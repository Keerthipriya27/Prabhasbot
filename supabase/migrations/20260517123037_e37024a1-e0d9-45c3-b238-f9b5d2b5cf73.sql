create schema if not exists extensions;
alter extension vector set schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;