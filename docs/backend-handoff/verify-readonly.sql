-- SOMENTE LEITURA. Executar com acesso administrativo de inspecção.
-- Não contém fixtures, tokens, dados de compradores ou mutações.
select version,name
from supabase_migrations.schema_migrations
where name in ('initial_greenfield','managed_store_creation','product_variants_and_pdp_contract','merchant_workspace','merchant_product_creation')
order by version;

select (select count(*) from public.kg_stores) as stores,
       (select count(*) from public.kg_products) as products,
       (select count(*) from public.kg_categories) as categories;

select id,public,file_size_limit,allowed_mime_types
from storage.buckets where id='kg-product-images';

select n.nspname as schema,c.relname as relation,c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind='r' and (n.nspname='kg_private' or (n.nspname='public' and c.relname like 'kg\_%'))
order by 1,2;

select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies
where schemaname='kg_private' or (schemaname='public' and tablename like 'kg\_%')
 or (schemaname='storage' and policyname like 'kg\_%')
order by schemaname,tablename,policyname;
