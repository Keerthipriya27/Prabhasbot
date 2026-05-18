-- Fix RLS policies for documents table
-- Drop existing policies
drop policy if exists "Users view own documents" on public.documents;
drop policy if exists "Users insert own documents" on public.documents;
drop policy if exists "Users update own documents" on public.documents;
drop policy if exists "Users delete own documents" on public.documents;

-- Recreate with proper settings
create policy "Users view own documents" on public.documents
  for select
  using (auth.uid() = user_id);

create policy "Users insert own documents" on public.documents
  for insert
  with check (auth.uid() = user_id);

create policy "Users update own documents" on public.documents
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own documents" on public.documents
  for delete
  using (auth.uid() = user_id);

-- Fix document chunks policies
drop policy if exists "Users view own chunks" on public.document_chunks;
drop policy if exists "Users insert own chunks" on public.document_chunks;
drop policy if exists "Users delete own chunks" on public.document_chunks;

create policy "Users view own chunks" on public.document_chunks
  for select
  using (auth.uid() = user_id);

create policy "Users insert own chunks" on public.document_chunks
  for insert
  with check (auth.uid() = user_id);

create policy "Users delete own chunks" on public.document_chunks
  for delete
  using (auth.uid() = user_id);

-- Drop existing trigger if it exists
drop trigger if exists set_documents_user_id on public.documents;

-- Create trigger to automatically set user_id on insert
create or replace function public.set_documents_user_id()
returns trigger language plpgsql set search_path = public as $$
begin
  new.user_id = auth.uid();
  return new;
end;
$$;

create trigger set_documents_user_id
  before insert on public.documents
  for each row
  execute function public.set_documents_user_id();

