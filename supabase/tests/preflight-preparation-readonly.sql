-- Read-only preflight. Run again immediately before deployment; do not repair automatically.
select count(*)::int as approved_without_active_merchant from public.kg_stores s where s.status='approved' and not exists(select 1 from kg_private.store_merchants m where m.store_id=s.id and m.active);

with schedules as (
 select id,status,opening_hours h from public.kg_stores
), checked as (
 select *,case when h is null or h='[]'::jsonb then false
 when jsonb_typeof(h)<>'array' then true
 else exists(select 1 from jsonb_array_elements(h) e where jsonb_typeof(e) is distinct from 'object'
 or jsonb_typeof(e->'day') is distinct from 'number' or coalesce(e->>'day','') !~ '^[0-6]$'
 or (e ? 'closed' and jsonb_typeof(e->'closed') is distinct from 'boolean')
 or (coalesce(e->>'closed','false')='false' and
 (coalesce(e->>'open','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(e->>'close','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or e->>'open'=e->>'close')))
 or (select count(*)<>count(distinct e->>'day') from jsonb_array_elements(h) e)
 end invalid
 from schedules
)
select count(*)::int total_stores,
 count(*) filter(where h is null or h='[]'::jsonb)::int manual_schedule,
 count(*) filter(where h is not null and h<>'[]'::jsonb)::int configured_schedule,
 count(*) filter(where invalid)::int incompatible_schedule,
 count(*) filter(where invalid and status='approved')::int incompatible_approved_schedule
from checked;

