begin;
select set_config('request.jwt.claim.aal','aal2',true);
insert into auth.users(id,email) values ('30000000-0000-0000-0000-000000000001','editor-admin@example.invalid'),('30000000-0000-0000-0000-000000000002','editor-merchant@example.invalid'),('30000000-0000-0000-0000-000000000003','editor-other@example.invalid');
insert into kg_private.admins(user_id) values('30000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
select set_config('test.edit_store',(public.kg_create_store('Editor store','','+258841234567','Chongoene','draft')).id::text,true);
select public.kg_assign_merchant(current_setting('test.edit_store')::uuid,auth.uid(),true);
select public.kg_review_store(current_setting('test.edit_store')::uuid,'approved','Fixture com responsável');
select set_config('test.edit_other',(public.kg_create_store('Other editor store','','+258851234567','Chongoene','draft')).id::text,true);
select public.kg_assign_merchant(current_setting('test.edit_other')::uuid,auth.uid(),true);
select public.kg_review_store(current_setting('test.edit_other')::uuid,'approved','Fixture com responsável');
select public.kg_assign_merchant(current_setting('test.edit_store')::uuid,'30000000-0000-0000-0000-000000000002',true);
select set_config('test.edit_category',(select id::text from public.kg_categories where is_active limit 1),true);
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000002',true);
select set_config('test.edit_product',gen_random_uuid()::text,true);
do $$declare v_doc jsonb;v_result jsonb;v_id uuid=current_setting('test.edit_product')::uuid;v_store uuid=current_setting('test.edit_store')::uuid;v_request uuid=gen_random_uuid();v_variant uuid=gen_random_uuid();v_stamp timestamptz;v_store_doc jsonb;begin
 v_doc=jsonb_build_object('title','Draft without photograph','category_id',current_setting('test.edit_category'),'status','draft','price_minor',0,'images','[]'::jsonb,'variants','[]'::jsonb);
 v_result=public.kg_save_catalogue_product(v_request,v_store,v_id,null,v_doc);
 if v_result->>'status'<>'draft' then raise exception 'FAIL: draft not saved';end if;
 if public.kg_save_catalogue_product(v_request,v_store,v_id,null,v_doc)<>v_result then raise exception 'FAIL: exact retry changed';end if;
 begin perform public.kg_save_catalogue_product(v_request,v_store,v_id,null,v_doc||'{"title":"Different"}');raise exception 'FAIL: request reused';exception when invalid_parameter_value then null;end;
 begin perform public.kg_save_catalogue_product(gen_random_uuid(),current_setting('test.edit_other')::uuid,gen_random_uuid(),null,v_doc);raise exception 'FAIL: foreign edit';exception when insufficient_privilege then null;end;
 select updated_at into v_stamp from public.kg_products where id=v_id;
 begin perform public.kg_save_catalogue_product(gen_random_uuid(),v_store,v_id,v_stamp,v_doc||'{"status":"published","price_minor":100}');raise exception 'FAIL: publication without photo';exception when invalid_parameter_value then null;end;
 if (select status from public.kg_products where id=v_id)<>'draft' then raise exception 'FAIL: failed publication not atomic';end if;
 v_doc=v_doc||jsonb_build_object('variants',jsonb_build_array(jsonb_build_object('id',v_variant,'option_name','1 kg','price_minor',1000,'in_stock',true,'track_quantity',true,'stock_quantity',0)));
 v_result=public.kg_save_catalogue_product(gen_random_uuid(),v_store,v_id,v_stamp,v_doc);
 if (select in_stock from public.kg_product_variants where id=v_variant) then raise exception 'FAIL: tracked zero stock available';end if;
 if (select stock_status from public.kg_products where id=v_id)<>'out' then raise exception 'FAIL: aggregate stock';end if;
 select updated_at into v_stamp from public.kg_products where id=v_id;
 begin perform public.kg_save_catalogue_product(gen_random_uuid(),v_store,v_id,now()-interval '1 day',v_doc);raise exception 'FAIL: stale edit';exception when serialization_failure then null;end;
 begin perform public.kg_save_catalogue_product(gen_random_uuid(),v_store,v_id,v_stamp,v_doc||jsonb_build_object('variants',(v_doc->'variants')||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'option_name','1 KG','price_minor',900))));raise exception 'FAIL: duplicate case-insensitive option';exception when invalid_parameter_value then null;end;
 begin perform public.kg_save_catalogue_product(gen_random_uuid(),v_store,v_id,v_stamp,v_doc||jsonb_build_object('variants',jsonb_build_array(jsonb_build_object('id',v_variant,'option_name','1 kg','price_minor',1000,'previous_price_minor',900))));raise exception 'FAIL: invalid promotion';exception when invalid_parameter_value then null;end;
 v_result=public.kg_save_catalogue_product(gen_random_uuid(),v_store,v_id,v_stamp,v_doc||'{"variants":[]}');
 if not exists(select 1 from public.kg_product_variants where id=v_variant and not active and option_name='1 kg') then raise exception 'FAIL: retired variant identity or label lost';end if;
 select jsonb_build_object('name','Edited identity','description','Real description','whatsapp_e164','+258841112222','location','Chongoene','address','Centro','service_area','Chongoene','opening_hours',jsonb_build_array(jsonb_build_object('day',0,'closed',false,'open','08:00','close','17:00'))) into v_store_doc;
 perform public.kg_save_store_settings(v_store,(select updated_at from public.kg_stores where id=v_store),v_store_doc);
 if not exists(select 1 from public.kg_stores where id=v_store and name='Edited identity' and status='approved') then raise exception 'FAIL: settings persistence';end if;
 begin update public.kg_stores set status='suspended' where id=v_store;raise exception 'FAIL: merchant moderates store';exception when insufficient_privilege then null;end;
 begin update public.kg_products set status='published' where id=v_id;raise exception 'FAIL: direct publication bypass';exception when insufficient_privilege then null;end;
 if (public.kg_merchant_activity(v_store)->'recent')='[]'::jsonb then raise exception 'FAIL: no catalogue events';end if;
end$$;
-- Verify the persisted change record through the administrative reader.
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
do $$
begin
 if not exists (
   select 1
   from jsonb_array_elements(public.kg_admin_read('store', p_store_id=>current_setting('test.edit_store')::uuid)->'history') as event
   where event->>'actor_id'='30000000-0000-0000-0000-000000000002'
     and event #>> '{metadata,changes,name,before}'='Editor store'
     and event #>> '{metadata,changes,name,after}'='Edited identity'
     and event #>> '{metadata,changes,opening_hours,after,0,close}'='17:00'
     and not (event->'metadata'->'changes' ? 'location')
 ) then raise exception 'FAIL: store history must retain changed fields and the author'; end if;
end$$;
-- Local-only Storage metadata mock. Hosted tests use actual Storage uploads instead.
reset role;
select set_config('test.edit_photo','30000000-0000-0000-0000-000000000002/'||current_setting('test.edit_store')||'/'||current_setting('test.edit_product')||'/11111111-1111-4111-8111-111111111111.png',true);
select set_config('test.edit_photo2','30000000-0000-0000-0000-000000000002/'||current_setting('test.edit_store')||'/'||current_setting('test.edit_product')||'/22222222-2222-4222-8222-222222222222.png',true);
insert into storage.objects(bucket_id,name,metadata) values('kg-product-images',current_setting('test.edit_photo'),'{"mimetype":"image/png","size":200}'),('kg-product-images',current_setting('test.edit_photo2'),'{"mimetype":"image/png","size":300}');
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000002',true);
do $$declare v_id uuid=current_setting('test.edit_product')::uuid;v_store uuid=current_setting('test.edit_store')::uuid;v_variant uuid=gen_random_uuid();v_stamp timestamptz;v_doc jsonb;begin
 select updated_at into v_stamp from public.kg_products where id=v_id;
 v_doc=jsonb_build_object('title','Published with gallery','category_id',current_setting('test.edit_category'),'status','published','images',jsonb_build_array(current_setting('test.edit_photo2'),current_setting('test.edit_photo')),'variants',jsonb_build_array(jsonb_build_object('id',v_variant,'option_name','500 ml','price_minor',8550,'previous_price_minor',10000,'in_stock',true,'track_quantity',true,'stock_quantity',7,'image_path',current_setting('test.edit_photo'))));
 perform public.kg_save_catalogue_product(gen_random_uuid(),v_store,v_id,v_stamp,v_doc);
 if (select count(*) from public.kg_product_images where product_id=v_id)<>2 or not exists(select 1 from public.kg_product_images where product_id=v_id and storage_path=current_setting('test.edit_photo2') and sort_order=0) then raise exception 'FAIL: ordered gallery';end if;
 if not exists(select 1 from public.kg_product_variants where id=v_variant and active and stock_quantity=7 and previous_price_minor=10000 and image_path=current_setting('test.edit_photo')) then raise exception 'FAIL: full variant persistence';end if;
 if kg_private.can_remove_product_upload(current_setting('test.edit_photo')) then raise exception 'FAIL: published media removable';end if;
 select updated_at into v_stamp from public.kg_products where id=v_id;
 perform public.kg_save_catalogue_product(gen_random_uuid(),v_store,v_id,v_stamp,v_doc||'{"title":"Renamed product"}');
 if (select count(*) from public.kg_product_variants where product_id=v_id and active)<>1 or not exists(select 1 from public.kg_product_variants where id=v_variant and active) then raise exception 'FAIL: edit replaced variant identity';end if;
end$$;
reset role;
rollback;
