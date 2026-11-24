begin;
insert into auth.users(id,email) values('96000000-0000-4000-8000-000000000001','detail@example.invalid');
insert into public.kg_profiles(id,display_name) values('96000000-0000-4000-8000-000000000001','Detalhe');
insert into kg_private.admins(user_id) values('96000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000001',true),set_config('request.jwt.claim.aal','aal1',true);
do $$ begin
 begin perform public.kg_admin_detail('users','96000000-0000-4000-8000-000000000001');raise exception 'MFA bypass';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.aal','aal2',true);
do $$ begin
 if public.kg_admin_detail('users','96000000-0000-4000-8000-000000000001')->'record'->>'display_name'<>'Detalhe' then raise exception 'Wrong identity';end if;
 begin perform public.kg_admin_detail('users','96000000-0000-4000-8000-000000000001',-1);raise exception 'Negative offset';exception when invalid_parameter_value then null;end;
 begin perform public.kg_admin_detail('users','96000000-0000-4000-8000-000000000099');raise exception 'Missing identity';exception when no_data_found then null;end;
end $$;
rollback;
