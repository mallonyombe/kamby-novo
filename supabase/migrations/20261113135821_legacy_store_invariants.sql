-- Close legacy RPC/direct-table paths without granting any new authority.
-- Existing approved stores are not rewritten; the invariant is enforced on
-- future activation and membership removal. Administrators still require MFA.
create function kg_private.require_store_responsible() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='approved' and (TG_OP='INSERT' or old.status is distinct from new.status) then
  if not exists(select 1 from kg_private.store_merchants where store_id=new.id and active) then
   raise exception 'Cria a loja em preparação e atribui um responsável antes de activar' using errcode='22023';
  end if;
 end if;
 return new;
end;$$;
revoke all on function kg_private.require_store_responsible() from public,anon,authenticated;
create trigger kg_store_responsible before insert or update of status on public.kg_stores
for each row execute function kg_private.require_store_responsible();

create function kg_private.guard_merchant_membership() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_store uuid;v_status text;
begin
 if TG_OP='UPDATE' and (new.store_id is distinct from old.store_id or new.user_id is distinct from old.user_id) then
  raise exception 'Identidade da atribuição imutável' using errcode='42501';
 end if;
 v_store=case when TG_OP='DELETE' then old.store_id else new.store_id end;
 -- Same parent-row lock as administrative state changes. This closes the
 -- simultaneous last-member revocation and activate/revoke race.
 select status into v_status from public.kg_stores where id=v_store for update;
 if v_status='approved' and TG_OP<>'INSERT' and old.active and
    (TG_OP='DELETE' or not new.active) and not exists(
      select 1 from kg_private.store_merchants where store_id=v_store and active and user_id<>old.user_id
    ) then
  raise exception 'Uma loja activa precisa de um responsável' using errcode='22023';
 end if;
 if TG_OP='DELETE' then return old;end if;
 return new;
end;$$;
revoke all on function kg_private.guard_merchant_membership() from public,anon,authenticated;
create trigger kg_membership_guard before insert or update or delete on kg_private.store_merchants
for each row execute function kg_private.guard_merchant_membership();

create function kg_private.touch_store_membership() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.kg_stores set updated_at=clock_timestamp()
 where id=case when TG_OP='DELETE' then old.store_id else new.store_id end;
 if TG_OP='DELETE' then return old;end if;return new;
end;$$;
revoke all on function kg_private.touch_store_membership() from public,anon,authenticated;
create trigger kg_membership_revision after insert or update or delete on kg_private.store_merchants
for each row execute function kg_private.touch_store_membership();

create or replace function kg_private.assign_merchant(p_store_id uuid,p_user_id uuid,p_active boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not kg_private.is_admin() then raise exception 'Acesso de gestão obrigatório' using errcode='42501';end if;
 if p_active is null then raise exception 'Estado obrigatório' using errcode='22023';end if;
 -- Lock parent BEFORE upsert locks any membership row, matching admin_store_write.
 perform 1 from public.kg_stores where id=p_store_id for update;
 if not found then raise exception 'Loja indisponível' using errcode='P0002';end if;
 insert into kg_private.store_merchants(store_id,user_id,active) values(p_store_id,p_user_id,p_active)
 on conflict(store_id,user_id) do update set active=excluded.active;
 insert into public.kg_audit_events(actor_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),'store.merchant_assigned','store',p_store_id,jsonb_build_object('user_id',p_user_id,'active',p_active));
end;$$;
notify pgrst,'reload schema';
