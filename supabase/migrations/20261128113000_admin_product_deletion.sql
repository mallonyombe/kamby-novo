create function public.kg_admin_delete_product(p_id uuid,p_expected timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare product public.kg_products%rowtype;
begin
  if not kg_private.is_admin() then
    raise exception 'Gestão e confirmação de segurança necessárias' using errcode='42501';
  end if;
  select * into product from public.kg_products where id=p_id for update;
  if not found then return; end if;
  if p_expected is distinct from product.updated_at then
    raise exception 'O produto mudou. Reabre a ficha.' using errcode='40001';
  end if;
  if product.status='published' and product.moderation_status='allowed' then
    raise exception 'Arquiva ou oculta o produto antes de o eliminar' using errcode='22023';
  end if;

  delete from public.kg_products where id=p_id;
  insert into public.kg_catalogue_activity(store_id,product_id,kind,title)
  values(product.store_id,product.id,'deleted',product.title);
  insert into public.kg_audit_events(actor_id,action,resource_type,resource_id,metadata)
  values(auth.uid(),'admin.product.delete','product',product.id,jsonb_build_object(
    'store_id',product.store_id,'title',product.title,'before_status',product.status,
    'before_moderation',product.moderation_status));
end;
$$;

revoke all on function public.kg_admin_delete_product(uuid,timestamptz) from public,anon;
grant execute on function public.kg_admin_delete_product(uuid,timestamptz) to authenticated;
