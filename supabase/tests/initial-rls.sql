-- Run in a disposable/mocked Supabase database only. Every fixture rolls back.
begin;
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-000000000001','seller-a@example.invalid'),
 ('00000000-0000-0000-0000-000000000002','seller-b@example.invalid'),
 ('00000000-0000-0000-0000-000000000003','buyer@example.invalid'),
 ('00000000-0000-0000-0000-000000000004','admin@example.invalid');
insert into kg_private.admins(user_id) values('00000000-0000-0000-0000-000000000004');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
insert into public.kg_stores(owner_id,name,slug,whatsapp_e164) values(auth.uid(),'Loja A','loja-a','+258841234567');
do $$begin
 if (select status from public.kg_stores where owner_id=auth.uid())<>'pending' then raise exception 'candidate must be pending'; end if;
 begin
  update public.kg_stores set status='approved' where owner_id=auth.uid();
  raise exception 'FAIL: self approval accepted';
 exception when insufficient_privilege then null; end;
 begin
  perform public.kg_review_store((select id from public.kg_stores where owner_id=auth.uid()),'approved','');
  raise exception 'FAIL: seller review accepted';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.kg_products(store_id,title,price_minor,status) select id,'Produto prematuro',5000,'published' from public.kg_stores where owner_id=auth.uid();
  raise exception 'FAIL: pending store product accepted';
 exception when insufficient_privilege then null; when raise_exception then if sqlerrm='FAIL: pending store product accepted' then raise; end if; end;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
insert into public.kg_stores(owner_id,name,slug,whatsapp_e164) values(auth.uid(),'Loja B','loja-b','+258851234567');
do $$declare changed integer; begin
 update public.kg_stores set name='Hijacked' where slug='loja-a'; get diagnostics changed=row_count;
 if changed<>0 then raise exception 'FAIL: cross-store update'; end if;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
select public.kg_review_store(id,'approved','Verificação interna de teste') from public.kg_stores;
-- An admin who also owns a shop cannot approve their own shop.
insert into public.kg_stores(owner_id,name,slug,whatsapp_e164) values(auth.uid(),'Admin Shop','admin-shop','+258861234567');
do $$begin
 begin
  perform public.kg_review_store((select id from public.kg_stores where owner_id=auth.uid()),'approved','');
  raise exception 'FAIL: admin self approval accepted';
 exception when insufficient_privilege then null; end;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
insert into public.kg_products(store_id,title,price_minor,status,image_url) select id,'Produto A',12500,'published','https://example.invalid/a.jpg' from public.kg_stores where owner_id=auth.uid();
insert into public.kg_products(store_id,title,price_minor,status) select id,'Rascunho A',9999,'draft' from public.kg_stores where owner_id=auth.uid();
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
insert into public.kg_products(store_id,title,price_minor,status) select id,'Produto B',25000,'published' from public.kg_stores where owner_id=auth.uid();
do $$declare changed integer; begin
 update public.kg_products set title='Hijacked' where title='Produto A'; get diagnostics changed=row_count;
 if changed<>0 then raise exception 'FAIL: cross-product update'; end if;
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
 select c.id into v_cart from public.kg_carts c join public.kg_stores s on s.id=c.store_id where s.slug='loja-a';
 select id into v_product from public.kg_products where title='Produto B';
 begin
  insert into public.kg_cart_items(cart_id,product_id,quantity) values(v_cart,v_product,1);
  raise exception 'FAIL: cross-store item accepted';
 exception when check_violation then null; end;
 begin
  perform public.kg_prepare_contact((select id from public.kg_stores where slug='loja-a'),null);
  raise exception 'FAIL: null items accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.kg_prepare_contact((select id from public.kg_stores where slug='loja-a'),jsonb_build_array(jsonb_build_object('product_id',(select id from public.kg_products where title='Produto A'))));
  raise exception 'FAIL: missing quantity accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.kg_prepare_contact((select id from public.kg_stores where slug='loja-a'),jsonb_build_array(jsonb_build_object('product_id',(select id from public.kg_products where title='Produto B'),'quantity',1)));
  raise exception 'FAIL: cross-store contact accepted';
 exception when check_violation then null; end;
 select * into v_intent from public.kg_prepare_contact((select id from public.kg_stores where slug='loja-a'),jsonb_build_array(jsonb_build_object('product_id',(select id from public.kg_products where title='Produto A'),'quantity',2,'price_minor',1)),v_request);
 if v_intent.status<>'prepared' or (v_intent.snapshot->>'subtotal_minor')::bigint<>25000 then raise exception 'FAIL: forged price or false sale'; end if;
 perform public.kg_prepare_contact((select id from public.kg_stores where slug='loja-a'),jsonb_build_array(jsonb_build_object('product_id',(select id from public.kg_products where title='Produto A'),'quantity',2)),v_request);
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
 if exists(select 1 from public.kg_store_applications where status='approved' and reviewed_by is null) then raise exception 'FAIL: missing reviewer'; end if;
end$$;

-- Storage: owner path, private drafts, published image, cross-store writes.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
insert into storage.objects(bucket_id,name) select 'kg-product-images',auth.uid()::text || '/' || id::text || '/public.jpg' from public.kg_stores where owner_id=auth.uid();
insert into storage.objects(bucket_id,name) select 'kg-product-images',auth.uid()::text || '/' || id::text || '/draft.jpg' from public.kg_stores where owner_id=auth.uid();
update public.kg_products set image_url='https://example.invalid/storage/v1/object/public/kg-product-images/' || auth.uid()::text || '/' || store_id::text || '/public.jpg' where title='Produto A';
update public.kg_products set image_url='https://example.invalid/storage/v1/object/public/kg-product-images/' || auth.uid()::text || '/' || store_id::text || '/draft.jpg' where title='Rascunho A';
do $$begin
 begin
  insert into storage.objects(bucket_id,name) select 'kg-product-images',auth.uid()::text || '/' || id::text || '/wrong.jpg' from public.kg_stores where slug='loja-b';
  raise exception 'FAIL: cross-store storage accepted';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.kg_product_images(product_id,storage_path) select id,'00000000-0000-0000-0000-000000000002/foreign/file.jpg' from public.kg_products where title='Produto A';
  raise exception 'FAIL: cross-store image metadata accepted';
 exception when check_violation then null; end;
end$$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$begin
 if (select count(*) from storage.objects where bucket_id='kg-product-images')<>1 then raise exception 'FAIL: draft storage exposed'; end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
do $$begin
 begin
  update public.kg_products set image_url=(select image_url from public.kg_products where title='Produto A') where title='Produto B';
  raise exception 'FAIL: linking another store image accepted';
 exception when check_violation then null; end;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
select public.kg_review_store(id,'suspended','Moderação de teste') from public.kg_stores where slug='loja-a';
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$begin
 if (select count(*) from storage.objects where bucket_id='kg-product-images')<>0 then raise exception 'FAIL: suspended store image exposed'; end if;
 if exists(select 1 from public.kg_products where title='Produto A') then raise exception 'FAIL: suspended store product exposed'; end if;
end$$;
rollback;
