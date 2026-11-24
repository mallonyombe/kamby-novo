-- The existing products.read grant covers catalogue inspection only.
-- Lists and single-product sheets use the same price, shop and variant data.
create function public.kg_admin_products(p_query text default '', p_state text default '', p_offset integer default 0, p_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not kg_private.has_operation('products.read') then raise exception 'Sem acesso ao catálogo' using errcode='42501';end if;
 if p_offset is null or p_offset not between 0 and 100000 or p_state not in ('','published','draft','archived','blocked') then
   raise exception 'Filtro inválido' using errcode='22023';
 end if;
 with candidates as materialized (
   select p.id,p.created_at
   from public.kg_products p join public.kg_stores s on s.id=p.store_id left join public.kg_categories c on c.id=p.category_id
   where (p_id is null or p.id=p_id)
   and (p_state='' or p.status=p_state or (p_state='blocked' and p.moderation_status='blocked'))
   and (coalesce(trim(p_query),'')='' or strpos(kg_private.search_text(concat_ws(' ',p.title,s.name,c.name)),kg_private.search_text(left(trim(p_query),160)))>0)
 ), page as (
   select * from candidates order by created_at desc,id limit 30 offset p_offset
 )
 select jsonb_build_object('total',(select count(*) from candidates),'rows',coalesce(jsonb_agg(
   jsonb_build_object('id',p.id,'title',p.title,'status',p.status,'updated_at',p.updated_at,'store_id',s.id,'store_name',s.name,'store_status',s.status,
    'category_name',c.name,'price_minor',p.price_minor,'previous_price_minor',p.previous_price_minor,'image_url',p.image_url,
    'description',case when p_id is not null then p.description end,'stock_status',p.stock_status,'stock_quantity',p.stock_quantity,
    'variants',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'option_name',v.option_name,'price_minor',v.price_minor,
      'previous_price_minor',v.previous_price_minor,'active',v.active,'in_stock',v.in_stock,'stock_quantity',v.stock_quantity,'track_quantity',v.track_quantity)
      order by v.sort_order,v.id) from public.kg_product_variants v where v.product_id=p.id and v.active),'[]'::jsonb),
    'images',coalesce((select jsonb_agg(jsonb_build_object('sort_order',i.sort_order,'storage_path',i.storage_path) order by i.sort_order)
       from public.kg_product_images i where i.product_id=p.id and (p_id is not null or i.sort_order=(select min(j.sort_order) from public.kg_product_images j where j.product_id=p.id))),'[]'::jsonb),
    'moderation_status',p.moderation_status,'can_manage',kg_private.is_admin()
   ) order by page.created_at desc,page.id),'[]'::jsonb)) into result
 from page join public.kg_products p on p.id=page.id join public.kg_stores s on s.id=p.store_id left join public.kg_categories c on c.id=p.category_id;
 return result;
end $$;

create function public.kg_admin_product_action(p_id uuid,p_action text,p_expected timestamptz,p_reason text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare product public.kg_products%rowtype; next_status text; next_moderation text; stamp timestamptz;
begin
 if not kg_private.is_admin() then raise exception 'Gestão e confirmação de segurança necessárias' using errcode='42501';end if;
 if p_action is null or p_action not in ('hide','allow','publish','archive','restore') or char_length(coalesce(p_reason,''))>500 then
   raise exception 'Acção inválida' using errcode='22023';
 end if;
 select * into product from public.kg_products where id=p_id for update;
 if not found then raise exception 'O produto já não está disponível' using errcode='P0002';end if;
 if p_expected is null or product.updated_at<>p_expected then raise exception 'O produto mudou. Reabre a ficha.' using errcode='40001';end if;
 next_status:=product.status;next_moderation:=product.moderation_status;
 if p_action='hide' and product.moderation_status='allowed' and product.status='published' then next_moderation:='blocked';
 elsif p_action='allow' and product.moderation_status='blocked' then next_moderation:='allowed';
 elsif p_action='archive' and product.status<>'archived' and product.moderation_status='allowed' then next_status:='archived';
 elsif p_action='restore' and product.status='archived' and product.moderation_status='allowed' then next_status:='draft';
 elsif p_action='publish' and product.status='draft' and product.moderation_status='allowed' then
   perform 1 from public.kg_stores where id=product.store_id and status='approved' for share;
   if not found then raise exception 'Activa a loja antes de publicar o produto' using errcode='22023';end if;
   if not exists(select 1 from public.kg_store_categories sc join public.kg_categories c on c.id=sc.category_id where sc.store_id=product.store_id and sc.category_id=product.category_id and c.is_active) then
    raise exception 'O vendedor precisa de escolher uma categoria válida' using errcode='22023';end if;
   if product.image_url='' and not exists(select 1 from public.kg_product_images where product_id=p_id) then
    raise exception 'O vendedor precisa de adicionar uma fotografia' using errcode='22023';end if;
   if product.price_minor<=0 or exists(select 1 from public.kg_product_variants where product_id=p_id and active and price_minor<=0) then
    raise exception 'O vendedor precisa de indicar o preço' using errcode='22023';end if;
   next_status:='published';
 else raise exception 'Esta acção já não está disponível para o produto' using errcode='22023';end if;
 update public.kg_products set status=next_status,moderation_status=next_moderation where id=p_id returning updated_at into stamp;
 insert into public.kg_audit_events(actor_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),'admin.product.'||p_action,'product',p_id,jsonb_strip_nulls(jsonb_build_object(
  'store_id',product.store_id,'title',product.title,'before_status',product.status,'after_status',next_status,
  'before_moderation',product.moderation_status,'after_moderation',next_moderation,'reason',nullif(trim(p_reason),''))));
 return jsonb_build_object('id',p_id,'status',next_status,'moderation_status',next_moderation,'updated_at',stamp);
end $$;
revoke all on function public.kg_admin_products(text,text,integer,uuid),public.kg_admin_product_action(uuid,text,timestamptz,text) from public,anon;
grant execute on function public.kg_admin_products(text,text,integer,uuid),public.kg_admin_product_action(uuid,text,timestamptz,text) to authenticated;
