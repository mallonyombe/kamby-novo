-- Platform operations. Existing administrators retain authority; no new account
-- receives a grant. All administrative authority, including old RLS, requires MFA.
create or replace function kg_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and coalesce(auth.jwt()->>'aal','')='aal2' and exists(select 1 from kg_private.admins where user_id=auth.uid());
$$;
create table kg_private.operation_grants(user_id uuid references auth.users on delete cascade,permission text not null check(permission in ('overview.read','stores.read','products.read','users.read','categories.read','moderation.read','analytics.read','system.read')),primary key(user_id,permission));
alter table kg_private.operation_grants enable row level security;
revoke all on kg_private.operation_grants from public,anon,authenticated;
create policy kg_operation_grants_internal on kg_private.operation_grants for select to authenticated using(false);
create function kg_private.has_operation(p_permission text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and coalesce(auth.jwt()->>'aal','')='aal2' and (
 (kg_private.is_admin() and p_permission=any(array['overview.read','stores.read','stores.write','stores.decide','stores.access','products.read','users.read','categories.read','moderation.read','analytics.read','system.read']))
 or exists(select 1 from kg_private.operation_grants where user_id=auth.uid() and permission=p_permission));
$$;
revoke all on function kg_private.has_operation(text) from public,anon;
grant execute on function kg_private.has_operation(text) to authenticated;
create function kg_private.operation_context() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_allowed boolean;v_permissions jsonb;
begin
 if auth.uid() is null then raise exception 'Sessão expirada' using errcode='42501';end if;
 select exists(select 1 from kg_private.admins where user_id=auth.uid()) or exists(select 1 from kg_private.operation_grants where user_id=auth.uid()) into v_allowed;
 if not v_allowed then raise exception 'Sem acesso à administração' using errcode='42501';end if;
 select coalesce(jsonb_agg(p),'[]') into v_permissions from unnest(array['overview.read','stores.read','stores.write','stores.decide','stores.access','products.read','users.read','categories.read','moderation.read','analytics.read','system.read']) p where kg_private.has_operation(p);
 return jsonb_build_object('mfa_required',coalesce(auth.jwt()->>'aal','')<>'aal2','permissions',v_permissions,'as_of',statement_timestamp());
end;$$;
revoke all on function kg_private.operation_context() from public,anon;
grant execute on function kg_private.operation_context() to authenticated;
create function public.kg_admin_context() returns jsonb language sql security invoker set search_path='' as $$select kg_private.operation_context()$$;
revoke all on function public.kg_admin_context() from public,anon;
grant execute on function public.kg_admin_context() to authenticated;

-- Serialised writes use compare-and-swap and idempotent request identifiers.
create table kg_private.operation_requests(request_id uuid primary key,actor_id uuid not null references auth.users,operation text not null,payload jsonb not null,result jsonb not null,created_at timestamptz not null default now());
alter table kg_private.operation_requests enable row level security;
revoke all on kg_private.operation_requests from public,anon,authenticated;
create policy kg_operation_requests_internal on kg_private.operation_requests for select to authenticated using(false);
create table public.kg_admin_decisions(id uuid primary key default gen_random_uuid(),request_id uuid not null unique,actor_id uuid not null references auth.users,store_id uuid not null references public.kg_stores,operation text not null,reason text not null check(char_length(reason) between 3 and 2000),before_state jsonb not null,after_state jsonb not null,created_at timestamptz not null default now());
create index kg_admin_decisions_store_idx on public.kg_admin_decisions(store_id,created_at desc);
create index kg_admin_decisions_actor_idx on public.kg_admin_decisions(actor_id);
alter table public.kg_admin_decisions enable row level security;
revoke all on public.kg_admin_decisions from public,anon,authenticated;
grant select on public.kg_admin_decisions to authenticated;
create policy kg_decisions_read on public.kg_admin_decisions for select to authenticated using((select kg_private.has_operation('system.read')));

alter table public.kg_stores drop constraint kg_stores_status_check;
alter table public.kg_stores add constraint kg_stores_status_check check(status in ('draft','pending','approved','suspended','rejected','closed'));
alter table public.kg_store_applications drop constraint kg_store_applications_status_check;
alter table public.kg_store_applications add constraint kg_store_applications_status_check check(status in ('draft','pending','approved','suspended','rejected','closed'));
-- Keep the merchant guard intact; extend only the controlled administrative states.
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
     if new.status not in ('draft','pending','approved','suspended','rejected','closed') then raise exception 'Estado inválido' using errcode='22023'; end if;
     if new.status in ('suspended','rejected','closed') and char_length(trim(coalesce(current_setting('kg.review_reason',true),'')))<3 then
       raise exception 'Indica o motivo da suspensão' using errcode='22023';
     end if;
   elsif auth.uid()=old.owner_id and old.status in ('suspended','rejected') and not kg_private.is_admin() then
     raise exception 'Loja sem autorização para alterações' using errcode='42501';
   end if;
 end if;
 new.updated_at=clock_timestamp(); return new;
end;$$;
create index kg_events_platform_time_idx on public.kg_store_events(created_at) include(kind);
create function kg_private.admin_read(p_area text,p_query text,p_state text,p_offset integer,p_store_id uuid,p_days integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_rows jsonb;v_total bigint;v_store public.kg_stores%rowtype;v_permission text;v_query text;
begin
 v_permission=case when p_area='store' then 'stores.read' else p_area||'.read' end;
 if not kg_private.has_operation(v_permission) then raise exception 'Sem autorização para esta operação' using errcode='42501';end if;
 if p_offset is null or p_offset<0 or p_offset>100000 or char_length(coalesce(p_query,''))>160 or p_days is null or p_days not in (7,30) then raise exception 'Consulta inválida' using errcode='22023';end if;
 v_query='%'||replace(replace(replace(coalesce(trim(p_query),''),'\','\\'),'%','\%'),'_','\_')||'%';
 if p_area='overview' then
  -- Snapshot counts deliberately do not depend on the activity period.
  return jsonb_build_object('as_of',statement_timestamp(),'stores',(select count(*) from public.kg_stores where status='approved'),'pending',(select count(*) from public.kg_stores where status='pending'),'products',(select count(*) from public.kg_products p join public.kg_stores s on s.id=p.store_id where p.status='published' and p.moderation_status='allowed' and s.status='approved'),'reports',(select count(*) from public.kg_reports where status='open'));
 elsif p_area='stores' then
  select count(*) into v_total from public.kg_stores s where (p_state='' or s.status=p_state) and (s.name ilike v_query or s.id::text=trim(p_query));
  select coalesce(jsonb_agg(x),'[]') into v_rows from (select s.id,s.name,s.status,s.location,s.created_at,s.updated_at,(select count(*) from public.kg_products p where p.store_id=s.id and p.status<>'archived') as product_count,(select p.display_name from kg_private.store_merchants m join public.kg_profiles p on p.id=m.user_id where m.store_id=s.id and m.active order by m.created_at limit 1) as merchant_name from public.kg_stores s where (p_state='' or s.status=p_state) and (s.name ilike v_query or s.id::text=trim(p_query)) order by s.created_at desc,s.id limit 30 offset p_offset) x;
 elsif p_area='store' then
  select * into v_store from public.kg_stores where id=p_store_id;
  if not found then raise exception 'Loja indisponível' using errcode='P0002';end if;
  return jsonb_build_object('store',to_jsonb(v_store),'members',case when kg_private.has_operation('stores.access') then (select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'display_name',p.display_name,'active',m.active)),'[]') from kg_private.store_merchants m left join public.kg_profiles p on p.id=m.user_id where m.store_id=p_store_id) else '[]'::jsonb end,'products',(select coalesce(jsonb_agg(x),'[]') from (select id,title,price_minor,status,moderation_status from public.kg_products where store_id=p_store_id order by created_at desc limit 30)x),'reports',case when kg_private.has_operation('moderation.read') then (select coalesce(jsonb_agg(x),'[]') from (select id,reason,status,created_at from public.kg_reports where (target_type='store' and target_id=p_store_id) or (target_type='product' and target_id in(select id from public.kg_products where store_id=p_store_id)) order by created_at desc limit 30)x) else '[]'::jsonb end,'history',case when kg_private.has_operation('system.read') then (select coalesce(jsonb_agg(x),'[]') from (select id,action,actor_id,metadata,created_at from public.kg_audit_events where resource_type='store' and resource_id=p_store_id order by created_at desc limit 30)x) else '[]'::jsonb end,'categories',(select coalesce(jsonb_agg(category_id),'[]') from public.kg_store_categories where store_id=p_store_id),'as_of',statement_timestamp());
 elsif p_area='products' then
  select count(*) into v_total from public.kg_products p where (p_state='' or p.status=p_state) and (p_store_id is null or p.store_id=p_store_id) and (p.title ilike v_query or p.id::text=trim(p_query));
  select coalesce(jsonb_agg(x),'[]') into v_rows from(select p.id,p.title,p.status,p.moderation_status,p.price_minor,s.name as store_name,c.name as category_name from public.kg_products p join public.kg_stores s on s.id=p.store_id left join public.kg_categories c on c.id=p.category_id where (p_state='' or p.status=p_state) and (p_store_id is null or p.store_id=p_store_id) and (p.title ilike v_query or p.id::text=trim(p_query)) order by p.created_at desc,p.id limit 30 offset p_offset)x;
 elsif p_area='users' then
  select count(*) into v_total from public.kg_profiles p where p.display_name ilike v_query or p.id::text=trim(p_query);
  select coalesce(jsonb_agg(x),'[]') into v_rows from(select p.id,p.display_name,p.created_at,(select count(*) from kg_private.store_merchants m where m.user_id=p.id and m.active) as stores from public.kg_profiles p where p.display_name ilike v_query or p.id::text=trim(p_query) order by p.created_at desc,p.id limit 30 offset p_offset)x;
 elsif p_area='categories' then
  select count(*) into v_total from public.kg_categories where name ilike v_query;
  select coalesce(jsonb_agg(x),'[]') into v_rows from(select c.id,c.name,c.slug,c.is_active,(select count(*) from public.kg_products where category_id=c.id and status<>'archived') as products from public.kg_categories c where c.name ilike v_query order by c.name,c.id limit 30 offset p_offset)x;
 elsif p_area='moderation' then
  select count(*) into v_total from public.kg_reports where (p_state='' or status=p_state) and (reason ilike v_query or id::text=trim(p_query));
  select coalesce(jsonb_agg(x),'[]') into v_rows from(select id,target_type,target_id,reason,status,resolution_reason,reviewed_at,created_at from public.kg_reports where (p_state='' or status=p_state) and (reason ilike v_query or id::text=trim(p_query)) order by created_at,id limit 30 offset p_offset)x;
 elsif p_area='system' then
  select count(*) into v_total from public.kg_audit_events where action ilike v_query or resource_id::text=trim(p_query);
  select coalesce(jsonb_agg(x),'[]') into v_rows from(select id,actor_id,action,resource_type,resource_id,metadata,created_at from public.kg_audit_events where action ilike v_query or resource_id::text=trim(p_query) order by created_at desc,id limit 30 offset p_offset)x;
 elsif p_area='analytics' then
  with bounds as (select (now() at time zone 'Africa/Maputo')::date as today),events as (select (created_at at time zone 'Africa/Maputo')::date as day,count(*) filter(where kind='store_view') as views,count(*) filter(where kind='whatsapp_click') as contacts from public.kg_store_events,bounds where created_at>=((today-(p_days-1))::timestamp at time zone 'Africa/Maputo') and created_at<((today+1)::timestamp at time zone 'Africa/Maputo') group by 1) select coalesce(jsonb_agg(x order by day),'[]') into v_rows from(select d::date as day,coalesce(e.views,0) as views,coalesce(e.contacts,0) as contacts from bounds cross join lateral generate_series(today-(p_days-1),today,interval '1 day') d left join events e on e.day=d::date)x;
  return jsonb_build_object('rows',v_rows,'days',p_days,'timezone','Africa/Maputo','as_of',statement_timestamp());
 else raise exception 'Área inválida' using errcode='22023';end if;
 return jsonb_build_object('rows',v_rows,'total',v_total,'as_of',statement_timestamp());
end;$$;
revoke all on function kg_private.admin_read(text,text,text,integer,uuid,integer) from public,anon;
grant execute on function kg_private.admin_read(text,text,text,integer,uuid,integer) to authenticated;
create function public.kg_admin_read(p_area text,p_query text default '',p_state text default '',p_offset integer default 0,p_store_id uuid default null,p_days integer default 7) returns jsonb language sql security invoker set search_path='' as $$select kg_private.admin_read(p_area,p_query,p_state,p_offset,p_store_id,p_days)$$;
revoke all on function public.kg_admin_read(text,text,text,integer,uuid,integer) from public,anon;
grant execute on function public.kg_admin_read(text,text,text,integer,uuid,integer) to authenticated;

create function kg_private.admin_store_write(p_request_id uuid,p_store_id uuid,p_expected_updated_at timestamptz,p_operation text,p_document jsonb,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_store public.kg_stores%rowtype;v_before jsonb;v_after jsonb;v_request kg_private.operation_requests%rowtype;v_payload jsonb;v_permission text;v_status text;v_user uuid;v_count integer;
begin
 v_permission=case p_operation when 'create' then 'stores.write' when 'identity' then 'stores.write' when 'decision' then 'stores.decide' when 'access' then 'stores.access' end;
 if v_permission is null or not kg_private.has_operation(v_permission) or not kg_private.is_admin() then raise exception 'Sem autorização para esta operação' using errcode='42501';end if;
 if p_request_id is null or p_store_id is null or p_document is null or jsonb_typeof(p_document)<>'object' or octet_length(p_document::text)>12000 or char_length(trim(coalesce(p_reason,''))) not between 3 and 2000 then raise exception 'Indica os dados e o motivo da operação' using errcode='22023';end if;
 v_payload=jsonb_build_object('store',p_store_id,'revision',p_expected_updated_at,'operation',p_operation,'document',p_document,'reason',trim(p_reason));
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into v_request from kg_private.operation_requests where request_id=p_request_id;
 if found then
  if v_request.actor_id<>auth.uid() or v_request.payload<>v_payload then raise exception 'Identificador de operação reutilizado' using errcode='22023';end if;
  return v_request.result;
 end if;
 perform set_config('kg.review_reason',trim(p_reason),true);
 if p_operation='create' then
  if p_expected_updated_at is not null then raise exception 'Revisão inicial inválida' using errcode='22023';end if;
  insert into public.kg_stores(id,owner_id,name,slug,description,whatsapp_e164,location,status) values(p_store_id,auth.uid(),trim(p_document->>'name'),'loja-'||replace(p_store_id::text,'-',''),trim(coalesce(p_document->>'description','')),regexp_replace(p_document->>'whatsapp_e164','\s','','g'),trim(coalesce(p_document->>'location','')),'draft') returning * into v_store;
  v_before='{}';
 else
  select * into v_store from public.kg_stores where id=p_store_id for update;
  if not found then raise exception 'Loja indisponível' using errcode='P0002';end if;
  if p_expected_updated_at is null or v_store.updated_at<>p_expected_updated_at then raise exception 'A loja foi alterada noutra sessão. Actualiza a ficha.' using errcode='40001';end if;
  v_before=to_jsonb(v_store);
  if p_operation='identity' then
   update public.kg_stores set name=trim(p_document->>'name'),description=trim(coalesce(p_document->>'description','')),whatsapp_e164=regexp_replace(p_document->>'whatsapp_e164','\s','','g'),location=trim(coalesce(p_document->>'location','')) where id=p_store_id returning * into v_store;
  elsif p_operation='decision' then
   v_status=p_document->>'status';
   if v_status is null or not ((v_store.status='draft' and v_status in ('pending','approved','closed')) or (v_store.status='pending' and v_status in ('approved','rejected','closed')) or (v_store.status='approved' and v_status in ('suspended','closed')) or (v_store.status='suspended' and v_status in ('approved','closed')) or (v_store.status in ('rejected','closed') and v_status='draft')) then raise exception 'Transição de estado inválida' using errcode='22023';end if;
   if v_status='approved' and not exists(select 1 from kg_private.store_merchants where store_id=p_store_id and active) then raise exception 'Atribui um responsável antes de activar a loja' using errcode='22023';end if;
   update public.kg_stores set status=v_status where id=p_store_id returning * into v_store;
  elsif p_operation='access' then
   v_user=(p_document->>'user_id')::uuid;
   if not exists(select 1 from public.kg_profiles where id=v_user) or not (p_document ? 'active') then raise exception 'Selecciona uma conta existente' using errcode='22023';end if;
   if not (p_document->>'active')::boolean then
    select count(*) into v_count from kg_private.store_merchants where store_id=p_store_id and active and user_id<>v_user;
    if v_count=0 and v_store.status='approved' then raise exception 'Uma loja activa precisa de um responsável' using errcode='22023';end if;
   end if;
   perform kg_private.assign_merchant(p_store_id,v_user,(p_document->>'active')::boolean);
   update public.kg_stores set updated_at=clock_timestamp() where id=p_store_id returning * into v_store;
  end if;
 end if;
 v_after=to_jsonb(v_store);
 insert into public.kg_admin_decisions(request_id,actor_id,store_id,operation,reason,before_state,after_state) values(p_request_id,auth.uid(),p_store_id,p_operation,trim(p_reason),v_before,v_after||case when p_operation='access' then jsonb_build_object('access',p_document) else '{}'::jsonb end);
 insert into public.kg_audit_events(actor_id,action,resource_type,resource_id,metadata) values(auth.uid(),'admin.store.'||p_operation,'store',p_store_id,jsonb_build_object('request_id',p_request_id,'reason',trim(p_reason),'before_status',v_before->>'status','after_status',v_store.status,'subject',case when p_operation='access' then p_document else '{}'::jsonb end));
 insert into kg_private.operation_requests(request_id,actor_id,operation,payload,result) values(p_request_id,auth.uid(),p_operation,v_payload,v_after);
 return v_after;
end;$$;
revoke all on function kg_private.admin_store_write(uuid,uuid,timestamptz,text,jsonb,text) from public,anon;
grant execute on function kg_private.admin_store_write(uuid,uuid,timestamptz,text,jsonb,text) to authenticated;
create function public.kg_admin_store_write(p_request_id uuid,p_store_id uuid,p_expected_updated_at timestamptz,p_operation text,p_document jsonb,p_reason text) returns jsonb language sql security invoker set search_path='' as $$select kg_private.admin_store_write(p_request_id,p_store_id,p_expected_updated_at,p_operation,p_document,p_reason)$$;
revoke all on function public.kg_admin_store_write(uuid,uuid,timestamptz,text,jsonb,text) from public,anon;
grant execute on function public.kg_admin_store_write(uuid,uuid,timestamptz,text,jsonb,text) to authenticated;
notify pgrst,'reload schema';
