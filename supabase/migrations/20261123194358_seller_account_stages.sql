-- Keep the legacy boolean for older clients. A user with several legacy shops is
-- represented by the most advanced active membership, with a public shop first.
create or replace function kg_private.admin_seller_rows(p_result jsonb) returns jsonb
language sql stable security definer set search_path='' as $$
 select case when kg_private.has_operation('users.read') then jsonb_set(p_result,'{rows}',(
  select coalesce(jsonb_agg(entry || jsonb_build_object(
    'seller_active',stage.value<>'customer',
    'seller_state',stage.value
  ) order by position),'[]'::jsonb)
  from jsonb_array_elements(p_result->'rows') with ordinality as rows(entry,position)
  cross join lateral (
   select case
    when bool_or(s.status='approved' and s.is_open) then 'public'
    when bool_or(s.status='approved') then 'paused'
    when bool_or(s.status in ('draft','pending')) then 'preparing'
    when bool_or(s.status='suspended') then 'suspended'
    when bool_or(s.status in ('closed','rejected')) then 'closed'
    when exists(select 1 from kg_private.seller_activations a
                where a.user_id=(entry->>'id')::uuid and a.store_id is null) then 'activated'
    else 'customer'
   end as value
   from kg_private.store_merchants m
   join public.kg_stores s on s.id=m.store_id
   where m.user_id=(entry->>'id')::uuid and m.active
  ) stage
 )) else p_result end
$$;
