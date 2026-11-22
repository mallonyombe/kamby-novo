begin;
insert into auth.users(id,email) values('50000000-0000-0000-0000-000000000001','admin@invalid.example'),('50000000-0000-0000-0000-000000000002','seller@invalid.example'),('50000000-0000-0000-0000-000000000003','reader@invalid.example');
insert into public.kg_profiles(id,display_name) values('50000000-0000-0000-0000-000000000002','Responsável'),('50000000-0000-0000-0000-000000000003','Operador');
insert into kg_private.admins values('50000000-0000-0000-0000-000000000001',now());
insert into kg_private.operation_grants values('50000000-0000-0000-0000-000000000003','stores.read');
set local role authenticated;
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.aal','aal1',true);
do $$begin
 if public.kg_is_admin() or (public.kg_admin_context()->>'mfa_required')::boolean is not true then raise exception 'FAIL: admin without MFA';end if;
 begin perform public.kg_admin_read('stores');raise exception 'FAIL: read without MFA';exception when insufficient_privilege then null;end;
 begin perform public.kg_create_store('Denied','','+258841234567','','draft');raise exception 'FAIL: old RPC without MFA';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.aal','aal2',true);
do $$declare s jsonb;r jsonb;request uuid='51000000-0000-0000-0000-000000000001';store uuid='52000000-0000-0000-0000-000000000001';doc jsonb='{"name":"Loja Operacional","whatsapp_e164":"+258841234567","location":"Chongoene"}';rev timestamptz;begin
 s=public.kg_admin_store_write(request,store,null,'create',doc,'Criação autorizada');
 r=public.kg_admin_store_write(request,store,null,'create',doc,'Criação autorizada');if s<>r or (select count(*) from public.kg_stores)<>1 then raise exception 'FAIL: idempotency';end if;
 begin perform public.kg_admin_store_write(request,store,null,'create',doc||'{"name":"Outra"}', 'Criação autorizada');raise exception 'FAIL: request reuse';exception when invalid_parameter_value then null;end;
 rev=(s->>'updated_at')::timestamptz;
 begin perform public.kg_admin_store_write(gen_random_uuid(),store,rev,'decision','{"status":"approved"}','Activação');raise exception 'FAIL: activation without merchant';exception when invalid_parameter_value then null;end;
 s=public.kg_admin_store_write(gen_random_uuid(),store,rev,'access','{"user_id":"50000000-0000-0000-0000-000000000002","active":true}','Atribuição autorizada');
 s=public.kg_admin_store_write(gen_random_uuid(),store,(s->>'updated_at')::timestamptz,'decision','{"status":"pending"}','Pronta para análise');
 s=public.kg_admin_store_write(gen_random_uuid(),store,(s->>'updated_at')::timestamptz,'decision','{"status":"approved"}','Identidade verificada');
 begin perform public.kg_admin_store_write(gen_random_uuid(),store,rev,'identity',doc,'Versão anterior');raise exception 'FAIL: stale revision';exception when serialization_failure then null;end;
 begin perform public.kg_admin_store_write(gen_random_uuid(),store,(s->>'updated_at')::timestamptz,'access','{"user_id":"50000000-0000-0000-0000-000000000002","active":false}','Revogação');raise exception 'FAIL: revoke last responsible';exception when invalid_parameter_value then null;end;
 if (public.kg_admin_read('overview',p_days=>7)-'as_of')<>(public.kg_admin_read('overview',p_days=>30)-'as_of') then raise exception 'FAIL: snapshot changes with period';end if;
 if (public.kg_admin_read('stores',p_query=>'Loja')->>'total')::int<>1 then raise exception 'FAIL: search';end if;
 if jsonb_array_length(public.kg_admin_read('analytics',p_days=>30)->'rows')<>30 then raise exception 'FAIL: period';end if;
 if not exists(select 1 from public.kg_admin_decisions where operation='decision' and before_state->>'status'='pending' and after_state->>'status'='approved' and actor_id=auth.uid()) then raise exception 'FAIL: audit decision';end if;
end$$;
reset role;
create function kg_private.mock_audit_failure() returns trigger language plpgsql as $$begin raise exception 'Audit unavailable' using errcode='58000';end$$;
create trigger mock_audit_failure before insert on public.kg_admin_decisions for each row execute function kg_private.mock_audit_failure();
set local role authenticated;
do $$declare s public.kg_stores%rowtype;begin
 select * into s from public.kg_stores limit 1;
 begin perform public.kg_admin_store_write(gen_random_uuid(),s.id,s.updated_at,'decision','{"status":"suspended"}','Auditoria falha');raise exception 'FAIL: mutation without audit';exception when sqlstate '58000' then null;end;
 if (select status from public.kg_stores where id=s.id)<>'approved' then raise exception 'FAIL: partial write';end if;
end$$;
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000003',true);
do $$begin
 if public.kg_is_admin() then raise exception 'FAIL: reader becomes admin';end if;
 if (public.kg_admin_read('stores')->>'total')::int<>1 then raise exception 'FAIL: explicit read permission';end if;
 begin perform public.kg_admin_read('users');raise exception 'FAIL: role crosses scope';exception when insufficient_privilege then null;end;
 begin perform public.kg_admin_store_write(gen_random_uuid(),gen_random_uuid(),null,'create','{}','Unauthorized');raise exception 'FAIL: reader writes';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000002',true);
do $$begin
 begin perform public.kg_admin_context();raise exception 'FAIL: seller enters admin';exception when insufficient_privilege then null;end;
 if (select count(*) from public.kg_admin_decisions)<>0 then raise exception 'FAIL: audit exposed';end if;
end$$;
rollback;
