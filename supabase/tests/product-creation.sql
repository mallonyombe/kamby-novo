-- LOCAL ONLY: storage.objects here is the PGlite substitute, not the Storage service.
begin;
select set_config('request.jwt.claim.aal','aal2',true);
insert into auth.users(id,email) values
 ('20000000-0000-0000-0000-000000000001','create-admin@example.invalid'),
 ('20000000-0000-0000-0000-000000000002','create-merchant@example.invalid'),
 ('20000000-0000-0000-0000-000000000003','create-outsider@example.invalid');
insert into kg_private.admins(user_id) values('20000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
select set_config('test.create_store',(public.kg_create_store('New Product Shop','','+258841234567','Chongoene','draft')).id::text,true);
select public.kg_assign_merchant(current_setting('test.create_store')::uuid,auth.uid(),true);
select public.kg_review_store(current_setting('test.create_store')::uuid,'approved','Fixture com responsável');
select set_config('test.foreign_store',(public.kg_create_store('Foreign Product Shop','','+258851234567','Chongoene','draft')).id::text,true);
select public.kg_assign_merchant(current_setting('test.foreign_store')::uuid,auth.uid(),true);
select public.kg_review_store(current_setting('test.foreign_store')::uuid,'approved','Fixture com responsável');
select public.kg_assign_merchant(current_setting('test.create_store')::uuid,'20000000-0000-0000-0000-000000000002',true);
select set_config('test.create_category',(select id::text from public.kg_categories where slug='casa'),true);
select set_config('test.create_id',gen_random_uuid()::text,true);
select set_config('test.simple_id',gen_random_uuid()::text,true);
select set_config('test.fail_id',gen_random_uuid()::text,true);
select set_config('test.cleanup_id',gen_random_uuid()::text,true);
-- Force a failure after the product insert by reserving the generated variant SKU.
insert into public.kg_products(store_id,title,price_minor,status) values(current_setting('test.create_store')::uuid,'Existing SKU holder',10000,'published');
insert into public.kg_product_variants(product_id,sku,option_name,price_minor)
select id,'KB-' || replace(current_setting('test.fail_id'),'-','') || '-1','Reserved',10000 from public.kg_products where title='Existing SKU holder';
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
select set_config('test.create_path',public.kg_product_upload_context(current_setting('test.create_store')::uuid,current_setting('test.create_id')::uuid,'png')->>'path',true);
select set_config('test.simple_path',public.kg_product_upload_context(current_setting('test.create_store')::uuid,current_setting('test.simple_id')::uuid,'jpg')->>'path',true);
select set_config('test.fail_path',public.kg_product_upload_context(current_setting('test.create_store')::uuid,current_setting('test.fail_id')::uuid,'png')->>'path',true);
select set_config('test.cleanup_path',public.kg_product_upload_context(current_setting('test.create_store')::uuid,current_setting('test.cleanup_id')::uuid,'png')->>'path',true);
do $$begin
 begin perform public.kg_product_upload_context(current_setting('test.foreign_store')::uuid,gen_random_uuid(),'png');raise exception 'FAIL: upload context for foreign store';exception when insufficient_privilege then null;end;
 begin perform public.kg_product_upload_context(current_setting('test.create_store')::uuid,gen_random_uuid(),'svg');raise exception 'FAIL: SVG accepted';exception when invalid_parameter_value then null;end;
 begin perform public.kg_merchant_create_product(current_setting('test.create_id')::uuid,current_setting('test.create_store')::uuid,current_setting('test.create_category')::uuid,'Jarro',45050,'500 ml','Cerâmica',current_setting('test.create_path'));raise exception 'FAIL: publish without upload';exception when invalid_parameter_value then null;end;
 if exists(select 1 from public.kg_products where id=current_setting('test.create_id')::uuid) then raise exception 'FAIL: failed publication left product';end if;
 begin insert into public.kg_products(store_id,title,price_minor,status) values(current_setting('test.create_store')::uuid,'Direct write',100,'published');raise exception 'FAIL: merchant direct INSERT';exception when insufficient_privilege then null;end;
end$$;
-- Simulate successful API uploads in the local metadata substitute only.
insert into storage.objects(bucket_id,name,metadata) values
 ('kg-product-images',current_setting('test.create_path'),'{"mimetype":"image/png","size":128}'),
 ('kg-product-images',current_setting('test.simple_path'),'{"mimetype":"image/jpeg","size":128}'),
 ('kg-product-images',current_setting('test.fail_path'),'{"mimetype":"image/png","size":128}'),
 ('kg-product-images',current_setting('test.cleanup_path'),'{"mimetype":"image/png","size":128}');
do $$declare result jsonb;changed integer;begin
 result=public.kg_merchant_create_product(current_setting('test.create_id')::uuid,current_setting('test.create_store')::uuid,current_setting('test.create_category')::uuid,'Jarro de cerâmica',45050,'500 ml','Material natural.',current_setting('test.create_path'));
 if result->>'status'<>'published' then raise exception 'FAIL: not published';end if;
 perform public.kg_merchant_create_product(current_setting('test.create_id')::uuid,current_setting('test.create_store')::uuid,current_setting('test.create_category')::uuid,'Jarro de cerâmica',45050,'500 ml','Material natural.',current_setting('test.create_path'));
 if (select count(*) from public.kg_products where id=current_setting('test.create_id')::uuid)<>1 then raise exception 'FAIL: duplicate product';end if;
 if (select count(*) from public.kg_product_variants where product_id=current_setting('test.create_id')::uuid and option_name='500 ml' and price_minor=45050)<>1 then raise exception 'FAIL: variant missing or duplicated';end if;
 if (select count(*) from public.kg_product_images where product_id=current_setting('test.create_id')::uuid and storage_path=current_setting('test.create_path'))<>1 then raise exception 'FAIL: image missing or duplicated';end if;
 begin perform public.kg_merchant_create_product(current_setting('test.create_id')::uuid,current_setting('test.create_store')::uuid,current_setting('test.create_category')::uuid,'Changed data',100,'500 ml','Material natural.',current_setting('test.create_path'));raise exception 'FAIL: reused id with other fields';exception when invalid_parameter_value then null;end;
 begin perform public.kg_merchant_create_product(current_setting('test.fail_id')::uuid,current_setting('test.create_store')::uuid,current_setting('test.create_category')::uuid,'Must roll back',30000,'Reserved','',current_setting('test.fail_path'));raise exception 'FAIL: forced SKU conflict ignored';exception when unique_violation then null;end;
 if exists(select 1 from public.kg_products where id=current_setting('test.fail_id')::uuid) then raise exception 'FAIL: partial product after variant failure';end if;
 if kg_private.can_remove_product_upload(current_setting('test.create_path')) then raise exception 'FAIL: linked image removable';end if;
 delete from storage.objects where bucket_id='kg-product-images' and name=current_setting('test.create_path');get diagnostics changed=row_count;
 if changed<>0 then raise exception 'FAIL: merchant deleted published photo';end if;
 delete from storage.objects where bucket_id='kg-product-images' and name=current_setting('test.cleanup_path');get diagnostics changed=row_count;
 if changed<>1 then raise exception 'FAIL: unlinked upload cannot be cleaned';end if;
 update storage.objects set metadata='{"mimetype":"image/png","size":1}' where name=current_setting('test.create_path');get diagnostics changed=row_count;
 if changed<>0 then raise exception 'FAIL: published image overwrite';end if;
 perform public.kg_merchant_create_product(current_setting('test.simple_id')::uuid,current_setting('test.create_store')::uuid,current_setting('test.create_category')::uuid,'Caneca simples',5000,'','',current_setting('test.simple_path'));
 if exists(select 1 from public.kg_product_variants where product_id=current_setting('test.simple_id')::uuid) then raise exception 'FAIL: invented optional variant';end if;
end$$;
reset role;
do $$begin
 if exists(select 1 from kg_private.product_creations where product_id=current_setting('test.fail_id')::uuid) then raise exception 'FAIL: partial request after failed publication';end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
update public.kg_categories set is_active=false where id=current_setting('test.create_category')::uuid;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
-- An exact retry resolves the committed article even if its category was later disabled.
select public.kg_merchant_create_product(current_setting('test.create_id')::uuid,current_setting('test.create_store')::uuid,current_setting('test.create_category')::uuid,'Jarro de cerâmica',45050,'500 ml','Material natural.',current_setting('test.create_path'));
do $$begin
 begin perform public.kg_merchant_create_product(gen_random_uuid(),current_setting('test.foreign_store')::uuid,current_setting('test.create_category')::uuid,'Foreign creation',100,'','',current_setting('test.create_path'));raise exception 'FAIL: foreign creation';exception when insufficient_privilege then null;end;
end$$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$begin
 if (select count(*) from public.kg_products where id=current_setting('test.create_id')::uuid and status='published')<>1 then raise exception 'FAIL: new article not public';end if;
 if (select count(*) from storage.objects where bucket_id='kg-product-images' and name=current_setting('test.create_path'))<>1 then raise exception 'FAIL: published media not readable';end if;
 begin perform public.kg_merchant_create_product(gen_random_uuid(),current_setting('test.create_store')::uuid,current_setting('test.create_category')::uuid,'Anonymous',100,'','',current_setting('test.create_path'));raise exception 'FAIL: anonymous publication';exception when insufficient_privilege then null;end;
end$$;
rollback;
