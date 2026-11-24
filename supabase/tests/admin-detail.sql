begin;
insert into auth.users(id,email) values('96000000-0000-4000-8000-000000000001','detail@example.invalid');
insert into public.kg_profiles(id,display_name) values('96000000-0000-4000-8000-000000000001','Detalhe');
insert into kg_private.admins(user_id) values('96000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000001',true),set_config('request.jwt.claim.aal','aal1',true);
do $$ begin
 begin perform public.kg_admin_detail('users','96000000-0000-4000-8000-000000000001');raise exception 'MFA bypass';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.aal','aal2',true);
do $$ begin
 if public.kg_admin_detail('users','96000000-0000-4000-8000-000000000001')->'record'->>'display_name'<>'Detalhe' then raise exception 'Wrong identity';end if;
 begin perform public.kg_admin_detail('users','96000000-0000-4000-8000-000000000001',-1);raise exception 'Negative offset';exception when invalid_parameter_value then null;end;
 begin perform public.kg_admin_detail('users','96000000-0000-4000-8000-000000000099');raise exception 'Missing identity';exception when no_data_found then null;end;
end $$;
select public.kg_record_app_session('96000000-0000-4000-8000-000000000011','96000000-0000-4000-8000-000000000021');
select public.kg_record_app_session('96000000-0000-4000-8000-000000000012','96000000-0000-4000-8000-000000000021');
do $$begin
 if (public.kg_admin_audience(7)->>'sessions')::int<>2 then raise exception 'Sessions not counted';end if;
 if (public.kg_admin_audience(7)->>'returning_devices')::int<>1 then raise exception 'Returning device not counted';end if;
end $$;
select set_config('request.jwt.claim.aal','aal1',true);
do $$begin
 begin perform public.kg_admin_audience(7);raise exception 'Audience MFA bypass';exception when insufficient_privilege then null;end;
 begin perform public.kg_admin_store_bin('96000000-0000-4000-8000-000000000099','trash','Test',now());raise exception 'Store MFA bypass';exception when insufficient_privilege then null;end;
 begin perform public.kg_admin_product_action('96000000-0000-4000-8000-000000000099','hide',now());raise exception 'Product MFA bypass';exception when insufficient_privilege then null;end;
end $$;
rollback;
