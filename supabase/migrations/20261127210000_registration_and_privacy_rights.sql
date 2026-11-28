create table kg_private.privacy_policy_versions (
  version text primary key,
  published_at timestamptz not null default now()
);
insert into kg_private.privacy_policy_versions(version) values ('2026-11-27.1');

create table kg_private.registration_acceptances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  terms_version text not null references kg_private.account_terms(version),
  privacy_version text not null references kg_private.privacy_policy_versions(version),
  accepted_at timestamptz not null default clock_timestamp(),
  adult_declared boolean not null check (adult_declared)
);

create table kg_private.email_marketing_choices (
  user_id uuid not null references auth.users(id) on delete cascade,
  sequence bigint generated always as identity,
  allowed boolean not null,
  purpose_version text not null default 'kamby-email-offers-v1',
  recorded_at timestamptz not null default clock_timestamp(),
  primary key (user_id, sequence)
);

alter table kg_private.privacy_policy_versions enable row level security;
alter table kg_private.registration_acceptances enable row level security;
alter table kg_private.email_marketing_choices enable row level security;
revoke all on kg_private.privacy_policy_versions, kg_private.registration_acceptances,
  kg_private.email_marketing_choices from public, anon, authenticated;

create function public.kg_registration_documents() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'terms_version', (public.kg_current_account_terms()->>'version'),
    'privacy_version', (
      select version from kg_private.privacy_policy_versions
      order by published_at desc, version desc limit 1
    )
  );
$$;
revoke all on function public.kg_registration_documents() from public, anon, authenticated;
grant execute on function public.kg_registration_documents() to anon, authenticated;

create function kg_private.valid_registration(p_metadata jsonb) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(
    p_metadata->'kamby_registration' = 'true'::jsonb
    and p_metadata->'adult_declared' = 'true'::jsonb
    and p_metadata->'legal_accepted' = 'true'::jsonb
    and jsonb_typeof(p_metadata->'email_marketing') = 'boolean'
    and p_metadata->>'terms_version' = versions->>'terms_version'
    and p_metadata->>'privacy_version' = versions->>'privacy_version',
    false
  )
  from (select public.kg_registration_documents() as versions) current_documents;
$$;
revoke all on function kg_private.valid_registration(jsonb) from public, anon, authenticated;

-- Configurar como Before User Created em Authentication > Hooks.
-- A entrada Google continua disponível para utilizadores existentes.
create function public.kg_before_user_created(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if event #>> '{user,app_metadata,provider}' is distinct from 'email' then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403,
      'message', 'Cria primeiro a tua conta Kamby com e-mail.'));
  end if;
  if not kg_private.valid_registration(event #> '{user,user_metadata}') then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403,
      'message', 'Confirma a idade e aceita as versões actuais dos documentos.'));
  end if;
  return '{}'::jsonb;
end;
$$;
revoke all on function public.kg_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.kg_before_user_created(jsonb) to supabase_auth_admin;

create function kg_private.record_registration_acceptance() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  details jsonb := new.raw_user_meta_data;
  occurred_at timestamptz := clock_timestamp();
begin
  if new.raw_app_meta_data->>'provider' is distinct from 'email'
      or not coalesce(details ? 'legal_accepted', false) then
    return new;
  end if;
  if not kg_private.valid_registration(details) then
    raise exception 'Documentos de registo inválidos ou desactualizados' using errcode = '23514';
  end if;
  insert into kg_private.registration_acceptances(user_id, terms_version, privacy_version, accepted_at, adult_declared)
  values (new.id, details->>'terms_version', details->>'privacy_version', occurred_at, true);
  insert into kg_private.account_terms_acceptances(user_id, version, accepted_at)
  values (new.id, details->>'terms_version', occurred_at);
  if details->'email_marketing' = 'true'::jsonb then
    insert into kg_private.email_marketing_choices(user_id, allowed, recorded_at)
    values (new.id, true, occurred_at);
  end if;
  return new;
end;
$$;
revoke all on function kg_private.record_registration_acceptance() from public, anon, authenticated;
create trigger kg_registration_acceptance after insert on auth.users
for each row execute function kg_private.record_registration_acceptance();

create function public.kg_email_marketing_choice(p_user_id uuid, p_allowed boolean default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  previous boolean;
begin
  if caller is null or caller is distinct from p_user_id then
    raise exception 'Sessão obrigatória' using errcode = '42501';
  end if;
  if p_allowed is not null then
    perform 1 from auth.users where id = caller for update;
  end if;
  select allowed into previous from kg_private.email_marketing_choices
  where user_id = caller order by sequence desc limit 1;
  if p_allowed is not null and p_allowed <> coalesce(previous, false) then
    insert into kg_private.email_marketing_choices(user_id, allowed) values (caller, p_allowed);
    return p_allowed;
  end if;
  return coalesce(previous, false);
end;
$$;
revoke all on function public.kg_email_marketing_choice(uuid, boolean) from public, anon, authenticated;
grant execute on function public.kg_email_marketing_choice(uuid, boolean) to authenticated;

create function public.kg_download_account_data(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare caller uuid := auth.uid();
begin
  if caller is null or caller is distinct from p_user_id
      or not exists (select 1 from auth.users where id = caller) then
    raise exception 'Sessão obrigatória' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('id', id, 'email', email, 'phone', phone,
      'last_sign_in_at', last_sign_in_at) from auth.users where id = caller),
    'profile', (select to_jsonb(p) from public.kg_profiles p where p.id = caller),
    'saved_products', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from public.kg_saved_products s where s.user_id = caller),
    'preferences', (select to_jsonb(p) from public.kg_user_preferences p where p.user_id = caller),
    'notifications', (select coalesce(jsonb_agg(to_jsonb(n)), '[]') from public.kg_notifications n where n.user_id = caller),
    'contact_activity', (select coalesce(jsonb_agg(to_jsonb(a)), '[]') from public.kg_contact_activity a where a.user_id = caller),
    'contact_intents', (select coalesce(jsonb_agg(to_jsonb(i) - 'snapshot'), '[]') from public.kg_contact_intents i where i.buyer_id = caller),
    'carts', (select coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object(
      'items', (select coalesce(jsonb_agg(to_jsonb(i)), '[]') from public.kg_cart_items i where i.cart_id = c.id)
    )), '[]') from public.kg_carts c where c.buyer_id = caller),
    'reports', (select coalesce(jsonb_agg(to_jsonb(r) - 'resolution_reason' - 'reviewed_by'), '[]')
      from public.kg_reports r where r.reporter_id = caller),
    'closure_request', (select to_jsonb(r) from public.kg_account_requests r where r.user_id = caller),
    'registration_acceptance', (select to_jsonb(r) from kg_private.registration_acceptances r where r.user_id = caller),
    'accepted_terms', (select coalesce(jsonb_agg(to_jsonb(t) order by t.accepted_at), '[]')
      from kg_private.account_terms_acceptances t where t.user_id = caller),
    'email_marketing_choices', (select coalesce(jsonb_agg(jsonb_build_object('allowed', m.allowed, 'purpose_version', m.purpose_version, 'recorded_at', m.recorded_at)
      order by m.sequence), '[]') from kg_private.email_marketing_choices m where m.user_id = caller)
  );
end;
$$;
revoke all on function public.kg_download_account_data(uuid) from public, anon, authenticated;
grant execute on function public.kg_download_account_data(uuid) to authenticated;

create function public.kg_read_terms_version(p_version text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('version', version, 'title', title, 'sections', sections)
  from kg_private.account_terms where version = p_version;
$$;
revoke all on function public.kg_read_terms_version(text) from public, anon, authenticated;
grant execute on function public.kg_read_terms_version(text) to anon, authenticated;

create function public.kg_submit_product_report(p_product uuid, p_kind text, p_details text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  report_reason text;
begin
  if caller is null then raise exception 'Sessão obrigatória' using errcode = '42501'; end if;
  if p_kind is null or p_kind not in ('content', 'copyright') or p_details is null
      or char_length(btrim(p_details)) not between 10 and 1900 then
    raise exception 'Denúncia inválida' using errcode = '22023';
  end if;
  if not exists (select 1 from public.kg_products p join public.kg_stores s on s.id = p.store_id
      where p.id = p_product and p.status = 'published' and p.moderation_status = 'allowed' and s.status = 'approved') then
    raise exception 'Produto indisponível' using errcode = '22023';
  end if;

  report_reason := (case p_kind when 'copyright' then 'Direitos de autor' else 'Conteúdo do anúncio' end) || E'\n' || btrim(p_details);
  perform 1 from auth.users where id = caller for update;
  if not found then raise exception 'Sessão obrigatória' using errcode = '42501'; end if;
  if exists (select 1 from public.kg_reports r where r.reporter_id = caller and r.target_id = p_product
      and r.target_type = 'product' and r.status = 'open' and r.reason = report_reason) then return; end if;
  if (select count(*) from public.kg_reports r where r.reporter_id = caller and r.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Aguarda antes de enviar outra denúncia' using errcode = '54000';
  end if;
  insert into public.kg_reports(reporter_id, target_type, target_id, reason)
    values (caller, 'product', p_product, report_reason);
end;
$$;
revoke all on function public.kg_submit_product_report(uuid, text, text) from public, anon, authenticated;
grant execute on function public.kg_submit_product_report(uuid, text, text) to authenticated;
revoke insert(reporter_id, target_type, target_id, reason) on public.kg_reports from authenticated;
