begin;
insert into auth.users(id,email)values
 ('94000000-0000-0000-0000-000000000001','seller-admin@example.invalid'),
 ('94000000-0000-0000-0000-000000000002','seller-new@example.invalid'),
 ('94000000-0000-0000-0000-000000000003','seller-buyer@example.invalid');
insert into public.kg_profiles(id,display_name)
select id,split_part(email,'@',1) from auth.users where email like 'seller-%@example.invalid';
insert into kg_private.admins values('94000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','94000000-0000-0000-0000-000000000002',true),
 set_config('request.jwt.claim.aal','aal1',true);
do $$begin
 if (public.kg_account_context()->>'seller_onboarding')::boolean then raise exception 'Client shown seller entry';end if;
 begin perform public.kg_admin_activate_seller(auth.uid());raise exception 'Self-activation accepted';exception when insufficient_privilege then null;end;
 begin perform public.kg_create_seller_store('Shop','+258841234567');raise exception 'Unactivated user created store';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','94000000-0000-0000-0000-000000000001',true);
do $$begin
 begin perform public.kg_admin_activate_seller('94000000-0000-0000-0000-000000000002');raise exception 'MFA bypass';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.aal','aal2',true);
select public.kg_admin_activate_seller('94000000-0000-0000-0000-000000000002');
select public.kg_admin_activate_seller('94000000-0000-0000-0000-000000000002');
do $$begin
 if (public.kg_admin_read('users','seller-new')->'rows'->0->>'seller_active')::boolean is distinct from true then raise exception 'Admin card missing seller state';end if;
end$$;
select set_config('request.jwt.claim.sub','94000000-0000-0000-0000-000000000002',true),
 set_config('request.jwt.claim.aal','aal1',true);
do $$begin
 if not (public.kg_account_context()->>'seller_onboarding')::boolean then raise exception 'Seller entry missing';end if;
 if (select count(*) from public.kg_notifications where action='seller_setup')<>1 then raise exception 'Seller notification missing or duplicated';end if;
 if exists(select 1 from public.kg_my_managed_stores()) then raise exception 'Activation created a store';end if;
end$$;
select set_config('test.seller_store',public.kg_create_seller_store('Nova loja','+258 84 123 4567')::text,true);
do $$declare s uuid=current_setting('test.seller_store')::uuid;begin
 if s<>public.kg_create_seller_store('Nova loja','+258 84 123 4567') then raise exception 'Retry created a duplicate store';end if;
 if not exists(select 1 from public.kg_stores where id=s and owner_id=auth.uid() and status='draft') then raise exception 'Private owner draft missing';end if;
 if not exists(select 1 from public.kg_store_categories where store_id=s) then raise exception 'Draft lacks catalogue categories';end if;
 if (public.kg_account_context()->>'seller_onboarding')::boolean then raise exception 'Setup still offered after creation';end if;
 if not (public.kg_account_context()->'merchant_store_ids' ? s::text) then raise exception 'Merchant workspace is not accessible';end if;
end$$;
select set_config('request.jwt.claim.sub','94000000-0000-0000-0000-000000000003',true);
do $$declare s uuid=current_setting('test.seller_store')::uuid;begin
 if exists(select 1 from public.kg_stores where id=s) or exists(select 1 from public.kg_notifications where action='seller_setup') then raise exception 'Private data disclosed';end if;
 begin perform public.kg_submit_seller_store(s);raise exception 'Another user submitted the store';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','94000000-0000-0000-0000-000000000002',true);
select public.kg_submit_seller_store(current_setting('test.seller_store')::uuid);
select public.kg_submit_seller_store(current_setting('test.seller_store')::uuid);
select set_config('request.jwt.claim.sub','94000000-0000-0000-0000-000000000001',true),
 set_config('request.jwt.claim.aal','aal2',true);
do $$declare s uuid=current_setting('test.seller_store')::uuid;rev timestamptz;begin
 select updated_at into rev from public.kg_stores where id=s and status='pending';
 if rev is null then raise exception 'Store has not reached the management review queue';end if;
 begin perform public.kg_assign_merchant(s,'94000000-0000-0000-0000-000000000003',true);raise exception 'Legacy assignment accepted';exception when insufficient_privilege then null;end;
 perform public.kg_admin_store_write(gen_random_uuid(),s,rev,'decision','{"status":"approved"}','Revisão concluída');
end$$;
set local role anon;
do $$begin
 if not exists(select 1 from public.kg_stores where id=current_setting('test.seller_store')::uuid and status='approved') then raise exception 'Approved seller store is not public';end if;
end$$;
rollback;
