-- Preserva a assinatura consumida pelos clientes já publicados.
create or replace function kg_private.delete_archived_product(p_store_id uuid,p_product_id uuid,p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare
  product public.kg_products%rowtype;
begin
  if auth.uid() is null or not kg_private.can_prepare_store(p_store_id) then
    raise exception 'Sem acesso a esta loja' using errcode='42501';
  end if;
  perform 1 from public.kg_stores where id=p_store_id for share;
  perform 1 from kg_private.store_merchants where store_id=p_store_id and user_id=auth.uid() and active for share;
  if not found or not kg_private.can_prepare_store(p_store_id) then
    raise exception 'Sem acesso a esta loja' using errcode='42501';
  end if;
  select * into product from public.kg_products where id=p_product_id and store_id=p_store_id for update;
  if not found then return; end if;
  if product.updated_at is distinct from p_expected_updated_at then
    raise exception 'Este produto foi alterado' using errcode='40001';
  end if;
  if product.status not in ('draft','archived') or product.moderation_status<>'allowed' then
    raise exception 'Só podes apagar um rascunho ou um produto arquivado sem restrições' using errcode='42501';
  end if;
  delete from public.kg_products where id=p_product_id;
  insert into public.kg_catalogue_activity(store_id,product_id,kind,title)
    values(p_store_id,p_product_id,'deleted',product.title);
end;$$;

