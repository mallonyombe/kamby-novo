-- Product detail contract: visible variants, multiple media and variant-aware checkout.
-- The existing kg_product_images table is the canonical product_media equivalent:
-- it keeps private Storage paths and a bounded display order without duplicating data.

alter table public.kg_products
add column unit_reference text not null default 'un'
check (char_length(trim(unit_reference)) between 1 and 24);

grant insert(unit_reference),update(unit_reference) on public.kg_products to authenticated;

create table public.kg_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.kg_products(id) on delete cascade,
  sku text not null unique check (char_length(trim(sku)) between 1 and 80),
  option_name text not null check (char_length(trim(option_name)) between 1 and 120),
  price_minor bigint not null check (price_minor between 0 and 900000000000),
  in_stock boolean not null default true,
  stock_quantity integer not null default 0 check (stock_quantity between 0 and 1000000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, option_name)
);

create index kg_product_variants_product_idx
on public.kg_product_variants(product_id, created_at, id);

alter table public.kg_product_variants enable row level security;
revoke all on public.kg_product_variants from public, anon, authenticated;
grant select on public.kg_product_variants to anon, authenticated;
grant insert(product_id,sku,option_name,price_minor,in_stock,stock_quantity),
  update(sku,option_name,price_minor,in_stock,stock_quantity), delete
on public.kg_product_variants to authenticated;

create policy kg_variants_select on public.kg_product_variants
for select to anon, authenticated
using (
  exists (
    select 1
    from public.kg_products p
    join public.kg_stores s on s.id=p.store_id
    where p.id=product_id and p.status='published' and s.status='approved'
  )
  or (select kg_private.is_admin())
);

create policy kg_variants_insert on public.kg_product_variants
for insert to authenticated
with check ((select kg_private.is_admin()));

create policy kg_variants_update on public.kg_product_variants
for update to authenticated
using ((select kg_private.is_admin()))
with check ((select kg_private.is_admin()));

create policy kg_variants_delete on public.kg_product_variants
for delete to authenticated
using ((select kg_private.is_admin()));

create function kg_private.guard_product_variant() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is not null and not kg_private.is_admin() then
    raise exception 'Acesso de gestão obrigatório' using errcode='42501';
  end if;
  if auth.uid() is null and current_setting('role',true) in ('anon','authenticated') then
    raise exception 'Sessão de gestão obrigatória' using errcode='42501';
  end if;
  if TG_OP='UPDATE' and (
    new.id is distinct from old.id
    or new.product_id is distinct from old.product_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Identidade da variante imutável' using errcode='42501';
  end if;
  new.sku=trim(new.sku);
  new.option_name=trim(new.option_name);
  new.updated_at=now();
  return new;
end;$$;
revoke all on function kg_private.guard_product_variant() from public,anon,authenticated;

create trigger kg_product_variant_guard
before insert or update on public.kg_product_variants
for each row execute function kg_private.guard_product_variant();

create trigger kg_product_variant_audit
after insert or update or delete on public.kg_product_variants
for each row execute function kg_private.audit_change();

alter table public.kg_cart_items
add column variant_id uuid references public.kg_product_variants(id) on delete restrict;

alter table public.kg_cart_items
drop constraint kg_cart_items_cart_id_product_id_key;

create unique index kg_cart_items_base_product_unique
on public.kg_cart_items(cart_id,product_id)
where variant_id is null;

create unique index kg_cart_items_variant_unique
on public.kg_cart_items(cart_id,product_id,variant_id)
where variant_id is not null;

create index kg_cart_items_variant_idx on public.kg_cart_items(variant_id)
where variant_id is not null;

grant insert(variant_id) on public.kg_cart_items to authenticated;

create or replace function kg_private.cart_item_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare
  v_store uuid;
  v_product public.kg_products%rowtype;
  v_variant public.kg_product_variants%rowtype;
begin
  select store_id into v_store
  from public.kg_carts
  where id=new.cart_id and buyer_id=auth.uid();
  if v_store is null then
    raise exception 'Carrinho inacessível' using errcode='42501';
  end if;

  select * into v_product from public.kg_products where id=new.product_id;
  if not found
    or v_product.store_id<>v_store
    or v_product.status<>'published'
    or v_product.stock_status='out'
    or not exists(select 1 from public.kg_stores where id=v_store and status='approved')
  then
    raise exception 'Produto indisponível ou de outra loja' using errcode='23514';
  end if;

  if new.variant_id is not null then
    select * into v_variant
    from public.kg_product_variants
    where id=new.variant_id and product_id=new.product_id and in_stock;
    if not found or (v_variant.stock_quantity>0 and new.quantity>v_variant.stock_quantity) then
      raise exception 'Variante indisponível ou de outro produto' using errcode='23514';
    end if;
    new.unit_price_snapshot_minor=v_variant.price_minor;
  else
    new.unit_price_snapshot_minor=v_product.price_minor;
  end if;

  if TG_OP='UPDATE' and (
    new.cart_id is distinct from old.cart_id
    or new.product_id is distinct from old.product_id
    or new.variant_id is distinct from old.variant_id
    or new.id is distinct from old.id
  ) then
    raise exception 'Item imutável' using errcode='42501';
  end if;
  return new;
end;$$;
revoke all on function kg_private.cart_item_guard() from public,anon,authenticated;

create function public.kg_set_cart_item(
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity integer
) returns uuid language plpgsql security invoker set search_path='' as $$
declare
  v_store uuid;
  v_cart uuid;
begin
  if auth.uid() is null then
    raise exception 'Inicia sessão para guardar o carrinho' using errcode='42501';
  end if;
  if p_quantity not between 0 and 99 then
    raise exception 'Quantidade inválida' using errcode='22023';
  end if;
  if p_quantity=0 then
    delete from public.kg_cart_items i
    using public.kg_carts c
    where i.cart_id=c.id
      and c.buyer_id=auth.uid()
      and i.product_id=p_product_id
      and i.variant_id is not distinct from p_variant_id;
    return null;
  end if;

  select p.store_id into v_store
  from public.kg_products p
  join public.kg_stores s on s.id=p.store_id
  where p.id=p_product_id
    and p.status='published'
    and p.stock_status<>'out'
    and s.status='approved';
  if not found then
    raise exception 'Produto indisponível' using errcode='23514';
  end if;
  if p_variant_id is not null and not exists (
    select 1 from public.kg_product_variants
    where id=p_variant_id
      and product_id=p_product_id
      and in_stock
      and (stock_quantity=0 or stock_quantity>=p_quantity)
  ) then
    raise exception 'Variante indisponível ou de outro produto' using errcode='23514';
  end if;

  insert into public.kg_carts(buyer_id,store_id)
  values(auth.uid(),v_store)
  on conflict(buyer_id,store_id) do nothing;
  select id into v_cart
  from public.kg_carts
  where buyer_id=auth.uid() and store_id=v_store;

  update public.kg_cart_items
  set quantity=p_quantity
  where cart_id=v_cart
    and product_id=p_product_id
    and variant_id is not distinct from p_variant_id;
  if not found then
    insert into public.kg_cart_items(cart_id,product_id,variant_id,quantity)
    values(v_cart,p_product_id,p_variant_id,p_quantity);
  end if;
  return v_cart;
end;$$;
revoke all on function public.kg_set_cart_item(uuid,uuid,integer) from public,anon;
grant execute on function public.kg_set_cart_item(uuid,uuid,integer) to authenticated;

create or replace function public.kg_set_cart_item(p_product_id uuid,p_quantity integer)
returns uuid language sql security invoker set search_path='' as $$
  select public.kg_set_cart_item(p_product_id,null::uuid,p_quantity);
$$;
revoke all on function public.kg_set_cart_item(uuid,integer) from public,anon;
grant execute on function public.kg_set_cart_item(uuid,integer) to authenticated;

-- The optional variant_id preserves old callers while allowing the server to price
-- a selected option. Client-supplied prices are always ignored.
create or replace function kg_private.prepare_contact(
  p_store_id uuid,
  p_items jsonb,
  p_request_id uuid
) returns public.kg_contact_intents
language plpgsql security definer set search_path='' as $$
declare
  v_store public.kg_stores%rowtype;
  v_item jsonb;
  v_product public.kg_products%rowtype;
  v_variant public.kg_product_variants%rowtype;
  v_variant_id uuid;
  v_quantity integer;
  v_unit_price bigint;
  v_key text;
  v_lines jsonb='[]';
  v_subtotal bigint=0;
  v_result public.kg_contact_intents%rowtype;
  v_seen text[]='{}';
begin
  if auth.uid() is null then
    raise exception 'Inicia sessão para guardar o pedido preparado' using errcode='42501';
  end if;
  if p_store_id is null or p_request_id is null then
    raise exception 'Loja e chave do pedido obrigatórias' using errcode='22023';
  end if;
  select * into v_result
  from public.kg_contact_intents
  where buyer_id=auth.uid() and request_id=p_request_id;
  if found then
    if v_result.store_id is distinct from p_store_id then
      raise exception 'Chave de pedido já utilizada noutra loja' using errcode='22023';
    end if;
    return v_result;
  end if;
  if p_items is null
    or jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) not between 1 and 100
  then
    raise exception 'Carrinho inválido' using errcode='22023';
  end if;

  select * into v_store
  from public.kg_stores
  where id=p_store_id and status='approved'
  for share;
  if not found then
    raise exception 'Loja indisponível' using errcode='23514';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) is distinct from 'object'
      or coalesce(v_item->>'quantity','') !~ '^[0-9]{1,2}$'
      or coalesce(v_item->>'product_id','')=''
    then
      raise exception 'Quantidade inválida' using errcode='22023';
    end if;
    v_quantity=(v_item->>'quantity')::integer;
    if v_quantity not between 1 and 99 then
      raise exception 'Quantidade inválida' using errcode='22023';
    end if;

    select * into v_product
    from public.kg_products
    where id=(v_item->>'product_id')::uuid
      and store_id=p_store_id
      and status='published'
      and stock_status<>'out'
    for share;
    if not found then
      raise exception 'Produto indisponível ou de outra loja' using errcode='23514';
    end if;

    v_variant_id=null;
    if coalesce(v_item->>'variant_id','')<>'' then
      v_variant_id=(v_item->>'variant_id')::uuid;
    end if;
    if v_variant_id is not null then
      select * into v_variant
      from public.kg_product_variants
      where id=v_variant_id
        and product_id=v_product.id
        and in_stock
        and (stock_quantity=0 or stock_quantity>=v_quantity)
      for share;
      if not found then
        raise exception 'Variante indisponível ou de outro produto' using errcode='23514';
      end if;
      v_unit_price=v_variant.price_minor;
    else
      v_variant=null;
      v_unit_price=v_product.price_minor;
    end if;

    v_key=v_product.id::text || ':' || coalesce(v_variant_id::text,'base');
    if v_key=any(v_seen) then
      raise exception 'Produto ou variante repetida' using errcode='23514';
    end if;
    v_seen=array_append(v_seen,v_key);
    v_lines=v_lines || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'product_id',v_product.id,
      'title',v_product.title,
      'variant_id',v_variant_id,
      'sku',case when v_variant_id is null then null else v_variant.sku end,
      'option_name',case when v_variant_id is null then null else v_variant.option_name end,
      'quantity',v_quantity,
      'unit_price_minor',v_unit_price,
      'unit_reference',v_product.unit_reference,
      'currency',v_product.currency
    )));
    v_subtotal=v_subtotal+v_unit_price*v_quantity;
    if v_subtotal>9007199254740991 then
      raise exception 'Subtotal acima do limite permitido' using errcode='22023';
    end if;
  end loop;

  insert into public.kg_contact_intents(buyer_id,store_id,request_id,snapshot)
  values(auth.uid(),p_store_id,p_request_id,jsonb_build_object(
    'store_id',v_store.id,
    'store_name',v_store.name,
    'whatsapp_e164',v_store.whatsapp_e164,
    'items',v_lines,
    'subtotal_minor',v_subtotal,
    'currency','MZN'
  ))
  on conflict(buyer_id,request_id) do nothing
  returning * into v_result;
  if not found then
    select * into v_result
    from public.kg_contact_intents
    where buyer_id=auth.uid() and request_id=p_request_id;
  end if;
  if v_result.store_id is distinct from p_store_id then
    raise exception 'Chave de pedido já utilizada noutra loja' using errcode='22023';
  end if;
  return v_result;
end;$$;
revoke all on function kg_private.prepare_contact(uuid,jsonb,uuid) from public,anon;
grant execute on function kg_private.prepare_contact(uuid,jsonb,uuid) to authenticated;

notify pgrst,'reload schema';
