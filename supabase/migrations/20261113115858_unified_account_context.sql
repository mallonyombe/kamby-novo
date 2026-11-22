-- One authenticated identity, with capabilities derived only from private grants.
-- This read-only context does not grant access: each existing RPC/RLS policy
-- remains authoritative and rechecks membership/MFA on every operation.
create function kg_private.account_context() returns jsonb
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
 where m.user_id=v_user and m.active and s.status='approved';
 if jsonb_array_length(v_stores)>0 then v_roles=v_roles||'["merchant"]'::jsonb;end if;
 if v_admin then v_roles=v_roles||'["administrator"]'::jsonb;
 elsif v_operator then v_roles=v_roles||'["operator"]'::jsonb;end if;
 return jsonb_build_object('user_id',v_user,'roles',v_roles,
  'merchant_store_ids',v_stores,'admin_access',(v_admin or v_operator) and v_mfa,
  'admin_mfa_required',(v_admin or v_operator) and not v_mfa);
end;$$;
revoke all on function kg_private.account_context() from public,anon;
grant execute on function kg_private.account_context() to authenticated;
create function public.kg_account_context() returns jsonb
language sql stable security invoker set search_path='' as $$
 select kg_private.account_context();
$$;
revoke all on function public.kg_account_context() from public,anon;
grant execute on function public.kg_account_context() to authenticated;
notify pgrst,'reload schema';
