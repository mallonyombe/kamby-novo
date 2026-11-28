create table kg_private.account_terms (
  version text primary key,
  title text not null check (length(btrim(title)) > 0),
  sections jsonb not null check (jsonb_typeof(sections) = 'array' and jsonb_array_length(sections) > 0),
  published_at timestamptz not null default now()
);

create table kg_private.account_terms_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null references kg_private.account_terms(version),
  accepted_at timestamptz not null default now(),
  primary key (user_id, version)
);

alter table kg_private.account_terms enable row level security;
alter table kg_private.account_terms_acceptances enable row level security;
revoke all on kg_private.account_terms, kg_private.account_terms_acceptances from public, anon, authenticated;

insert into kg_private.account_terms (version, title, sections)
values ('2026-11-27.1', 'Termos de utilização do Kamby', '[
  {"title":"Catálogo e pedidos","body":"O Kamby permite consultar produtos de lojas e iniciar um contacto pelo WhatsApp. Confirma com a loja a variante, a disponibilidade, o preço final e os custos de entrega antes de acordar a compra."},
  {"title":"Pagamento, entrega e devoluções","body":"O pagamento e a entrega são combinados directamente com a loja. Para questões sobre a compra, pagamento, entrega, trocas, devoluções ou reembolsos, usa o contacto comercial da loja. Conserva o registo do que foi combinado. Aplicam-se os teus direitos de consumidor."},
  {"title":"Conta e utilização","body":"Usa informações correctas na tua conta e protege as tuas credenciais. Usa a plataforma para fins lícitos e respeita os direitos de outras pessoas. A exploração pública do catálogo está disponível sem iniciar sessão."},
  {"title":"Privacidade e alterações","body":"Os dados da conta servem para identificar a sessão e disponibilizar as funções da conta. A medição pelo Google Analytics fica desligada até escolheres activá-la. Em Perfil, consulta Privacidade para reveres esta escolha e as opções disponíveis. Quando houver uma nova versão destes termos, poderás consultá-la antes de voltar a usar as funcionalidades da conta."}
]'::jsonb);

create function public.kg_current_account_terms() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'version', t.version, 'title', t.title, 'sections', t.sections, 'user_id', auth.uid(),
    'accepted', exists (
      select 1 from kg_private.account_terms_acceptances a
      where a.user_id = auth.uid() and a.version = t.version
    )
  )
  from kg_private.account_terms t
  order by t.published_at desc, t.version desc
  limit 1;
$$;

create function public.kg_accept_account_terms(p_version text, p_user_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  current_version text;
begin
  if caller is null or caller is distinct from p_user_id then
    raise exception 'Sessão obrigatória' using errcode = '42501';
  end if;

  select t.version into current_version from kg_private.account_terms t
    order by t.published_at desc, t.version desc limit 1;
  if current_version is null or current_version is distinct from p_version then
    raise exception 'Os termos foram actualizados' using errcode = '40001';
  end if;

  insert into kg_private.account_terms_acceptances(user_id, version)
  values (caller, current_version) on conflict (user_id, version) do nothing;
end;
$$;

revoke all on function public.kg_current_account_terms() from public, anon, authenticated;
revoke all on function public.kg_accept_account_terms(text, uuid) from public, anon, authenticated;
grant execute on function public.kg_current_account_terms() to anon, authenticated;
grant execute on function public.kg_accept_account_terms(text, uuid) to authenticated;
