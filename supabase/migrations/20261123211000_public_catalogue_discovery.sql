-- Only category names with a published offer should appear on the buyer's feed.
create function public.kg_feed_categories()
returns table(id uuid,label text)
language sql stable security invoker set search_path='' as $$
  select c.id,c.name from public.kg_categories c
  where c.is_active and exists (
    select 1 from public.kg_products p join public.kg_stores s on s.id=p.store_id
    where p.category_id=c.id and p.status='published'
      and p.moderation_status='allowed' and s.status='approved'
  )
  order by c.name,c.id
$$;

create function kg_private.search_text(p_value text)
returns text language sql immutable strict parallel safe set search_path='' as $$
  select translate(lower(p_value),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')
$$;

-- Search each tab independently. Return only an ordered page of public IDs;
-- photographs and variants use the same card loader as the feed.
create function public.kg_search_catalogue(
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
      select p.id,p.created_at,kg_private.search_text(p.title) title,
        coalesce(v.available_price,v.any_price,p.price_minor) price,
        coalesce(v.available,p.stock_status<>'out' and coalesce(p.stock_quantity,1)>0) available
      from public.kg_products p join public.kg_stores s on s.id=p.store_id
      left join public.kg_categories c on c.id=p.category_id and c.is_active
      left join lateral (
        select min(price_minor) any_price,min(price_minor) filter(where in_stock and (not track_quantity or stock_quantity>0)) available_price,
          bool_or(in_stock and (not track_quantity or stock_quantity>0)) available
        from public.kg_product_variants where product_id=p.id and active
      ) v on true
      where p.status='published' and p.moderation_status='allowed' and s.status='approved'
        and (p_category is null or c.id=p_category)
        and not exists (select 1 from unnest(words) word where strpos(
          kg_private.search_text(concat_ws(' ',p.title,c.name,s.name)),word)=0)
    ), ranked as (
      select id,row_number() over(order by
        case when p_sort='price-up' then price end asc,
        case when p_sort='price-down' then price end desc,
        case when p_sort='relevance' and title=term then 0 else 1 end,
        created_at desc,id desc) position
      from candidates where (not p_available or available)
        and (p_min is null or price>=p_min) and (p_max is null or price<=p_max)
    )
    select jsonb_build_object('total',count(*),'ids',coalesce(jsonb_agg(id order by position)
      filter(where position>greatest(0,p_offset) and position<=greatest(0,p_offset)::bigint+least(60,greatest(1,p_limit))),'[]'::jsonb))
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
revoke all on function public.kg_feed_categories(),kg_private.search_text(text),
 public.kg_search_catalogue(text,text,integer,integer,uuid,bigint,bigint,boolean,boolean,boolean,text) from public;
grant execute on function public.kg_feed_categories(),kg_private.search_text(text),
 public.kg_search_catalogue(text,text,integer,integer,uuid,bigint,bigint,boolean,boolean,boolean,text) to anon,authenticated;
