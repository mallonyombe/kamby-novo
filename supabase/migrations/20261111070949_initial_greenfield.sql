-- Kamby greenfield. No legacy objects or commercial records are changed.
-- Review this proposal independently before applying it to a hosted project.
create schema if not exists kg_private;
revoke all on schema kg_private from public;
grant usage on schema kg_private to anon, authenticated;
alter default privileges in schema kg_private revoke execute on functions from public;

create table kg_private.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table kg_private.admins enable row level security;
revoke all on kg_private.admins from public, anon, authenticated;

create function kg_private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists(select 1 from kg_private.admins where user_id=(select auth.uid()));
$$;
revoke all on function kg_private.is_admin() from public;
grant execute on function kg_private.is_admin() to anon, authenticated;
create function public.kg_is_admin() returns boolean language sql stable security invoker set search_path = '' as $$select kg_private.is_admin();$$;
revoke all on function public.kg_is_admin() from public,anon;
grant execute on function public.kg_is_admin() to authenticated;

create table public.kg_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check(char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now()
);
create table public.kg_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check(char_length(name) between 1 and 60),
  slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.kg_stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete restrict,
  name text not null check(char_length(name) between 2 and 80),
  slug text not null unique check(char_length(slug) between 2 and 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '' check(char_length(description)<=2000),
  whatsapp_e164 text not null check(whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  location text not null default '' check(char_length(location)<=120),
  status text not null default 'pending' check(status in ('draft','pending','approved','suspended','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.kg_store_applications (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.kg_stores(id) on delete cascade,
  applicant_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check(status in ('draft','pending','approved','suspended','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  reason text check(char_length(reason)<=2000),
  created_at timestamptz not null default now()
);
create table public.kg_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.kg_stores(id) on delete restrict,
  category_id uuid references public.kg_categories(id) on delete restrict,
  title text not null check(char_length(title) between 2 and 160),
  description text not null default '' check(char_length(description)<=5000),
  price_minor bigint not null check(price_minor between 0 and 900000000000),
  currency text not null default 'MZN' check(currency='MZN'),
  stock_status text not null default 'available' check(stock_status in ('available','low','out')),
  status text not null default 'draft' check(status in ('draft','published','archived')),
  image_url text not null default '' check(image_url='' or (image_url ~ '^https://' and char_length(image_url)<=2000)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.kg_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.kg_products(id) on delete cascade,
  storage_path text not null unique check(char_length(storage_path)<=500),
  sort_order smallint not null default 0 check(sort_order between 0 and 9),
  unique(product_id,sort_order)
);
create table public.kg_carts (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.kg_stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(buyer_id,store_id)
);
create table public.kg_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.kg_carts(id) on delete cascade,
  product_id uuid not null references public.kg_products(id) on delete cascade,
  quantity integer not null check(quantity between 1 and 99),
  unit_price_snapshot_minor bigint not null check(unit_price_snapshot_minor>=0),
  unique(cart_id,product_id)
);
create table public.kg_contact_intents (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.kg_stores(id) on delete restrict,
  request_id uuid not null default gen_random_uuid(),
  snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
  status text not null default 'prepared' check(status in ('prepared','whatsapp_opened')),
  created_at timestamptz not null default now(),
  unique(buyer_id,request_id)
);
create table public.kg_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check(target_type in ('product','store')),
  target_id uuid not null,
  reason text not null check(char_length(reason) between 3 and 2000),
  status text not null default 'open' check(status in ('open','resolved','dismissed')),
  resolution_reason text check(char_length(resolution_reason)<=2000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.kg_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index kg_stores_status_created_idx on public.kg_stores(status,created_at desc,id);
create index kg_applications_applicant_idx on public.kg_store_applications(applicant_id);
create index kg_applications_reviewer_idx on public.kg_store_applications(reviewed_by);
create index kg_products_store_status_idx on public.kg_products(store_id,status,created_at desc,id);
create index kg_products_catalog_idx on public.kg_products(created_at desc,id) where status='published';
create index kg_products_category_idx on public.kg_products(category_id,status);
create index kg_products_search_idx on public.kg_products using gin(to_tsvector('simple',title || ' ' || description));
create index kg_cart_items_product_idx on public.kg_cart_items(product_id);
create index kg_carts_store_idx on public.kg_carts(store_id);
create index kg_intents_store_idx on public.kg_contact_intents(store_id,created_at desc);
create index kg_reports_reporter_idx on public.kg_reports(reporter_id,created_at desc);
create index kg_reports_queue_idx on public.kg_reports(status,created_at desc);
create index kg_reports_reviewer_idx on public.kg_reports(reviewed_by);
create index kg_reports_target_idx on public.kg_reports(target_type,target_id);
create index kg_audit_actor_idx on public.kg_audit_events(actor_id);
create index kg_audit_created_idx on public.kg_audit_events(created_at desc);

-- Trigger protects privileged columns independently of policies and REST clients.
create function kg_private.guard_store() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='INSERT' then
   if auth.uid() is not null and (new.owner_id<>auth.uid() or new.status<>'pending') then raise exception 'Candidatura inválida' using errcode='42501'; end if;
 else
   if new.owner_id<>old.owner_id or new.id<>old.id or new.created_at<>old.created_at then raise exception 'Identidade da loja imutável' using errcode='42501'; end if;
   if (new.status is distinct from old.status) and auth.uid() is not null then
     if not kg_private.is_admin() or new.owner_id=auth.uid() then raise exception 'Revisão administrativa independente obrigatória' using errcode='42501'; end if;
     if new.status in ('rejected','suspended') and char_length(trim(coalesce(current_setting('kg.review_reason',true),'')))<3 then raise exception 'Indica o motivo da decisão'; end if;
   elsif auth.uid()=old.owner_id and old.status in ('suspended','rejected') then raise exception 'Loja sem autorização para alterações' using errcode='42501'; end if;
 end if;
 new.updated_at=now(); return new;
end;$$;
revoke all on function kg_private.guard_store() from public,anon,authenticated;
create trigger kg_store_guard before insert or update on public.kg_stores for each row execute function kg_private.guard_store();

create function kg_private.store_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- Internal trigger only. User mutations must have a caller and passed RLS/guard.
 if auth.uid() is null and current_setting('role',true) in ('anon','authenticated') then raise exception 'Sessão obrigatória' using errcode='42501'; end if;
 if TG_OP='INSERT' then
   insert into public.kg_store_applications(store_id,applicant_id,status) values(new.id,new.owner_id,new.status);
 elsif new.status is distinct from old.status then
   update public.kg_store_applications set status=new.status,reviewed_by=auth.uid(),reviewed_at=now(),reason=nullif(current_setting('kg.review_reason',true),'') where store_id=new.id;
 end if;
 insert into public.kg_audit_events(actor_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),case when TG_OP='INSERT' then 'store.applied' when new.status is distinct from old.status then 'store.reviewed' else 'store.updated' end,'store',new.id,jsonb_build_object('status',new.status));
 return new;
end;$$;
revoke all on function kg_private.store_event() from public,anon,authenticated;
create trigger kg_store_event after insert or update on public.kg_stores for each row execute function kg_private.store_event();

create function kg_private.guard_product() returns trigger language plpgsql security invoker set search_path='' as $$
declare v_owner uuid; v_path text;
begin
 if TG_OP='UPDATE' and (new.store_id<>old.store_id or new.id<>old.id or new.created_at<>old.created_at) then raise exception 'Identidade do produto imutável' using errcode='42501'; end if;
 if new.status='published' and not exists(select 1 from public.kg_stores where id=new.store_id and status='approved') then raise exception 'A loja tem de ser aprovada antes da publicação'; end if;
 select owner_id into v_owner from public.kg_stores where id=new.store_id;
 if position('/kg-product-images/' in new.image_url)>0 then
   v_path=split_part(new.image_url,'/kg-product-images/',2);
   if v_owner is null or v_path not like v_owner::text || '/' || new.store_id::text || '/%' or v_path ~ '(^|/)\.\.(/|$)' then raise exception 'Imagem não pertence à loja do produto' using errcode='23514'; end if;
 end if;
 new.updated_at=now(); return new;
end;$$;
revoke all on function kg_private.guard_product() from public,anon,authenticated;
create trigger kg_product_guard before insert or update on public.kg_products for each row execute function kg_private.guard_product();

create function kg_private.cart_item_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare v_store uuid; v_product public.kg_products%rowtype;
begin
 select store_id into v_store from public.kg_carts where id=new.cart_id and buyer_id=auth.uid();
 if v_store is null then raise exception 'Carrinho inacessível' using errcode='42501'; end if;
 select * into v_product from public.kg_products where id=new.product_id;
 if not found or v_product.store_id<>v_store or v_product.status<>'published' or v_product.stock_status='out' or not exists(select 1 from public.kg_stores where id=v_store and status='approved') then raise exception 'Produto indisponível ou de outra loja' using errcode='23514'; end if;
 if TG_OP='UPDATE' and (new.cart_id<>old.cart_id or new.product_id<>old.product_id or new.id<>old.id) then raise exception 'Item imutável' using errcode='42501'; end if;
 new.unit_price_snapshot_minor=v_product.price_minor;
 return new;
end;$$;
revoke all on function kg_private.cart_item_guard() from public,anon,authenticated;
create trigger kg_cart_item_guard before insert or update on public.kg_cart_items for each row execute function kg_private.cart_item_guard();

create function kg_private.report_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='INSERT' then
   if new.reporter_id is distinct from auth.uid() or new.status<>'open' then raise exception 'Denúncia inválida' using errcode='42501'; end if;
   if (new.target_type='store' and not exists(select 1 from public.kg_stores where id=new.target_id and status='approved')) or (new.target_type='product' and not exists(select 1 from public.kg_products p join public.kg_stores s on s.id=p.store_id where p.id=new.target_id and p.status='published' and s.status='approved')) then raise exception 'Conteúdo indisponível' using errcode='23514'; end if;
 else
   if new.id<>old.id or new.reporter_id<>old.reporter_id or new.target_type<>old.target_type or new.target_id<>old.target_id or new.reason<>old.reason or new.created_at<>old.created_at then raise exception 'Identidade da denúncia imutável' using errcode='42501'; end if;
   if not kg_private.is_admin() or new.status not in ('resolved','dismissed') or char_length(trim(coalesce(new.resolution_reason,'')))<3 or new.reviewed_by is distinct from auth.uid() then raise exception 'Decisão administrativa fundamentada obrigatória' using errcode='42501'; end if;
 end if;
 return new;
end;$$;
revoke all on function kg_private.report_guard() from public,anon,authenticated;
create trigger kg_report_guard before insert or update on public.kg_reports for each row execute function kg_private.report_guard();

create function kg_private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null and current_setting('role',true) in ('anon','authenticated') then raise exception 'Sessão obrigatória' using errcode='42501'; end if;
 v_id=case when TG_OP='DELETE' then old.id else new.id end;
 insert into public.kg_audit_events(actor_id,action,resource_type,resource_id,metadata) values(auth.uid(),lower(TG_TABLE_NAME || '.' || TG_OP),TG_TABLE_NAME,v_id,'{}');
 if TG_OP='DELETE' then return old; else return new; end if;
end;$$;
revoke all on function kg_private.audit_change() from public,anon,authenticated;
create trigger kg_product_audit after insert or update or delete on public.kg_products for each row execute function kg_private.audit_change();
create trigger kg_category_audit after insert or update or delete on public.kg_categories for each row execute function kg_private.audit_change();
create trigger kg_report_audit after insert or update on public.kg_reports for each row execute function kg_private.audit_change();

create function kg_private.image_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare v_store uuid; v_owner uuid;
begin
 select p.store_id,s.owner_id into v_store,v_owner from public.kg_products p join public.kg_stores s on s.id=p.store_id where p.id=new.product_id;
 if v_store is null or new.storage_path not like v_owner::text || '/' || v_store::text || '/%' or new.storage_path ~ '(^|/)\.\.(/|$)' then raise exception 'Imagem não pertence à loja do produto' using errcode='23514'; end if;
 return new;
end;$$;
revoke all on function kg_private.image_guard() from public,anon,authenticated;
create trigger kg_image_guard before insert or update on public.kg_product_images for each row execute function kg_private.image_guard();

-- RLS and explicit grants: no implicit all-table access.
alter table public.kg_profiles enable row level security;
alter table public.kg_categories enable row level security;
alter table public.kg_stores enable row level security;
alter table public.kg_store_applications enable row level security;
alter table public.kg_products enable row level security;
alter table public.kg_product_images enable row level security;
alter table public.kg_carts enable row level security;
alter table public.kg_cart_items enable row level security;
alter table public.kg_contact_intents enable row level security;
alter table public.kg_reports enable row level security;
alter table public.kg_audit_events enable row level security;
revoke all on public.kg_profiles,public.kg_categories,public.kg_stores,public.kg_store_applications,public.kg_products,public.kg_product_images,public.kg_carts,public.kg_cart_items,public.kg_contact_intents,public.kg_reports,public.kg_audit_events from public,anon,authenticated;
grant select on public.kg_categories,public.kg_stores,public.kg_products,public.kg_product_images to anon;
grant select on public.kg_profiles,public.kg_categories,public.kg_stores,public.kg_store_applications,public.kg_products,public.kg_product_images,public.kg_carts,public.kg_cart_items,public.kg_contact_intents,public.kg_reports,public.kg_audit_events to authenticated;
grant insert(id,display_name),update(display_name) on public.kg_profiles to authenticated;
grant insert(name,slug,is_active),update(name,slug,is_active),delete on public.kg_categories to authenticated;
grant insert(owner_id,name,slug,description,whatsapp_e164,location),update(name,slug,description,whatsapp_e164,location,status) on public.kg_stores to authenticated;
grant insert(store_id,category_id,title,description,price_minor,currency,stock_status,status,image_url),update(category_id,title,description,price_minor,currency,stock_status,status,image_url),delete on public.kg_products to authenticated;
grant insert(product_id,storage_path,sort_order),update(storage_path,sort_order),delete on public.kg_product_images to authenticated;
grant insert(buyer_id,store_id),delete on public.kg_carts to authenticated;
grant insert(cart_id,product_id,quantity),update(quantity),delete on public.kg_cart_items to authenticated;
grant update(status) on public.kg_contact_intents to authenticated;
grant insert(reporter_id,target_type,target_id,reason),update(status,resolution_reason,reviewed_by,reviewed_at) on public.kg_reports to authenticated;

create policy kg_profiles_select on public.kg_profiles for select to authenticated using(id=(select auth.uid()) or (select kg_private.is_admin()));
create policy kg_profiles_insert on public.kg_profiles for insert to authenticated with check(id=(select auth.uid()));
create policy kg_profiles_update on public.kg_profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy kg_categories_select on public.kg_categories for select to anon,authenticated using(is_active or (select kg_private.is_admin()));
create policy kg_categories_admin_insert on public.kg_categories for insert to authenticated with check((select kg_private.is_admin()));
create policy kg_categories_admin_update on public.kg_categories for update to authenticated using((select kg_private.is_admin())) with check((select kg_private.is_admin()));
create policy kg_categories_admin_delete on public.kg_categories for delete to authenticated using((select kg_private.is_admin()));
create policy kg_stores_select on public.kg_stores for select to anon,authenticated using(status='approved' or owner_id=(select auth.uid()) or (select kg_private.is_admin()));
create policy kg_stores_insert on public.kg_stores for insert to authenticated with check(owner_id=(select auth.uid()) and status='pending');
create policy kg_stores_update on public.kg_stores for update to authenticated using(owner_id=(select auth.uid()) or (select kg_private.is_admin())) with check(owner_id=(select auth.uid()) or (select kg_private.is_admin()));
create policy kg_applications_select on public.kg_store_applications for select to authenticated using(applicant_id=(select auth.uid()) or (select kg_private.is_admin()));
create policy kg_products_select on public.kg_products for select to anon,authenticated using((status='published' and exists(select 1 from public.kg_stores s where s.id=store_id and s.status='approved')) or exists(select 1 from public.kg_stores s where s.id=store_id and s.owner_id=(select auth.uid())) or (select kg_private.is_admin()));
create policy kg_products_insert on public.kg_products for insert to authenticated with check(exists(select 1 from public.kg_stores s where s.id=store_id and s.owner_id=(select auth.uid()) and s.status='approved'));
create policy kg_products_update on public.kg_products for update to authenticated using(exists(select 1 from public.kg_stores s where s.id=store_id and s.owner_id=(select auth.uid()) and s.status='approved') or (select kg_private.is_admin())) with check(exists(select 1 from public.kg_stores s where s.id=store_id and s.owner_id=(select auth.uid()) and s.status='approved') or (select kg_private.is_admin()));
create policy kg_products_delete on public.kg_products for delete to authenticated using(exists(select 1 from public.kg_stores s where s.id=store_id and s.owner_id=(select auth.uid()) and s.status='approved') or (select kg_private.is_admin()));
create policy kg_images_select on public.kg_product_images for select to anon,authenticated using(exists(select 1 from public.kg_products p where p.id=product_id));
create policy kg_images_insert on public.kg_product_images for insert to authenticated with check(exists(select 1 from public.kg_products p join public.kg_stores s on s.id=p.store_id where p.id=product_id and s.owner_id=(select auth.uid()) and s.status='approved'));
create policy kg_images_update on public.kg_product_images for update to authenticated using(exists(select 1 from public.kg_products p join public.kg_stores s on s.id=p.store_id where p.id=product_id and s.owner_id=(select auth.uid()) and s.status='approved')) with check(exists(select 1 from public.kg_products p join public.kg_stores s on s.id=p.store_id where p.id=product_id and s.owner_id=(select auth.uid()) and s.status='approved'));
create policy kg_images_delete on public.kg_product_images for delete to authenticated using(exists(select 1 from public.kg_products p join public.kg_stores s on s.id=p.store_id where p.id=product_id and s.owner_id=(select auth.uid()) and s.status='approved'));
create policy kg_carts_select on public.kg_carts for select to authenticated using(buyer_id=(select auth.uid()));
create policy kg_carts_insert on public.kg_carts for insert to authenticated with check(buyer_id=(select auth.uid()) and exists(select 1 from public.kg_stores s where s.id=store_id and s.status='approved'));
create policy kg_carts_delete on public.kg_carts for delete to authenticated using(buyer_id=(select auth.uid()));
create policy kg_items_select on public.kg_cart_items for select to authenticated using(exists(select 1 from public.kg_carts c where c.id=cart_id and c.buyer_id=(select auth.uid())));
create policy kg_items_insert on public.kg_cart_items for insert to authenticated with check(exists(select 1 from public.kg_carts c where c.id=cart_id and c.buyer_id=(select auth.uid())));
create policy kg_items_update on public.kg_cart_items for update to authenticated using(exists(select 1 from public.kg_carts c where c.id=cart_id and c.buyer_id=(select auth.uid()))) with check(exists(select 1 from public.kg_carts c where c.id=cart_id and c.buyer_id=(select auth.uid())));
create policy kg_items_delete on public.kg_cart_items for delete to authenticated using(exists(select 1 from public.kg_carts c where c.id=cart_id and c.buyer_id=(select auth.uid())));
create policy kg_intents_select on public.kg_contact_intents for select to authenticated using(buyer_id=(select auth.uid()) or (select kg_private.is_admin()));
create policy kg_intents_update on public.kg_contact_intents for update to authenticated using(buyer_id=(select auth.uid()) and status='prepared') with check(buyer_id=(select auth.uid()) and status='whatsapp_opened');
create policy kg_reports_select on public.kg_reports for select to authenticated using(reporter_id=(select auth.uid()) or (select kg_private.is_admin()));
create policy kg_reports_insert on public.kg_reports for insert to authenticated with check(reporter_id=(select auth.uid()) and status='open');
create policy kg_reports_update on public.kg_reports for update to authenticated using((select kg_private.is_admin())) with check((select kg_private.is_admin()));
create policy kg_audit_select on public.kg_audit_events for select to authenticated using((select kg_private.is_admin()));

create function public.kg_review_store(p_store_id uuid,p_status text,p_reason text default '') returns public.kg_stores language plpgsql security invoker set search_path='' as $$
declare v_store public.kg_stores%rowtype;
begin
 if auth.uid() is null or not kg_private.is_admin() then raise exception 'Acesso administrativo obrigatório' using errcode='42501'; end if;
 if p_status not in ('approved','rejected','suspended') then raise exception 'Decisão inválida' using errcode='22023'; end if;
 perform set_config('kg.review_reason',coalesce(trim(p_reason),''),true);
 update public.kg_stores set status=p_status where id=p_store_id and owner_id<>auth.uid() returning * into v_store;
 if not found then raise exception 'Loja indisponível para revisão' using errcode='42501'; end if;
 return v_store;
end;$$;
revoke all on function public.kg_review_store(uuid,text,text) from public,anon;
grant execute on function public.kg_review_store(uuid,text,text) to authenticated;

create function public.kg_resolve_report(p_report_id uuid,p_status text,p_reason text) returns public.kg_reports language plpgsql security invoker set search_path='' as $$
declare v_report public.kg_reports%rowtype;
begin
 if auth.uid() is null or not kg_private.is_admin() then raise exception 'Acesso administrativo obrigatório' using errcode='42501'; end if;
 if p_status not in ('resolved','dismissed') or char_length(trim(coalesce(p_reason,'')))<3 then raise exception 'Indica uma decisão e motivo válidos' using errcode='22023'; end if;
 update public.kg_reports set status=p_status,resolution_reason=trim(p_reason),reviewed_by=auth.uid(),reviewed_at=now() where id=p_report_id and status='open' returning * into v_report;
 if not found then raise exception 'Denúncia já tratada ou indisponível' using errcode='22023'; end if;
 return v_report;
end;$$;
revoke all on function public.kg_resolve_report(uuid,text,text) from public,anon;
grant execute on function public.kg_resolve_report(uuid,text,text) to authenticated;

create function public.kg_set_cart_item(p_product_id uuid,p_quantity integer) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_store uuid; v_cart uuid;
begin
 if auth.uid() is null then raise exception 'Inicia sessão para guardar o carrinho' using errcode='42501'; end if;
 if p_quantity not between 0 and 99 then raise exception 'Quantidade inválida' using errcode='22023'; end if;
 if p_quantity=0 then
  delete from public.kg_cart_items i using public.kg_carts c where i.cart_id=c.id and c.buyer_id=auth.uid() and i.product_id=p_product_id;
  return null;
 end if;
 select p.store_id into v_store from public.kg_products p join public.kg_stores s on s.id=p.store_id where p.id=p_product_id and p.status='published' and p.stock_status<>'out' and s.status='approved';
 if not found then raise exception 'Produto indisponível' using errcode='23514'; end if;
 insert into public.kg_carts(buyer_id,store_id) values(auth.uid(),v_store) on conflict(buyer_id,store_id) do nothing;
 select id into v_cart from public.kg_carts where buyer_id=auth.uid() and store_id=v_store;
 insert into public.kg_cart_items(cart_id,product_id,quantity) values(v_cart,p_product_id,p_quantity) on conflict(cart_id,product_id) do update set quantity=excluded.quantity;
 return v_cart;
end;$$;
revoke all on function public.kg_set_cart_item(uuid,integer) from public,anon;
grant execute on function public.kg_set_cart_item(uuid,integer) to authenticated;

-- The server takes current catalogue values; clients cannot forge snapshots.
create function kg_private.prepare_contact(p_store_id uuid,p_items jsonb,p_request_id uuid) returns public.kg_contact_intents language plpgsql security definer set search_path='' as $$
declare v_store public.kg_stores%rowtype; v_item jsonb; v_product public.kg_products%rowtype; v_quantity integer; v_lines jsonb='[]'; v_subtotal bigint=0; v_result public.kg_contact_intents%rowtype; v_seen uuid[]='{}';
begin
 if auth.uid() is null then raise exception 'Inicia sessão para guardar o pedido preparado' using errcode='42501'; end if;
 if p_store_id is null or p_request_id is null then raise exception 'Loja e chave do pedido obrigatórias' using errcode='22023'; end if;
 select * into v_result from public.kg_contact_intents where buyer_id=auth.uid() and request_id=p_request_id;
 if found then
  if v_result.store_id is distinct from p_store_id then raise exception 'Chave de pedido já utilizada noutra loja' using errcode='22023'; end if;
  return v_result;
 end if;
 if p_items is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Carrinho inválido' using errcode='22023'; end if;
 select * into v_store from public.kg_stores where id=p_store_id and status='approved' for share;
 if not found then raise exception 'Loja indisponível' using errcode='23514'; end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(v_item) is distinct from 'object' or coalesce(v_item->>'quantity','') !~ '^[0-9]{1,2}$' or coalesce(v_item->>'product_id','')=''  then raise exception 'Quantidade inválida' using errcode='22023'; end if;
  v_quantity=(v_item->>'quantity')::integer;
  if v_quantity not between 1 and 99 then raise exception 'Quantidade inválida' using errcode='22023'; end if;
  select * into v_product from public.kg_products where id=(v_item->>'product_id')::uuid and store_id=p_store_id and status='published' and stock_status<>'out' for share;
  if not found or v_product.id=any(v_seen) then raise exception 'Produto indisponível, repetido ou de outra loja' using errcode='23514'; end if;
  v_seen=array_append(v_seen,v_product.id);
  v_lines=v_lines || jsonb_build_array(jsonb_build_object('product_id',v_product.id,'title',v_product.title,'quantity',v_quantity,'unit_price_minor',v_product.price_minor,'currency',v_product.currency));
  v_subtotal=v_subtotal+v_product.price_minor*v_quantity;
  if v_subtotal>9007199254740991 then raise exception 'Subtotal acima do limite permitido' using errcode='22023'; end if;
 end loop;
 insert into public.kg_contact_intents(buyer_id,store_id,request_id,snapshot) values(auth.uid(),p_store_id,p_request_id,jsonb_build_object('store_id',v_store.id,'store_name',v_store.name,'whatsapp_e164',v_store.whatsapp_e164,'items',v_lines,'subtotal_minor',v_subtotal,'currency','MZN')) on conflict(buyer_id,request_id) do nothing returning * into v_result;
 if not found then select * into v_result from public.kg_contact_intents where buyer_id=auth.uid() and request_id=p_request_id; end if;
 if v_result.store_id is distinct from p_store_id then raise exception 'Chave de pedido já utilizada noutra loja' using errcode='22023'; end if;
 return v_result;
end;$$;
revoke all on function kg_private.prepare_contact(uuid,jsonb,uuid) from public,anon;
grant execute on function kg_private.prepare_contact(uuid,jsonb,uuid) to authenticated;
create function public.kg_prepare_contact(p_store_id uuid,p_items jsonb,p_request_id uuid default gen_random_uuid()) returns public.kg_contact_intents language sql security invoker set search_path='' as $$select kg_private.prepare_contact(p_store_id,p_items,p_request_id);$$;
revoke all on function public.kg_prepare_contact(uuid,jsonb,uuid) from public,anon;
grant execute on function public.kg_prepare_contact(uuid,jsonb,uuid) to authenticated;

-- Fresh storage bucket, never modifying the legacy buckets or their policies.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('kg-product-images','kg-product-images',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy kg_storage_select on storage.objects for select to anon,authenticated using(
 bucket_id='kg-product-images' and (
  ((storage.foldername(storage.objects.name))[1]=(select auth.uid())::text and exists(select 1 from public.kg_stores s where s.id::text=(storage.foldername(storage.objects.name))[2] and s.owner_id=(select auth.uid())))
  or exists(select 1 from public.kg_products p join public.kg_stores s on s.id=p.store_id where p.status='published' and s.status='approved' and right(p.image_url,char_length('/kg-product-images/' || storage.objects.name))='/kg-product-images/' || storage.objects.name)
  or exists(select 1 from public.kg_product_images pi join public.kg_products p on p.id=pi.product_id join public.kg_stores s on s.id=p.store_id where pi.storage_path=storage.objects.name and p.status='published' and s.status='approved')
  or (select kg_private.is_admin())
 )
);
create policy kg_storage_insert on storage.objects for insert to authenticated with check(bucket_id='kg-product-images' and (storage.foldername(storage.objects.name))[1]=(select auth.uid())::text and exists(select 1 from public.kg_stores s where s.id::text=(storage.foldername(storage.objects.name))[2] and s.owner_id=(select auth.uid()) and s.status='approved'));
create policy kg_storage_update on storage.objects for update to authenticated using(bucket_id='kg-product-images' and (storage.foldername(storage.objects.name))[1]=(select auth.uid())::text and exists(select 1 from public.kg_stores s where s.id::text=(storage.foldername(storage.objects.name))[2] and s.owner_id=(select auth.uid()) and s.status='approved')) with check(bucket_id='kg-product-images' and (storage.foldername(storage.objects.name))[1]=(select auth.uid())::text and exists(select 1 from public.kg_stores s where s.id::text=(storage.foldername(storage.objects.name))[2] and s.owner_id=(select auth.uid()) and s.status='approved'));
create policy kg_storage_delete on storage.objects for delete to authenticated using(bucket_id='kg-product-images' and (storage.foldername(storage.objects.name))[1]=(select auth.uid())::text and exists(select 1 from public.kg_stores s where s.id::text=(storage.foldername(storage.objects.name))[2] and s.owner_id=(select auth.uid())));

notify pgrst,'reload schema';
