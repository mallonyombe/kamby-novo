create function public.kg_merchant_activity_period(p_store_id uuid, p_days integer)
returns jsonb
language plpgsql stable security invoker
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Africa/Maputo')::date;
  v_first date;
begin
  if auth.uid() is null or not (
    kg_private.is_admin() or kg_private.can_manage_store(p_store_id, false)
  ) then
    raise exception 'Acesso à loja obrigatório' using errcode = '42501';
  end if;

  if p_days is null or p_days not in (7, 30, 90) then
    raise exception 'Período inválido' using errcode = '22023';
  end if;
  v_first := v_today - (p_days - 1);

  return (
    with daily_events as (
      select (created_at at time zone 'Africa/Maputo')::date as day,
        count(*) filter (where kind = 'store_view') as views,
        count(*) filter (where kind = 'whatsapp_click') as contacts
      from public.kg_store_events
      where store_id = p_store_id
        and created_at >= v_first::timestamp at time zone 'Africa/Maputo'
        and created_at < (v_today + 1)::timestamp at time zone 'Africa/Maputo'
        and kind in ('store_view', 'whatsapp_click')
      group by 1
    ), days as (
      select v_first + day_offset as day,
        coalesce(events.views, 0) as views,
        coalesce(events.contacts, 0) as contacts
      from generate_series(0, p_days - 1) as dates(day_offset)
      left join daily_events as events on events.day = v_first + day_offset
    )
    select jsonb_build_object('days', jsonb_agg(days order by days.day))
    from days
  );
end;
$$;

revoke all on function public.kg_merchant_activity_period(uuid, integer) from public, anon;
grant execute on function public.kg_merchant_activity_period(uuid, integer) to authenticated;
notify pgrst, 'reload schema';
