create table kg_private.app_sessions(
 id uuid primary key,device uuid not null,started_at timestamptz not null default now(),
 last_seen timestamptz not null default now(),visits integer not null default 1
);
alter table kg_private.app_sessions enable row level security;
revoke all on kg_private.app_sessions from public,anon,authenticated;
create function public.kg_record_app_session(p_session uuid,p_device uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_session is null or p_device is null then return;end if;
 insert into kg_private.app_sessions(id,device) values(p_session,p_device)
 on conflict(id) do update set last_seen=now(),visits=least(100,kg_private.app_sessions.visits+1)
 where kg_private.app_sessions.device=p_device and kg_private.app_sessions.last_seen<now()-interval '1 minute';
 delete from kg_private.app_sessions where id in(select id from kg_private.app_sessions where last_seen<now()-interval '90 days' limit 100);
end $$;
create function public.kg_admin_audience(p_days integer default 7) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not kg_private.has_operation('analytics.read') then raise exception 'Sem autorização' using errcode='42501';end if;
 if p_days not in(7,30) then raise exception 'Período inválido' using errcode='22023';end if;
 with sessions as(select * from kg_private.app_sessions where last_seen>=now()-make_interval(days=>p_days)),
 daily as(select (started_at at time zone 'Africa/Maputo')::date as day,count(*) sessions,count(distinct device) active_devices from sessions group by 1)
 select jsonb_build_object('started_at',(select min(started_at) from kg_private.app_sessions),'days',p_days,'sessions',(select count(*) from sessions),'active_devices',(select count(distinct device) from sessions),'returning_devices',(select count(*) from(select device from sessions group by device having count(*)>1)x),'rows',coalesce((select jsonb_agg(to_jsonb(daily) order by day) from daily),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.kg_record_app_session(uuid,uuid),public.kg_admin_audience(integer) from public;
grant execute on function public.kg_record_app_session(uuid,uuid) to anon,authenticated;
grant execute on function public.kg_admin_audience(integer) to authenticated;
