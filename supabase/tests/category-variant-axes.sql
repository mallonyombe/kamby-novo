begin;
insert into auth.users(id,email) values ('96000000-0000-4000-8000-000000000061','category-owner@example.invalid');
insert into public.kg_profiles(id,display_name) values ('96000000-0000-4000-8000-000000000061','Gestor de categorias');
insert into kg_private.admins(user_id) values ('96000000-0000-4000-8000-000000000061');
insert into public.kg_stores (id,owner_id,name,slug,whatsapp_e164)
values ('96000000-0000-4000-8000-000000000062','96000000-0000-4000-8000-000000000061','Loja de ensaio','loja-ensaio-eixos','+258841234567');

set local role authenticated;
select set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000061',true);
select set_config('request.jwt.claim.aal','aal1',true);
do $$
begin
  begin
    insert into public.kg_categories (name,slug,variant_axis) values ('Água','agua-ensaio','volume');
    raise exception 'Category creation bypassed MFA';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.aal','aal2',true);
insert into public.kg_categories (name,slug,variant_axis) values ('Água','agua-ensaio','volume');
do $$
begin
  if not exists(select 1 from public.kg_store_categories sc join public.kg_categories c on c.id=sc.category_id
                where c.slug='agua-ensaio' and c.variant_axis='volume' and sc.store_id='96000000-0000-4000-8000-000000000062') then
    raise exception 'Existing store did not inherit the new category';
  end if;
  begin
    update public.kg_categories set variant_axis='litre' where slug='agua-ensaio';
    raise exception 'Invalid axis accepted';
  exception when check_violation then null;
  end;
end;
$$;

reset role;
insert into public.kg_products (id,store_id,category_id,title,price_minor)
select '96000000-0000-4000-8000-000000000063','96000000-0000-4000-8000-000000000062',id,'Água mineral',5000
from public.kg_categories where slug='agua-ensaio';
set local role authenticated;
do $$
begin
  begin
    delete from public.kg_categories where slug='agua-ensaio';
    raise exception 'Category in use was deleted';
  exception when foreign_key_violation then null;
  end;
end;
$$;
do $$
declare
  product_id constant uuid := '96000000-0000-4000-8000-000000000063';
  version timestamptz;
begin
  select updated_at into strict version from public.kg_products where id=product_id;
  perform set_config('request.jwt.claim.aal','aal1',true);
  begin
    perform public.kg_admin_delete_product(product_id,version);
    raise exception 'Product deletion bypassed MFA';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.aal','aal2',true);
  begin
    perform public.kg_admin_delete_product(product_id,version-interval '1 second');
    raise exception 'Product deletion ignored an outdated version';
  exception when serialization_failure then null;
  end;
  perform public.kg_admin_delete_product(product_id,version);
  perform public.kg_admin_delete_product(product_id,version);
  if exists(select 1 from public.kg_products where id=product_id) then
    raise exception 'Deleted product remained in the catalogue';
  end if;
  if (select count(*) from public.kg_audit_events where resource_id=product_id and action='admin.product.delete')<>1 then
    raise exception 'Expected one permanent deletion event';
  end if;
end;
$$;

do $$
declare category_id_to_remove uuid;
begin
  delete from public.kg_categories where slug='agua-ensaio' returning id into strict category_id_to_remove;
  if exists(select 1 from public.kg_store_categories where category_id=category_id_to_remove) then
    raise exception 'Deleted category kept eligibility links';
  end if;
end;
$$;
rollback;
