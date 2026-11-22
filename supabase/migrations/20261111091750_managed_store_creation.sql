-- Product correction: stores are created by Kamby management, never by clients.
-- The initial migration is retained unchanged. No legacy objects/data are touched.
alter table public.kg_stores drop constraint kg_stores_owner_id_key;
create index kg_stores_owner_idx on public.kg_stores(owner_id);
alter table public.kg_stores alter column status set default 'draft';
alter table public.kg_stores add constraint kg_stores_whatsapp_mz_length_check
check(whatsapp_e164 !~ '^\+258' or char_length(whatsapp_e164) in (12,13));
grant insert(status) on public.kg_stores to authenticated;

drop policy kg_stores_insert on public.kg_stores;
create policy kg_stores_insert on public.kg_stores for insert to authenticated
with check ((select kg_private.is_admin()) and owner_id=(select auth.uid()) and status in ('draft','approved'));

create or replace function kg_private.guard_store() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is not null and not kg_private.is_admin() then raise exception 'Acesso de gestão obrigatório' using errcode='42501'; end if;
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
     if new.status not in ('draft','approved','suspended') then raise exception 'Estado inválido' using errcode='22023'; end if;
     if new.status='suspended' and char_length(trim(coalesce(current_setting('kg.review_reason',true),'')))<3 then
       raise exception 'Indica o motivo da suspensão' using errcode='22023';
     end if;
   elsif auth.uid()=old.owner_id and old.status in ('suspended','rejected') and not kg_private.is_admin() then
     raise exception 'Loja sem autorização para alterações' using errcode='42501';
   end if;
 end if;
 new.updated_at=now(); return new;
end;$$;
revoke all on function kg_private.guard_store() from public,anon,authenticated;

create or replace function kg_private.store_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_action text; v_metadata jsonb;
begin
 if auth.uid() is null and current_setting('role',true) in ('anon','authenticated') then raise exception 'Sessão obrigatória' using errcode='42501'; end if;
 -- Managed stores are not applications. Existing historical applications remain intact.
 v_action=case when TG_OP='INSERT' then 'store.created'
   when new.status is distinct from old.status and new.status='approved' then 'store.published'
   when new.status is distinct from old.status and new.status='draft' then 'store.unpublished'
   when new.status is distinct from old.status and new.status='suspended' then 'store.suspended'
   else 'store.updated' end;
 v_metadata=jsonb_build_object('status',new.status);
 if TG_OP='UPDATE' and new.status is distinct from old.status then
   v_metadata=v_metadata || jsonb_build_object('previous_status',old.status);
   if new.status='suspended' then v_metadata=v_metadata || jsonb_build_object('reason',trim(current_setting('kg.review_reason',true))); end if;
 end if;
 insert into public.kg_audit_events(actor_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),v_action,'store',new.id,v_metadata);
 return new;
end;$$;
revoke all on function kg_private.store_event() from public,anon,authenticated;

create function public.kg_create_store(
 p_name text,p_description text,p_whatsapp_e164 text,p_location text,p_status text
) returns public.kg_stores language plpgsql security invoker set search_path='' as $$
declare v_store public.kg_stores%rowtype; v_name text; v_phone text; v_slug text;
begin
 if auth.uid() is null or not kg_private.is_admin() then raise exception 'Só a gestão pode criar lojas' using errcode='42501'; end if;
 v_name=trim(coalesce(p_name,''));
 if char_length(v_name) not between 2 and 80 then raise exception 'Indica um nome de loja entre 2 e 80 caracteres' using errcode='22023'; end if;
 if char_length(coalesce(p_description,''))>2000 or char_length(coalesce(p_location,''))>120 then raise exception 'Descrição ou localização demasiado longa' using errcode='22023'; end if;
 v_phone=regexp_replace(coalesce(p_whatsapp_e164,''),'\s','','g');
 if v_phone !~ '^\+[1-9][0-9]{7,14}$' or (v_phone ~ '^\+258' and char_length(v_phone) not in (12,13)) then raise exception 'Indica o contacto em formato internacional' using errcode='22023'; end if;
 if p_status is null or p_status not in ('draft','approved') then raise exception 'Estado inicial inválido' using errcode='22023'; end if;
 v_slug=trim(both '-' from regexp_replace(translate(lower(v_name),'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn'),'[^a-z0-9]+','-','g'));
 v_slug=trim(trailing '-' from left(coalesce(nullif(v_slug,''),'loja'),45)) || '-' || replace(gen_random_uuid()::text,'-','');
 insert into public.kg_stores(owner_id,name,slug,description,whatsapp_e164,location,status)
 values(auth.uid(),v_name,v_slug,trim(coalesce(p_description,'')),v_phone,trim(coalesce(p_location,'')),p_status)
 returning * into v_store;
 return v_store;
end;$$;
revoke all on function public.kg_create_store(text,text,text,text,text) from public,anon;
grant execute on function public.kg_create_store(text,text,text,text,text) to authenticated;

-- Details and publication are committed together, avoiding a partially saved shop.
create function public.kg_update_store(
 p_store_id uuid,p_name text,p_description text,p_whatsapp_e164 text,p_location text,p_status text,p_reason text
) returns public.kg_stores language plpgsql security invoker set search_path='' as $$
declare v_store public.kg_stores%rowtype; v_name text; v_phone text;
begin
 if auth.uid() is null or not kg_private.is_admin() then raise exception 'Acesso de gestão obrigatório' using errcode='42501'; end if;
 v_name=trim(coalesce(p_name,''));
 if char_length(v_name) not between 2 and 80 then raise exception 'Indica um nome de loja entre 2 e 80 caracteres' using errcode='22023'; end if;
 if char_length(coalesce(p_description,''))>2000 or char_length(coalesce(p_location,''))>120 or char_length(coalesce(p_reason,''))>2000 then raise exception 'Texto demasiado longo' using errcode='22023'; end if;
 v_phone=regexp_replace(coalesce(p_whatsapp_e164,''),'\s','','g');
 if v_phone !~ '^\+[1-9][0-9]{7,14}$' or (v_phone ~ '^\+258' and char_length(v_phone) not in (12,13)) then raise exception 'Indica o contacto em formato internacional' using errcode='22023'; end if;
 if p_status is null or p_status not in ('draft','approved','suspended') then raise exception 'Estado inválido' using errcode='22023'; end if;
 perform set_config('kg.review_reason',coalesce(trim(p_reason),''),true);
 update public.kg_stores
 set name=v_name,description=trim(coalesce(p_description,'')),whatsapp_e164=v_phone,location=trim(coalesce(p_location,'')),status=p_status
 where id=p_store_id returning * into v_store;
 if not found then raise exception 'Loja indisponível' using errcode='22023'; end if;
 return v_store;
end;$$;
revoke all on function public.kg_update_store(uuid,text,text,text,text,text,text) from public,anon;
grant execute on function public.kg_update_store(uuid,text,text,text,text,text,text) to authenticated;

create or replace function public.kg_review_store(p_store_id uuid,p_status text,p_reason text default '')
returns public.kg_stores language plpgsql security invoker set search_path='' as $$
declare v_store public.kg_stores%rowtype;
begin
 if auth.uid() is null or not kg_private.is_admin() then raise exception 'Acesso de gestão obrigatório' using errcode='42501'; end if;
 if p_status is null or p_status not in ('draft','approved','suspended') then raise exception 'Estado inválido' using errcode='22023'; end if;
 if char_length(coalesce(p_reason,''))>2000 then raise exception 'Motivo demasiado longo' using errcode='22023'; end if;
 perform set_config('kg.review_reason',coalesce(trim(p_reason),''),true);
 update public.kg_stores set status=p_status where id=p_store_id returning * into v_store;
 if not found then raise exception 'Loja indisponível' using errcode='22023'; end if;
 return v_store;
end;$$;
revoke all on function public.kg_review_store(uuid,text,text) from public,anon;
grant execute on function public.kg_review_store(uuid,text,text) to authenticated;

-- owner_id records the creator; it never grants residual catalogue access.
drop policy kg_stores_update on public.kg_stores;
create policy kg_stores_update on public.kg_stores for update to authenticated
using ((select kg_private.is_admin())) with check ((select kg_private.is_admin()));
drop policy kg_stores_select on public.kg_stores;
create policy kg_stores_select on public.kg_stores for select to anon,authenticated
using(status='approved' or (select kg_private.is_admin()));
drop policy kg_products_select on public.kg_products;
create policy kg_products_select on public.kg_products for select to anon,authenticated
using((status='published' and exists(select 1 from public.kg_stores s where s.id=store_id and s.status='approved')) or (select kg_private.is_admin()));
drop policy kg_products_insert on public.kg_products;
create policy kg_products_insert on public.kg_products for insert to authenticated
with check ((select kg_private.is_admin()));
drop policy kg_products_update on public.kg_products;
create policy kg_products_update on public.kg_products for update to authenticated
using ((select kg_private.is_admin())) with check ((select kg_private.is_admin()));
drop policy kg_products_delete on public.kg_products;
create policy kg_products_delete on public.kg_products for delete to authenticated
using ((select kg_private.is_admin()));

drop policy kg_images_insert on public.kg_product_images;
create policy kg_images_insert on public.kg_product_images for insert to authenticated
with check ((select kg_private.is_admin()));
drop policy kg_images_update on public.kg_product_images;
create policy kg_images_update on public.kg_product_images for update to authenticated
using ((select kg_private.is_admin())) with check ((select kg_private.is_admin()));
drop policy kg_images_delete on public.kg_product_images;
create policy kg_images_delete on public.kg_product_images for delete to authenticated
using ((select kg_private.is_admin()));

create or replace function kg_private.guard_product() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_owner uuid; v_path text;
begin
 if auth.uid() is not null and not kg_private.is_admin() then raise exception 'Acesso de gestão obrigatório' using errcode='42501'; end if;
 if auth.uid() is null and current_setting('role',true) in ('anon','authenticated') then raise exception 'Sessão obrigatória' using errcode='42501'; end if;
 if TG_OP='UPDATE' and (new.store_id is distinct from old.store_id or new.id is distinct from old.id or new.created_at is distinct from old.created_at) then raise exception 'Identidade do produto imutável' using errcode='42501'; end if;
 if new.status='published' and not exists(select 1 from public.kg_stores where id=new.store_id and status='approved') then raise exception 'Publica a loja antes do produto'; end if;
 select owner_id into v_owner from public.kg_stores where id=new.store_id;
 if position('/kg-product-images/' in new.image_url)>0 then
   v_path=split_part(new.image_url,'/kg-product-images/',2);
   if v_owner is null or v_path not like v_owner::text || '/' || new.store_id::text || '/%' or v_path ~ '(^|/)\.\.(/|$)' then raise exception 'Imagem não pertence à loja do produto' using errcode='23514'; end if;
 end if;
 new.updated_at=now(); return new;
end;$$;
revoke all on function kg_private.guard_product() from public,anon,authenticated;

create or replace function kg_private.image_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_store uuid; v_owner uuid;
begin
 if auth.uid() is not null and not kg_private.is_admin() then raise exception 'Acesso de gestão obrigatório' using errcode='42501'; end if;
 if auth.uid() is null and current_setting('role',true) in ('anon','authenticated') then raise exception 'Sessão obrigatória' using errcode='42501'; end if;
 select p.store_id,s.owner_id into v_store,v_owner from public.kg_products p join public.kg_stores s on s.id=p.store_id where p.id=new.product_id;
 if v_store is null or new.storage_path not like v_owner::text || '/' || v_store::text || '/%' or new.storage_path ~ '(^|/)\.\.(/|$)' then raise exception 'Imagem não pertence à loja do produto' using errcode='23514'; end if;
 return new;
end;$$;
revoke all on function kg_private.image_guard() from public,anon,authenticated;

-- The canonical path belongs to the store owner, even when another admin uploads it.
-- A matching store and owner prefix are required; an arbitrary admin path is rejected.
create function kg_private.can_write_store_image(p_name text)
returns boolean language sql stable security invoker set search_path='' as $$
 select (select auth.uid()) is not null and (select kg_private.is_admin()) and p_name !~ '(^|/)\.\.(/|$)' and exists(
  select 1 from public.kg_stores s
  where s.id::text=(storage.foldername(p_name))[2]
    and s.owner_id::text=(storage.foldername(p_name))[1]
 );
$$;
revoke all on function kg_private.can_write_store_image(text) from public,anon;
grant execute on function kg_private.can_write_store_image(text) to authenticated;

drop policy kg_storage_select on storage.objects;
create policy kg_storage_select on storage.objects for select to anon,authenticated
using(bucket_id='kg-product-images' and (
 (select kg_private.is_admin())
 or exists(select 1 from public.kg_products p join public.kg_stores s on s.id=p.store_id where p.status='published' and s.status='approved' and right(p.image_url,char_length('/kg-product-images/' || storage.objects.name))='/kg-product-images/' || storage.objects.name)
 or exists(select 1 from public.kg_product_images pi join public.kg_products p on p.id=pi.product_id join public.kg_stores s on s.id=p.store_id where pi.storage_path=storage.objects.name and p.status='published' and s.status='approved')
));

drop policy kg_storage_insert on storage.objects;
create policy kg_storage_insert on storage.objects for insert to authenticated
with check(bucket_id='kg-product-images' and kg_private.can_write_store_image(name));
drop policy kg_storage_update on storage.objects;
create policy kg_storage_update on storage.objects for update to authenticated
using(bucket_id='kg-product-images' and kg_private.can_write_store_image(name))
with check(bucket_id='kg-product-images' and kg_private.can_write_store_image(name));
drop policy kg_storage_delete on storage.objects;
create policy kg_storage_delete on storage.objects for delete to authenticated
using(bucket_id='kg-product-images' and kg_private.can_write_store_image(name));

notify pgrst,'reload schema';
