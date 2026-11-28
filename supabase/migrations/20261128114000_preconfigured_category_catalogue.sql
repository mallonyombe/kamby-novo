alter table public.kg_categories
  add column catalogue_group text,
  drop constraint kg_categories_variant_axis_check,
  add constraint kg_categories_variant_axis_check check (variant_axis in (
    'volume','small_volume','weight','size','apparel_size','waist_size','shoe_size','kids_apparel_size','kids_shoe_size',
    'bra_size','ring_size','length','capacity','dimensions','power','color','pack','diaper_size','bed_size'
  ));

-- Preserve the identity and activation state of existing categories when a preset
-- matches their slug or normalized name. New entries always start unavailable.
create temporary table kg_category_presets (
  slug text primary key,
  name text not null,
  catalogue_group text not null,
  variant_axis text
);
insert into kg_category_presets values
 ('roupa-feminina','Roupa feminina','Moda e calçado','apparel_size'),
 ('roupa-masculina','Roupa masculina','Moda e calçado','apparel_size'),
 ('camisetas','Camisetas','Moda e calçado','apparel_size'),
 ('camisas','Camisas','Moda e calçado','apparel_size'),
 ('calcas-e-jeans','Calças e jeans','Moda e calçado','waist_size'),
 ('vestidos-e-saias','Vestidos e saias','Moda e calçado','apparel_size'),
 ('casacos-e-blusoes','Casacos e blusões','Moda e calçado','apparel_size'),
 ('roupa-desportiva','Roupa desportiva','Moda e calçado','apparel_size'),
 ('roupa-de-praia','Roupa de praia','Moda e calçado','apparel_size'),
 ('roupa-interior','Roupa interior','Moda e calçado','apparel_size'),
 ('soutiens','Soutiens','Moda e calçado','bra_size'),
 ('calcado-feminino','Calçado feminino','Moda e calçado','shoe_size'),
 ('calcado-masculino','Calçado masculino','Moda e calçado','shoe_size'),
 ('sapatos','Sapatos','Moda e calçado','shoe_size'),
 ('sapatilhas','Sapatilhas','Moda e calçado','shoe_size'),
 ('sandalias-e-chinelos','Sandálias e chinelos','Moda e calçado','shoe_size'),
 ('malas-e-carteiras','Malas e carteiras','Moda e calçado','color'),
 ('oculos','Óculos','Moda e calçado','color'),
 ('relogios','Relógios','Moda e calçado',null),
 ('aneis','Anéis','Moda e calçado','ring_size'),
 ('acessorios-de-moda','Acessórios de moda','Moda e calçado',null),
 ('capulanas','Capulanas','Moda e calçado','length'),
 ('tecidos','Tecidos','Moda e calçado','length'),
 ('roupa-infantil','Roupa infantil','Bebés e crianças','kids_apparel_size'),
 ('roupa-para-bebe','Roupa para bebé','Bebés e crianças','kids_apparel_size'),
 ('calcado-infantil','Calçado infantil','Bebés e crianças','kids_shoe_size'),
 ('fraldas','Fraldas','Bebés e crianças','diaper_size'),
 ('higiene-do-bebe','Higiene do bebé','Bebés e crianças',null),
 ('carrinhos-e-cadeiras-de-bebe','Carrinhos e cadeiras de bebé','Bebés e crianças',null),
 ('brinquedos','Brinquedos','Bebés e crianças',null),
 ('agua','Água','Alimentação e bebidas','volume'),
 ('sumos-e-refrigerantes','Sumos e refrigerantes','Alimentação e bebidas','volume'),
 ('leite-e-bebidas-vegetais','Leite e bebidas vegetais','Alimentação e bebidas','volume'),
 ('oleos-e-vinagres','Óleos e vinagres','Alimentação e bebidas','volume'),
 ('arroz-e-massas','Arroz e massas','Alimentação e bebidas','weight'),
 ('farinhas-e-cereais','Farinhas e cereais','Alimentação e bebidas','weight'),
 ('feijao-e-leguminosas','Feijão e leguminosas','Alimentação e bebidas','weight'),
 ('acucar-e-sal','Açúcar e sal','Alimentação e bebidas','weight'),
 ('fruta-e-legumes','Fruta e legumes','Alimentação e bebidas','weight'),
 ('carne-e-aves','Carne e aves','Alimentação e bebidas','weight'),
 ('peixe-e-marisco','Peixe e marisco','Alimentação e bebidas','weight'),
 ('cafe-e-cha','Café e chá','Alimentação e bebidas','weight'),
 ('especiarias','Especiarias','Alimentação e bebidas','weight'),
 ('pao-e-pastelaria','Pão e pastelaria','Alimentação e bebidas','pack'),
 ('bolachas-e-snacks','Bolachas e snacks','Alimentação e bebidas','weight'),
 ('conservas','Conservas','Alimentação e bebidas','weight'),
 ('sabao-e-detergentes','Sabão e detergentes','Casa e jardim',null),
 ('limpeza-liquida','Produtos de limpeza líquidos','Casa e jardim','volume'),
 ('loica-e-utensilios','Loiça e utensílios','Casa e jardim',null),
 ('copos-e-canecas','Copos e canecas','Casa e jardim','volume'),
 ('panelas-e-frigideiras','Panelas e frigideiras','Casa e jardim',null),
 ('electrodomesticos','Electrodomésticos','Casa e jardim',null),
 ('iluminacao-e-lampadas','Iluminação e lâmpadas','Casa e jardim','power'),
 ('roupa-de-cama','Roupa de cama','Casa e jardim','bed_size'),
 ('colchoes','Colchões','Casa e jardim','bed_size'),
 ('toalhas','Toalhas','Casa e jardim','dimensions'),
 ('cortinas','Cortinas','Casa e jardim','dimensions'),
 ('tapetes','Tapetes','Casa e jardim','dimensions'),
 ('mobilia','Mobília','Casa e jardim',null),
 ('decoracao','Decoração','Casa e jardim',null),
 ('vasos-e-jardineiras','Vasos e jardineiras','Casa e jardim',null),
 ('plantas-e-sementes','Plantas e sementes','Casa e jardim',null),
 ('ferramentas','Ferramentas','Casa e jardim',null),
 ('cabos-e-extensoes','Cabos e extensões','Casa e jardim','length'),
 ('telemoveis','Telemóveis','Tecnologia','capacity'),
 ('tablets','Tablets','Tecnologia','capacity'),
 ('computadores','Computadores','Tecnologia',null),
 ('armazenamento-digital','Pen drives e armazenamento','Tecnologia','capacity'),
 ('carregadores','Carregadores','Tecnologia',null),
 ('auscultadores','Auscultadores','Tecnologia','color'),
 ('capas-para-telemovel','Capas para telemóvel','Tecnologia','color'),
 ('teclados-e-ratos','Teclados e ratos','Tecnologia','color'),
 ('televisores-e-monitores','Televisores e monitores','Tecnologia',null),
 ('camara-e-fotografia','Câmara e fotografia','Tecnologia',null),
 ('jogos-e-consolas','Jogos e consolas','Tecnologia',null),
 ('redes-e-conectividade','Redes e conectividade','Tecnologia',null),
 ('perfumaria','Perfumaria','Cuidados pessoais','small_volume'),
 ('champoes-e-condicionadores','Champôs e condicionadores','Cuidados pessoais','volume'),
 ('cremes-e-locoes','Cremes e loções','Cuidados pessoais','volume'),
 ('oleos-para-cabelo','Óleos para cabelo','Cuidados pessoais','volume'),
 ('maquilhagem','Maquilhagem','Cuidados pessoais',null),
 ('sabonetes','Sabonetes','Cuidados pessoais','weight'),
 ('higiene-oral','Higiene oral','Cuidados pessoais',null),
 ('barbearia','Barbearia','Cuidados pessoais',null),
 ('unhas','Produtos para unhas','Cuidados pessoais','color'),
 ('bicicletas','Bicicletas','Desporto e lazer',null),
 ('bolas-e-equipamento-desportivo','Bolas e equipamento desportivo','Desporto e lazer',null),
 ('campismo-e-passeio','Campismo e passeio','Desporto e lazer',null),
 ('instrumentos-musicais','Instrumentos musicais','Desporto e lazer',null),
 ('livros','Livros','Papelaria e estudo',null),
 ('cadernos-e-blocos','Cadernos e blocos','Papelaria e estudo',null),
 ('canetas-e-lapis','Canetas e lápis','Papelaria e estudo','color'),
 ('papel-e-cartolinas','Papel e cartolinas','Papelaria e estudo','pack'),
 ('material-de-escritorio','Material de escritório','Papelaria e estudo',null),
 ('material-escolar','Material escolar','Papelaria e estudo',null),
 ('pecas-automoveis','Peças para automóveis','Automóvel e moto',null),
 ('acessorios-automoveis','Acessórios para automóveis','Automóvel e moto',null),
 ('lubrificantes','Lubrificantes','Automóvel e moto','volume'),
 ('capacetes','Capacetes','Automóvel e moto','size'),
 ('alimentacao-animal','Alimentação animal','Animais','weight'),
 ('acessorios-animais','Acessórios para animais','Animais',null),
 ('higiene-animal','Higiene animal','Animais',null);

update public.kg_categories c set catalogue_group=p.catalogue_group, variant_axis=p.variant_axis
from pg_temp.kg_category_presets p
where c.slug=p.slug or kg_private.search_text(c.name)=kg_private.search_text(p.name);

insert into public.kg_categories(name,slug,is_active,catalogue_group,variant_axis)
select p.name,p.slug,false,p.catalogue_group,p.variant_axis
from pg_temp.kg_category_presets p
where not exists (
  select 1 from public.kg_categories c
  where c.slug=p.slug or kg_private.search_text(c.name)=kg_private.search_text(p.name)
);
drop table pg_temp.kg_category_presets;

create or replace function kg_private.assign_new_category() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('kamby.category_assignments',0));
  insert into public.kg_store_categories(store_id,category_id)
  select id,new.id from public.kg_stores
  on conflict do nothing;
  return new;
end;
$$;

create or replace function kg_private.assign_initial_categories() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('kamby.category_assignments',0));
  insert into public.kg_store_categories(store_id,category_id)
  select new.id,id from public.kg_categories where is_active
  on conflict do nothing;
  return new;
end;
$$;

create trigger kg_activate_existing_category
  after update of is_active on public.kg_categories for each row
  when (new.is_active and not old.is_active) execute function kg_private.assign_new_category();

create function kg_private.guard_category_configuration() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then
    if old.catalogue_group is not null then
      raise exception 'Uma categoria do catálogo pode ser desactivada' using errcode='23514';
    end if;
    return old;
  end if;
  if old.catalogue_group is not null and (
    new.name is distinct from old.name or new.slug is distinct from old.slug
    or new.variant_axis is distinct from old.variant_axis or new.catalogue_group is distinct from old.catalogue_group
  ) then
    raise exception 'A configuração desta categoria vem do catálogo' using errcode='23514';
  end if;
  if not new.is_active and old.is_active and exists (
    select 1 from public.kg_products p where p.category_id=old.id and p.status<>'archived'
  ) then
    raise exception 'Move os produtos para outra categoria antes de desactivar esta' using errcode='23503';
  end if;
  return new;
end;
$$;
revoke all on function kg_private.guard_category_configuration() from public,anon,authenticated;
create trigger kg_configured_category
  before update or delete on public.kg_categories for each row execute function kg_private.guard_category_configuration();

-- Serialize writes that start depending on an active category with deactivation.
-- Archiving and moving a product to a different category stay possible.
create function kg_private.require_active_product_category() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.category_id is null or new.status='archived' then return new; end if;
  if tg_op='UPDATE' and old.category_id is not distinct from new.category_id and old.status<>'archived' then
    return new;
  end if;
  perform 1 from public.kg_categories c where c.id=new.category_id and c.is_active for share;
  if not found then
    raise exception 'Selecciona uma categoria disponível' using errcode='22023';
  end if;
  return new;
end;
$$;
revoke all on function kg_private.require_active_product_category() from public,anon,authenticated;
create trigger kg_active_product_category
  before insert or update of category_id,status on public.kg_products
  for each row execute function kg_private.require_active_product_category();

create function kg_private.admin_category_rows(p_query text,p_state text,p_offset integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not kg_private.has_operation('categories.read') then
    raise exception 'Sem autorização' using errcode='42501';
  end if;
  if p_state is null or p_state not in ('','active','inactive') or p_offset is null
    or p_offset not between 0 and 100000 or length(p_query)>160 then
    raise exception 'Consulta inválida' using errcode='22023';
  end if;
  with matching as (
    select c.id,c.name,c.is_active,c.catalogue_group
    from public.kg_categories c
    where (p_state='' or c.is_active=(p_state='active'))
      and strpos(kg_private.search_text(concat_ws(' ',c.name,c.catalogue_group,c.slug)),
        kg_private.search_text(btrim(coalesce(p_query,''))))>0
  ), page as (
    select m.*,(select count(*) from public.kg_products p where p.category_id=m.id and p.status<>'archived') as products
    from matching m order by m.catalogue_group nulls first,m.name,m.id limit 30 offset p_offset
  )
  select jsonb_build_object(
    'total',(select count(*) from matching),
    'rows',coalesce((select jsonb_agg(to_jsonb(page) order by catalogue_group nulls first,name,id) from page),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function kg_private.admin_category_rows(text,text,integer) from public,anon;
grant execute on function kg_private.admin_category_rows(text,text,integer) to authenticated;

create or replace function public.kg_admin_read(p_area text,p_query text default '',p_state text default '',p_offset integer default 0,p_store_id uuid default null,p_days integer default 7)
returns jsonb language sql security invoker set search_path='' as $$
 select case when p_area='users' then kg_private.admin_seller_rows(kg_private.admin_read(p_area,p_query,p_state,p_offset,p_store_id,p_days))
 when p_area='stores' then kg_private.stores_in_directory(p_query,p_state,p_offset)
 when p_area='store' then jsonb_set(kg_private.admin_read(p_area,p_query,p_state,p_offset,p_store_id,p_days),'{members}',kg_private.store_members_for_card(p_store_id))
 when p_area='categories' then kg_private.admin_category_rows(p_query,p_state,p_offset)
 else kg_private.admin_read(p_area,p_query,p_state,p_offset,p_store_id,p_days) end;
$$;

create function public.kg_set_category_active(p_id uuid,p_expected boolean,p_active boolean) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
  if not kg_private.has_operation('stores.write') then
    raise exception 'Sem autorização' using errcode='42501';
  end if;
  if p_active is null or p_expected is null then
    raise exception 'Estado inválido' using errcode='22023';
  end if;
  update public.kg_categories set is_active=p_active where id=p_id and is_active=p_expected;
  if not found then
    raise exception 'O estado da categoria foi alterado' using errcode='40001';
  end if;
  return p_active;
end;
$$;
revoke all on function public.kg_set_category_active(uuid,boolean,boolean) from public,anon;
grant execute on function public.kg_set_category_active(uuid,boolean,boolean) to authenticated;
notify pgrst,'reload schema';
