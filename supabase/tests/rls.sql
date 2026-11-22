-- Current managed-catalogue contract. All fixtures and memberships roll back.
begin;
select set_config('request.jwt.claim.aal','aal2',true);
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-000000000001','client-a@example.invalid'),
 ('00000000-0000-0000-0000-000000000002','client-b@example.invalid'),
 ('00000000-0000-0000-0000-000000000003','buyer@example.invalid'),
 ('00000000-0000-0000-0000-000000000004','admin@example.invalid');
insert into kg_private.admins(user_id) values('00000000-0000-0000-0000-000000000004');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$begin
 begin
  perform public.kg_create_store('Anon Store','','+258841234567','','approved');
  raise exception 'FAIL: anon RPC creates store';
 exception when insufficient_privilege then null; end;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$begin
 if public.kg_is_admin() then raise exception 'FAIL: ordinary account is admin'; end if;
 begin
  perform public.kg_create_store('Client Store','','+258841234567','','approved');
  raise exception 'FAIL: client RPC creates store';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.kg_stores(owner_id,name,slug,whatsapp_e164) values(auth.uid(),'Client Store','client-store','+258841234567');
  raise exception 'FAIL: client direct insert creates store';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.kg_stores(owner_id,name,slug,whatsapp_e164,status) values('00000000-0000-0000-0000-000000000004','Spoofed Store','spoofed-store','+258841234567','approved');
  raise exception 'FAIL: client spoofs store owner and published status';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claims','{"user_metadata":{"role":"admin"}}',true);
 if public.kg_is_admin() then raise exception 'FAIL: editable metadata grants admin'; end if;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
select public.kg_create_store('Loja A','Catálogo A','+258841234567','Xai-Xai','draft');
select public.kg_assign_merchant(id,'00000000-0000-0000-0000-000000000002',true) from public.kg_stores where name='Loja A';
select public.kg_review_store(id,'approved','Fixture com responsável') from public.kg_stores where name='Loja A';
select public.kg_create_store('Loja B','Catálogo B','+258851234567','Chongoene','draft');
select public.kg_create_store(repeat('a',44) || ' b','','+258861234567','','draft');
-- Rename this generated-slug fixture to keep following test labels readable.
update public.kg_stores set name='Loja reservada' where name=repeat('a',44) || ' b';
do $$begin
 begin
  perform public.kg_create_store('Bad phone','','+258123456','','draft');
  raise exception 'FAIL: invalid Mozambique number accepted';
 exception when invalid_parameter_value then null; end;
 if (select count(*) from public.kg_stores where owner_id=auth.uid())<>3 then raise exception 'FAIL: same admin cannot create multiple stores'; end if;
 if exists(select 1 from public.kg_stores where slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$') then raise exception 'FAIL: invalid generated slug'; end if;
 if (select count(*) from public.kg_store_applications)<>0 then raise exception 'FAIL: fictitious managed-store applications'; end if;
 if (select count(*) from public.kg_audit_events where action='store.created' and actor_id=auth.uid())<>3 then raise exception 'FAIL: created-store actor audit missing'; end if;
 begin
  perform public.kg_create_store('Bad state','','+258841234567','','pending');
  raise exception 'FAIL: managed store accepts application state';
 exception when invalid_parameter_value then null; end;
 begin
  insert into public.kg_stores(owner_id,name,slug,whatsapp_e164,status) values('00000000-0000-0000-0000-000000000001','Spoofed Admin Store','spoofed-admin','+258841234567','approved');
  raise exception 'FAIL: client-supplied owner grants store access';
 exception when insufficient_privilege then null; end;
end$$;
select public.kg_assign_merchant(id,'00000000-0000-0000-0000-000000000002',true) from public.kg_stores where name='Loja B';
select public.kg_review_store(id,'approved','') from public.kg_stores where name='Loja B';
select public.kg_update_store(id,'Loja A','Descrição editada',whatsapp_e164,'Xai-Xai','approved','') from public.kg_stores where name='Loja A';
do $$begin
 begin
  perform public.kg_update_store((select id from public.kg_stores where name='Loja A'),'Nome parcial','Mudança parcial','+258841234567','Mudança parcial','suspended','');
  raise exception 'FAIL: atomic update accepts suspension without reason';
 exception when invalid_parameter_value then null; end;
 if not exists(select 1 from public.kg_stores where name='Loja A' and description='Descrição editada' and location='Xai-Xai' and status='approved') then raise exception 'FAIL: failed update partially changed shop'; end if;
end$$;
insert into public.kg_products(store_id,title,price_minor,status,image_url) select id,'Produto A',12500,'published','https://example.invalid/a.jpg' from public.kg_stores where name='Loja A';
insert into public.kg_products(store_id,title,price_minor,status) select id,'Rascunho A',9999,'draft' from public.kg_stores where name='Loja A';
insert into public.kg_products(store_id,title,price_minor,status) select id,'Produto B',25000,'published' from public.kg_stores where name='Loja B';
insert into public.kg_products(store_id,title,price_minor,status) select id,'Produto reservado',9000,'draft' from public.kg_stores where name='Loja reservada';
do $$begin
 begin
  update public.kg_products set status='published' where title='Produto reservado';
  raise exception 'FAIL: draft store publishes product';
 exception when raise_exception then if sqlerrm='FAIL: draft store publishes product' then raise; end if; end;
 begin
  update public.kg_stores set owner_id='00000000-0000-0000-0000-000000000001' where name='Loja A';
  raise exception 'FAIL: store owner mutable';
 exception when insufficient_privilege then null; end;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$declare changed integer; begin
 update public.kg_stores set name='Hijacked' where name='Loja A';get diagnostics changed=row_count;
 if changed<>0 then raise exception 'FAIL: client changes managed store'; end if;
 update public.kg_products set title='Hijacked' where title='Produto A';get diagnostics changed=row_count;
 if changed<>0 then raise exception 'FAIL: client changes managed product'; end if;
 begin
  insert into public.kg_products(store_id,title,price_minor,status) select id,'Forged product',5000,'published' from public.kg_stores where name='Loja A';
  raise exception 'FAIL: ordinary client inserts product';
 exception when insufficient_privilege then null; end;
 begin
  perform public.kg_update_store((select id from public.kg_stores where name='Loja A'),'Hijacked','','+258841234567','','approved','');
  raise exception 'FAIL: ordinary client updates store through RPC';
 exception when insufficient_privilege then null; end;
 begin
  perform public.kg_review_store((select id from public.kg_stores where name='Loja A'),'draft','');
  raise exception 'FAIL: client changes store publication';
 exception when insufficient_privilege then null; end;
end$$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$begin
 if (select count(*) from public.kg_stores)<>2 then raise exception 'FAIL: anon sees pending shop'; end if;
 if (select count(*) from public.kg_products)<>2 then raise exception 'FAIL: anon sees draft'; end if;
 begin
  perform public.kg_is_admin(); raise exception 'FAIL: anon admin RPC callable';
 exception when insufficient_privilege then null; end;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select public.kg_set_cart_item(id,2) from public.kg_products where title in ('Produto A','Produto B');
do $$declare v_cart uuid; v_product uuid; v_intent public.kg_contact_intents%rowtype; v_request uuid=gen_random_uuid(); begin
 begin
  perform public.kg_set_cart_item((select id from public.kg_products where title='Produto A'),100);
  raise exception 'FAIL: quantity 100 accepted';
 exception when invalid_parameter_value then null; end;
 if (select count(*) from public.kg_carts)<>2 then raise exception 'FAIL: carts not separated'; end if;
 if (select sum(unit_price_snapshot_minor*quantity) from public.kg_cart_items)<>75000 then raise exception 'FAIL: snapshot price mismatch'; end if;
 select c.id into v_cart from public.kg_carts c join public.kg_stores s on s.id=c.store_id where s.name='Loja A';
 select id into v_product from public.kg_products where title='Produto B';
 begin
  insert into public.kg_cart_items(cart_id,product_id,quantity) values(v_cart,v_product,1);
  raise exception 'FAIL: cross-store item accepted';
 exception when check_violation then null; end;
 begin
  perform public.kg_prepare_contact((select id from public.kg_stores where name='Loja A'),null);
  raise exception 'FAIL: null items accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.kg_prepare_contact((select id from public.kg_stores where name='Loja A'),jsonb_build_array(jsonb_build_object('product_id',(select id from public.kg_products where title='Produto A'))));
  raise exception 'FAIL: missing quantity accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.kg_prepare_contact((select id from public.kg_stores where name='Loja A'),jsonb_build_array(jsonb_build_object('product_id',(select id from public.kg_products where title='Produto B'),'quantity',1)));
  raise exception 'FAIL: cross-store contact accepted';
 exception when check_violation then null; end;
 select * into v_intent from public.kg_prepare_contact((select id from public.kg_stores where name='Loja A'),jsonb_build_array(jsonb_build_object('product_id',(select id from public.kg_products where title='Produto A'),'quantity',2,'price_minor',1)),v_request);
 if v_intent.status<>'prepared' or (v_intent.snapshot->>'subtotal_minor')::bigint<>25000 then raise exception 'FAIL: forged price or false sale'; end if;
 perform public.kg_prepare_contact((select id from public.kg_stores where name='Loja A'),jsonb_build_array(jsonb_build_object('product_id',(select id from public.kg_products where title='Produto A'),'quantity',2)),v_request);
 if (select count(*) from public.kg_contact_intents)<>1 then raise exception 'FAIL: idempotency'; end if;
 update public.kg_contact_intents set status='whatsapp_opened' where id=v_intent.id;
 begin
  update public.kg_contact_intents set status='sold' where id=v_intent.id;
 exception when check_violation then null; when insufficient_privilege then null; end;
 if (select status from public.kg_contact_intents where id=v_intent.id)<>'whatsapp_opened' then raise exception 'FAIL: sale status persisted'; end if;
 begin
  update public.kg_contact_intents set snapshot='{}' where id=v_intent.id;
  raise exception 'FAIL: snapshot editable';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.kg_audit_events(action,resource_type,resource_id) values('fake','store',gen_random_uuid());
  raise exception 'FAIL: audit forgeable';
 exception when insufficient_privilege then null; end;
end$$;
insert into public.kg_reports(reporter_id,target_type,target_id,reason) select auth.uid(),'product',id,'Conteúdo de teste reportado' from public.kg_products where title='Produto A';
do $$begin
 begin
  perform public.kg_resolve_report((select id from public.kg_reports limit 1),'resolved','Sem problema');
  raise exception 'FAIL: buyer resolves report';
 exception when insufficient_privilege then null; end;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$begin
 if (select count(*) from public.kg_carts)<>0 or (select count(*) from public.kg_cart_items)<>0 or (select count(*) from public.kg_contact_intents)<>0 then raise exception 'FAIL: foreign buyer data exposed'; end if;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
select public.kg_resolve_report(id,'resolved','Revisão de teste concluída') from public.kg_reports;
do $$begin
 if (select count(*) from public.kg_audit_events)=0 then raise exception 'FAIL: no audit'; end if;
 if exists(select 1 from public.kg_store_applications) then raise exception 'FAIL: managed stores created applications'; end if;
end$$;

-- Management can upload for any managed store using its canonical owner/store path.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
insert into storage.objects(bucket_id,name) select 'kg-product-images',owner_id::text || '/' || id::text || '/public.jpg' from public.kg_stores where name='Loja A';
insert into storage.objects(bucket_id,name) select 'kg-product-images',owner_id::text || '/' || id::text || '/draft.jpg' from public.kg_stores where name='Loja A';
insert into storage.objects(bucket_id,name) select 'kg-product-images',owner_id::text || '/' || id::text || '/reserved.jpg' from public.kg_stores where name='Loja reservada';
update public.kg_products p set image_url='https://example.invalid/storage/v1/object/public/kg-product-images/' || s.owner_id::text || '/' || s.id::text || '/public.jpg' from public.kg_stores s where s.id=p.store_id and p.title='Produto A';
update public.kg_products p set image_url='https://example.invalid/storage/v1/object/public/kg-product-images/' || s.owner_id::text || '/' || s.id::text || '/draft.jpg' from public.kg_stores s where s.id=p.store_id and p.title='Rascunho A';
-- Server-provisioned second admin is test-only and rolls back; no user metadata used.
reset role;
insert into kg_private.admins(user_id) values('00000000-0000-0000-0000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
insert into storage.objects(bucket_id,name) select 'kg-product-images',owner_id::text || '/' || id::text || '/cross-admin.jpg' from public.kg_stores where name='Loja A';
update public.kg_products p set image_url='https://example.invalid/storage/v1/object/public/kg-product-images/' || s.owner_id::text || '/' || s.id::text || '/cross-admin.jpg' from public.kg_stores s where s.id=p.store_id and p.title='Produto A';
insert into public.kg_products(store_id,title,price_minor,status) select id,'Admin B temporary product',7500,'draft' from public.kg_stores where name='Loja A';
update public.kg_products set price_minor=8000 where title='Admin B temporary product';
delete from public.kg_products where title='Admin B temporary product';
update public.kg_stores set location='Zona editada por gestão' where name='Loja A';
do $$begin
 if not exists(select 1 from public.kg_products where title='Produto A' and image_url like '%/cross-admin.jpg') then raise exception 'FAIL: second admin cannot manage another creator store image'; end if;
 if exists(select 1 from public.kg_products where title='Admin B temporary product') then raise exception 'FAIL: second admin cannot delete product'; end if;
 begin
  insert into storage.objects(bucket_id,name) select 'kg-product-images',auth.uid()::text || '/' || id::text || '/wrong-prefix.jpg' from public.kg_stores where name='Loja A';
  raise exception 'FAIL: wrong owner prefix accepted';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.kg_product_images(product_id,storage_path) select id,'00000000-0000-0000-0000-000000000002/foreign/file.jpg' from public.kg_products where title='Produto A';
  raise exception 'FAIL: cross-store image metadata accepted';
 exception when check_violation then null; end;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$begin
 begin
  insert into storage.objects(bucket_id,name) select 'kg-product-images',owner_id::text || '/' || id::text || '/client-spoof.jpg' from public.kg_stores where name='Loja A';
  raise exception 'FAIL: ordinary client uploads managed-store image';
 exception when insufficient_privilege then null; end;
 if (select count(*) from public.kg_audit_events)<>0 then raise exception 'FAIL: client reads management audit'; end if;
end$$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$begin
 if (select count(*) from storage.objects where bucket_id='kg-product-images')<>1 then raise exception 'FAIL: unlinked or draft store images exposed'; end if;
end$$;
-- Removing admin membership immediately removes private reads and all catalogue writes,
-- even though this account created (and remains owner_id of) the stores.
reset role;
delete from kg_private.admins where user_id='00000000-0000-0000-0000-000000000004';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
do $$declare changed integer; begin
 if public.kg_is_admin() then raise exception 'FAIL: demoted creator remains admin'; end if;
 if (select count(*) from public.kg_stores)<>2 or exists(select 1 from public.kg_stores where status<>'approved') then raise exception 'FAIL: demoted creator sees private stores'; end if;
 if (select count(*) from public.kg_products)<>2 or exists(select 1 from public.kg_products where status<>'published') then raise exception 'FAIL: demoted creator sees private products'; end if;
 if (select count(*) from storage.objects where bucket_id='kg-product-images')<>1 then raise exception 'FAIL: demoted creator sees private storage'; end if;
 update public.kg_stores set description='Demoted change' where name='Loja A';get diagnostics changed=row_count;
 if changed<>0 then raise exception 'FAIL: demoted creator edits store'; end if;
 update public.kg_products set title='Demoted change' where title='Produto A';get diagnostics changed=row_count;
 if changed<>0 then raise exception 'FAIL: demoted creator edits product'; end if;
 delete from public.kg_products where title='Produto A';get diagnostics changed=row_count;
 if changed<>0 then raise exception 'FAIL: demoted creator deletes product'; end if;
 delete from storage.objects where bucket_id='kg-product-images';get diagnostics changed=row_count;
 if changed<>0 then raise exception 'FAIL: demoted creator deletes images'; end if;
 begin
  perform public.kg_create_store('Residual store','','+258841234567','','draft');
  raise exception 'FAIL: demoted creator creates store';
 exception when insufficient_privilege then null; end;
 begin
  perform public.kg_update_store((select id from public.kg_stores where name='Loja A'),'Residual store','','+258841234567','','draft','');
  raise exception 'FAIL: demoted creator edits store through RPC';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.kg_products(store_id,title,price_minor,status) select id,'Residual product',5000,'draft' from public.kg_stores where name='Loja A';
  raise exception 'FAIL: demoted creator inserts product';
 exception when insufficient_privilege then null; end;
 begin
  insert into storage.objects(bucket_id,name) select 'kg-product-images',owner_id::text || '/' || id::text || '/residual-image.jpg' from public.kg_stores where name='Loja A';
  raise exception 'FAIL: demoted creator uploads image';
 exception when insufficient_privilege then null; end;
end$$;
insert into public.kg_profiles(id,display_name) values(auth.uid(),'Perfil do cliente');
update public.kg_profiles set display_name='Nome actualizado' where id=auth.uid();
select public.kg_set_cart_item(id,1) from public.kg_products where title='Produto A';
select public.kg_prepare_contact((select id from public.kg_stores where name='Loja A'),jsonb_build_array(jsonb_build_object('product_id',(select id from public.kg_products where title='Produto A'),'quantity',1)));
do $$begin
 if not exists(select 1 from public.kg_profiles where id=auth.uid() and display_name='Nome actualizado') then raise exception 'FAIL: own profile broken after admin demotion'; end if;
 if (select count(*) from public.kg_carts)<>1 or (select count(*) from public.kg_contact_intents)<>1 then raise exception 'FAIL: own buyer operations broken after admin demotion'; end if;
end$$;
reset role;
insert into kg_private.admins(user_id) values('00000000-0000-0000-0000-000000000004');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
select public.kg_review_store(id,'draft','') from public.kg_stores where name='Loja A';
select public.kg_review_store(id,'approved','') from public.kg_stores where name='Loja A';
do $$begin
 begin
  perform public.kg_review_store((select id from public.kg_stores where name='Loja A'),'suspended','');
  raise exception 'FAIL: suspension without reason';
 exception when invalid_parameter_value then null; end;
end$$;
select public.kg_review_store(id,'suspended','Moderação de teste') from public.kg_stores where name='Loja A';
do $$begin
 if not exists(select 1 from public.kg_audit_events where action='store.published' and actor_id=auth.uid()) then raise exception 'FAIL: publish actor audit missing'; end if;
 if not exists(select 1 from public.kg_audit_events where action='store.suspended' and metadata->>'reason'='Moderação de teste') then raise exception 'FAIL: suspension audit missing'; end if;
 if exists(select 1 from public.kg_store_applications) then raise exception 'FAIL: status changes create applications'; end if;
end$$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$begin
 if (select count(*) from storage.objects where bucket_id='kg-product-images')<>0 then raise exception 'FAIL: suspended store image exposed'; end if;
 if exists(select 1 from public.kg_products where title='Produto A') then raise exception 'FAIL: suspended store product exposed'; end if;
end$$;

-- PDP contract: variants, multiple ordered media and server-owned prices.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
select public.kg_review_store(id,'approved','') from public.kg_stores where name='Loja A';
update public.kg_products set unit_reference='un' where title in ('Produto A','Rascunho A','Produto B');
insert into public.kg_product_variants(product_id,sku,option_name,price_minor,in_stock,stock_quantity)
select id,'A-250','250 ml',29000,true,12 from public.kg_products where title='Produto A';
insert into public.kg_product_variants(product_id,sku,option_name,price_minor,in_stock,stock_quantity)
select id,'A-350','350 ml',35000,true,8 from public.kg_products where title='Produto A';
insert into public.kg_product_variants(product_id,sku,option_name,price_minor,in_stock,stock_quantity)
select id,'A-750','750 ml',55000,false,0 from public.kg_products where title='Produto A';
insert into public.kg_product_variants(product_id,sku,option_name,price_minor,in_stock,stock_quantity)
select id,'DRAFT-1','Rascunho',10000,true,1 from public.kg_products where title='Rascunho A';
insert into public.kg_product_variants(product_id,sku,option_name,price_minor,in_stock,stock_quantity)
select id,'B-1','Única',25000,true,5 from public.kg_products where title='Produto B';
insert into public.kg_product_images(product_id,storage_path,sort_order)
select p.id,s.owner_id::text || '/' || s.id::text || '/public.jpg',0
from public.kg_products p join public.kg_stores s on s.id=p.store_id
where p.title='Produto A';
insert into public.kg_product_images(product_id,storage_path,sort_order)
select p.id,s.owner_id::text || '/' || s.id::text || '/cross-admin.jpg',1
from public.kg_products p join public.kg_stores s on s.id=p.store_id
where p.title='Produto A';
do $$begin
 if (select count(*) from public.kg_product_variants)<>5 then raise exception 'FAIL: management variant CRUD incomplete'; end if;
 if not exists(select 1 from public.kg_audit_events where resource_type='kg_product_variants' and actor_id=auth.uid()) then raise exception 'FAIL: variant audit missing'; end if;
end$$;

set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$begin
 if (select count(*) from public.kg_product_variants)<>4 then raise exception 'FAIL: public variant visibility'; end if;
 if exists(select 1 from public.kg_product_variants where sku='DRAFT-1') then raise exception 'FAIL: draft product variant exposed'; end if;
 if (select count(*) from public.kg_product_images where product_id=(select id from public.kg_products where title='Produto A'))<>2 then raise exception 'FAIL: ordered product media unavailable'; end if;
end$$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
do $$begin
 begin
  insert into public.kg_product_variants(product_id,sku,option_name,price_minor)
  select id,'FORGED','Forjada',1 from public.kg_products where title='Produto A';
  raise exception 'FAIL: client inserts variant';
 exception when insufficient_privilege then null; end;
 begin
  perform public.kg_set_cart_item(
    (select id from public.kg_products where title='Produto A'),
    (select id from public.kg_product_variants where sku='A-750'),
    1
  );
  raise exception 'FAIL: unavailable variant added to cart';
 exception when check_violation then null; end;
 begin
  perform public.kg_set_cart_item(
    (select id from public.kg_products where title='Produto A'),
    (select id from public.kg_product_variants where sku='B-1'),
    1
  );
  raise exception 'FAIL: foreign product variant accepted';
 exception when check_violation then null; end;
end$$;
select public.kg_set_cart_item(
  (select id from public.kg_products where title='Produto A'),
  (select id from public.kg_product_variants where sku='A-350'),
  2
);
do $$declare v_intent public.kg_contact_intents%rowtype;begin
 if not exists(
  select 1 from public.kg_cart_items i
  join public.kg_product_variants v on v.id=i.variant_id
  where v.sku='A-350' and i.quantity=2 and i.unit_price_snapshot_minor=35000
 ) then raise exception 'FAIL: cart variant price not server-owned'; end if;
 select * into v_intent from public.kg_prepare_contact(
  (select id from public.kg_stores where name='Loja A'),
  jsonb_build_array(jsonb_build_object(
    'product_id',(select id from public.kg_products where title='Produto A'),
    'variant_id',(select id from public.kg_product_variants where sku='A-350'),
    'quantity',2,
    'price_minor',1
  )),
  gen_random_uuid()
 );
 if (v_intent.snapshot->>'subtotal_minor')::bigint<>70000
   or v_intent.snapshot->'items'->0->>'sku'<>'A-350'
   or v_intent.snapshot->'items'->0->>'option_name'<>'350 ml'
 then raise exception 'FAIL: WhatsApp snapshot variant or price forged'; end if;
end$$;
rollback;
