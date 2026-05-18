-- Create RPC function for inserting documents (works with RLS)
create or replace function public.insert_document(
  p_filename text,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc_id uuid;
begin
  insert into public.documents (
    user_id,
    filename,
    storage_path,
    mime_type,
    size_bytes,
    status
  )
  values (
    auth.uid(),
    p_filename,
    p_storage_path,
    p_mime_type,
    p_size_bytes,
    'pending'
  )
  returning id into v_doc_id;
  
  return v_doc_id;
end;
$$;
