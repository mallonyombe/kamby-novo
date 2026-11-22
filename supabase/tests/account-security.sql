-- Isolated, rolled-back fixtures. Never run against production.
begin;
insert into auth.users(id,email) values
 ('91000000-0000-0000-0000-000000000001','security-admin@example.invalid'),
 ('91000000-0000-0000-0000-000000000002','security-client@example.invalid'),
 ('91000000-0000-0000-0000-000000000003','security-merchant@example.invalid');
insert into kg_private.admins(user_id) values('91000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.aal','aal2',true);
select set_config('test.security_store',(public.kg_create_store('Security shop','','+258841234567','Maputo','draft')).id::text,true);
select public.kg_assign_merchant(current_setting('test.security_store')::uuid,auth.uid(),true);
select public.kg_review_store(current_setting('test.security_store')::uuid,'approved','Fixture com responsável');
reset role;
insert into kg_private.store_merchants(store_id,user_id) values(current_setting('test.security_store')::uuid,'91000000-0000-0000-0000-000000000003');
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"user_metadata":{"role":"admin","is_admin":true,"store_ids":["forged"]}}',true);
do $$declare v jsonb;begin
 v=public.kg_account_context();
 if v->'roles'<>'["customer"]'::jsonb or v->'merchant_store_ids'<>'[]'::jsonb or (v->>'admin_access')::boolean then raise exception 'FAIL forged metadata escalated';end if;
 begin perform public.kg_create_store('Forged shop','','+258841234567','','draft');raise exception 'FAIL client created store';exception when insufficient_privilege then null;end;
 begin insert into kg_private.admins(user_id) values(auth.uid());raise exception 'FAIL self granted admin';exception when insufficient_privilege then null;end;
 begin insert into kg_private.store_merchants(store_id,user_id) values(current_setting('test.security_store')::uuid,auth.uid());raise exception 'FAIL self assigned store';exception when insufficient_privilege then null;end;
 insert into public.kg_profiles(id,display_name)values(auth.uid(),'Cliente');
 begin insert into public.kg_profiles(id,display_name)values('91000000-0000-0000-0000-000000000003','Forged');raise exception 'FAIL profile owner forgery';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000003',true);
do $$declare v jsonb;begin
 v=public.kg_account_context();
 if not (v->'roles' ? 'merchant') or jsonb_array_length(v->'merchant_store_ids')<>1 then raise exception 'FAIL assigned merchant missing';end if;
 if (v->>'admin_access')::boolean then raise exception 'FAIL merchant became admin';end if;
 if exists(select 1 from public.kg_profiles) then raise exception 'FAIL cross-account profile read';end if;
 begin perform public.kg_create_store('Forged shop','','+258841234567','','draft');raise exception 'FAIL merchant created store';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
select public.kg_assign_merchant(current_setting('test.security_store')::uuid,'91000000-0000-0000-0000-000000000003',false);
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000003',true);
do $$begin
 if public.kg_account_context()->'roles' ? 'merchant' then raise exception 'FAIL revoked grant cached';end if;
 if kg_private.can_manage_store(current_setting('test.security_store')::uuid) then raise exception 'FAIL revoked merchant allowed';end if;
end$$;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.aal','aal1',true);
do $$declare v jsonb;begin
 v=public.kg_account_context();
 if not (v->>'admin_mfa_required')::boolean or (v->>'admin_access')::boolean or kg_private.is_admin() then raise exception 'FAIL MFA bypass';end if;
 begin perform public.kg_create_store('No MFA shop','','+258841234567','','draft');raise exception 'FAIL admin write without MFA';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.aal','aal2',true);
do $$begin
 if not (public.kg_account_context()->>'admin_access')::boolean then raise exception 'FAIL MFA admin denied';end if;
end$$;
select set_config('request.jwt.claim.sub','',true);
do $$begin
 begin perform public.kg_account_context();raise exception 'FAIL missing identity allowed';exception when insufficient_privilege then null;end;
end$$;
set local role anon;
do $$begin
 begin perform public.kg_account_context();raise exception 'FAIL anon private context';exception when insufficient_privilege then null;end;
 if not exists(select 1 from public.kg_stores where id=current_setting('test.security_store')::uuid) then raise exception 'FAIL guest browsing requires login';end if;
end$$;
rollback;
