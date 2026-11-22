-- Private account experience; no new public catalogue or role source.
create table public.kg_saved_products (
 user_id uuid not null references auth.users(id) on delete cascade,
 product_id uuid not null references public.kg_products(id) on delete cascade,
 created_at timestamptz not null default now(),primary key(user_id,product_id)
);
create index kg_saved_product_lookup on public.kg_saved_products(product_id,user_id);
alter table public.kg_saved_products enable row level security;
revoke all on public.kg_saved_products from public,anon,authenticated;
grant select,delete on public.kg_saved_products to authenticated;
grant insert(user_id,product_id) on public.kg_saved_products to authenticated;
create policy kg_saved_read on public.kg_saved_products for select to authenticated using(user_id=(select auth.uid()));
create policy kg_saved_remove on public.kg_saved_products for delete to authenticated using(user_id=(select auth.uid()));
create policy kg_saved_add on public.kg_saved_products for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.kg_products p join public.kg_stores s on s.id=p.store_id where p.id=product_id and p.status='published' and s.status='approved'));

create table public.kg_user_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 catalogue_alerts boolean not null default true,
 account_alerts boolean not null default true
);
alter table public.kg_user_preferences enable row level security;
revoke all on public.kg_user_preferences from public,anon,authenticated;
grant select on public.kg_user_preferences to authenticated;
grant insert(user_id,catalogue_alerts,account_alerts),update(catalogue_alerts,account_alerts) on public.kg_user_preferences to authenticated;
create policy kg_pref_read on public.kg_user_preferences for select to authenticated using(user_id=(select auth.uid()));
create policy kg_pref_add on public.kg_user_preferences for insert to authenticated with check(user_id=(select auth.uid()));
create policy kg_pref_edit on public.kg_user_preferences for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table public.kg_contact_activity (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 store_id uuid references public.kg_stores(id) on delete set null,
 product_id uuid references public.kg_products(id) on delete set null,
 store_name text not null, product_title text not null default '',
 kind text not null default 'whatsapp_requested' check(kind='whatsapp_requested'),
 created_at timestamptz not null default now()
);
create index kg_contact_activity_user_time on public.kg_contact_activity(user_id,created_at desc,id);
alter table public.kg_contact_activity enable row level security;
revoke all on public.kg_contact_activity from public,anon,authenticated;
grant select on public.kg_contact_activity to authenticated;
create policy kg_activity_read on public.kg_contact_activity for select to authenticated using(user_id=(select auth.uid()));
create function kg_private.record_contact_activity(p_store_id uuid,p_product_id uuid,p_request_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_store public.kg_stores%rowtype;v_title text='';v_old public.kg_contact_activity%rowtype;
begin
 if auth.uid() is null then raise exception 'Sessão obrigatória' using errcode='42501';end if;
 select * into v_old from public.kg_contact_activity where id=p_request_id;
 if found then
  if v_old.user_id is distinct from auth.uid() or v_old.store_id is distinct from p_store_id or v_old.product_id is distinct from p_product_id then raise exception 'Pedido inacessível' using errcode='42501';end if;
  return;
 end if;
 select * into v_store from public.kg_stores where id=p_store_id and status='approved';
 if not found then raise exception 'Loja indisponível' using errcode='22023';end if;
 if p_product_id is not null then
  select title into v_title from public.kg_products where id=p_product_id and store_id=p_store_id and status='published';
  if not found then raise exception 'Produto indisponível' using errcode='22023';end if;
 end if;
 -- A bounded per-user window protects this auxiliary record; a click is never a sale.
 if (select count(*) from public.kg_contact_activity where user_id=auth.uid() and created_at>now()-interval '1 minute')>=30 then raise exception 'Tenta mais tarde' using errcode='22023';end if;
 insert into public.kg_contact_activity(id,user_id,store_id,product_id,store_name,product_title)
 values(p_request_id,auth.uid(),p_store_id,p_product_id,v_store.name,coalesce(v_title,''));
end;$$;
revoke all on function kg_private.record_contact_activity(uuid,uuid,uuid) from public,anon;
grant execute on function kg_private.record_contact_activity(uuid,uuid,uuid) to authenticated;
create function public.kg_record_contact_activity(p_store_id uuid,p_product_id uuid default null,p_request_id uuid default gen_random_uuid())
returns void language sql security invoker set search_path='' as $$select kg_private.record_contact_activity(p_store_id,p_product_id,p_request_id);$$;
revoke all on function public.kg_record_contact_activity(uuid,uuid,uuid) from public,anon;
grant execute on function public.kg_record_contact_activity(uuid,uuid,uuid) to authenticated;

create table public.kg_account_requests (
 user_id uuid primary key references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','processing','completed','declined')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.kg_account_requests enable row level security;
revoke all on public.kg_account_requests from public,anon,authenticated;
grant select on public.kg_account_requests to authenticated;
grant insert(user_id),update(status,updated_at) on public.kg_account_requests to authenticated;
create policy kg_request_read on public.kg_account_requests for select to authenticated using(user_id=(select auth.uid()) or (select kg_private.is_admin()));
create policy kg_request_add on public.kg_account_requests for insert to authenticated with check(user_id=(select auth.uid()) and status='pending');
create policy kg_request_admin on public.kg_account_requests for update to authenticated using((select kg_private.is_admin())) with check((select kg_private.is_admin()));

create table public.kg_notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('catalogue','account')),
 title text not null,body text not null,
 created_at timestamptz not null default now(),read_at timestamptz
);
create index kg_notifications_user_time on public.kg_notifications(user_id,created_at desc,id);
alter table public.kg_notifications enable row level security;
revoke all on public.kg_notifications from public,anon,authenticated;
grant select on public.kg_notifications to authenticated;
grant update(read_at) on public.kg_notifications to authenticated;
create policy kg_notification_read on public.kg_notifications for select to authenticated using(user_id=(select auth.uid()));
create policy kg_notification_seen on public.kg_notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create function kg_private.notify_saved_product() returns trigger language plpgsql security definer set search_path='' as $$
declare v_product public.kg_products%rowtype;v_title text;
begin
 if TG_TABLE_NAME='kg_product_variants' then
  if new.price_minor is not distinct from old.price_minor and new.in_stock is not distinct from old.in_stock then return new;end if;
  select * into v_product from public.kg_products where id=new.product_id;
  v_title=v_product.title || ' · ' || new.option_name;
 else
  if new.price_minor is not distinct from old.price_minor and new.stock_status is not distinct from old.stock_status then return new;end if;
  if exists(select 1 from public.kg_product_variants where product_id=new.id) then return new;end if;
  v_product=new;v_title=new.title;
 end if;
 if v_product.status<>'published' or not exists(select 1 from public.kg_stores where id=v_product.store_id and status='approved') then return new;end if;
 insert into public.kg_notifications(user_id,kind,title,body)
 select f.user_id,'catalogue','Artigo guardado actualizado',v_title || ': o preço ou a disponibilidade mudou.'
 from public.kg_saved_products f left join public.kg_user_preferences p on p.user_id=f.user_id
 where f.product_id=v_product.id and coalesce(p.catalogue_alerts,true);
 return new;
end;$$;
revoke all on function kg_private.notify_saved_product() from public,anon,authenticated;
create trigger kg_notify_product after update of price_minor,stock_status on public.kg_products for each row execute function kg_private.notify_saved_product();
create trigger kg_notify_variant after update of price_minor,in_stock on public.kg_product_variants for each row execute function kg_private.notify_saved_product();
create function kg_private.notify_account_request() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' and new.status=old.status then return new;end if;
 if coalesce((select account_alerts from public.kg_user_preferences where user_id=new.user_id),true) then
 insert into public.kg_notifications(user_id,kind,title,body) values(new.user_id,'account','Pedido de encerramento',case new.status when 'pending' then 'O teu pedido foi registado para análise.' when 'processing' then 'O teu pedido está em tratamento.' when 'completed' then 'O pedido foi marcado como concluído pela gestão.' else 'A gestão reviu o teu pedido. Contacta o suporte para esclarecimentos.' end);
 end if;
 new.updated_at=now();return new;
end;$$;
revoke all on function kg_private.notify_account_request() from public,anon,authenticated;
create trigger kg_notify_request before insert or update on public.kg_account_requests for each row execute function kg_private.notify_account_request();
notify pgrst,'reload schema';
