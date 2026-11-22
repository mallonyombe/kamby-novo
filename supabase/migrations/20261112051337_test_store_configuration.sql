-- Explicitly marked test merchants use the same catalogue and RLS as real stores.
alter table public.kg_stores add column is_test boolean not null default false;
grant insert(is_test),update(is_test) on public.kg_stores to authenticated;
-- Existing merchant guard permits only is_open/updated_at, so merchants cannot change this flag.
notify pgrst,'reload schema';
