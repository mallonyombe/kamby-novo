begin;
insert into auth.users(id,email,phone,last_sign_in_at) values
 ('96200000-0000-4000-8000-000000000001','gestor@example.invalid',null,null),
 ('96200000-0000-4000-8000-000000000002','operador@example.invalid',null,null),
 ('96200000-0000-4000-8000-000000000003','cliente@example.invalid','+258841234567','2026-11-27 12:00Z');
insert into public.kg_profiles(id,display_name,location)
values('96200000-0000-4000-8000-000000000003','Cliente Ensaio','Chongoene');
insert into kg_private.admins(user_id) values('96200000-0000-4000-8000-000000000001');
insert into kg_private.operation_grants(user_id,permission) values('96200000-0000-4000-8000-000000000002','users.read');
insert into storage.objects(bucket_id,name,owner_id)
values('kg-profile-photos','96200000-0000-4000-8000-000000000003/avatar','96200000-0000-4000-8000-000000000003');

set local role authenticated;
select set_config('request.jwt.claim.aal','aal2',true);
select set_config('request.jwt.claim.sub','96200000-0000-4000-8000-000000000002',true);
do $$
declare
 profile jsonb := public.kg_admin_detail('users','96200000-0000-4000-8000-000000000003')->'record';
 directory_entry jsonb := public.kg_admin_read('users',p_query=>'Cliente Ensaio')->'rows'->0;
begin
 if profile->>'display_name' is distinct from 'Cliente Ensaio' or profile->>'location' is distinct from 'Chongoene' then
  raise exception 'Ficha delegada perdeu dados operacionais';
 end if;
 if profile->'email' is distinct from 'null'::jsonb
    or profile->'phone' is distinct from 'null'::jsonb
    or profile->'last_sign_in_at' is distinct from 'null'::jsonb
    or profile->'has_photo' is distinct from 'false'::jsonb then
  raise exception 'Dados privados na ficha delegada';
 end if;
 if directory_entry->>'display_name' is distinct from 'Cliente Ensaio'
    or directory_entry ?| array['email','phone','last_sign_in_at','has_photo'] then
  raise exception 'Directório delegado forneceu dados privados ou perdeu a identidade operacional';
 end if;
 if exists(select 1 from storage.objects where bucket_id='kg-profile-photos') then
  raise exception 'Fotografia disponível à consulta delegada';
 end if;
end $$;

select set_config('request.jwt.claim.sub','96200000-0000-4000-8000-000000000001',true);
do $$
declare profile jsonb := public.kg_admin_detail('users','96200000-0000-4000-8000-000000000003')->'record';
begin
 if profile->>'email' is distinct from 'cliente@example.invalid'
    or profile->>'phone' is distinct from '+258841234567'
    or profile->>'last_sign_in_at' is null
    or profile->'has_photo' is distinct from 'true'::jsonb then
  raise exception 'Acesso privado do gestor integral indisponível';
 end if;
 if not exists(select 1 from storage.objects where bucket_id='kg-profile-photos') then
  raise exception 'Fotografia indisponível ao gestor integral';
 end if;
end $$;

select set_config('request.jwt.claim.sub','96200000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claim.aal','aal1',true);
do $$ begin
 if not exists(select 1 from storage.objects where bucket_id='kg-profile-photos') then
  raise exception 'Acesso à fotografia do próprio perfil indisponível';
 end if;
end $$;
rollback;
