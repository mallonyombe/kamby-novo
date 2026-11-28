begin;
insert into auth.users(id,email) values
 ('96000000-0000-4000-8000-000000000071','preset-admin@example.invalid'),
 ('96000000-0000-4000-8000-000000000072','preset-seller@example.invalid'),
 ('96000000-0000-4000-8000-000000000073','preset-later@example.invalid');
insert into public.kg_profiles(id,display_name) select id,'Ensaios de catálogo' from auth.users where email like 'preset-%';
insert into kg_private.admins(user_id) values ('96000000-0000-4000-8000-000000000071');
insert into public.kg_stores (id,owner_id,name,slug,whatsapp_e164) values
 ('96000000-0000-4000-8000-000000000074','96000000-0000-4000-8000-000000000072','Loja anterior','loja-anterior-categorias','+258841234567');
select set_config('test.category_preset',(select id::text from public.kg_categories where slug='agua'),true);

set local role anon;
do $$
begin
  if exists(select 1 from public.kg_categories where slug='agua') then
    raise exception 'An inactive preset leaked to public catalogue';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000071',true);
select set_config('request.jwt.claim.aal','aal1',true);
do $$
begin
  begin
    perform public.kg_set_category_active(current_setting('test.category_preset')::uuid,false,true);
    raise exception 'Category activation bypassed MFA';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.aal','aal2',true);
do $$
declare result jsonb;
begin
  result:=public.kg_admin_read('categories','', 'inactive',0);
  if (result->>'total')::int<100 or jsonb_array_length(result->'rows')<>30 then
    raise exception 'Preset catalogue size or page length incorrect';
  end if;
  result:=public.kg_admin_read('categories','agua','inactive',0);
  if not (result->'rows' @> '[{"name":"Água","is_active":false}]'::jsonb) then
    raise exception 'Accent-insensitive search did not find Água';
  end if;
  if (select variant_axis from public.kg_categories where slug='agua') is distinct from 'volume'
     or (select variant_axis from public.kg_categories where slug='calcado-feminino') is distinct from 'shoe_size'
     or (select variant_axis from public.kg_categories where slug='roupa-feminina') is distinct from 'apparel_size' then
    raise exception 'Presets do not distinguish volume, shoes and clothing';
  end if;

  perform public.kg_set_category_active(current_setting('test.category_preset')::uuid,false,true);
  begin
    perform public.kg_set_category_active(current_setting('test.category_preset')::uuid,false,true);
    raise exception 'Outdated activation write succeeded';
  exception when serialization_failure then null;
  end;
  if not exists(select 1 from public.kg_store_categories
                where store_id='96000000-0000-4000-8000-000000000074'
                  and category_id=current_setting('test.category_preset')::uuid) then
    raise exception 'Existing store did not receive the activated category';
  end if;
  begin
    update public.kg_categories set variant_axis='shoe_size' where id=current_setting('test.category_preset')::uuid;
    raise exception 'Manager could alter the predefined measurements';
  exception when check_violation then null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','',true);
insert into public.kg_stores (id,owner_id,name,slug,whatsapp_e164) values
 ('96000000-0000-4000-8000-000000000075','96000000-0000-4000-8000-000000000073','Loja posterior','loja-posterior-categorias','+258841234567');
insert into public.kg_products (store_id,category_id,title,price_minor) values
 ('96000000-0000-4000-8000-000000000075',current_setting('test.category_preset')::uuid,'Água mineral',5000);

set local role authenticated;
select set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000071',true);
do $$
begin
  if not exists(select 1 from public.kg_store_categories
                where store_id='96000000-0000-4000-8000-000000000075'
                  and category_id=current_setting('test.category_preset')::uuid) then
    raise exception 'New store missed an active category';
  end if;
  begin
    perform public.kg_set_category_active(current_setting('test.category_preset')::uuid,true,false);
    raise exception 'Manager could deactivate a category in use';
  exception when foreign_key_violation then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000072',true);
do $$
begin
  begin
    perform public.kg_admin_read('categories');
    raise exception 'Seller could reach the private category catalogue';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.kg_set_category_active(current_setting('test.category_preset')::uuid,true,false);
    raise exception 'Seller could manage categories';
  exception when insufficient_privilege then null;
  end;
end;
$$;
rollback;
