-- The official text is supplied separately. An empty registry fails closed.
create table kg_private.seller_terms (
 version text primary key check (btrim(version) <> ''),
 title text not null check (btrim(title) <> ''),
 body text not null check (btrim(body) <> ''),
 active boolean not null default false
);
create unique index kg_seller_terms_single_active on kg_private.seller_terms (active) where active;
alter table kg_private.seller_terms enable row level security;
revoke all on kg_private.seller_terms from public,anon,authenticated;

create table kg_private.seller_terms_acceptances (
 user_id uuid references auth.users on delete cascade,
 version text references kg_private.seller_terms on delete restrict,
 accepted_at timestamptz not null default clock_timestamp(),
 primary key(user_id,version)
);
alter table kg_private.seller_terms_acceptances enable row level security;
revoke all on kg_private.seller_terms_acceptances from public,anon,authenticated;

create function kg_private.seller_terms_immutable() returns trigger
language plpgsql set search_path='' as $$
begin
 if (new.version,new.title,new.body) is distinct from (old.version,old.title,old.body) then
  raise exception 'Regista uma nova versão dos termos' using errcode='22023';
 end if;
 return new;
end;$$;
create trigger kg_seller_terms_version_immutable before update on kg_private.seller_terms
for each row execute function kg_private.seller_terms_immutable();
revoke all on function kg_private.seller_terms_immutable() from public,anon,authenticated;

create function kg_private.can_accept_seller_terms() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
  exists(select 1 from kg_private.seller_activations where user_id=auth.uid())
  or exists(select 1 from kg_private.store_merchants where user_id=auth.uid() and active)
 )
$$;

create function kg_private.current_seller_terms() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not kg_private.can_accept_seller_terms() then
  raise exception 'Modo vendedor indisponível' using errcode='42501';
 end if;
 return (select jsonb_build_object(
  'version',t.version,'title',t.title,'body',t.body,'accepted',exists(
   select 1 from kg_private.seller_terms_acceptances where user_id=auth.uid() and version=t.version
  )) from kg_private.seller_terms t where t.active);
end;$$;

create function kg_private.accept_seller_terms(p_version text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not kg_private.can_accept_seller_terms() then
  raise exception 'Modo vendedor indisponível' using errcode='42501';
 end if;
 perform 1 from kg_private.seller_terms where version=p_version and active for share;
 if not found then raise exception 'A versão dos termos mudou' using errcode='40001';end if;
 insert into kg_private.seller_terms_acceptances(user_id,version) values(auth.uid(),p_version)
 on conflict(user_id,version) do nothing;
end;$$;

create function kg_private.require_current_seller_terms() returns void
language plpgsql security definer set search_path='' as $$
declare v_version text;
begin
 select version into v_version from kg_private.seller_terms where active for share;
 if not found or not exists(
  select 1 from kg_private.seller_terms_acceptances where user_id=auth.uid() and version=v_version
 ) then
  raise exception 'Aceita os termos de vendedor para continuar' using errcode='42501',detail='seller_terms_required';
 end if;
end;$$;
revoke all on function kg_private.can_accept_seller_terms(),kg_private.require_current_seller_terms() from public,anon,authenticated;

create or replace function kg_private.guard_store() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_operation text=kg_private.seller_store_operation(new.id);
begin
 if TG_OP='INSERT' and v_operation='create' and new.owner_id=auth.uid()
    and new.status='draft' and not new.is_open then
  new.updated_at=clock_timestamp();
  return new;
 end if;
 if TG_OP='UPDATE' and v_operation='create'
    and (to_jsonb(new)-'updated_at')=(to_jsonb(old)-'updated_at') then
  new.updated_at=clock_timestamp();
  return new;
 end if;
 if TG_OP='UPDATE' and v_operation='publish' and old.status in ('draft','pending') and new.status='approved' and new.is_open
    and (to_jsonb(new)-array['status','is_open','updated_at'])=(to_jsonb(old)-array['status','is_open','updated_at']) then
  new.updated_at=clock_timestamp();
  return new;
 end if;
 if TG_OP='UPDATE' and kg_private.in_editor(old.id,null) then
  if (to_jsonb(new)-array['name','description','whatsapp_e164','location','logo_path','banner_path','address','service_area','opening_hours','updated_at']) is distinct from (to_jsonb(old)-array['name','description','whatsapp_e164','location','logo_path','banner_path','address','service_area','opening_hours','updated_at']) then raise exception 'Estado e permissões pertencem à administração' using errcode='42501';end if;
  new.updated_at=clock_timestamp();return new;
 end if;
 if auth.uid() is not null and not kg_private.is_admin() then
   if TG_OP<>'UPDATE' or not kg_private.can_manage_store(old.id)
     or (to_jsonb(new)-'is_open'-'updated_at') is distinct from (to_jsonb(old)-'is_open'-'updated_at') then
     raise exception 'Só podes alterar a abertura da tua loja' using errcode='42501';
   end if;
   new.updated_at=clock_timestamp(); return new;
 end if;
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
     if new.status='pending' then raise exception 'A revisão deixou de fazer parte da publicação' using errcode='42501';end if;
     if not kg_private.is_admin() then raise exception 'Acesso de gestão obrigatório' using errcode='42501'; end if;
     if new.status not in ('draft','pending','approved','suspended','rejected','closed') then raise exception 'Estado inválido' using errcode='22023'; end if;
     if new.status in ('suspended','rejected','closed') and char_length(trim(coalesce(current_setting('kg.review_reason',true),'')))<3 then
       raise exception 'Indica o motivo da suspensão' using errcode='22023';
     end if;
   elsif auth.uid()=old.owner_id and old.status in ('suspended','rejected') and not kg_private.is_admin() then
     raise exception 'Loja sem autorização para alterações' using errcode='42501';
   end if;
 end if;
 new.updated_at=clock_timestamp(); return new;
end;$$;

create or replace function kg_private.create_seller_store(p_name text,p_whatsapp text) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 v_user uuid=auth.uid();
 v_id uuid;
 v_name text=trim(coalesce(p_name,''));
 v_phone text=regexp_replace(coalesce(p_whatsapp,''),'\s','','g');
begin
 if v_user is null then raise exception 'Sessão obrigatória' using errcode='42501';end if;
 select store_id into v_id from kg_private.seller_activations where user_id=v_user for update;
 if not found then raise exception 'Modo vendedor indisponível' using errcode='42501';end if;
 perform kg_private.require_current_seller_terms();
 if v_id is not null then return v_id;end if;
 if exists(select 1 from kg_private.store_merchants where user_id=v_user and active) then
  raise exception 'Esta conta já gere uma loja' using errcode='22023';
 end if;
 if char_length(v_name) not between 2 and 80 or v_phone !~ '^\+[1-9][0-9]{7,14}$'
    or (v_phone ~ '^\+258' and char_length(v_phone) not in (12,13)) then
  raise exception 'Confere o nome e o WhatsApp com indicativo' using errcode='22023';
 end if;
 v_id=gen_random_uuid();
 insert into kg_private.seller_store_changes values(txid_current(),v_id,v_user,'create');
 insert into public.kg_stores(id,owner_id,name,slug,whatsapp_e164,status,is_open)
 values(v_id,v_user,v_name,'loja-'||replace(v_id::text,'-',''),v_phone,'draft',false);
 insert into kg_private.store_merchants(store_id,user_id,active) values(v_id,v_user,true);
 update kg_private.seller_activations set store_id=v_id where user_id=v_user;
 delete from kg_private.seller_store_changes where transaction_id=txid_current();
 return v_id;
end;$$;

alter table kg_private.seller_store_changes drop constraint seller_store_changes_operation_check;
alter table kg_private.seller_store_changes add constraint seller_store_changes_operation_check
check (operation in ('create','publish'));

create or replace function kg_private.require_store_responsible() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='approved' and (TG_OP='INSERT' or old.status is distinct from new.status) then
  if TG_OP='UPDATE' and old.status in ('draft','pending') and auth.uid() is not null
     and kg_private.seller_store_operation(new.id) is distinct from 'publish' then
   raise exception 'A loja é publicada pelo vendedor' using errcode='42501';
  end if;
  if not exists(select 1 from kg_private.store_merchants where store_id=new.id and active) then
   raise exception 'Uma loja pública precisa de um vendedor activo' using errcode='22023';
  end if;
 end if;
 return new;
end;$$;

create function kg_private.publish_seller_store(p_store_id uuid) returns public.kg_stores
language plpgsql security definer set search_path='' as $$
declare v_store public.kg_stores%rowtype;
begin
 if auth.uid() is null then raise exception 'Sessão obrigatória' using errcode='42501';end if;
 select * into v_store from public.kg_stores where id=p_store_id for update;
 if not found or not kg_private.can_prepare_store(p_store_id) then
  raise exception 'Loja indisponível' using errcode='42501';
 end if;
 if v_store.status='approved' then return v_store;end if;
 if v_store.status not in ('draft','pending') then
  raise exception 'A loja não pode ser publicada' using errcode='22023';
 end if;
 perform kg_private.require_current_seller_terms();
 insert into kg_private.seller_store_changes values(txid_current(),p_store_id,auth.uid(),'publish');
 update public.kg_stores set status='approved',is_open=true where id=p_store_id returning * into v_store;
 delete from kg_private.seller_store_changes where transaction_id=txid_current();
 return v_store;
end;$$;

create function public.kg_current_seller_terms() returns jsonb
language sql stable security invoker set search_path='' as $$select kg_private.current_seller_terms()$$;
create function public.kg_accept_seller_terms(p_version text) returns void
language sql security invoker set search_path='' as $$select kg_private.accept_seller_terms(p_version)$$;
create function public.kg_publish_seller_store(p_store_id uuid) returns public.kg_stores
language sql security invoker set search_path='' as $$select kg_private.publish_seller_store(p_store_id)$$;
revoke all on function kg_private.current_seller_terms(),kg_private.accept_seller_terms(text),
 kg_private.publish_seller_store(uuid),public.kg_current_seller_terms(),public.kg_accept_seller_terms(text),
 public.kg_publish_seller_store(uuid) from public,anon;
grant execute on function kg_private.current_seller_terms(),kg_private.accept_seller_terms(text),
 kg_private.publish_seller_store(uuid),public.kg_current_seller_terms(),public.kg_accept_seller_terms(text),
 public.kg_publish_seller_store(uuid) to authenticated;

revoke execute on function public.kg_submit_seller_store(uuid),kg_private.submit_seller_store(uuid) from authenticated;
notify pgrst,'reload schema';

-- Primeira versão adoptada pela gestão para a abertura de lojas.
insert into kg_private.seller_terms(version,title,body,active) values (
 '2026-11-24.1','Condições para vender no Kamby',
 'Ao activar a tua loja, autorizas a apresentação pública do nome, fotografias, produtos e contactos comerciais que escolheres publicar. Comprometes-te a apresentar informação correcta sobre preços, variantes e disponibilidade e a usar imagens que tens autorização para publicar. O cliente contacta a loja pelo WhatsApp. A loja confirma com o cliente a disponibilidade, o pagamento e a entrega. Podes preparar a loja em privado e decidir quando a tornar pública.',true);
