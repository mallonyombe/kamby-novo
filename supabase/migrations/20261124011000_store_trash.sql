-- A store in the bin keeps its owner, catalogue, contacts and audit history.
alter table public.kg_stores
  add column deleted_at timestamptz,
  add column deleted_from_status text,
  add constraint kg_store_trash_state check (
    (deleted_at is null and deleted_from_status is null)
    or (deleted_at is not null and deleted_from_status is not null and status='closed' and not is_open)
  );

create function kg_private.guard_store_bin() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.deleted_at is not null then raise exception 'Loja inválida' using errcode='22023';end if;
 elsif (old.deleted_at is not null or new.deleted_at is not null) and
       (old.deleted_at is not distinct from new.deleted_at or current_user in ('authenticated','anon')) then
  raise exception 'Repõe a loja antes de fazer alterações' using errcode='42501';
 end if;
 return new;
end;$$;
create trigger kg_guard_store_bin before insert or update on public.kg_stores
for each row execute function kg_private.guard_store_bin();
revoke all on function kg_private.guard_store_bin() from public,anon,authenticated;

create function kg_private.change_store_bin(p_store_id uuid,p_action text,p_name text,p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare s public.kg_stores%rowtype;target text;actor_name text;
begin
 if not kg_private.has_operation('stores.decide') then raise exception 'Sem autorização' using errcode='42501';end if;
 if p_action is null or p_action not in ('trash','restore') then raise exception 'Acção inválida' using errcode='22023';end if;
 select * into s from public.kg_stores where id=p_store_id for update;
 if not found then raise exception 'Loja indisponível' using errcode='P0002';end if;
 if s.updated_at is distinct from p_expected_updated_at then raise exception 'A loja foi alterada' using errcode='40001';end if;
 if btrim(p_name) is distinct from s.name then raise exception 'Confirma o nome exacto da loja' using errcode='22023';end if;
 select display_name into actor_name from public.kg_profiles where id=auth.uid();
 if p_action='trash' then
  if s.deleted_at is not null then raise exception 'A loja já está na lixeira' using errcode='22023';end if;
  perform set_config('kg.review_reason','Loja movida para a lixeira.',true);
  target='closed';
  update public.kg_stores set status=target,is_open=false,deleted_at=clock_timestamp(),deleted_from_status=s.status where id=s.id;
 else
  if s.deleted_at is null then raise exception 'A loja não está na lixeira' using errcode='22023';end if;
  target=case when s.deleted_from_status in ('suspended','rejected','closed') then s.deleted_from_status else 'draft' end;
  perform set_config('kg.review_reason','Loja reposta da lixeira.',true);
  update public.kg_stores set status=target,is_open=false,deleted_at=null,deleted_from_status=null where id=s.id;
 end if;
 insert into public.kg_audit_events(actor_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),'admin.store.'||p_action,'store',s.id,jsonb_build_object('actor_name',actor_name,'before_status',s.status,'after_status',target));
end;$$;
create function public.kg_admin_store_bin(p_store_id uuid,p_action text,p_name text,p_expected_updated_at timestamptz)
returns void language sql security invoker set search_path='' as $$
 select kg_private.change_store_bin(p_store_id,p_action,p_name,p_expected_updated_at);
$$;

create function kg_private.stores_in_directory(p_query text,p_state text,p_offset integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare q text; result jsonb;
begin
 if not kg_private.has_operation('stores.read') then raise exception 'Sem autorização' using errcode='42501';end if;
 if p_offset is null or p_offset not between 0 and 100000 or length(p_query)>160 then raise exception 'Consulta inválida' using errcode='22023';end if;
 q='%'||replace(replace(replace(coalesce(btrim(p_query),''),'\','\\'),'%','\%'),'_','\_')||'%';
 with matches as materialized (
   select s.id,s.name,s.status,s.location,s.created_at,s.updated_at,s.deleted_at from public.kg_stores s
   where (case when p_state='trash' then s.deleted_at is not null else s.deleted_at is null and (p_state='' or s.status=p_state) end)
   and (s.name ilike q or s.id::text=btrim(p_query))
 ), page as (
   select m.*,
    (select count(*) from public.kg_products p where p.store_id=m.id and p.status<>'archived') product_count,
    (select p.display_name from kg_private.store_merchants v join public.kg_profiles p on p.id=v.user_id where v.store_id=m.id and v.active order by v.created_at,v.user_id limit 1) merchant_name
   from matches m order by m.created_at desc,m.id limit 30 offset p_offset
 )
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id) from page p),'[]'::jsonb),'total',(select count(*) from matches),'as_of',statement_timestamp()) into result;
 return result;
end;$$;

create function kg_private.store_members_for_card(p_store_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select case when kg_private.has_operation('stores.access') and kg_private.has_operation('stores.read')
 then coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'display_name',p.display_name,'active',m.active,'joined_at',m.created_at,
 'has_photo',exists(select 1 from storage.objects o where o.bucket_id='kg-profile-photos' and o.name=m.user_id::text||'/avatar')) order by m.active desc,m.created_at,m.user_id)
 from kg_private.store_merchants m left join public.kg_profiles p on p.id=m.user_id where m.store_id=p_store_id),'[]'::jsonb)
 else '[]'::jsonb end;
$$;
create function kg_private.can_read_store_avatar(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select kg_private.has_operation('stores.access') and kg_private.has_operation('stores.read')
 and exists(select 1 from kg_private.store_merchants where user_id::text||'/avatar'=object_name);
$$;
create policy kg_profile_photo_store_responsible_read on storage.objects for select to authenticated
 using(bucket_id='kg-profile-photos' and kg_private.can_read_store_avatar(name));

create or replace function public.kg_admin_read(p_area text,p_query text default '',p_state text default '',p_offset integer default 0,p_store_id uuid default null,p_days integer default 7)
returns jsonb language sql security invoker set search_path='' as $$
 select case when p_area='users' then kg_private.admin_seller_rows(kg_private.admin_read(p_area,p_query,p_state,p_offset,p_store_id,p_days))
 when p_area='stores' then kg_private.stores_in_directory(p_query,p_state,p_offset)
 when p_area='store' then jsonb_set(kg_private.admin_read(p_area,p_query,p_state,p_offset,p_store_id,p_days),'{members}',kg_private.store_members_for_card(p_store_id))
 else kg_private.admin_read(p_area,p_query,p_state,p_offset,p_store_id,p_days) end;
$$;
revoke all on function kg_private.change_store_bin(uuid,text,text,timestamptz),public.kg_admin_store_bin(uuid,text,text,timestamptz),kg_private.stores_in_directory(text,text,integer),kg_private.store_members_for_card(uuid),kg_private.can_read_store_avatar(text) from public,anon;
grant execute on function kg_private.change_store_bin(uuid,text,text,timestamptz),public.kg_admin_store_bin(uuid,text,text,timestamptz),kg_private.stores_in_directory(text,text,integer),kg_private.store_members_for_card(uuid),kg_private.can_read_store_avatar(text) to authenticated;
notify pgrst,'reload schema';
