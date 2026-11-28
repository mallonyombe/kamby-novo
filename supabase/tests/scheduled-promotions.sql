begin;
set local time zone 'Africa/Maputo';
do $$
declare
  starts constant timestamptz := '2026-12-02T09:00:00+02:00';
  ends constant timestamptz := '2026-12-02T13:00:00+02:00';
begin
  if kg_private.promotion_active(800,1100,starts,ends,'2026-12-02T06:59:59Z')
    or not kg_private.promotion_active(800,1100,starts,ends,'2026-12-02T07:00:00Z')
    or not kg_private.promotion_active(800,1100,starts,ends,'2026-12-02T10:59:59Z')
    or kg_private.promotion_active(800,1100,starts,ends,'2026-12-02T11:00:00Z') then
    raise exception 'Invalid promotion time boundaries';
  end if;
  if not kg_private.promotion_active(800,1100,null,null,starts)
    or not kg_private.promotion_active(800,1100,null,ends,starts)
    or not kg_private.promotion_active(800,1100,starts,null,ends)
    or kg_private.promotion_active(800,null,null,null,starts) then
    raise exception 'Open-ended, immediate or disabled promotion misinterpreted';
  end if;
end;
$$;

insert into auth.users(id,email) values
  ('98000000-0000-4000-8000-000000000001','publisher-promotion@example.invalid'),
  ('98000000-0000-4000-8000-000000000002','customer-promotion@example.invalid');
insert into public.kg_profiles(id,display_name) values
  ('98000000-0000-4000-8000-000000000001','Vendedor'),
  ('98000000-0000-4000-8000-000000000002','Comprador');
insert into public.kg_stores(id,name,slug,owner_id,status,whatsapp_e164) values
  ('98000000-0000-4000-8000-000000000003','Loja Promoções','loja-promocoes-qa','98000000-0000-4000-8000-000000000001','draft','+258841234567');
insert into kg_private.store_merchants(store_id,user_id,active) values
  ('98000000-0000-4000-8000-000000000003','98000000-0000-4000-8000-000000000001',true);
update public.kg_stores set status='approved',is_open=true where slug='loja-promocoes-qa';

insert into public.kg_products (id,store_id,category_id,title,price_minor,previous_price_minor,image_url,status)
select rows.id::uuid,sc.store_id,sc.category_id,rows.title,rows.price,rows.previous,'https://example.invalid/p.jpg','published'
from (values
  ('98000000-0000-4000-8000-000000000004','Chá Folhas',800,1100),
  ('98000000-0000-4000-8000-000000000005','Chá Copos',700,null),
  ('98000000-0000-4000-8000-000000000006','Chá Legado',600,1000)
) rows(id,title,price,previous)
cross join lateral (
  select store_id,category_id from public.kg_store_categories
  where store_id='98000000-0000-4000-8000-000000000003' order by category_id limit 1
) sc;
insert into public.kg_product_variants(id,product_id,sku,option_name,price_minor,previous_price_minor,in_stock,track_quantity) values
  ('98000000-0000-4000-8000-000000000007','98000000-0000-4000-8000-000000000005','qa-promo-1','Copo grande',700,1300,true,false);

set local role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000001',true);
do $$
declare
  s constant uuid := '98000000-0000-4000-8000-000000000003';
  p constant uuid := '98000000-0000-4000-8000-000000000004';
  pv constant uuid := '98000000-0000-4000-8000-000000000005';
  v constant uuid := '98000000-0000-4000-8000-000000000007';
  today timestamptz := statement_timestamp();
  start_in_future text := to_char((today+interval '2 days') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"');
  future_end text := to_char((today+interval '3 days') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"');
  yesterday text := to_char((today-interval '1 day') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"');
  doc jsonb;
  variant_doc jsonb;
  stamp timestamptz;
  req uuid := gen_random_uuid();
  response jsonb;
begin
  select updated_at,jsonb_build_object('title',title,'category_id',category_id,'status','published',
    'price_minor',800,'previous_price_minor',1100,'images','[]'::jsonb,'variants','[]'::jsonb)
  into strict stamp,doc from public.kg_products where id=p;
  begin
    perform public.kg_save_catalogue_product(gen_random_uuid(),s,p,stamp,doc||jsonb_build_object(
      'promotion_starts_at',start_in_future,'promotion_ends_at',yesterday));
    raise exception 'An inverted promotion window was accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.kg_save_catalogue_product(gen_random_uuid(),s,p,stamp,doc||jsonb_build_object(
      'promotion_starts_at','2026-12-02T13:00:00'));
    raise exception 'An ambiguous timezone was accepted';
  exception when invalid_parameter_value then null; end;

  response := public.kg_save_catalogue_product(req,s,p,stamp,doc||jsonb_build_object(
    'promotion_starts_at',start_in_future,'promotion_ends_at',future_end));
  if public.kg_save_catalogue_product(req,s,p,stamp,doc||jsonb_build_object(
      'promotion_starts_at',start_in_future,'promotion_ends_at',future_end)) is distinct from response then
    raise exception 'A promotion save cannot be retried';
  end if;
  perform public.kg_save_catalogue_product(gen_random_uuid(),s,p,(response->>'updated_at')::timestamptz,doc);
  if (select promotion_starts_at from public.kg_products where id=p) is distinct from start_in_future::timestamptz then
    raise exception 'A client using the legacy document removed the schedule';
  end if;

  select updated_at,jsonb_build_object('title',title,'category_id',category_id,'status','published',
    'price_minor',0,'images','[]'::jsonb)
  into strict stamp,variant_doc from public.kg_products where id=pv;
  variant_doc := variant_doc||jsonb_build_object('variants',jsonb_build_array(jsonb_build_object(
    'id',v,'option_name','Copo grande','price_minor',700,'previous_price_minor',1300,
    'in_stock',true,'track_quantity',false,'promotion_starts_at',yesterday,'promotion_ends_at',future_end)));
  perform public.kg_save_catalogue_product(gen_random_uuid(),s,pv,stamp,variant_doc);
end;
$$;

set local role anon;
do $$
begin
  if (select public.effective_price_minor(p) from public.kg_products p where title='Chá Folhas') is distinct from 1100::bigint
    or (select public.effective_previous_price_minor(p) from public.kg_products p where title='Chá Folhas') is not null
    or (select public.effective_previous_price_minor(p) from public.kg_products p where title='Chá Legado') is distinct from 1000::bigint
    or (select public.effective_price_minor(v) from public.kg_product_variants v where option_name='Copo grande') is distinct from 700::bigint
    or (select public.effective_previous_price_minor(v) from public.kg_product_variants v where option_name='Copo grande') is distinct from 1300::bigint then
    raise exception 'Public prices differ from their promotion windows';
  end if;
  if (public.kg_search_catalogue('products','cha folhas',0,10,null,null,1000)->>'total')::int <> 0
    or (public.kg_search_catalogue('products','cha folhas',0,10,null,1100,1100)->>'total')::int <> 1
    or (public.kg_search_catalogue('products','cha copos',0,10,null,700,700)->>'total')::int <> 1 then
    raise exception 'Search price filters ignore the effective price';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000002',true);
do $$
declare
  s constant uuid := '98000000-0000-4000-8000-000000000003';
  p constant uuid := '98000000-0000-4000-8000-000000000004';
  pv constant uuid := '98000000-0000-4000-8000-000000000005';
  v constant uuid := '98000000-0000-4000-8000-000000000007';
  order_items jsonb;
  contact public.kg_contact_intents%rowtype;
begin
  perform public.kg_set_cart_item(p,null,2);
  perform public.kg_set_cart_item(pv,v,3);
  if (select unit_price_snapshot_minor from public.kg_cart_items where product_id=p) is distinct from 1100::bigint
    or (select unit_price_snapshot_minor from public.kg_cart_items where product_id=pv) is distinct from 700::bigint then
    raise exception 'Cart snapshot differs from the effective price';
  end if;
  order_items := jsonb_build_array(jsonb_build_object('product_id',p,'quantity',2),
    jsonb_build_object('product_id',pv,'variant_id',v,'quantity',3));
  contact := public.kg_prepare_contact(s,order_items,'98000000-0000-4000-8000-000000000008');
  if (contact.snapshot->>'subtotal_minor')::bigint is distinct from 4300::bigint then
    raise exception 'Contact checkout total differs from the effective price';
  end if;
end;
$$;

-- Simulate the sale after the end time with the same checkout inputs.
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.kg_product_variants
set promotion_starts_at=statement_timestamp()-interval '2 days',promotion_ends_at=statement_timestamp()-interval '1 day'
where id='98000000-0000-4000-8000-000000000007';
set local role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000002',true);
do $$
declare
  s constant uuid := '98000000-0000-4000-8000-000000000003';
  p constant uuid := '98000000-0000-4000-8000-000000000004';
  pv constant uuid := '98000000-0000-4000-8000-000000000005';
  v constant uuid := '98000000-0000-4000-8000-000000000007';
  order_items jsonb := jsonb_build_array(jsonb_build_object('product_id',p,'quantity',2),
    jsonb_build_object('product_id',pv,'variant_id',v,'quantity',3));
  old_request public.kg_contact_intents%rowtype;
  new_request public.kg_contact_intents%rowtype;
begin
  perform public.kg_set_cart_item(pv,v,3);
  if (select unit_price_snapshot_minor from public.kg_cart_items where product_id=pv) is distinct from 1300::bigint then
    raise exception 'The expired discount still applies to the cart';
  end if;
  old_request := public.kg_prepare_contact(s,order_items,'98000000-0000-4000-8000-000000000008');
  new_request := public.kg_prepare_contact(s,order_items,gen_random_uuid());
  if (old_request.snapshot->>'subtotal_minor')::bigint is distinct from 4300::bigint
    or (new_request.snapshot->>'subtotal_minor')::bigint is distinct from 6100::bigint then
    raise exception 'The expired discount was applied or the previous snapshot changed';
  end if;
end;
$$;
rollback;
