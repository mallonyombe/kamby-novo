-- Merchant workspace: atomic, versioned document edits; direct table grants remain narrow.
alter table public.kg_products
 add column condition text not null default 'new' check(condition in ('new','used','refurbished')),
 add column attributes text not null default '' check(char_length(attributes)<=1000),
 add column previous_price_minor bigint check(previous_price_minor>0 and previous_price_minor<=900000000000),
 add column stock_quantity integer check(stock_quantity between 0 and 1000000000),
 add column moderation_status text not null default 'allowed' check(moderation_status in ('allowed','blocked'));
alter table public.kg_product_variants
 add column active boolean not null default true,
 add column sort_order integer not null default 0 check(sort_order between 0 and 99),
 add column track_quantity boolean not null default false,
 add column previous_price_minor bigint check(previous_price_minor>0 and previous_price_minor<=900000000000),
 add column image_path text check(char_length(image_path)<=500);
update public.kg_product_variants set track_quantity=true where stock_quantity>0;
alter table public.kg_stores
 add column logo_path text check(char_length(logo_path)<=500),
 add column banner_path text check(char_length(banner_path)<=500),
 add column address text not null default '' check(char_length(address)<=300),
 add column service_area text not null default '' check(char_length(service_area)<=300),
 add column opening_hours jsonb not null default '[]' check(jsonb_typeof(opening_hours)='array' and jsonb_array_length(opening_hours)<=7 and octet_length(opening_hours::text)<=6000);
create table public.kg_store_categories(store_id uuid not null references public.kg_stores on delete cascade,category_id uuid not null references public.kg_categories,primary key(store_id,category_id));
create index kg_store_categories_category_idx on public.kg_store_categories(category_id);
alter table public.kg_store_categories enable row level security;
grant select on public.kg_store_categories to anon,authenticated;
grant insert,update,delete on public.kg_store_categories to authenticated;
create policy kg_store_categories_read on public.kg_store_categories for select using(true);
create policy kg_store_categories_admin on public.kg_store_categories for all to authenticated using((select kg_private.is_admin())) with check((select kg_private.is_admin()));
insert into public.kg_store_categories select s.id,c.id from public.kg_stores s cross join public.kg_categories c where c.is_active;
create function kg_private.assign_initial_categories() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.kg_store_categories select new.id,id from public.kg_categories where is_active; return new;end;$$;
revoke all on function kg_private.assign_initial_categories() from public,anon,authenticated;
create trigger kg_initial_categories after insert on public.kg_stores for each row execute function kg_private.assign_initial_categories();

create policy kg_products_moderation on public.kg_products as restrictive for select to anon,authenticated
 using(moderation_status='allowed' or (select kg_private.is_admin()) or kg_private.can_manage_store(store_id,false));
create policy kg_variants_active on public.kg_product_variants as restrictive for select to anon,authenticated
 using(active or (select kg_private.is_admin()) or exists(select 1 from public.kg_products p where p.id=product_id and kg_private.can_manage_store(p.store_id,false)));

alter table public.kg_product_variants drop constraint kg_product_variants_product_id_option_name_key;
create unique index kg_variant_active_option on public.kg_product_variants(product_id,lower(option_name)) where active;

-- An unexposed, transaction-scoped permit prevents clients from broadening trigger access.
create table kg_private.editor_context(tx bigint primary key,actor_id uuid not null,store_id uuid not null,product_id uuid);
alter table kg_private.editor_context enable row level security;
revoke all on kg_private.editor_context from public,anon,authenticated;
create policy kg_editor_no_access on kg_private.editor_context for select to authenticated using(false);
create function kg_private.in_editor(p_store uuid,p_product uuid) returns boolean language sql volatile security definer set search_path='' as $$select auth.uid() is not null and exists(select 1 from kg_private.editor_context where tx=txid_current() and actor_id=auth.uid() and store_id=p_store and product_id is not distinct from p_product)$$;
revoke all on function kg_private.in_editor(uuid,uuid) from public,anon;
grant execute on function kg_private.in_editor(uuid,uuid) to authenticated;
create or replace function kg_private.guard_product() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_owner uuid; v_path text;
begin
 if TG_OP='UPDATE' and kg_private.in_editor(new.store_id,new.id) and new.moderation_status is distinct from old.moderation_status then raise exception 'A moderação pertence à administração' using errcode='42501';end if;
 if auth.uid() is not null and not kg_private.is_admin() and not kg_private.in_editor(new.store_id,new.id) then
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
 new.updated_at=clock_timestamp(); return new;
end;$$;
create or replace function kg_private.guard_product_variant() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is not null and not kg_private.is_admin() and not exists(select 1 from public.kg_products p where p.id=new.product_id and kg_private.in_editor(p.store_id,p.id)) then
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
  if new.track_quantity and new.stock_quantity=0 then new.in_stock=false;end if;
  new.sku=trim(new.sku);
  new.option_name=trim(new.option_name);
  new.updated_at=clock_timestamp();
  return new;
end;$$;
create or replace function kg_private.image_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_store uuid;v_owner uuid;
begin
 if auth.uid() is null and current_setting('role',true) in ('anon','authenticated') then raise exception 'Sessão obrigatória' using errcode='42501';end if;
 select p.store_id,s.owner_id into v_store,v_owner from public.kg_products p join public.kg_stores s on s.id=p.store_id where p.id=new.product_id;
 if kg_private.in_editor(v_store,new.product_id) then return new;end if;
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
create or replace function kg_private.guard_store() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='UPDATE' and kg_private.in_editor(old.id,null) then
  if (to_jsonb(new)-array['name','description','whatsapp_e164','location','logo_path','banner_path','address','service_area','opening_hours','updated_at']) is distinct from (to_jsonb(old)-array['name','description','whatsapp_e164','location','logo_path','banner_path','address','service_area','opening_hours','updated_at']) then raise exception 'Estado e permissões pertencem à administração' using errcode='42501';end if;
  new.updated_at=clock_timestamp();return new;
 end if;
 if auth.uid() is not null and not kg_private.is_admin() then
   if TG_OP<>'UPDATE' or not kg_private.can_manage_store(old.id)
     or (to_jsonb(new)-'is_open'-'updated_at') is distinct from (to_jsonb(old)-'is_open'-'updated_at') then
     raise exception 'Só podes alterar a abertura da tua loja' using errcode='42501';
   end if;
   new.updated_at=clock_timestamp(); return new;
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
 new.updated_at=clock_timestamp(); return new;
end;$$;
create or replace function kg_private.can_upload_product_image(p_name text) returns boolean language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/(photo|[0-9a-f-]{36})\.(jpg|png|webp)$' and split_part(p_name,'/',1)=auth.uid()::text and exists(select 1 from public.kg_stores s where s.id::text=split_part(p_name,'/',2) and kg_private.can_manage_store(s.id));$$;
create or replace function kg_private.can_remove_product_upload(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and split_part(p_name,'/',1)=auth.uid()::text
 and not exists(select 1 from public.kg_product_images where storage_path=p_name)
 and not exists(select 1 from public.kg_stores where logo_path=p_name or banner_path=p_name)
 and not exists(select 1 from public.kg_products p where right(p.image_url,char_length('/kg-product-images/'||p_name))='/kg-product-images/'||p_name);$$;
create policy kg_merchant_images_read on storage.objects for select to authenticated using(bucket_id='kg-product-images' and exists(select 1 from public.kg_product_images i join public.kg_products p on p.id=i.product_id where i.storage_path=name and kg_private.can_manage_store(p.store_id,false)));
create policy kg_store_artwork_read on storage.objects for select to anon,authenticated using(bucket_id='kg-product-images' and exists(select 1 from public.kg_stores s where (s.logo_path=name or s.banner_path=name) and (s.status='approved' or kg_private.can_manage_store(s.id,false) or kg_private.is_admin())));
create function kg_private.validate_editor_image(p_path text,p_store uuid,p_product uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_meta jsonb;begin
 if p_path is null or p_path ~ '(^|/)\.\.(/|$)' or split_part(p_path,'/',2)<>p_store::text then raise exception 'Fotografia fora desta loja' using errcode='42501';end if;
 if not exists(select 1 from public.kg_product_images i join public.kg_products p on p.id=i.product_id where i.storage_path=p_path and p.store_id=p_store)
 and not exists(select 1 from public.kg_stores where id=p_store and (logo_path=p_path or banner_path=p_path)) then
  if not (split_part(p_path,'/',1)=auth.uid()::text or coalesce((select owner_id::text=split_part(p_path,'/',1) from public.kg_stores where id=p_store and kg_private.is_admin()),false)) or split_part(p_path,'/',3)<>p_product::text or p_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/(photo|[0-9a-f-]{36})\.(jpg|png|webp)$' then raise exception 'Envio não autorizado' using errcode='42501';end if;
 end if;
 select metadata into v_meta from storage.objects where bucket_id='kg-product-images' and name=p_path;
 if not found or coalesce((v_meta->>'size')::bigint,(v_meta->>'contentLength')::bigint,0) not between 1 and 5242880 or v_meta->>'mimetype' not in ('image/jpeg','image/png','image/webp') then raise exception 'Envia uma fotografia válida antes de guardar' using errcode='22023';end if;
end;$$;
revoke all on function kg_private.validate_editor_image(text,uuid,uuid) from public,anon,authenticated;
create table kg_private.editor_requests(id uuid primary key,actor_id uuid not null,store_id uuid not null,payload jsonb not null,result jsonb not null);
alter table kg_private.editor_requests enable row level security;
revoke all on kg_private.editor_requests from public,anon,authenticated;
create policy kg_editor_requests_private on kg_private.editor_requests for select to authenticated using(false);

create function kg_private.save_catalogue_product(p_request_id uuid,p_store_id uuid,p_product_id uuid,p_expected_updated_at timestamptz,p_document jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_product public.kg_products%rowtype;v_req kg_private.editor_requests%rowtype;v_variant jsonb;v_image text;v_price bigint;v_previous bigint;v_title text;v_status text;v_id uuid;v_ids uuid[]='{}';v_count integer;v_stock boolean;v_result jsonb;v_payload jsonb;v_order integer=0;
begin
 if auth.uid() is null or not(kg_private.is_admin() or kg_private.can_manage_store(p_store_id)) then raise exception 'Sem permissões para esta loja' using errcode='42501';end if;
 perform 1 from public.kg_stores where id=p_store_id and status='approved' for share;
 if not found then raise exception 'Loja não aprovada' using errcode='42501';end if;
 if p_request_id is null or p_product_id is null or p_document is null or jsonb_typeof(p_document)<>'object' or octet_length(p_document::text)>200000 then raise exception 'Documento inválido' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 v_payload=jsonb_build_object('product_id',p_product_id,'expected',p_expected_updated_at,'document',p_document);
 select * into v_req from kg_private.editor_requests where id=p_request_id;
 if found then
  if v_req.actor_id<>auth.uid() or v_req.store_id<>p_store_id or v_req.payload<>v_payload then raise exception 'Pedido reutilizado com dados diferentes' using errcode='22023';end if;return v_req.result;
 end if;
 select * into v_product from public.kg_products where id=p_product_id for update;
 if found then
  if v_product.store_id<>p_store_id then raise exception 'Produto fora desta loja' using errcode='42501';end if;
  if v_product.updated_at is distinct from p_expected_updated_at then raise exception 'Outro colaborador alterou o produto. Reabre a versão actual antes de guardar.' using errcode='40001';end if;
  if v_product.moderation_status='blocked' then raise exception 'Produto bloqueado pela administração' using errcode='42501';end if;
 elsif p_expected_updated_at is not null then raise exception 'Produto removido' using errcode='40001';end if;
 v_title=trim(coalesce(p_document->>'title',''));v_status=p_document->>'status';
 if char_length(v_title) not between 2 and 160 or v_status not in ('draft','published','archived') or v_status is null or char_length(coalesce(p_document->>'description',''))>5000 or char_length(coalesce(p_document->>'attributes',''))>1000 or coalesce(p_document->>'condition','new') not in ('new','used','refurbished') then raise exception 'Confere as informações do artigo' using errcode='22023';end if;
 if not exists(select 1 from public.kg_categories c join public.kg_store_categories sc on sc.category_id=c.id where sc.store_id=p_store_id and c.id=(p_document->>'category_id')::uuid and c.is_active) then raise exception 'Categoria não permitida nesta loja' using errcode='22023';end if;
 if jsonb_typeof(p_document->'images') is distinct from 'array' or jsonb_array_length(p_document->'images')>10 or jsonb_typeof(p_document->'variants') is distinct from 'array' or jsonb_array_length(p_document->'variants')>100 then raise exception 'Galeria ou variantes inválidas' using errcode='22023';end if;
 if (select count(*)<>count(distinct value) from jsonb_array_elements_text(p_document->'images')) then raise exception 'Fotografia duplicada' using errcode='22023';end if;
 if v_status='published' and jsonb_array_length(p_document->'images')=0 and coalesce(v_product.image_url,'')='' then raise exception 'Adiciona uma fotografia para publicar' using errcode='22023';end if;
 for v_image in select jsonb_array_elements_text(p_document->'images') loop perform kg_private.validate_editor_image(v_image,p_store_id,p_product_id);end loop;
 v_count=jsonb_array_length(p_document->'variants');
 if (select count(*)<>count(distinct lower(trim(value->>'option_name'))) from jsonb_array_elements(p_document->'variants')) then raise exception 'Há variantes com o mesmo nome' using errcode='22023';end if;
 v_price=coalesce((p_document->>'price_minor')::bigint,0);v_previous=(p_document->>'previous_price_minor')::bigint;
 if v_count>0 then select min((value->>'price_minor')::bigint) into v_price from jsonb_array_elements(p_document->'variants');v_previous=null;end if;
 if v_price is null or v_price not between 0 and 900000000000 or (v_status='published' and v_price=0) or (v_previous is not null and v_previous<=v_price) then raise exception 'Preço ou promoção inválidos' using errcode='22023';end if;
 insert into kg_private.editor_context values(txid_current(),auth.uid(),p_store_id,p_product_id);
 insert into public.kg_products(id,store_id,category_id,title,description,price_minor,currency,stock_status,status,condition,attributes,previous_price_minor,stock_quantity)
 values(p_product_id,p_store_id,(p_document->>'category_id')::uuid,v_title,coalesce(p_document->>'description',''),v_price,'MZN','available',v_status,coalesce(p_document->>'condition','new'),coalesce(p_document->>'attributes',''),v_previous,(p_document->>'stock_quantity')::integer)
 on conflict(id) do update set category_id=excluded.category_id,title=excluded.title,description=excluded.description,price_minor=excluded.price_minor,status=excluded.status,condition=excluded.condition,attributes=excluded.attributes,previous_price_minor=excluded.previous_price_minor,stock_quantity=excluded.stock_quantity;
 -- Retired variants retain identity and labels for saved carts.
 update public.kg_product_variants set active=false where product_id=p_product_id;
 for v_variant in select value from jsonb_array_elements(p_document->'variants') loop
  v_id=(v_variant->>'id')::uuid;
  if v_id is null or v_id=any(v_ids) then raise exception 'Identificador de variante duplicado' using errcode='22023';end if;v_ids=array_append(v_ids,v_id);
  if exists(select 1 from public.kg_product_variants where id=v_id and product_id<>p_product_id) then raise exception 'Variante fora deste produto' using errcode='42501';end if;
  v_price=(v_variant->>'price_minor')::bigint;v_previous=(v_variant->>'previous_price_minor')::bigint;
  if char_length(trim(coalesce(v_variant->>'option_name',''))) not between 1 and 120 or v_price is null or v_price not between 0 and 900000000000 or (v_status='published' and v_price=0) or (v_previous is not null and v_previous<=v_price) then raise exception 'Nome, preço ou promoção da variante inválidos' using errcode='22023';end if;
  if nullif(v_variant->>'image_path','') is not null and not (p_document->'images' ? (v_variant->>'image_path')) then raise exception 'A fotografia da variante deve fazer parte da galeria' using errcode='22023';end if;
  v_stock=coalesce((v_variant->>'in_stock')::boolean,true) and (not coalesce((v_variant->>'track_quantity')::boolean,false) or coalesce((v_variant->>'stock_quantity')::integer,0)>0);
  insert into public.kg_product_variants(id,product_id,sku,option_name,price_minor,in_stock,stock_quantity,track_quantity,active,sort_order,previous_price_minor,image_path)
  values(v_id,p_product_id,'KB-'||replace(v_id::text,'-',''),trim(v_variant->>'option_name'),v_price,v_stock,coalesce((v_variant->>'stock_quantity')::integer,0),coalesce((v_variant->>'track_quantity')::boolean,false),true,v_order,v_previous,nullif(v_variant->>'image_path',''))
  on conflict(id) do update set option_name=excluded.option_name,price_minor=excluded.price_minor,in_stock=excluded.in_stock,stock_quantity=excluded.stock_quantity,track_quantity=excluded.track_quantity,active=true,sort_order=excluded.sort_order,previous_price_minor=excluded.previous_price_minor,image_path=excluded.image_path;
  v_order=v_order+1;
 end loop;
 if v_count>0 then select min(price_minor),bool_or(in_stock) into v_price,v_stock from public.kg_product_variants where product_id=p_product_id and active;
 else v_price=coalesce((p_document->>'price_minor')::bigint,0);v_stock=coalesce((p_document->>'in_stock')::boolean,true) and (p_document->>'stock_quantity' is null or (p_document->>'stock_quantity')::integer>0);end if;
 -- Drop only gallery references, never Storage metadata. Storage API cleanup is a separate step.
 delete from public.kg_product_images where product_id=p_product_id;
 v_order=0;for v_image in select jsonb_array_elements_text(p_document->'images') loop insert into public.kg_product_images(product_id,storage_path,sort_order) values(p_product_id,v_image,v_order);v_order=v_order+1;end loop;
 update public.kg_products set price_minor=v_price,stock_status=case when v_stock then 'available' else 'out' end where id=p_product_id returning * into v_product;
 delete from kg_private.editor_context where tx=txid_current();
 v_result=jsonb_build_object('id',p_product_id,'status',v_product.status,'updated_at',v_product.updated_at);
 insert into kg_private.editor_requests values(p_request_id,auth.uid(),p_store_id,v_payload,v_result);
 return v_result;
end;$$;
revoke all on function kg_private.save_catalogue_product(uuid,uuid,uuid,timestamptz,jsonb) from public,anon;
grant execute on function kg_private.save_catalogue_product(uuid,uuid,uuid,timestamptz,jsonb) to authenticated;
create function public.kg_save_catalogue_product(p_request_id uuid,p_store_id uuid,p_product_id uuid,p_expected_updated_at timestamptz,p_document jsonb) returns jsonb language sql security invoker set search_path='' as $$select kg_private.save_catalogue_product(p_request_id,p_store_id,p_product_id,p_expected_updated_at,p_document)$$;
revoke all on function public.kg_save_catalogue_product(uuid,uuid,uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.kg_save_catalogue_product(uuid,uuid,uuid,timestamptz,jsonb) to authenticated;

create function kg_private.save_store_settings(p_store_id uuid,p_expected_updated_at timestamptz,p_document jsonb) returns public.kg_stores language plpgsql security definer set search_path='' as $$
declare v_store public.kg_stores%rowtype;v_hour jsonb;v_path text;begin
 if auth.uid() is null or not(kg_private.is_admin() or kg_private.can_manage_store(p_store_id)) then raise exception 'Sem permissões para esta loja' using errcode='42501';end if;
 select * into v_store from public.kg_stores where id=p_store_id for update;
 if v_store.updated_at is distinct from p_expected_updated_at then raise exception 'A loja foi alterada noutra sessão. Recarrega antes de guardar.' using errcode='40001';end if;
 if char_length(trim(coalesce(p_document->>'name',''))) not between 2 and 80 or coalesce(p_document->>'whatsapp_e164','') !~ '^\+[1-9][0-9]{7,14}$' or char_length(coalesce(p_document->>'location',''))>120 or char_length(coalesce(p_document->>'description',''))>2000 or char_length(coalesce(p_document->>'address',''))>300 or char_length(coalesce(p_document->>'service_area',''))>300 then raise exception 'Confere os dados da loja e o WhatsApp com indicativo' using errcode='22023';end if;
 if jsonb_typeof(p_document->'opening_hours') is distinct from 'array' or jsonb_array_length(p_document->'opening_hours')>7 then raise exception 'Horário inválido' using errcode='22023';end if;
 for v_hour in select value from jsonb_array_elements(p_document->'opening_hours') loop
  if v_hour->>'day' is null or (v_hour->>'day')::integer not between 0 and 6 or (not coalesce((v_hour->>'closed')::boolean,false) and (coalesce(v_hour->>'open','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(v_hour->>'close','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or (v_hour->>'open')>=(v_hour->>'close'))) then raise exception 'Confere as horas de abertura e fecho' using errcode='22023';end if;
 end loop;
 if (select count(*)<>count(distinct value->>'day') from jsonb_array_elements(p_document->'opening_hours')) then raise exception 'Dia duplicado no horário' using errcode='22023';end if;
 for v_path in select x from unnest(array[nullif(p_document->>'logo_path',''),nullif(p_document->>'banner_path','')]) x where x is not null loop perform kg_private.validate_editor_image(v_path,p_store_id,p_store_id);end loop;
 insert into kg_private.editor_context values(txid_current(),auth.uid(),p_store_id,null);
 update public.kg_stores set name=trim(p_document->>'name'),description=coalesce(p_document->>'description',''),whatsapp_e164=p_document->>'whatsapp_e164',location=coalesce(p_document->>'location',''),address=coalesce(p_document->>'address',''),service_area=coalesce(p_document->>'service_area',''),opening_hours=p_document->'opening_hours',logo_path=nullif(p_document->>'logo_path',''),banner_path=nullif(p_document->>'banner_path','') where id=p_store_id returning * into v_store;
 delete from kg_private.editor_context where tx=txid_current();return v_store;
end;$$;
revoke all on function kg_private.save_store_settings(uuid,timestamptz,jsonb) from public,anon;
grant execute on function kg_private.save_store_settings(uuid,timestamptz,jsonb) to authenticated;
create function public.kg_save_store_settings(p_store_id uuid,p_expected_updated_at timestamptz,p_document jsonb) returns public.kg_stores language sql security invoker set search_path='' as $$select kg_private.save_store_settings(p_store_id,p_expected_updated_at,p_document)$$;
revoke all on function public.kg_save_store_settings(uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.kg_save_store_settings(uuid,timestamptz,jsonb) to authenticated;

create table public.kg_catalogue_activity(id uuid primary key default gen_random_uuid(),store_id uuid not null references public.kg_stores on delete cascade,product_id uuid,kind text not null,title text not null,created_at timestamptz not null default now());
alter table public.kg_catalogue_activity enable row level security;
grant select on public.kg_catalogue_activity to authenticated;
create policy kg_catalogue_activity_read on public.kg_catalogue_activity for select to authenticated using((select kg_private.is_admin()) or kg_private.can_manage_store(store_id,false));
create index kg_catalogue_activity_store_time on public.kg_catalogue_activity(store_id,created_at desc);
create function kg_private.record_catalogue_edit() returns trigger language plpgsql security definer set search_path='' as $$begin
 if TG_OP='INSERT' or (to_jsonb(new)-'updated_at') is distinct from (to_jsonb(old)-'updated_at') then
 insert into public.kg_catalogue_activity(store_id,product_id,kind,title) values(new.store_id,new.id,case when TG_OP='INSERT' then 'created' when new.status='archived' then 'archived' when new.status='published' and old.status<>'published' then 'published' else 'updated' end,new.title);end if;return new;end;$$;
revoke all on function kg_private.record_catalogue_edit() from public,anon,authenticated;
create trigger kg_catalogue_activity after insert or update on public.kg_products for each row execute function kg_private.record_catalogue_edit();
create function public.kg_merchant_activity(p_store_id uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$declare v_days jsonb;v_recent jsonb;begin
 if auth.uid() is null or not(kg_private.is_admin() or kg_private.can_manage_store(p_store_id,false)) then raise exception 'Acesso obrigatório' using errcode='42501';end if;
 select jsonb_agg(x order by day) into v_days from (select d::date as day,count(e.id) filter(where kind='store_view') as views,count(e.id) filter(where kind='whatsapp_click') as contacts from generate_series(current_date-6,current_date,'1 day') d left join public.kg_store_events e on e.store_id=p_store_id and e.created_at>=d and e.created_at<d+interval '1 day' group by d) x;
 select coalesce(jsonb_agg(x),'[]') into v_recent from (select id,product_id,kind,title,created_at from public.kg_catalogue_activity where store_id=p_store_id order by created_at desc limit 30) x;
 return jsonb_build_object('days',v_days,'recent',v_recent,'as_of',now());end;$$;
revoke all on function public.kg_merchant_activity(uuid) from public,anon;
grant execute on function public.kg_merchant_activity(uuid) to authenticated;
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
    or v_product.stock_status='out' or v_product.moderation_status='blocked' or (new.variant_id is null and v_product.stock_quantity is not null and new.quantity>v_product.stock_quantity)
    or not exists(select 1 from public.kg_stores where id=v_store and status='approved')
  then
    raise exception 'Produto indisponível ou de outra loja' using errcode='23514';
  end if;

  if new.variant_id is not null then
    select * into v_variant
    from public.kg_product_variants
    where id=new.variant_id and product_id=new.product_id and active and in_stock;
    if not found or (v_variant.track_quantity and new.quantity>v_variant.stock_quantity) then
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
create or replace function public.kg_set_cart_item(
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
      and active and in_stock
      and (not track_quantity or stock_quantity>=p_quantity)
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
      and stock_status<>'out' and moderation_status='allowed'
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
        and active and in_stock
        and (not track_quantity or stock_quantity>=v_quantity)
      for share;
      if not found then
        raise exception 'Variante indisponível ou de outro produto' using errcode='23514';
      end if;
      v_unit_price=v_variant.price_minor;
    else
      if exists(select 1 from public.kg_product_variants where product_id=v_product.id and active) or (v_product.stock_quantity is not null and v_quantity>v_product.stock_quantity) then raise exception 'Selecciona uma variante disponível e confere a quantidade' using errcode='23514';end if;
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
notify pgrst,'reload schema';
