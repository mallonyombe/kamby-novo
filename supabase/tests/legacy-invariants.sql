-- Final-schema regression: fixtures use the actual draft -> assign -> approve path.
begin;
insert into auth.users(id,email) values
 ('95000000-0000-0000-0000-000000000001','legacy-admin@example.invalid'),
 ('95000000-0000-0000-0000-000000000002','legacy-seller@example.invalid'),
 ('95000000-0000-0000-0000-000000000003','legacy-second@example.invalid');
insert into public.kg_profiles(id,display_name)values('95000000-0000-0000-0000-000000000002','Vendedor'),('95000000-0000-0000-0000-000000000003','Segundo');
insert into kg_private.admins(user_id)values('95000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','95000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.aal','aal2',true);
do $$begin
 begin perform public.kg_create_store('Premature','','+258841234567','','approved');raise exception 'FAIL legacy creates approved without responsible';exception when invalid_parameter_value then null;end;
 begin insert into public.kg_stores(owner_id,name,slug,whatsapp_e164,status)values(auth.uid(),'Premature direct','premature-direct','+258841234567','approved');raise exception 'FAIL direct creates approved';exception when invalid_parameter_value then null;end;
end$$;
select set_config('test.invariant_store',(public.kg_create_store('Invariant store','','+258841234567','','draft')).id::text,true);
do $$declare s uuid=current_setting('test.invariant_store')::uuid;begin
 begin perform public.kg_review_store(s,'approved','Premature');raise exception 'FAIL legacy review activates without responsible';exception when invalid_parameter_value then null;end;
 begin update public.kg_stores set status='approved' where id=s;raise exception 'FAIL direct status activates without responsible';exception when invalid_parameter_value then null;end;
end$$;
select public.kg_assign_merchant(current_setting('test.invariant_store')::uuid,'95000000-0000-0000-0000-000000000002',true);
select public.kg_review_store(current_setting('test.invariant_store')::uuid,'approved','Valid responsible');
select set_config('test.invariant_version',(select updated_at::text from public.kg_stores where id=current_setting('test.invariant_store')::uuid),true);
do $$declare s uuid=current_setting('test.invariant_store')::uuid;begin
 begin perform public.kg_assign_merchant(s,'95000000-0000-0000-0000-000000000002',false);raise exception 'FAIL legacy removes final responsible';exception when invalid_parameter_value then null;end;
end$$;
select public.kg_assign_merchant(current_setting('test.invariant_store')::uuid,'95000000-0000-0000-0000-000000000003',true);
do $$declare s uuid=current_setting('test.invariant_store')::uuid;begin
 if (select updated_at from public.kg_stores where id=s)=current_setting('test.invariant_version')::timestamptz then raise exception 'FAIL membership did not invalidate store revision';end if;
 begin perform public.kg_admin_store_write(gen_random_uuid(),s,current_setting('test.invariant_version')::timestamptz,'decision','{"status":"suspended"}','Stale state');raise exception 'FAIL stale admin write after legacy membership';exception when serialization_failure then null;end;
end$$;
select public.kg_assign_merchant(current_setting('test.invariant_store')::uuid,'95000000-0000-0000-0000-000000000002',false);
reset role;
do $$begin
 begin delete from kg_private.store_merchants where store_id=current_setting('test.invariant_store')::uuid and user_id='95000000-0000-0000-0000-000000000003';raise exception 'FAIL internal delete final responsible';exception when invalid_parameter_value then null;end;
 if (select count(*) from kg_private.store_merchants where store_id=current_setting('test.invariant_store')::uuid and active)<>1 then raise exception 'FAIL membership invariant';end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.aal','aal1',true);
do $$begin
 begin perform public.kg_assign_merchant(current_setting('test.invariant_store')::uuid,'95000000-0000-0000-0000-000000000002',true);raise exception 'FAIL no-MFA legacy assignment';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','95000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claim.aal','aal2',true);
do $$begin
 begin perform public.kg_assign_merchant(current_setting('test.invariant_store')::uuid,auth.uid(),true);raise exception 'FAIL merchant self assignment';exception when insufficient_privilege then null;end;
end$$;
rollback;
