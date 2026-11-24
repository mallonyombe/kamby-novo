create table kg_private.seller_activations (
 user_id uuid primary key references public.kg_profiles(id) on delete cascade,
 activated_by uuid references auth.users(id) on delete set null,
 activated_at timestamptz not null default now(),
 store_id uuid unique references public.kg_stores(id) on delete restrict
);
alter table kg_private.seller_activations enable row level security;
revoke all on kg_private.seller_activations from public, anon, authenticated;

create table kg_private.seller_store_changes (
 transaction_id bigint primary key,
 store_id uuid not null,
 user_id uuid not null,
 operation text not null check (operation in ('create','submit'))
);
alter table kg_private.seller_store_changes enable row level security;
revoke all on kg_private.seller_store_changes from public, anon, authenticated;

alter table public.kg_notifications add column action text check (action in ('seller_setup'));

create function kg_private.activate_seller(p_user_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if not kg_private.is_admin() then
  raise exception 'Acesso de gestão obrigatório' using errcode='42501';
 end if;
 if not exists(select 1 from public.kg_profiles where id=p_user_id) then
  raise exception 'Conta indisponível' using errcode='P0002';
 end if;
 if exists(select 1 from kg_private.store_merchants where user_id=p_user_id and active) then
  return true;
 end if;
 insert into kg_private.seller_activations(user_id,activated_by)
 values(p_user_id,auth.uid()) on conflict(user_id) do nothing;
 if found then
  insert into public.kg_notifications(user_id,kind,title,body,action)
  values(p_user_id,'account','Modo vendedor activo','Já podes criar a tua loja no Kamby.','seller_setup');
  insert into public.kg_audit_events(actor_id,action,resource_type,resource_id,metadata)
  values(auth.uid(),'admin.user.seller_activated','user',p_user_id,'{}');
 end if;
 return true;
end;$$;

create function kg_private.seller_store_operation(p_store_id uuid) returns text
language sql stable security definer set search_path='' as $$
 select operation from kg_private.seller_store_changes
 where transaction_id=txid_current() and store_id=p_store_id and user_id=auth.uid()
$$;
revoke all on function kg_private.seller_store_operation(uuid) from public,anon;
grant execute on function kg_private.seller_store_operation(uuid) to authenticated;

create or replace function kg_private.guard_store() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_operation text=kg_private.seller_store_operation(new.id);
begin
 if TG_OP='INSERT' and v_operation='create' and new.owner_id=auth.uid()
    and new.status='draft' and not new.is_open then
  new.updated_at=clock_timestamp();
  return new;
 end if;
 if TG_OP='UPDATE' and v_operation='create'
    and (to_jsonb(new)-'updated_at')=(to_jsonb(old)-'updated_at') then
  new.updated_at=clock_timestamp();
  return new;
 end if;
 if TG_OP='UPDATE' and v_operation='submit' and old.status='draft' and new.status='pending'
    and (to_jsonb(new)-array['status','updated_at'])=(to_jsonb(old)-array['status','updated_at']) then
  new.updated_at=clock_timestamp();
  return new;
 end if;
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
 if jsonb_array_length(v_stores)>0 or exists(select 1 from kg_private.seller_activations where user_id=v_user) then v_roles=v_roles||'["merchant"]'::jsonb;end if;
 if v_admin then v_roles=v_roles||'["administrator"]'::jsonb;
 elsif v_operator then v_roles=v_roles||'["operator"]'::jsonb;end if;
 return jsonb_build_object('user_id',v_user,'roles',v_roles,
  'merchant_store_ids',v_stores,'seller_onboarding',not exists(select 1 from kg_private.store_merchants where user_id=v_user and active) and exists(select 1 from kg_private.seller_activations where user_id=v_user and store_id is null),'admin_access',(v_admin or v_operator) and v_mfa,
  'admin_mfa_required',(v_admin or v_operator) and not v_mfa);
end;$$;

create function kg_private.create_seller_store(p_name text,p_whatsapp text) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 v_user uuid=auth.uid();
 v_id uuid;
 v_name text=trim(coalesce(p_name,''));
 v_phone text=regexp_replace(coalesce(p_whatsapp,''),'\s','','g');
begin
 if v_user is null then raise exception 'Sessão obrigatória' using errcode='42501';end if;
 select store_id into v_id from kg_private.seller_activations where user_id=v_user for update;
 if not found then raise exception 'Modo vendedor indisponível' using errcode='42501';end if;
 if v_id is not null then return v_id;end if;
 if exists(select 1 from kg_private.store_merchants where user_id=v_user and active) then
  raise exception 'Esta conta já gere uma loja' using errcode='22023';
 end if;
 if char_length(v_name) not between 2 and 80 or v_phone !~ '^\+[1-9][0-9]{7,14}$'
    or (v_phone ~ '^\+258' and char_length(v_phone) not in (12,13)) then
  raise exception 'Confere o nome e o WhatsApp com indicativo' using errcode='22023';
 end if;
 v_id=gen_random_uuid();
 insert into kg_private.seller_store_changes values(txid_current(),v_id,v_user,'create');
 insert into public.kg_stores(id,owner_id,name,slug,whatsapp_e164,status,is_open)
 values(v_id,v_user,v_name,'loja-'||replace(v_id::text,'-',''),v_phone,'draft',false);
 insert into kg_private.store_merchants(store_id,user_id,active) values(v_id,v_user,true);
 update kg_private.seller_activations set store_id=v_id where user_id=v_user;
 delete from kg_private.seller_store_changes where transaction_id=txid_current();
 return v_id;
end;$$;

create function kg_private.submit_seller_store(p_store_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_status text;
begin
 if auth.uid() is null then raise exception 'Sessão obrigatória' using errcode='42501';end if;
 select status into v_status from public.kg_stores where id=p_store_id for update;
 if not found or not kg_private.can_prepare_store(p_store_id) then
  raise exception 'Loja indisponível' using errcode='42501';
 end if;
 if v_status='pending' then return;end if;
 if v_status<>'draft' then raise exception 'Esta loja não está em preparação' using errcode='22023';end if;
 insert into kg_private.seller_store_changes values(txid_current(),p_store_id,auth.uid(),'submit');
 update public.kg_stores set status='pending' where id=p_store_id;
 delete from kg_private.seller_store_changes where transaction_id=txid_current();
end;$$;

create function kg_private.admin_seller_rows(p_result jsonb) returns jsonb
language sql stable security definer set search_path='' as $$
 select case when kg_private.has_operation('users.read') then jsonb_set(p_result,'{rows}',(
  select coalesce(jsonb_agg(entry || jsonb_build_object('seller_active',
   (entry->>'stores')::integer>0 or exists(select 1 from kg_private.seller_activations where user_id=(entry->>'id')::uuid))
   order by position),'[]'::jsonb)
  from jsonb_array_elements(p_result->'rows') with ordinality as rows(entry,position)
 )) else p_result end
$$;

create or replace function public.kg_admin_read(p_area text,p_query text default '',p_state text default '',p_offset integer default 0,p_store_id uuid default null,p_days integer default 7)
returns jsonb language sql security invoker set search_path='' as $$
 select case when p_area='users' then kg_private.admin_seller_rows(kg_private.admin_read(p_area,p_query,p_state,p_offset,p_store_id,p_days))
 else kg_private.admin_read(p_area,p_query,p_state,p_offset,p_store_id,p_days) end
$$;

create function public.kg_admin_activate_seller(p_user_id uuid) returns boolean
language sql security invoker set search_path='' as $$select kg_private.activate_seller(p_user_id)$$;
create function public.kg_create_seller_store(p_name text,p_whatsapp text) returns uuid
language sql security invoker set search_path='' as $$select kg_private.create_seller_store(p_name,p_whatsapp)$$;
create function public.kg_submit_seller_store(p_store_id uuid) returns void
language sql security invoker set search_path='' as $$select kg_private.submit_seller_store(p_store_id)$$;
revoke all on function kg_private.activate_seller(uuid), kg_private.create_seller_store(text,text),
 kg_private.submit_seller_store(uuid), kg_private.admin_seller_rows(jsonb),
 public.kg_admin_activate_seller(uuid), public.kg_create_seller_store(text,text), public.kg_submit_seller_store(uuid)
 from public,anon;
grant execute on function kg_private.activate_seller(uuid), kg_private.create_seller_store(text,text),
 kg_private.submit_seller_store(uuid), kg_private.admin_seller_rows(jsonb),
 public.kg_admin_activate_seller(uuid), public.kg_create_seller_store(text,text), public.kg_submit_seller_store(uuid)
 to authenticated;

create or replace function kg_private.require_store_responsible() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='approved' and (TG_OP='INSERT' or old.status is distinct from new.status) then
  if TG_OP='UPDATE' and old.status='draft' and exists(
   select 1 from kg_private.seller_activations where store_id=new.id
  ) then
   raise exception 'A loja tem de ser enviada para revisão antes de ser publicada' using errcode='22023';
  end if;
  if not exists(select 1 from kg_private.store_merchants where store_id=new.id and active) then
   raise exception 'Cria a loja em preparação e atribui um responsável antes de activar' using errcode='22023';
  end if;
 end if;
 return new;
end;$$;

-- Existing seller memberships stay valid. Retire the old assignment and creation entry points.
revoke execute on function public.kg_assign_merchant(uuid,uuid,boolean), kg_private.assign_merchant(uuid,uuid,boolean),
 public.kg_create_store(text,text,text,text,text) from authenticated;
drop policy kg_stores_insert on public.kg_stores;
create or replace function public.kg_admin_store_write(p_request_id uuid,p_store_id uuid,p_expected_updated_at timestamptz,p_operation text,p_document jsonb,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if p_operation not in ('identity','decision') then
  raise exception 'Esta operação foi retirada' using errcode='42501';
 end if;
 return kg_private.admin_store_write(p_request_id,p_store_id,p_expected_updated_at,p_operation,p_document,p_reason);
end;$$;

notify pgrst,'reload schema';
