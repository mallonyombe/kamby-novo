begin;
insert into auth.users(id,email) values
 ('97000000-0000-4000-8000-000000000001','terms-one@example.invalid'),
 ('97000000-0000-4000-8000-000000000002','terms-two@example.invalid');

set local role anon;
do $$
begin
  if public.kg_current_account_terms()->>'version' is null
    or public.kg_current_account_terms()->>'accepted' is distinct from 'false' then
    raise exception 'Não foi possível consultar os termos como visitante';
  end if;
  if has_function_privilege('public.kg_accept_account_terms(text,uuid)', 'EXECUTE') then
    raise exception 'A aceitação deve exigir autenticação';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub','97000000-0000-4000-8000-000000000001',true);
do $$
declare
  current_version text := public.kg_current_account_terms()->>'version';
begin
  if public.kg_current_account_terms()->>'accepted' is distinct from 'false' then
    raise exception 'Aceitação inicial incorrecta';
  end if;
  perform public.kg_accept_account_terms(current_version,auth.uid());
  perform public.kg_accept_account_terms(current_version,auth.uid());
  if public.kg_current_account_terms()->>'accepted' is distinct from 'true' then
    raise exception 'Aceitação não persistida';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub','97000000-0000-4000-8000-000000000002',true);
do $$
begin
  if public.kg_current_account_terms()->>'accepted' is distinct from 'false' then
    raise exception 'Aceitação de outra conta foi reutilizada';
  end if;
end;
$$;

reset role;
insert into kg_private.account_terms(version,title,sections,published_at)
values ('teste-seguinte','Próximos termos','[{"title":"Conta","body":"Ensaio."}]',now()+interval '1 second');
set local role authenticated;
select set_config('request.jwt.claim.sub','97000000-0000-4000-8000-000000000001',true);
do $$
begin
  if public.kg_current_account_terms()->>'accepted' is distinct from 'false' then
    raise exception 'A aceitação anterior foi reutilizada para a versão actual';
  end if;
end;
$$;
rollback;
