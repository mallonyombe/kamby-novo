-- Preparation stays private. This does not change store creation or publication authority.
create function kg_private.can_prepare_store(p_store_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from kg_private.store_merchants m join public.kg_stores s on s.id=m.store_id
  where m.user_id=auth.uid() and m.active and m.store_id=p_store_id
   and s.status in ('draft','pending','approved')
 );
$$;
revoke all on function kg_private.can_prepare_store(uuid) from public,anon;
grant execute on function kg_private.can_prepare_store(uuid) to authenticated;


create or replace function kg_private.account_context() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
 v_user uuid=auth.uid(); v_admin boolean; v_operator boolean;
 v_stores jsonb; v_roles jsonb='["customer"]'::jsonb;
 v_mfa boolean=coalesce(auth.jwt()->>'aal','')='aal2';
begin
 if v_user is null or not exists(select 1 from auth.users where id=v_user) then
  raise exception 'Sessão obrigatória' using errcode='42501';
 end if;
 select exists(select 1 from kg_private.admins where user_id=v_user) into v_admin;
 select exists(select 1 from kg_private.operation_grants where user_id=v_user) into v_operator;
 select coalesce(jsonb_agg(m.store_id order by m.store_id),'[]'::jsonb) into v_stores
 from kg_private.store_merchants m join public.kg_stores s on s.id=m.store_id
 where m.user_id=v_user and m.active and s.status in ('draft','pending','approved');
 if jsonb_array_length(v_stores)>0 then v_roles=v_roles||'["merchant"]'::jsonb;end if;
 if v_admin then v_roles=v_roles||'["administrator"]'::jsonb;
 elsif v_operator then v_roles=v_roles||'["operator"]'::jsonb;end if;
 return jsonb_build_object('user_id',v_user,'roles',v_roles,
  'merchant_store_ids',v_stores,'admin_access',(v_admin or v_operator) and v_mfa,
  'admin_mfa_required',(v_admin or v_operator) and not v_mfa);
end;$$;

create or replace function kg_private.can_upload_product_image(p_name text) returns boolean language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/(photo|[0-9a-f-]{36})\.(jpg|png|webp)$' and split_part(p_name,'/',1)=auth.uid()::text and exists(select 1 from public.kg_stores s where s.id::text=split_part(p_name,'/',2) and kg_private.can_prepare_store(s.id));$$;

create or replace function kg_private.save_catalogue_product(p_request_id uuid,p_store_id uuid,p_product_id uuid,p_expected_updated_at timestamptz,p_document jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_product public.kg_products%rowtype;v_req kg_private.editor_requests%rowtype;v_variant jsonb;v_image text;v_price bigint;v_previous bigint;v_title text;v_status text;v_id uuid;v_ids uuid[]='{}';v_count integer;v_stock boolean;v_result jsonb;v_payload jsonb;v_order integer=0;
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

create or replace function kg_private.save_store_settings(p_store_id uuid,p_expected_updated_at timestamptz,p_document jsonb) returns public.kg_stores language plpgsql security definer set search_path='' as $$
declare v_store public.kg_stores%rowtype;v_hour jsonb;v_path text;begin
 if auth.uid() is null or not(kg_private.is_admin() or kg_private.can_prepare_store(p_store_id)) then raise exception 'Sem permissões para esta loja' using errcode='42501';end if;
 select * into v_store from public.kg_stores where id=p_store_id for update;
 if not found or v_store.status not in ('draft','pending','approved') or not(kg_private.is_admin() or kg_private.can_prepare_store(p_store_id)) then raise exception 'Loja sem acesso de preparação' using errcode='42501';end if;
 if v_store.updated_at is distinct from p_expected_updated_at then raise exception 'A loja foi alterada noutra sessão. Recarrega antes de guardar.' using errcode='40001';end if;
 if char_length(trim(coalesce(p_document->>'name',''))) not between 2 and 80 or coalesce(p_document->>'whatsapp_e164','') !~ '^\+[1-9][0-9]{7,14}$' or char_length(coalesce(p_document->>'location',''))>120 or char_length(coalesce(p_document->>'description',''))>2000 or char_length(coalesce(p_document->>'address',''))>300 or char_length(coalesce(p_document->>'service_area',''))>300 then raise exception 'Confere os dados da loja e o WhatsApp com indicativo' using errcode='22023';end if;
 if jsonb_typeof(p_document->'opening_hours') is distinct from 'array' or jsonb_array_length(p_document->'opening_hours')>7 then raise exception 'Horário inválido' using errcode='22023';end if;
 for v_hour in select value from jsonb_array_elements(p_document->'opening_hours') loop
  if jsonb_typeof(v_hour) is distinct from 'object' or jsonb_typeof(v_hour->'day') is distinct from 'number' or coalesce(v_hour->>'day','') !~ '^[0-6]$' or (v_hour ? 'closed' and jsonb_typeof(v_hour->'closed') is distinct from 'boolean') or (not coalesce((v_hour->>'closed')::boolean,false) and (coalesce(v_hour->>'open','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(v_hour->>'close','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or (v_hour->>'open')=(v_hour->>'close'))) then raise exception 'Confere as horas de abertura e fecho' using errcode='22023';end if;
 end loop;
 if (select count(*)<>count(distinct (value->>'day')::integer) from jsonb_array_elements(p_document->'opening_hours')) then raise exception 'Dia duplicado no horário' using errcode='22023';end if;
 for v_path in select x from unnest(array[nullif(p_document->>'logo_path',''),nullif(p_document->>'banner_path','')]) x where x is not null loop perform kg_private.validate_editor_image(v_path,p_store_id,p_store_id);end loop;
 insert into kg_private.editor_context values(txid_current(),auth.uid(),p_store_id,null);
 update public.kg_stores set name=trim(p_document->>'name'),description=coalesce(p_document->>'description',''),whatsapp_e164=p_document->>'whatsapp_e164',location=coalesce(p_document->>'location',''),address=coalesce(p_document->>'address',''),service_area=coalesce(p_document->>'service_area',''),opening_hours=p_document->'opening_hours',logo_path=nullif(p_document->>'logo_path',''),banner_path=nullif(p_document->>'banner_path','') where id=p_store_id returning * into v_store;
 delete from kg_private.editor_context where tx=txid_current();return v_store;
end;$$;

-- Existing schedule convention: Monday=0..Sunday=6, Maputo civil time.
-- Empty schedules preserve manual mode; configured omitted days are closed.
create function kg_private.contact_hours_open(p_hours jsonb,p_at timestamptz) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare v_local timestamp=p_at at time zone 'Africa/Maputo';v_day integer;v_time text;v_item jsonb;v_open text;v_close text;v_item_day integer;
begin
 if p_hours is null or p_hours='[]'::jsonb then return true;end if;
 if jsonb_typeof(p_hours)<>'array' then return false;end if;
 if exists(select 1 from jsonb_array_elements(p_hours) e where jsonb_typeof(e) is distinct from 'object' or jsonb_typeof(e->'day') is distinct from 'number' or coalesce(e->>'day','') !~ '^[0-6]$' or (e ? 'closed' and jsonb_typeof(e->'closed') is distinct from 'boolean')) then return false;end if;
 if (select count(*)<>count(distinct value->>'day') from jsonb_array_elements(p_hours)) then return false;end if;
 v_day=extract(isodow from v_local)::integer-1;v_time=to_char(v_local,'HH24:MI');
 for v_item in select value from jsonb_array_elements(p_hours) loop
  if jsonb_typeof(v_item) is distinct from 'object' or jsonb_typeof(v_item->'day') is distinct from 'number' or coalesce(v_item->>'day','') !~ '^[0-6]$' or (v_item ? 'closed' and jsonb_typeof(v_item->'closed') is distinct from 'boolean') then return false;end if;
  if coalesce(v_item->>'closed','false')<>'false' then continue;end if;
  v_item_day=(v_item->>'day')::integer;v_open=v_item->>'open';v_close=v_item->>'close';
  if coalesce(v_open,'') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(v_close,'') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or v_open=v_close then continue;end if;
  if v_open<v_close and v_item_day=v_day and v_time>=v_open and v_time<v_close then return true;end if;
  if v_open>v_close and ((v_item_day=v_day and v_time>=v_open) or (v_item_day=(v_day+6)%7 and v_time<v_close)) then return true;end if;
 end loop;
 return false;
end;$$;
revoke all on function kg_private.contact_hours_open(jsonb,timestamptz) from public;
grant execute on function kg_private.contact_hours_open(jsonb,timestamptz) to anon,authenticated;

-- Manual pause and configured schedule both constrain contact. Empty schedules use manual mode.
-- Public preflight reveals no private store data. A direct external wa.me URL is outside our control.
create function public.kg_store_contact_availability(p_store_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce((select jsonb_build_object('available',s.is_open and kg_private.contact_hours_open(s.opening_hours,statement_timestamp()),'reason',case when s.is_open and kg_private.contact_hours_open(s.opening_hours,statement_timestamp()) then 'open' else 'closed' end,'timezone','Africa/Maputo')
  from public.kg_stores s where s.id=p_store_id and s.status='approved'),
  jsonb_build_object('available',false,'reason','unavailable','timezone','Africa/Maputo'));
$$;
revoke all on function public.kg_store_contact_availability(uuid) from public;
grant execute on function public.kg_store_contact_availability(uuid) to anon,authenticated;


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

create or replace function kg_private.record_contact_activity(p_store_id uuid,p_product_id uuid,p_request_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_store public.kg_stores%rowtype;v_title text='';v_old public.kg_contact_activity%rowtype;
begin
 if auth.uid() is null then raise exception 'Sessão obrigatória' using errcode='42501';end if;
 perform 1 from public.kg_stores where id=p_store_id and status='approved' and is_open and kg_private.contact_hours_open(opening_hours,statement_timestamp()) for share;
 if not found then raise exception 'A loja está fechada ou indisponível para novos contactos' using errcode='23514';end if;
 select * into v_old from public.kg_contact_activity where id=p_request_id;
 if found then
  if v_old.user_id is distinct from auth.uid() or v_old.store_id is distinct from p_store_id or v_old.product_id is distinct from p_product_id then raise exception 'Pedido inacessível' using errcode='42501';end if;
  return;
 end if;
 select * into v_store from public.kg_stores where id=p_store_id and status='approved';
 if not found then raise exception 'Loja indisponível' using errcode='22023';end if;
 if p_product_id is not null then
  select title into v_title from public.kg_products where id=p_product_id and store_id=p_store_id and status='published';
  if not found then raise exception 'Produto indisponível' using errcode='22023';end if;
 end if;
 -- A bounded per-user window protects this auxiliary record; a click is never a sale.
 if (select count(*) from public.kg_contact_activity where user_id=auth.uid() and created_at>now()-interval '1 minute')>=30 then raise exception 'Tenta mais tarde' using errcode='22023';end if;
 insert into public.kg_contact_activity(id,user_id,store_id,product_id,store_name,product_title)
 values(p_request_id,auth.uid(),p_store_id,p_product_id,v_store.name,coalesce(v_title,''));
end;$$;

-- Protect direct status updates as well as RPC preparation; old snapshots remain readable.
create function kg_private.guard_contact_open() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.kg_stores where id=new.store_id and status='approved' and is_open and kg_private.contact_hours_open(opening_hours,statement_timestamp()) for share;
 if not found then
  raise exception 'A loja está fechada ou indisponível para novos contactos' using errcode='23514';
 end if;
 return new;
end;$$;
revoke all on function kg_private.guard_contact_open() from public,anon,authenticated;
create trigger kg_contact_store_open before insert or update on public.kg_contact_intents
for each row execute function kg_private.guard_contact_open();
notify pgrst,'reload schema';
