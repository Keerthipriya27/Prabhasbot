-- PrabhasBot RAG Database Setup
-- Run this in Supabase SQL Editor

-- Enable vector extension for embeddings
create extension if not exists vector;

-- Documents table
create table if not exists public.documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  status text default 'pending',
  chunk_count integer default 0,
  error text,
  created_at timestamp default now()
);

-- Document chunks with embeddings
create table if not exists public.document_chunks (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid not null references documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer,
  content text not null,
  embedding vector(1536),
  created_at timestamp default now()
);

-- Vector similarity index for fast retrieval
create index if not exists document_chunks_embedding_idx on public.document_chunks using ivfflat (embedding vector_cosine_ops);

-- RLS policies
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;

create policy "Users can view their own documents" on public.documents
  for select using (auth.uid() = user_id);

create policy "Users can insert their own documents" on public.documents
  for insert with check (auth.uid() = user_id);

create policy "Users can delete their own documents" on public.documents
  for delete using (auth.uid() = user_id);

create policy "Users can update their own documents" on public.documents
  for update using (auth.uid() = user_id);

create policy "Users can view their own chunks" on public.document_chunks
  for select using (auth.uid() = user_id);

create policy "Users can insert their own chunks" on public.document_chunks
  for insert with check (auth.uid() = user_id);

create policy "Users can delete their own chunks" on public.document_chunks
  for delete using (auth.uid() = user_id);

-- Match function for retrieval
create or replace function public.match_document_chunks(
  query_embedding vector,
  match_count int default 5
) returns table(id uuid, filename text, content text) as $$
  select dc.id, d.filename, dc.content
  from public.document_chunks dc
  join public.documents d on dc.document_id = d.id
  where dc.user_id = auth.uid()
  order by dc.embedding <-> query_embedding
  limit match_count;
$$ language sql;
