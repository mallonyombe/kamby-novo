begin;
select set_config('request.jwt.claim.aal','aal2',true);
insert into auth.users(id,email) values
 ('10000000-0000-0000-0000-000000000001','merchant-admin@example.invalid'),
 ('10000000-0000-0000-0000-000000000002','assigned-merchant@example.invalid'),
 ('10000000-0000-0000-0000-000000000003','other-merchant@example.invalid');
insert into kg_private.admins(user_id) values('10000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select set_config('test.merchant_store',(public.kg_create_store('Merchant A','','+258841234567','Chongoene','draft')).id::text,true);
select public.kg_assign_merchant(current_setting('test.merchant_store')::uuid,auth.uid(),true);
select public.kg_review_store(current_setting('test.merchant_store')::uuid,'approved','Fixture com responsável');
select set_config('test.other_store',(public.kg_create_store('Merchant B','','+258851234567','Chongoene','draft')).id::text,true);
select public.kg_assign_merchant(current_setting('test.other_store')::uuid,auth.uid(),true);
select public.kg_review_store(current_setting('test.other_store')::uuid,'approved','Fixture com responsável');
select public.kg_assign_merchant(current_setting('test.merchant_store')::uuid,'10000000-0000-0000-0000-000000000002',true);
with p as(insert into public.kg_products(store_id,title,price_minor,status) values(current_setting('test.merchant_store')::uuid,'Simple',12000,'published') returning id)
select set_config('test.simple_product',id::text,true) from p;
with p as(insert into public.kg_products(store_id,title,price_minor,status) values(current_setting('test.merchant_store')::uuid,'Variant product',10000,'published') returning id)
select set_config('test.variant_product',id::text,true) from p;
with v as(insert into public.kg_product_variants(product_id,sku,option_name,price_minor) values(current_setting('test.variant_product')::uuid,'merch-test-1','1 kg',10000) returning id)
select set_config('test.variant',id::text,true) from v;
with p as(insert into public.kg_products(store_id,title,price_minor,status) values(current_setting('test.other_store')::uuid,'Other shop product',10000,'published') returning id)
select set_config('test.other_product',id::text,true) from p;
insert into public.kg_products(store_id,title,price_minor,status) values(current_setting('test.merchant_store')::uuid,'Own draft',10000,'draft');
insert into public.kg_products(store_id,title,price_minor,status) values(current_setting('test.other_store')::uuid,'Foreign draft',10000,'draft');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
insert into public.kg_store_events(id,store_id,kind) values(gen_random_uuid(),current_setting('test.merchant_store')::uuid,'store_view');
insert into public.kg_store_events(id,store_id,kind) values(gen_random_uuid(),current_setting('test.merchant_store')::uuid,'whatsapp_click');
do $$begin
 begin perform public.kg_my_managed_stores();raise exception 'FAIL: anon opens merchant access'; exception when insufficient_privilege then null;end;
 begin perform * from public.kg_store_events;raise exception 'FAIL: anonymous reads analytics';exception when insufficient_privilege then null;end;
 begin insert into public.kg_store_events(id,store_id,kind,created_at) values(gen_random_uuid(),current_setting('test.merchant_store')::uuid,'store_view',now()-interval '1 year');raise exception 'FAIL: event time forged';exception when insufficient_privilege then null;end;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$declare v_product public.kg_products%rowtype;v_result jsonb;changed integer;begin
 if (select count(*) from public.kg_my_managed_stores())<>1 then raise exception 'FAIL: merchant lists another shop';end if;
 if (select count(*) from public.kg_products where title='Own draft')<>1 then raise exception 'FAIL: own draft invisible';end if;
 if exists(select 1 from public.kg_products where title='Foreign draft') then raise exception 'FAIL: foreign draft leaked';end if;
 if (public.kg_merchant_metrics(current_setting('test.merchant_store')::uuid)->>'store_views')::int<>1 then raise exception 'FAIL: visits metric';end if;
 if (public.kg_merchant_metrics(current_setting('test.merchant_store')::uuid)->>'whatsapp_clicks')::int<>1 then raise exception 'FAIL: click metric';end if;
 begin perform public.kg_merchant_metrics(current_setting('test.other_store')::uuid);raise exception 'FAIL: foreign metrics';exception when insufficient_privilege then null;end;
 begin perform public.kg_assign_merchant(current_setting('test.other_store')::uuid,auth.uid(),true);raise exception 'FAIL: self-assignment';exception when insufficient_privilege then null;end;
 begin update public.kg_stores set name='Hijacked' where id=current_setting('test.merchant_store')::uuid;raise exception 'FAIL: merchant changes store identity';exception when insufficient_privilege then null;end;
 begin update public.kg_stores set is_test=true where id=current_setting('test.merchant_store')::uuid;raise exception 'FAIL: merchant can change test-store classification';exception when insufficient_privilege then null;end;
 update public.kg_stores set is_open=false where id=current_setting('test.merchant_store')::uuid;
 if not exists(select 1 from public.kg_stores where id=current_setting('test.merchant_store')::uuid and not is_open) then raise exception 'FAIL: closing store not persisted';end if;
 update public.kg_stores set is_open=false where id=current_setting('test.other_store')::uuid;get diagnostics changed=row_count;
 if changed<>0 then raise exception 'FAIL: closes another shop';end if;
 begin update public.kg_products set title='Hijacked' where id=current_setting('test.simple_product')::uuid;raise exception 'FAIL: merchant changes product identity';exception when insufficient_privilege then null;end;
 select * into v_product from public.kg_products where id=current_setting('test.simple_product')::uuid;
 v_result=public.kg_merchant_update_item(v_product.id,null,12550,false,v_product.updated_at);
 if not exists(select 1 from public.kg_products where id=v_product.id and price_minor=12550 and stock_status='out') then raise exception 'FAIL: exact price and stock update';end if;
 begin perform public.kg_merchant_update_item(v_product.id,null,1,true,now()-interval '1 day');raise exception 'FAIL: stale editor overwrites';exception when serialization_failure then null;end;
 begin perform public.kg_merchant_update_item(current_setting('test.other_product')::uuid,null,1,true,now());raise exception 'FAIL: cross-store write';exception when insufficient_privilege then null;end;
 begin update public.kg_product_variants set sku='changed' where id=current_setting('test.variant')::uuid;raise exception 'FAIL: merchant changes variant identity';exception when insufficient_privilege then null;end;
 perform public.kg_merchant_update_item(current_setting('test.variant_product')::uuid,current_setting('test.variant')::uuid,23456,false,(select updated_at from public.kg_product_variants where id=current_setting('test.variant')::uuid));
 if not exists(select 1 from public.kg_product_variants where id=current_setting('test.variant')::uuid and price_minor=23456 and not in_stock) then raise exception 'FAIL: variant edit';end if;
 if not exists(select 1 from public.kg_products where id=current_setting('test.variant_product')::uuid and stock_status='out') then raise exception 'FAIL: variant stock not reflected in base product';end if;
end$$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
do $$begin
 if exists(select 1 from public.kg_my_managed_stores()) then raise exception 'FAIL: unassigned account sees management';end if;
 if exists(select 1 from public.kg_store_events) then raise exception 'FAIL: foreign analytics leaked';end if;
end$$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select public.kg_assign_merchant(current_setting('test.merchant_store')::uuid,'10000000-0000-0000-0000-000000000002',false);
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$declare changed integer;begin
 if exists(select 1 from public.kg_my_managed_stores()) then raise exception 'FAIL: revoked merchant retains access';end if;
 update public.kg_products set price_minor=500 where id=current_setting('test.simple_product')::uuid;get diagnostics changed=row_count;
 if changed<>0 then raise exception 'FAIL: revoked merchant writes';end if;
end$$;
rollback;
