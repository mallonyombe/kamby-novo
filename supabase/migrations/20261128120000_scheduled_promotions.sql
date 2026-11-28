-- Scheduled promotions use the existing discounted price and original price fields.
-- The effective price is resolved when read; no background job changes catalogue rows.
alter table public.kg_products
  add column promotion_starts_at timestamptz,
  add column promotion_ends_at timestamptz,
  add constraint kg_product_promotion_window check (
    (promotion_starts_at is null and promotion_ends_at is null) or (
      previous_price_minor is not null and previous_price_minor > price_minor
      and coalesce(isfinite(promotion_starts_at),true)
      and coalesce(isfinite(promotion_ends_at),true)
      and (promotion_starts_at is null or promotion_ends_at is null or promotion_starts_at < promotion_ends_at)
    )
  );

alter table public.kg_product_variants
  add column promotion_starts_at timestamptz,
  add column promotion_ends_at timestamptz,
  add constraint kg_variant_promotion_window check (
    (promotion_starts_at is null and promotion_ends_at is null) or (
      previous_price_minor is not null and previous_price_minor > price_minor
      and coalesce(isfinite(promotion_starts_at),true)
      and coalesce(isfinite(promotion_ends_at),true)
      and (promotion_starts_at is null or promotion_ends_at is null or promotion_starts_at < promotion_ends_at)
    )
  );

create function kg_private.promotion_active(p_price bigint,p_previous bigint,p_start timestamptz,p_end timestamptz,p_at timestamptz)
returns boolean language sql immutable security invoker set search_path='' as $$
  select coalesce(p_previous > p_price,false)
    and (p_start is null or p_start <= p_at)
    and (p_end is null or p_at < p_end)
$$;

revoke all on function kg_private.promotion_active(bigint,bigint,timestamptz,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function kg_private.promotion_active(bigint,bigint,timestamptz,timestamptz,timestamptz) to anon,authenticated;

-- PostgREST exposes these as read-only computed fields on rows already allowed by RLS.
create function public.effective_previous_price_minor(public.kg_products)
returns bigint language sql stable security invoker set search_path='' as $$
  select case when kg_private.promotion_active(
    $1.price_minor,$1.previous_price_minor,$1.promotion_starts_at,$1.promotion_ends_at,statement_timestamp()
  ) then $1.previous_price_minor end
$$;

create function public.effective_previous_price_minor(public.kg_product_variants)
returns bigint language sql stable security invoker set search_path='' as $$
  select case when kg_private.promotion_active(
    $1.price_minor,$1.previous_price_minor,$1.promotion_starts_at,$1.promotion_ends_at,statement_timestamp()
  ) then $1.previous_price_minor end
$$;

create function public.effective_price_minor(public.kg_products)
returns bigint language sql stable security invoker set search_path='' as $$
  select case when $1.previous_price_minor > $1.price_minor
    and public.effective_previous_price_minor($1) is null then $1.previous_price_minor else $1.price_minor end
$$;

create function public.effective_price_minor(public.kg_product_variants)
returns bigint language sql stable security invoker set search_path='' as $$
  select case when $1.previous_price_minor > $1.price_minor
    and public.effective_previous_price_minor($1) is null then $1.previous_price_minor else $1.price_minor end
$$;

revoke all on function public.effective_previous_price_minor(public.kg_products),
  public.effective_previous_price_minor(public.kg_product_variants),
  public.effective_price_minor(public.kg_products),
  public.effective_price_minor(public.kg_product_variants) from public,anon,authenticated;
grant execute on function public.effective_previous_price_minor(public.kg_products),
  public.effective_previous_price_minor(public.kg_product_variants),
  public.effective_price_minor(public.kg_products),
  public.effective_price_minor(public.kg_product_variants) to anon,authenticated;

-- Explicit UTC offsets avoid relying on the database session timezone.
create function kg_private.promotion_instant(p_value text)
returns timestamptz language plpgsql stable security invoker set search_path='' as $$
begin
  if p_value is null then return null; end if;
  if p_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}([.][0-9]{1,6})?)?(Z|[+-][0-9]{2}:[0-9]{2})$' then
    raise exception 'Indica uma data e hora válidas para a promoção' using errcode='22023';
  end if;
  return p_value::timestamptz;
exception when invalid_datetime_format or datetime_field_overflow or invalid_time_zone_displacement_value then
  raise exception 'Indica uma data e hora válidas para a promoção' using errcode='22023';
end;
$$;
revoke all on function kg_private.promotion_instant(text) from public,anon,authenticated;

create or replace function kg_private.save_catalogue_product(p_request_id uuid,p_store_id uuid,p_product_id uuid,p_expected_updated_at timestamptz,p_document jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_product public.kg_products%rowtype;v_req kg_private.editor_requests%rowtype;v_variant jsonb;v_image text;v_price bigint;v_previous bigint;v_title text;v_status text;v_id uuid;v_ids uuid[]='{}';v_count integer;v_stock boolean;v_result jsonb;v_payload jsonb;v_order integer=0;v_start timestamptz;v_end timestamptz;v_old_variant public.kg_product_variants%rowtype;
begin
 if auth.uid() is null or not(kg_private.is_admin() or kg_private.can_prepare_store(p_store_id)) then raise exception 'Sem permissões para esta loja' using errcode='42501';end if;
 perform 1 from public.kg_stores where id=p_store_id and status in ('draft','pending','approved') for share;
 if not found or not(kg_private.is_admin() or kg_private.can_prepare_store(p_store_id)) then raise exception 'Loja sem acesso de preparação' using errcode='42501';end if;
 if p_document->>'status'='published' and not exists(select 1 from public.kg_stores where id=p_store_id and status='approved') then raise exception 'A gestão precisa de activar a loja antes da publicação' using errcode='42501';end if;
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
 -- A missing key from older clients preserves the stored schedule. Explicit null clears it.
 v_start=kg_private.promotion_instant(p_document->>'promotion_starts_at');
 v_end=kg_private.promotion_instant(p_document->>'promotion_ends_at');
 if v_previous is null and (v_start is not null or v_end is not null) then raise exception 'Activa a promoção antes de programar datas' using errcode='22023';end if;
 if v_previous is not null then
  if not (p_document ? 'promotion_starts_at') then v_start=v_product.promotion_starts_at;end if;
  if not (p_document ? 'promotion_ends_at') then v_end=v_product.promotion_ends_at;end if;
 end if;
 if v_start>=v_end then raise exception 'O fim da promoção deve ser depois do início' using errcode='22023';end if;
 insert into kg_private.editor_context values(txid_current(),auth.uid(),p_store_id,p_product_id);
 insert into public.kg_products(id,store_id,category_id,title,description,price_minor,currency,stock_status,status,condition,attributes,previous_price_minor,stock_quantity,promotion_starts_at,promotion_ends_at)
 values(p_product_id,p_store_id,(p_document->>'category_id')::uuid,v_title,coalesce(p_document->>'description',''),v_price,'MZN','available',v_status,coalesce(p_document->>'condition','new'),coalesce(p_document->>'attributes',''),v_previous,(p_document->>'stock_quantity')::integer,v_start,v_end)
 on conflict(id) do update set category_id=excluded.category_id,title=excluded.title,description=excluded.description,price_minor=excluded.price_minor,status=excluded.status,condition=excluded.condition,attributes=excluded.attributes,previous_price_minor=excluded.previous_price_minor,stock_quantity=excluded.stock_quantity,promotion_starts_at=excluded.promotion_starts_at,promotion_ends_at=excluded.promotion_ends_at;
 -- Retired variants retain identity and labels for saved carts.
 update public.kg_product_variants set active=false where product_id=p_product_id;
 for v_variant in select value from jsonb_array_elements(p_document->'variants') loop
  v_id=(v_variant->>'id')::uuid;
  if v_id is null or v_id=any(v_ids) then raise exception 'Identificador de variante duplicado' using errcode='22023';end if;v_ids=array_append(v_ids,v_id);
  select * into v_old_variant from public.kg_product_variants where id=v_id;
  if found and v_old_variant.product_id<>p_product_id then raise exception 'Variante fora deste produto' using errcode='42501';end if;
  v_price=(v_variant->>'price_minor')::bigint;v_previous=(v_variant->>'previous_price_minor')::bigint;
  if char_length(trim(coalesce(v_variant->>'option_name',''))) not between 1 and 120 or v_price is null or v_price not between 0 and 900000000000 or (v_status='published' and v_price=0) or (v_previous is not null and v_previous<=v_price) then raise exception 'Nome, preço ou promoção da variante inválidos' using errcode='22023';end if;
  if nullif(v_variant->>'image_path','') is not null and not (p_document->'images' ? (v_variant->>'image_path')) then raise exception 'A fotografia da variante deve fazer parte da galeria' using errcode='22023';end if;
  v_start=kg_private.promotion_instant(v_variant->>'promotion_starts_at');
  v_end=kg_private.promotion_instant(v_variant->>'promotion_ends_at');
  if v_previous is null and (v_start is not null or v_end is not null) then raise exception 'Activa a promoção antes de programar datas' using errcode='22023';end if;
  if v_previous is not null then
   if not (v_variant ? 'promotion_starts_at') then v_start=v_old_variant.promotion_starts_at;end if;
   if not (v_variant ? 'promotion_ends_at') then v_end=v_old_variant.promotion_ends_at;end if;
  end if;
  if v_start>=v_end then raise exception 'O fim da promoção deve ser depois do início' using errcode='22023';end if;
  v_stock=coalesce((v_variant->>'in_stock')::boolean,true) and (not coalesce((v_variant->>'track_quantity')::boolean,false) or coalesce((v_variant->>'stock_quantity')::integer,0)>0);
  insert into public.kg_product_variants(id,product_id,sku,option_name,price_minor,in_stock,stock_quantity,track_quantity,active,sort_order,previous_price_minor,image_path,promotion_starts_at,promotion_ends_at)
  values(v_id,p_product_id,'KB-'||replace(v_id::text,'-',''),trim(v_variant->>'option_name'),v_price,v_stock,coalesce((v_variant->>'stock_quantity')::integer,0),coalesce((v_variant->>'track_quantity')::boolean,false),true,v_order,v_previous,nullif(v_variant->>'image_path',''),v_start,v_end)
  on conflict(id) do update set option_name=excluded.option_name,price_minor=excluded.price_minor,in_stock=excluded.in_stock,stock_quantity=excluded.stock_quantity,track_quantity=excluded.track_quantity,active=true,sort_order=excluded.sort_order,previous_price_minor=excluded.previous_price_minor,image_path=excluded.image_path,promotion_starts_at=excluded.promotion_starts_at,promotion_ends_at=excluded.promotion_ends_at
  where kg_product_variants.product_id=excluded.product_id;
  if not found then raise exception 'Variante fora deste produto' using errcode='42501';end if;
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
    new.unit_price_snapshot_minor=public.effective_price_minor(v_variant);
  else
    if exists(select 1 from public.kg_product_variants where product_id=new.product_id and active) then
      raise exception 'Selecciona uma variante disponível' using errcode='23514';
    end if;
    new.unit_price_snapshot_minor=public.effective_price_minor(v_product);
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
  -- Revalidate even an idempotent retry: a previous snapshot is not authority to contact a closed shop.
  perform 1 from public.kg_stores where id=p_store_id and status='approved' and is_open and kg_private.contact_hours_open(opening_hours,statement_timestamp()) for share;
  if not found then raise exception 'A loja está fechada ou indisponível para novos contactos' using errcode='23514';end if;
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
      v_unit_price=public.effective_price_minor(v_variant);
    else
      if exists(select 1 from public.kg_product_variants where product_id=v_product.id and active) or (v_product.stock_quantity is not null and v_quantity>v_product.stock_quantity) then raise exception 'Selecciona uma variante disponível e confere a quantidade' using errcode='23514';end if;
      v_variant=null;
      v_unit_price=public.effective_price_minor(v_product);
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

create or replace function public.kg_search_catalogue(
 p_kind text, p_query text, p_offset integer default 0, p_limit integer default 24,
 p_category uuid default null, p_min bigint default null, p_max bigint default null,
 p_available boolean default false, p_open boolean default false,
 p_with_products boolean default false, p_sort text default 'relevance'
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
  term text := trim(kg_private.search_text(left(coalesce(p_query,''),160)));
  words text[] := regexp_split_to_array(term,'[[:space:]]+');
  result jsonb;
begin
  if term='' then return jsonb_build_object('ids','[]'::jsonb,'total',0); end if;
  if p_kind='products' then
    with candidates as (
      select p.id,p.created_at,c.id category_id,c.name category_label,kg_private.search_text(p.title) title,
        coalesce(v.available_price,v.any_price,public.effective_price_minor(p)) price,
        coalesce(v.available,p.stock_status<>'out' and coalesce(p.stock_quantity,1)>0) available
      from public.kg_products p join public.kg_stores s on s.id=p.store_id
      left join public.kg_categories c on c.id=p.category_id and c.is_active
      left join lateral (
        select min(public.effective_price_minor(option)) any_price,min(public.effective_price_minor(option)) filter(where in_stock and (not track_quantity or stock_quantity>0)) available_price,
          bool_or(in_stock and (not track_quantity or stock_quantity>0)) available
        from public.kg_product_variants option where product_id=p.id and active
      ) v on true
      where p.status='published' and p.moderation_status='allowed' and s.status='approved'
        and not exists (select 1 from unnest(words) word where strpos(
          kg_private.search_text(concat_ws(' ',p.title,c.name,s.name)),word)=0)
    ), ranked as (
      select id,row_number() over(order by
        case when p_sort='price-up' then price end asc,
        case when p_sort='price-down' then price end desc,
        case when p_sort='relevance' and title=term then 0 else 1 end,
        created_at desc,id desc) position
      from candidates where (p_category is null or category_id=p_category) and (not p_available or available)
        and (p_min is null or price>=p_min) and (p_max is null or price<=p_max)
    )
    select jsonb_build_object('total',count(*),'ids',coalesce(jsonb_agg(id order by position)
      filter(where position>greatest(0,p_offset) and position<=greatest(0,p_offset)::bigint+least(60,greatest(1,p_limit))),'[]'::jsonb))
      || case when coalesce(p_offset,0)=0 then jsonb_build_object('categories',(
        select coalesce(jsonb_agg(jsonb_build_object('id',category_id,'label',category_label) order by category_label,category_id),'[]'::jsonb)
        from (select distinct category_id,category_label from candidates where category_id is not null) scopes
      )) else '{}'::jsonb end
      into result from ranked;
  elsif p_kind='stores' then
    with ranked as (
      select s.id,row_number() over(order by
        case when p_sort='relevance' and kg_private.search_text(s.name)=term then 0 else 1 end,s.name,s.id) position
      from public.kg_stores s where s.status='approved' and (not p_open or s.is_open)
        and (not p_with_products or exists(select 1 from public.kg_products p where p.store_id=s.id
          and p.status='published' and p.moderation_status='allowed'))
        and not exists(select 1 from unnest(words) word where strpos(
          kg_private.search_text(concat_ws(' ',s.name,s.description,s.location)),word)=0)
    )
    select jsonb_build_object('total',count(*),'ids',coalesce(jsonb_agg(id order by position)
      filter(where position>greatest(0,p_offset) and position<=greatest(0,p_offset)::bigint+least(60,greatest(1,p_limit))),'[]'::jsonb))
      into result from ranked;
  else
    raise exception 'Tipo de pesquisa inválido' using errcode='22023';
  end if;
  return result;
end $$;
