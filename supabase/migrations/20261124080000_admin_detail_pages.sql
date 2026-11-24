-- Operational detail follows the same MFA and operation grants as the directory.
create function public.kg_admin_detail(p_kind text,p_id uuid,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_kind not in ('users','categories') or not kg_private.has_operation(p_kind||'.read') then
  raise exception 'Sem autorização' using errcode='42501';
 end if;
 if p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'Página inválida' using errcode='22023';end if;
 if p_kind='users' then
  select jsonb_build_object('record',jsonb_build_object('id',p.id,'display_name',p.display_name,'location',p.location,'created_at',p.created_at),
   'seller_active',exists(select 1 from kg_private.seller_activations where user_id=p.id),
   'rows',case when kg_private.has_operation('stores.read') then
    (select coalesce(jsonb_agg(x),'[]') from (select s.id,s.name,s.status,m.active from public.kg_stores s join kg_private.store_merchants m on m.store_id=s.id where m.user_id=p.id order by s.created_at desc,s.id limit 30 offset p_offset)x)
    else '[]'::jsonb end,
   'total',case when kg_private.has_operation('stores.read') then (select count(*) from kg_private.store_merchants where user_id=p.id) else 0 end)
   into result from public.kg_profiles p where p.id=p_id;
 else
  select jsonb_build_object('record',to_jsonb(c),
   'rows',case when kg_private.has_operation('products.read') then
    (select coalesce(jsonb_agg(x),'[]') from (select p.id,p.title,p.price_minor,p.status,p.moderation_status,p.image_url,s.name store_name
      from public.kg_products p join public.kg_stores s on s.id=p.store_id where p.category_id=c.id order by p.created_at desc,p.id limit 30 offset p_offset)x)
    else '[]'::jsonb end,
   'total',case when kg_private.has_operation('products.read') then (select count(*) from public.kg_products where category_id=c.id) else 0 end)
   into result from public.kg_categories c where c.id=p_id;
 end if;
 if result is null then raise exception 'Registo indisponível' using errcode='P0002';end if;
 return result;
end $$;
revoke all on function public.kg_admin_detail(text,uuid,integer) from public,anon;
grant execute on function public.kg_admin_detail(text,uuid,integer) to authenticated;
