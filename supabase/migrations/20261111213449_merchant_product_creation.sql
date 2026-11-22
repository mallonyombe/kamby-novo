-- Initial category choices explicitly supplied for the new-product form.
insert into public.kg_categories(name,slug,is_active) values
 ('Casa & Decoração','casa',true),('Moda & Calçado','moda',true),
 ('Electrónica','eletronicos',true),('Mercearia','alimentos',true)
on conflict(slug) do nothing;

-- This private request record makes retries idempotent and gates the atomic insert.
create table kg_private.product_creations (
 product_id uuid primary key,
 store_id uuid not null references public.kg_stores(id) on delete cascade,
 created_by uuid not null references auth.users(id) on delete cascade,
 payload jsonb not null,
 created_at timestamptz not null default now()
);
create index kg_product_creations_actor_idx on kg_private.product_creations(created_by,store_id);
alter table kg_private.product_creations enable row level security;
revoke all on kg_private.product_creations from public,anon,authenticated;
create policy kg_creation_no_direct_access on kg_private.product_creations for select to authenticated using(false);

create function kg_private.is_new_product(p_product_id uuid,p_store_id uuid)
returns boolean language sql volatile security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(
  select 1 from kg_private.product_creations c where c.product_id=p_product_id and c.store_id=p_store_id
   and c.created_by=(select auth.uid())
 ) and (kg_private.is_admin() or kg_private.can_manage_store(p_store_id));
$$;
revoke all on function kg_private.is_new_product(uuid,uuid) from public,anon;
grant execute on function kg_private.is_new_product(uuid,uuid) to authenticated;

create function kg_private.can_upload_product_image(p_name text)
returns boolean language sql stable security invoker set search_path='' as $$
 select (select auth.uid()) is not null
  and p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/photo\.(jpg|png|webp)$'
  and (storage.foldername(p_name))[1]=(select auth.uid())::text
  and exists(select 1 from public.kg_stores s where s.id::text=(storage.foldername(p_name))[2]
   and kg_private.can_manage_store(s.id));
$$;
revoke all on function kg_private.can_upload_product_image(text) from public,anon;
grant execute on function kg_private.can_upload_product_image(text) to authenticated;

-- Failed uploads may be removed; files already attached to any article are protected,
-- even if RLS hides that article after a permission change.
create function kg_private.can_remove_product_upload(p_name text)
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null
  and p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/photo\.(jpg|png|webp)$'
  and split_part(p_name,'/',1)=(select auth.uid())::text
  and not exists(select 1 from public.kg_product_images i where i.storage_path=p_name)
  and not exists(select 1 from public.kg_products p where right(p.image_url,char_length('/kg-product-images/' || p_name))='/kg-product-images/' || p_name);
$$;
revoke all on function kg_private.can_remove_product_upload(text) from public,anon;
grant execute on function kg_private.can_remove_product_upload(text) to authenticated;

create policy kg_merchant_upload_insert on storage.objects for insert to authenticated
with check(bucket_id='kg-product-images' and kg_private.can_upload_product_image(name));
create policy kg_merchant_upload_read on storage.objects for select to authenticated
using(bucket_id='kg-product-images' and kg_private.can_upload_product_image(name));
create policy kg_merchant_upload_cleanup on storage.objects for delete to authenticated
using(bucket_id='kg-product-images' and kg_private.can_remove_product_upload(name));

create function public.kg_product_upload_context(p_store_id uuid,p_product_id uuid,p_extension text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_store public.kg_stores%rowtype;v_prefix uuid;
begin
 if auth.uid() is null or not(kg_private.is_admin() or kg_private.can_manage_store(p_store_id)) then raise exception 'Acesso à loja obrigatório' using errcode='42501';end if;
 select * into v_store from public.kg_stores where id=p_store_id and status='approved';
 if not found then raise exception 'A loja não está activa' using errcode='42501';end if;
 if p_product_id is null or p_extension is null or p_extension not in ('jpg','png','webp') then raise exception 'Fotografia inválida' using errcode='22023';end if;
 v_prefix=case when kg_private.is_admin() then v_store.owner_id else auth.uid() end;
 return jsonb_build_object('path',v_prefix::text || '/' || p_store_id::text || '/' || p_product_id::text || '/photo.' || p_extension);
end;$$;
revoke all on function public.kg_product_upload_context(uuid,uuid,text) from public,anon;
grant execute on function public.kg_product_upload_context(uuid,uuid,text) to authenticated;

create or replace function kg_private.guard_product() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_owner uuid; v_path text;
begin
 if auth.uid() is not null and not kg_private.is_admin() then
   if TG_OP='INSERT' and kg_private.is_new_product(new.id,new.store_id) then
    null;
   elsif TG_OP<>'UPDATE' or not kg_private.can_manage_store(old.store_id)
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
    if TG_OP='INSERT' and exists(select 1 from public.kg_products p where p.id=new.product_id and kg_private.is_new_product(p.id,p.store_id)) then
      null;
    elsif TG_OP<>'UPDATE' or not exists(select 1 from public.kg_products p where p.id=old.product_id and kg_private.can_manage_store(p.store_id))
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

create or replace function kg_private.image_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_store uuid;v_owner uuid;
begin
 if auth.uid() is null and current_setting('role',true) in ('anon','authenticated') then raise exception 'Sessão obrigatória' using errcode='42501';end if;
 select p.store_id,s.owner_id into v_store,v_owner from public.kg_products p join public.kg_stores s on s.id=p.store_id where p.id=new.product_id;
 if auth.uid() is not null and not kg_private.is_admin() then
  if TG_OP<>'INSERT' or not kg_private.is_new_product(new.product_id,v_store)
    or new.storage_path not like auth.uid()::text || '/' || v_store::text || '/' || new.product_id::text || '/%'
    or not exists(select 1 from kg_private.product_creations c where c.product_id=new.product_id and c.payload->>'image_path'=new.storage_path) then
   raise exception 'Fotografia fora da publicação autorizada' using errcode='42501';
  end if;
 elsif v_store is null or new.storage_path not like v_owner::text || '/' || v_store::text || '/%' then
  raise exception 'Imagem não pertence à loja do produto' using errcode='23514';
 end if;
 if new.storage_path ~ '(^|/)\.\.(/|$)' then raise exception 'Caminho de imagem inválido' using errcode='23514';end if;
 return new;
end;$$;

create function kg_private.create_merchant_product(
 p_product_id uuid,p_store_id uuid,p_category_id uuid,p_title text,p_price_minor bigint,p_option_name text,p_description text,p_image_path text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_store public.kg_stores%rowtype;v_payload jsonb;v_existing kg_private.product_creations%rowtype;
 v_product public.kg_products%rowtype;v_rows integer;v_path text;v_ext text;v_mime text;v_metadata jsonb;
begin
 if auth.uid() is null or not(kg_private.is_admin() or kg_private.can_manage_store(p_store_id)) then raise exception 'Acesso à loja obrigatório' using errcode='42501';end if;
 select * into v_store from public.kg_stores where id=p_store_id and status='approved' for share;
 if not found then raise exception 'A loja não está activa' using errcode='42501';end if;
 p_title=trim(coalesce(p_title,''));p_description=trim(coalesce(p_description,''));p_option_name=trim(coalesce(p_option_name,''));
 if p_product_id is null or char_length(p_title) not between 2 and 160 or char_length(p_description)>5000 or char_length(p_option_name)>120
  or p_price_minor is null or p_price_minor not between 1 and 900000000000 then raise exception 'Dados do artigo inválidos' using errcode='22023';end if;
 v_ext=split_part(p_image_path,'.',2);
 if v_ext is null or v_ext not in ('jpg','png','webp') then raise exception 'Fotografia inválida' using errcode='22023';end if;
 v_path=(case when kg_private.is_admin() then v_store.owner_id else auth.uid() end)::text || '/' || p_store_id::text || '/' || p_product_id::text || '/photo.' || v_ext;
 if p_image_path is null or p_image_path is distinct from v_path then raise exception 'Fotografia fora desta loja ou artigo' using errcode='42501';end if;
 v_payload=jsonb_build_object('category_id',p_category_id,'title',p_title,'price_minor',p_price_minor,'option_name',p_option_name,'description',p_description,'image_path',p_image_path);
 insert into kg_private.product_creations(product_id,store_id,created_by,payload) values(p_product_id,p_store_id,auth.uid(),v_payload)
 on conflict(product_id) do nothing;
 get diagnostics v_rows=row_count;
 if v_rows=0 then
  select * into v_existing from kg_private.product_creations where product_id=p_product_id for update;
  if v_existing.created_by is distinct from auth.uid() or v_existing.store_id is distinct from p_store_id then raise exception 'Pedido de publicação inacessível' using errcode='42501';end if;
  if v_existing.payload is distinct from v_payload then raise exception 'Este pedido já foi usado com outros dados' using errcode='22023';end if;
  select * into v_product from public.kg_products where id=p_product_id and store_id=p_store_id;
  if not found then raise exception 'Este artigo já foi removido pela gestão' using errcode='23514';end if;
  return jsonb_build_object('id',v_product.id,'status',v_product.status);
 end if;
 if not exists(select 1 from public.kg_categories where id=p_category_id and is_active) then raise exception 'Selecciona uma categoria disponível' using errcode='22023';end if;
 select metadata into v_metadata from storage.objects where bucket_id='kg-product-images' and name=p_image_path;
 if not found then raise exception 'Envia a fotografia antes de publicar' using errcode='22023';end if;
 v_mime=case v_ext when 'jpg' then 'image/jpeg' when 'png' then 'image/png' else 'image/webp' end;
 if v_metadata->>'mimetype' is distinct from v_mime
  or coalesce((v_metadata->>'size')::bigint,(v_metadata->>'contentLength')::bigint,0) not between 1 and 5242880 then
  raise exception 'Fotografia inválida ou maior que 5 MB' using errcode='22023';end if;
 insert into public.kg_products(id,store_id,category_id,title,description,price_minor,currency,stock_status,status,unit_reference)
 values(p_product_id,p_store_id,p_category_id,p_title,p_description,p_price_minor,'MZN','available','published','un') returning * into v_product;
 if p_option_name<>'' then
  insert into public.kg_product_variants(product_id,sku,option_name,price_minor,in_stock)
  values(p_product_id,'KB-' || replace(p_product_id::text,'-','') || '-1',p_option_name,p_price_minor,true);
 end if;
 insert into public.kg_product_images(product_id,storage_path,sort_order) values(p_product_id,p_image_path,0);
 return jsonb_build_object('id',v_product.id,'status',v_product.status);
end;$$;
revoke all on function kg_private.create_merchant_product(uuid,uuid,uuid,text,bigint,text,text,text) from public,anon;
grant execute on function kg_private.create_merchant_product(uuid,uuid,uuid,text,bigint,text,text,text) to authenticated;
create function public.kg_merchant_create_product(
 p_product_id uuid,p_store_id uuid,p_category_id uuid,p_title text,p_price_minor bigint,p_option_name text,p_description text,p_image_path text
) returns jsonb language sql security invoker set search_path='' as $$
 select kg_private.create_merchant_product(p_product_id,p_store_id,p_category_id,p_title,p_price_minor,p_option_name,p_description,p_image_path);
$$;
revoke all on function public.kg_merchant_create_product(uuid,uuid,uuid,text,bigint,text,text,text) from public,anon;
grant execute on function public.kg_merchant_create_product(uuid,uuid,uuid,text,bigint,text,text,text) to authenticated;
notify pgrst,'reload schema';
