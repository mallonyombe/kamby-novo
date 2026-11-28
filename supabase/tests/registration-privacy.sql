begin;
do $$
declare
  adult uuid := '97210000-0000-4000-8000-000000000001';
  other uuid := '97210000-0000-4000-8000-000000000002';
  store_id uuid := '97210000-0000-4000-8000-000000000003';
  category_id uuid := '97210000-0000-4000-8000-000000000004';
  product_id uuid := '97210000-0000-4000-8000-000000000005';
  docs jsonb := public.kg_registration_documents();
  proposed jsonb;
  event jsonb;
  proof jsonb;
begin
  proposed := docs || '{"adult_declared":true,"kamby_registration":true,"legal_accepted":true,"email_marketing":false}';
  event := jsonb_build_object('user',jsonb_build_object('app_metadata','{"provider":"email"}'::jsonb,'user_metadata',proposed));
  if public.kg_before_user_created(event) <> '{}' then raise exception 'Registration rejected'; end if;
  if not (public.kg_before_user_created(jsonb_set(event,'{user,user_metadata,adult_declared}','false')) ? 'error') then
    raise exception 'Under-age account allowed';
  end if;
  if not (public.kg_before_user_created(jsonb_set(event,'{user,user_metadata,terms_version}','"old"')) ? 'error') then
    raise exception 'Old document accepted';
  end if;
  if not (public.kg_before_user_created(jsonb_set(event,'{user,app_metadata,provider}','"google"')) ? 'error') then
    raise exception 'Creation via external OAuth accepted without a legal record';
  end if;
  if not (public.kg_before_user_created(jsonb_set(event,'{user,user_metadata,legal_accepted}','false')) ? 'error') then
    raise exception 'Creation allowed without acceptance';
  end if;
  begin
    insert into auth.users(id, email, raw_user_meta_data, raw_app_meta_data)
      values (adult,'privacy@test.invalid', proposed || '{"adult_declared":false}'::jsonb,'{"provider":"email"}');
    raise exception 'Invalid declared account was inserted';
  exception when check_violation then null;
  end;
  insert into auth.users(id, email, raw_user_meta_data, raw_app_meta_data)
    values (adult,'privacy@test.invalid', proposed,'{"provider":"email"}'),
           (other,'other@test.invalid', proposed || '{"email_marketing":true}'::jsonb,'{"provider":"email"}');
  update auth.users set raw_user_meta_data = '{}' where id = adult;
  perform set_config('request.jwt.claim.sub', adult::text, true);
  proof := public.kg_download_account_data(adult);
  if proof #>> '{registration_acceptance,terms_version}' is distinct from docs->>'terms_version'
    or proof #>> '{registration_acceptance,privacy_version}' is distinct from docs->>'privacy_version'
    or proof #>> '{registration_acceptance,accepted_at}' is null
    or not (public.kg_current_account_terms()->>'accepted')::boolean then
    raise exception 'Missing immutable evidence';
  end if;
  if proof #>> '{account,email}' is distinct from 'privacy@test.invalid'
    or proof::text like '%other@test.invalid%' then raise exception 'Incorrect export scope'; end if;
  begin
    perform public.kg_download_account_data(other);
    raise exception 'Exported another account';
  exception when insufficient_privilege then null;
  end;
  if public.kg_email_marketing_choice(adult) then raise exception 'Default marketing is on'; end if;
  if not public.kg_email_marketing_choice(adult, true) then raise exception 'Opt-in lost'; end if;
  perform public.kg_email_marketing_choice(adult, true);
  if public.kg_email_marketing_choice(adult, false) then raise exception 'Opt-out lost'; end if;
  if jsonb_array_length(public.kg_download_account_data(adult)->'email_marketing_choices') <> 2 then
    raise exception 'Expected a separate opt-in and revocation record';
  end if;
  begin
    perform public.kg_submit_product_report(gen_random_uuid(), 'copyright', 'Descrição de teste suficiente');
    raise exception 'Non-existent product accepted';
  exception when invalid_parameter_value then null;
  end;
  perform set_config('request.jwt.claim.sub', '', true);
  insert into public.kg_stores(id,name,slug,owner_id,status,whatsapp_e164,location)
    values (store_id,'Loja de ensaio','loja-privacidade-qa',other,'draft','+258841234567','Chongoene');
  insert into kg_private.store_merchants(store_id,user_id,active) values (store_id,other,true);
  update public.kg_stores set status='approved' where id=store_id;
  insert into public.kg_categories(id,name,slug) values (category_id,'Produtos','produtos-privacidade-qa');
  insert into public.kg_products(id,store_id,category_id,title,price_minor,status)
    values (product_id,store_id,category_id,'Produto de ensaio',1000,'published');
  perform set_config('request.jwt.claim.sub', adult::text, true);
  perform public.kg_submit_product_report(product_id, 'copyright', 'Descrição de teste suficiente');
  perform public.kg_submit_product_report(product_id, 'copyright', 'Descrição de teste suficiente');
  proof := public.kg_download_account_data(adult);
  if jsonb_array_length(proof->'reports') <> 1
     or proof #>> '{reports,0,reason}' not like 'Direitos de autor%' then
    raise exception 'Copyright report lost or duplicated';
  end if;
  perform set_config('request.jwt.claim.sub', other::text, true);
  if jsonb_array_length(public.kg_download_account_data(other)->'reports') <> 0 then
    raise exception 'Another account report exposed';
  end if;
  if not public.kg_email_marketing_choice(other) then raise exception 'Registration marketing opt-in lost'; end if;
  if has_function_privilege('anon','public.kg_download_account_data(uuid)','execute')
    or has_function_privilege('authenticated','public.kg_before_user_created(jsonb)','execute')
    or has_column_privilege('authenticated','public.kg_reports','reporter_id','insert') then
    raise exception 'Unexpected permissions';
  end if;
end;
$$;
rollback;
