-- Enable pgvector
create extension if not exists vector;

-- Documents table (file metadata)
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  status text not null default 'pending', -- pending | processing | ready | error
  error text,
  chunk_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_user_id_idx on public.documents(user_id, created_at desc);

alter table public.documents enable row level security;

create policy "Users view own documents" on public.documents
  for select using (auth.uid() = user_id);
create policy "Users insert own documents" on public.documents
  for insert with check (auth.uid() = user_id);
create policy "Users update own documents" on public.documents
  for update using (auth.uid() = user_id);
create policy "Users delete own documents" on public.documents
  for delete using (auth.uid() = user_id);

-- Document chunks with embeddings
create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index document_chunks_document_id_idx on public.document_chunks(document_id);
create index document_chunks_user_id_idx on public.document_chunks(user_id);
create index document_chunks_embedding_idx on public.document_chunks
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table public.document_chunks enable row level security;

create policy "Users view own chunks" on public.document_chunks
  for select using (auth.uid() = user_id);
create policy "Users insert own chunks" on public.document_chunks
  for insert with check (auth.uid() = user_id);
create policy "Users delete own chunks" on public.document_chunks
  for delete using (auth.uid() = user_id);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create trigger documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

-- Vector search function (scoped to caller)
create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id uuid,
  document_id uuid,
  filename text,
  content text,
  similarity float
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  return query
  select
    c.id,
    c.document_id,
    d.filename,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.user_id = auth.uid()
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Storage bucket for uploaded documents (private)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Storage policies: files stored under {user_id}/{filename}
create policy "Users read own document files" on storage.objects
  for select using (
    bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "Users upload own document files" on storage.objects
  for insert with check (
    bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "Users delete own document files" on storage.objects
  for delete using (
    bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]
  );