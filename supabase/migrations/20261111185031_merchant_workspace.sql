-- Assigned merchants may change only availability and price in their own catalogue.
-- Existing administrators retain creation, publication and suspension controls.
alter table public.kg_stores add column is_open boolean not null default true;
grant update(is_open) on public.kg_stores to authenticated;
alter table public.kg_profiles add column location text not null default '' check(char_length(location)<=120);
grant insert(location),update(location) on public.kg_profiles to authenticated;

create table kg_private.store_merchants (
 store_id uuid not null references public.kg_stores(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 primary key(store_id,user_id)
);
create index kg_store_merchants_user_idx on kg_private.store_merchants(user_id,store_id) where active;
alter table kg_private.store_merchants enable row level security;
revoke all on kg_private.store_merchants from public,anon,authenticated;
create policy kg_staff_no_direct_access on kg_private.store_merchants for select to authenticated using(false);

create function kg_private.can_manage_store(p_store_id uuid,p_require_approved boolean default true)
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(
  select 1 from kg_private.store_merchants m join public.kg_stores s on s.id=m.store_id
  where m.store_id=p_store_id and m.user_id=(select auth.uid()) and m.active
   and (not p_require_approved or s.status='approved')
 );
$$;
revoke all on function kg_private.can_manage_store(uuid,boolean) from public;
grant execute on function kg_private.can_manage_store(uuid,boolean) to anon,authenticated;

create function kg_private.assign_merchant(p_store_id uuid,p_user_id uuid,p_active boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not kg_private.is_admin() then raise exception 'Acesso de gestão obrigatório' using errcode='42501'; end if;
 if p_active is null then raise exception 'Estado obrigatório' using errcode='22023'; end if;
 insert into kg_private.store_merchants(store_id,user_id,active) values(p_store_id,p_user_id,p_active)
 on conflict(store_id,user_id) do update set active=excluded.active;
 insert into public.kg_audit_events(actor_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),'store.merchant_assigned','store',p_store_id,jsonb_build_object('user_id',p_user_id,'active',p_active));
end;$$;
revoke all on function kg_private.assign_merchant(uuid,uuid,boolean) from public,anon;
grant execute on function kg_private.assign_merchant(uuid,uuid,boolean) to authenticated;
create function public.kg_assign_merchant(p_store_id uuid,p_user_id uuid,p_active boolean default true)
returns void language sql security invoker set search_path='' as $$select kg_private.assign_merchant(p_store_id,p_user_id,p_active)$$;
revoke all on function public.kg_assign_merchant(uuid,uuid,boolean) from public,anon;
grant execute on function public.kg_assign_merchant(uuid,uuid,boolean) to authenticated;

create policy kg_merchant_stores_select on public.kg_stores for select to authenticated
using(kg_private.can_manage_store(id,false));
create policy kg_merchant_store_update on public.kg_stores for update to authenticated
using(kg_private.can_manage_store(id)) with check(kg_private.can_manage_store(id));
create policy kg_merchant_products_select on public.kg_products for select to authenticated
using(kg_private.can_manage_store(store_id,false));
create policy kg_merchant_products_update on public.kg_products for update to authenticated
using(kg_private.can_manage_store(store_id)) with check(kg_private.can_manage_store(store_id));
create policy kg_merchant_variants_select on public.kg_product_variants for select to authenticated
using(exists(select 1 from public.kg_products p where p.id=product_id and kg_private.can_manage_store(p.store_id,false)));
create policy kg_merchant_variants_update on public.kg_product_variants for update to authenticated
using(exists(select 1 from public.kg_products p where p.id=product_id and kg_private.can_manage_store(p.store_id)))
with check(exists(select 1 from public.kg_products p where p.id=product_id and kg_private.can_manage_store(p.store_id)));

create or replace function kg_private.guard_store() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is not null and not kg_private.is_admin() then
   if TG_OP<>'UPDATE' or not kg_private.can_manage_store(old.id)
     or (to_jsonb(new)-'is_open'-'updated_at') is distinct from (to_jsonb(old)-'is_open'-'updated_at') then
     raise exception 'Só podes alterar a abertura da tua loja' using errcode='42501';
   end if;
   new.updated_at=now(); return new;
 end if;
 if TG_OP='INSERT' then
   if auth.uid() is not null then
     if not kg_private.is_admin() or new.owner_id is distinct from auth.uid() then
       raise exception 'Só a gestão pode criar lojas' using errcode='42501';
     end if;
     if new.status not in ('draft','approved') then
       raise exception 'Estado inicial inválido' using errcode='22023';
     end if;
   elsif current_setting('role',true) in ('anon','authenticated') then
     raise exception 'Sessão de gestão obrigatória' using errcode='42501';
   end if;
 else
   if new.owner_id is distinct from old.owner_id or new.id is distinct from old.id or new.created_at is distinct from old.created_at then
     raise exception 'Identidade da loja imutável' using errcode='42501';
   end if;
   if new.status is distinct from old.status and auth.uid() is not null then
     if not kg_private.is_admin() then raise exception 'Acesso de gestão obrigatório' using errcode='42501'; end if;
     if new.status not in ('draft','approved','suspended') then raise exception 'Estado inválido' using errcode='22023'; end if;
     if new.status='suspended' and char_length(trim(coalesce(current_setting('kg.review_reason',true),'')))<3 then
       raise exception 'Indica o motivo da suspensão' using errcode='22023';
     end if;
   elsif auth.uid()=old.owner_id and old.status in ('suspended','rejected') and not kg_private.is_admin() then
     raise exception 'Loja sem autorização para alterações' using errcode='42501';
   end if;
 end if;
 new.updated_at=now(); return new;
end;$$;

create or replace function kg_private.guard_product() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_owner uuid; v_path text;
begin
 if auth.uid() is not null and not kg_private.is_admin() then
   if TG_OP<>'UPDATE' or not kg_private.can_manage_store(old.store_id)
    or (to_jsonb(new)-'price_minor'-'stock_status'-'updated_at') is distinct from (to_jsonb(old)-'price_minor'-'stock_status'-'updated_at') then
    raise exception 'Só podes alterar preço e stock do teu catálogo' using errcode='42501';
   end if;
 end if;
 if auth.uid() is null and current_setting('role',true) in ('anon','authenticated') then raise exception 'Sessão obrigatória' using errcode='42501'; end if;
 if TG_OP='UPDATE' and (new.store_id is distinct from old.store_id or new.id is distinct from old.id or new.created_at is distinct from old.created_at) then raise exception 'Identidade do produto imutável' using errcode='42501'; end if;
 if new.status='published' and not exists(select 1 from public.kg_stores where id=new.store_id and status='approved') then raise exception 'Publica a loja antes do produto'; end if;
 select owner_id into v_owner from public.kg_stores where id=new.store_id;
 if position('/kg-product-images/' in new.image_url)>0 then
   v_path=split_part(new.image_url,'/kg-product-images/',2);
   if v_owner is null or v_path not like v_owner::text || '/' || new.store_id::text || '/%' or v_path ~ '(^|/)\.\.(/|$)' then raise exception 'Imagem não pertence à loja do produto' using errcode='23514'; end if;
 end if;
 new.updated_at=now(); return new;
end;$$;

create or replace function kg_private.guard_product_variant() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is not null and not kg_private.is_admin() then
    if TG_OP<>'UPDATE' or not exists(select 1 from public.kg_products p where p.id=old.product_id and kg_private.can_manage_store(p.store_id))
      or (to_jsonb(new)-'price_minor'-'in_stock'-'updated_at') is distinct from (to_jsonb(old)-'price_minor'-'in_stock'-'updated_at') then
      raise exception 'Só podes alterar preço e stock das tuas variantes' using errcode='42501';
    end if;
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

create function public.kg_my_managed_stores()
returns table(id uuid,name text,location text,whatsapp_e164 text,status text,is_open boolean,updated_at timestamptz)
language sql stable security invoker set search_path='' as $$
 select s.id,s.name,s.location,s.whatsapp_e164,s.status,s.is_open,s.updated_at
 from public.kg_stores s
 where (select auth.uid()) is not null and ((select kg_private.is_admin()) or kg_private.can_manage_store(s.id,false))
 order by s.name,s.id;
$$;
revoke all on function public.kg_my_managed_stores() from public,anon;
grant execute on function public.kg_my_managed_stores() to authenticated;

-- Version checks prevent a stale editor overwriting a later change.
create function public.kg_merchant_update_item(
 p_product_id uuid,p_variant_id uuid,p_price_minor bigint,p_in_stock boolean,p_expected_updated_at timestamptz
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_product public.kg_products%rowtype; v_variant public.kg_product_variants%rowtype;
begin
 select * into v_product from public.kg_products where id=p_product_id for update;
 if not found or auth.uid() is null or not(kg_private.is_admin() or kg_private.can_manage_store(v_product.store_id)) then
  raise exception 'Produto fora da tua loja' using errcode='42501';
 end if;
 if not exists(select 1 from public.kg_stores s where s.id=v_product.store_id and s.status='approved') then
  raise exception 'A loja não está activa' using errcode='42501';
 end if;
 if p_price_minor is null or p_price_minor not between 0 and 900000000000 or p_in_stock is null then
  raise exception 'Preço ou stock inválido' using errcode='22023';
 end if;
 if p_variant_id is null then
  if exists(select 1 from public.kg_product_variants where product_id=p_product_id) then
   raise exception 'Altera o preço da variante' using errcode='22023';
  end if;
  if p_expected_updated_at is distinct from v_product.updated_at then raise exception 'O artigo foi alterado. Recarrega o catálogo.' using errcode='40001'; end if;
  update public.kg_products set price_minor=p_price_minor,stock_status=case when p_in_stock then 'available' else 'out' end
  where id=p_product_id returning * into v_product;
  return jsonb_build_object('product_id',v_product.id,'updated_at',v_product.updated_at);
 else
  select * into v_variant from public.kg_product_variants where id=p_variant_id and product_id=p_product_id for update;
  if not found then raise exception 'Variante fora deste artigo' using errcode='42501'; end if;
  if p_expected_updated_at is distinct from v_variant.updated_at then raise exception 'A variante foi alterada. Recarrega o catálogo.' using errcode='40001'; end if;
  update public.kg_product_variants set price_minor=p_price_minor,in_stock=p_in_stock where id=p_variant_id returning * into v_variant;
  update public.kg_products set stock_status=case when exists(select 1 from public.kg_product_variants where product_id=p_product_id and in_stock) then 'available' else 'out' end where id=p_product_id;
  return jsonb_build_object('product_id',p_product_id,'variant_id',v_variant.id,'updated_at',v_variant.updated_at);
 end if;
end;$$;
revoke all on function public.kg_merchant_update_item(uuid,uuid,bigint,boolean,timestamptz) from public,anon;
grant execute on function public.kg_merchant_update_item(uuid,uuid,bigint,boolean,timestamptz) to authenticated;

-- Counts represent recorded interactions, not sales or unique people.
create table public.kg_store_events (
 id uuid primary key,
 store_id uuid not null references public.kg_stores(id) on delete cascade,
 kind text not null check(kind in ('store_view','whatsapp_click')),
 created_at timestamptz not null default now()
);
create index kg_store_events_store_time_idx on public.kg_store_events(store_id,created_at desc) include(kind);
alter table public.kg_store_events enable row level security;
revoke all on public.kg_store_events from public,anon,authenticated;
grant insert(id,store_id,kind) on public.kg_store_events to anon,authenticated;
grant select on public.kg_store_events to authenticated;
create policy kg_events_record on public.kg_store_events for insert to anon,authenticated
with check(exists(select 1 from public.kg_stores s where s.id=store_id and s.status='approved'));
create policy kg_events_merchant_read on public.kg_store_events for select to authenticated
using((select kg_private.is_admin()) or kg_private.can_manage_store(store_id,false));

create function public.kg_merchant_metrics(p_store_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_visits bigint;v_clicks bigint;v_products bigint;
begin
 if auth.uid() is null or not(kg_private.is_admin() or kg_private.can_manage_store(p_store_id,false)) then
  raise exception 'Acesso à loja obrigatório' using errcode='42501';
 end if;
 select count(*) filter(where kind='store_view'),count(*) filter(where kind='whatsapp_click') into v_visits,v_clicks
 from public.kg_store_events where store_id=p_store_id and created_at>=now()-interval '7 days';
 select count(*) into v_products from public.kg_products where store_id=p_store_id and status='published';
 return jsonb_build_object('store_views',v_visits,'whatsapp_clicks',v_clicks,'active_products',v_products,'days',7,'as_of',now());
end;$$;
revoke all on function public.kg_merchant_metrics(uuid) from public,anon;
grant execute on function public.kg_merchant_metrics(uuid) to authenticated;
notify pgrst,'reload schema';
