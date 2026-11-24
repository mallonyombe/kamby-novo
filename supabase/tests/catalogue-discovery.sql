begin;
insert into auth.users(id,email) values('97000000-0000-0000-0000-000000000001','discovery@example.invalid');
insert into public.kg_stores(id,name,slug,owner_id,status,whatsapp_e164,location) values
 ('97000000-0000-0000-0000-000000000002','Loja São José','loja-qa','97000000-0000-0000-0000-000000000001','draft','+258841234567','Chongoene');
insert into kg_private.store_merchants(store_id,user_id,active) values
 ('97000000-0000-0000-0000-000000000002','97000000-0000-0000-0000-000000000001',true);
update public.kg_stores set status='approved',is_open=true where slug='loja-qa';
insert into public.kg_categories(id,name,slug) values
 ('97000000-0000-0000-0000-000000000003','Mercearia','mercearia-qa'),
 ('97000000-0000-0000-0000-000000000004','Casa','casa-qa'),
 ('97000000-0000-0000-0000-000000000005','Vazia','vazia-qa');
insert into public.kg_products(store_id,category_id,title,price_minor,status)
select '97000000-0000-0000-0000-000000000002','97000000-0000-0000-0000-000000000004','Artigo '||i,1000+i,'published' from generate_series(1,61) i;
insert into public.kg_products(id,store_id,category_id,title,price_minor,status) values
 ('97000000-0000-0000-0000-000000000006','97000000-0000-0000-0000-000000000002','97000000-0000-0000-0000-000000000003','Óleo',1000,'published'),
 ('97000000-0000-0000-0000-000000000007','97000000-0000-0000-0000-000000000002','97000000-0000-0000-0000-000000000005','Segredo',1000,'draft');
insert into public.kg_product_variants(product_id,sku,option_name,price_minor,in_stock,track_quantity) values
 ('97000000-0000-0000-0000-000000000006','qa-v1','1 litro',1000,false,false),
 ('97000000-0000-0000-0000-000000000006','qa-v2','2 litros',1800,true,false);
set local role anon;
do $$
declare result jsonb;
begin
 if (select count(*) from public.kg_feed_categories())<>2 then raise exception 'Wrong public categories';end if;
 if (public.kg_search_catalogue('products','segredo')->>'total')::int<>0 then raise exception 'Draft leaked';end if;
 result:=public.kg_search_catalogue('products','artigo',60,24);
 if (result->>'total')::int<>61 or jsonb_array_length(result->'ids')<>1 then raise exception 'Missing item after page 60';end if;
 result:=public.kg_search_catalogue('products','sao oleo',0,10,null,1800,1800,true);
 if result->'ids'<>jsonb_build_array('97000000-0000-0000-0000-000000000006'::text) then raise exception 'Accents, word order or available variant price failed';end if;
 if (public.kg_search_catalogue('products','oleo',0,10,null,null,1000)->>'total')::int<>0 then raise exception 'Exhausted option quoted';end if;
 if (public.kg_search_catalogue('stores','chongoene')->>'total')::int<>1 then raise exception 'Store search failed';end if;
end $$;
rollback;
