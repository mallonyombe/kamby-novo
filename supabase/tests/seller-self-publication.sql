begin;
update kg_private.seller_terms set active=false where active;
insert into auth.users(id,email) values
 ('95000000-0000-0000-0000-000000000001','publish-seller@example.invalid'),
 ('95000000-0000-0000-0000-000000000002','publish-other@example.invalid'),
 ('95000000-0000-0000-0000-000000000003','publish-admin@example.invalid');
insert into public.kg_profiles(id,display_name)
select id,split_part(email,'@',1) from auth.users where email like 'publish-%@example.invalid';
insert into kg_private.seller_activations(user_id) values('95000000-0000-0000-0000-000000000001');
insert into kg_private.admins(user_id) values('95000000-0000-0000-0000-000000000003');
create function pg_temp.assert_seller_stage(expected text) returns void language plpgsql as $$
declare result text;
begin
 select public.kg_admin_read('users','publish-seller')->'rows'->0->>'seller_state' into result;
 if result is distinct from expected then raise exception 'Expected seller stage %, got %',expected,result;end if;
end;$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','95000000-0000-0000-0000-000000000003',true),
 set_config('request.jwt.claim.aal','aal2',true);
select pg_temp.assert_seller_stage('activated');
set local role authenticated;
select set_config('request.jwt.claim.sub','95000000-0000-0000-0000-000000000001',true),
 set_config('request.jwt.claim.aal','aal1',true);
do $$begin
 if public.kg_current_seller_terms() is not null then raise exception 'Terms shipped without activation';end if;
 begin perform public.kg_create_seller_store('Shop','+258841234567');raise exception 'Create skipped consent';exception when insufficient_privilege then null;end;
end$$;
reset role;
insert into kg_private.seller_terms values('teste-1','Termos de teste','Documento fictício para ensaio.',true);
set local role authenticated;
do $$begin
 if (public.kg_current_seller_terms()->>'accepted')::boolean is distinct from false then raise exception 'Acceptance was inferred';end if;
 begin perform public.kg_accept_seller_terms('different-version');raise exception 'Accepted another version';exception when serialization_failure then null;end;
end$$;
select public.kg_accept_seller_terms('teste-1'),public.kg_accept_seller_terms('teste-1');
select set_config('test.self_store',public.kg_create_seller_store('Shop','+258841234567')::text,true);
reset role;
update kg_private.seller_terms set active=false where active;
insert into kg_private.seller_terms values('teste-2','Termos de teste','Nova versão para ensaio.',true);
set local role authenticated;
do $$begin
 begin perform public.kg_publish_seller_store(current_setting('test.self_store')::uuid);raise exception 'Published with only old consent';exception when insufficient_privilege then null;end;
 begin perform public.kg_submit_seller_store(current_setting('test.self_store')::uuid);raise exception 'Old review path still enabled';exception when insufficient_privilege then null;end;
end$$;
select public.kg_accept_seller_terms('teste-2');
select set_config('request.jwt.claim.sub','95000000-0000-0000-0000-000000000002',true);
do $$begin
 begin perform public.kg_accept_seller_terms('teste-2');raise exception 'Unactivated shopper accepted seller terms';exception when insufficient_privilege then null;end;
 begin perform public.kg_publish_seller_store(current_setting('test.self_store')::uuid);raise exception 'Shopper published someone else’s store';exception when insufficient_privilege then null;end;
end$$;
set local role anon;
do $$begin
 if exists(select 1 from public.kg_stores where id=current_setting('test.self_store')::uuid) then raise exception 'Draft leaked';end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','95000000-0000-0000-0000-000000000003',true),
 set_config('request.jwt.claim.aal','aal2',true);
select pg_temp.assert_seller_stage('preparing');
do $$begin
 begin perform public.kg_review_store(current_setting('test.self_store')::uuid,'approved','test');raise exception 'Admin bypassed seller publication';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','95000000-0000-0000-0000-000000000001',true),
 set_config('request.jwt.claim.aal','aal1',true);
select public.kg_publish_seller_store(current_setting('test.self_store')::uuid);
select public.kg_publish_seller_store(current_setting('test.self_store')::uuid);
select set_config('request.jwt.claim.sub','95000000-0000-0000-0000-000000000003',true),
 set_config('request.jwt.claim.aal','aal2',true);
select pg_temp.assert_seller_stage('public');
set local role anon;
do $$begin
 if not exists(select 1 from public.kg_stores where id=current_setting('test.self_store')::uuid and status='approved' and is_open) then
  raise exception 'Seller publication not visible';
 end if;
end$$;
reset role;
do $$begin
 if (select count(*) from kg_private.seller_terms_acceptances where user_id='95000000-0000-0000-0000-000000000001')<>2 then raise exception 'Acceptance records duplicated or overwritten';end if;
end$$;
rollback;
