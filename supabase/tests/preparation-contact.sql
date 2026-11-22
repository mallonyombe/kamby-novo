begin;
-- Pure schedule boundaries; never dependent on the clock/day of the test run.
do $$declare h jsonb='[{"day":0,"closed":false,"open":"08:00","close":"17:00"}]';n jsonb='[{"day":6,"closed":false,"open":"22:00","close":"02:00"}]';begin
 if not kg_private.contact_hours_open('[]','2026-11-16 03:00+02') then raise exception 'FAIL empty schedule compatibility';end if;
 if kg_private.contact_hours_open(h,'2026-11-16 07:59+02') or not kg_private.contact_hours_open(h,'2026-11-16 08:00+02') or not kg_private.contact_hours_open(h,'2026-11-16 16:59+02') or kg_private.contact_hours_open(h,'2026-11-16 17:00+02') then raise exception 'FAIL opening interval boundaries';end if;
 if kg_private.contact_hours_open(h,'2026-11-17 10:00+02') then raise exception 'FAIL omitted configured day';end if;
 if not kg_private.contact_hours_open(n,'2026-11-15 22:00+02') or not kg_private.contact_hours_open(n,'2026-11-16 01:59+02') or kg_private.contact_hours_open(n,'2026-11-16 02:00+02') then raise exception 'FAIL overnight Sunday to Monday';end if;
 if kg_private.contact_hours_open('[{"day":0,"open":"08:00","close":"08:00"}]','2026-11-16 08:00+02') or kg_private.contact_hours_open('[{"day":0,"closed":true,"open":"08:00","close":"17:00"}]','2026-11-16 09:00+02') then raise exception 'FAIL closed/zero duration';end if;
 if not kg_private.contact_hours_open(h,'2026-11-16 06:00+00') then raise exception 'FAIL timezone Maputo';end if;
end$$;
insert into auth.users(id,email)values('93000000-0000-0000-0000-000000000001','prep-admin@example.invalid'),('93000000-0000-0000-0000-000000000002','prep-merchant@example.invalid'),('93000000-0000-0000-0000-000000000003','prep-other@example.invalid');
insert into public.kg_profiles(id,display_name)values('93000000-0000-0000-0000-000000000001','Admin'),('93000000-0000-0000-0000-000000000002','Merchant'),('93000000-0000-0000-0000-000000000003','Buyer');
insert into kg_private.admins(user_id)values('93000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true),set_config('request.jwt.claim.aal','aal2',true);
select set_config('test.prep_store','93000000-0000-0000-0000-000000000004',true),set_config('test.prep_product','93000000-0000-0000-0000-000000000005',true);
select public.kg_admin_store_write(gen_random_uuid(),current_setting('test.prep_store')::uuid,null,'create','{"name":"Private preparation","whatsapp_e164":"+258841234567"}','Test preparation');
select public.kg_assign_merchant(current_setting('test.prep_store')::uuid,'93000000-0000-0000-0000-000000000002',true);
select set_config('test.prep_category',(select category_id::text from public.kg_store_categories where store_id=current_setting('test.prep_store')::uuid limit 1),true);
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000002',true);
do $$declare s uuid=current_setting('test.prep_store')::uuid;p uuid=current_setting('test.prep_product')::uuid;d jsonb;begin
 if not kg_private.can_prepare_store(s) or kg_private.can_manage_store(s) then raise exception 'FAIL preparation vs active permissions';end if;
 if not (public.kg_account_context()->'merchant_store_ids' ? s::text) then raise exception 'FAIL context excludes assigned preparation';end if;
 if not exists(select 1 from public.kg_my_managed_stores() where id=s) then raise exception 'FAIL private assigned listing';end if;
 d=jsonb_build_object('title','Private draft','category_id',current_setting('test.prep_category'),'status','draft','price_minor',100,'images','[]'::jsonb,'variants','[]'::jsonb);
 perform public.kg_save_catalogue_product(gen_random_uuid(),s,p,null,d);
 begin perform public.kg_save_catalogue_product(gen_random_uuid(),s,p,(select updated_at from public.kg_products where id=p),d||'{"status":"published"}');raise exception 'FAIL draft shop published';exception when insufficient_privilege then null;end;
 perform public.kg_save_store_settings(s,(select updated_at from public.kg_stores where id=s),'{"name":"Prepared identity","whatsapp_e164":"+258841234567","opening_hours":[{"day":0,"closed":false,"open":"22:00","close":"02:00"}]}');
 begin perform public.kg_save_store_settings(s,(select updated_at from public.kg_stores where id=s),'{"name":"Prepared identity","whatsapp_e164":"+258841234567","opening_hours":[{"day":"01","closed":false,"open":"08:00","close":"17:00"},{"day":1,"closed":true}]}');raise exception 'FAIL textual schedule day alias';exception when invalid_parameter_value then null;end;
 begin perform public.kg_save_store_settings(s,(select updated_at from public.kg_stores where id=s),'{"name":"Prepared identity","whatsapp_e164":"+258841234567","opening_hours":[{"day":1,"closed":"false","open":"08:00","close":"17:00"}]}');raise exception 'FAIL textual closed flag';exception when invalid_parameter_value then null;end;
 if not kg_private.can_upload_product_image(auth.uid()::text||'/'||s::text||'/'||p::text||'/photo.jpg') then raise exception 'FAIL preparation upload';end if;
 begin update public.kg_stores set status='approved' where id=s;exception when insufficient_privilege then null;end;
 if exists(select 1 from public.kg_stores where id=s and status='approved') then raise exception 'FAIL merchant activates shop';end if;
 begin perform public.kg_create_store('Self registered','','+258841234567','','draft');raise exception 'FAIL self registered shop';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000003',true);
do $$begin
 if exists(select 1 from public.kg_stores where id=current_setting('test.prep_store')::uuid) or exists(select 1 from public.kg_products where id=current_setting('test.prep_product')::uuid) then raise exception 'FAIL private preparation leaked';end if;
 if kg_private.can_prepare_store(current_setting('test.prep_store')::uuid) then raise exception 'FAIL unrelated prepares';end if;
 begin perform public.kg_save_store_settings(current_setting('test.prep_store')::uuid,null,'{}');raise exception 'FAIL unrelated editor';exception when insufficient_privilege then null;end;
end$$;
set local role anon;
do $$begin
 if public.kg_store_contact_availability(current_setting('test.prep_store')::uuid)->>'reason'<>'unavailable' then raise exception 'FAIL public draft disclosure';end if;
 if exists(select 1 from public.kg_products where id=current_setting('test.prep_product')::uuid) then raise exception 'FAIL anon private product';end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
select public.kg_admin_store_write(gen_random_uuid(),id,updated_at,'decision','{"status":"pending"}','Review preparation') from public.kg_stores where id=current_setting('test.prep_store')::uuid;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000002',true);
do $$begin
 if not kg_private.can_prepare_store(current_setting('test.prep_store')::uuid) then raise exception 'FAIL pending preparation';end if;
 perform public.kg_save_store_settings(current_setting('test.prep_store')::uuid,(select updated_at from public.kg_stores where id=current_setting('test.prep_store')::uuid),'{"name":"Prepared identity","whatsapp_e164":"+258841234567","opening_hours":[]}');
end$$;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
select public.kg_admin_store_write(gen_random_uuid(),id,updated_at,'decision','{"status":"approved"}','Activate prepared') from public.kg_stores where id=current_setting('test.prep_store')::uuid;
update public.kg_products set status='published' where id=current_setting('test.prep_product')::uuid;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000003',true);
select set_config('test.prep_request',gen_random_uuid()::text,true),set_config('test.prep_activity',gen_random_uuid()::text,true);
select public.kg_prepare_contact(current_setting('test.prep_store')::uuid,jsonb_build_array(jsonb_build_object('product_id',current_setting('test.prep_product'),'quantity',1)),current_setting('test.prep_request')::uuid);
select public.kg_record_contact_activity(current_setting('test.prep_store')::uuid,current_setting('test.prep_product')::uuid,current_setting('test.prep_activity')::uuid);
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
update public.kg_stores set is_open=false where id=current_setting('test.prep_store')::uuid;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000003',true);
select public.kg_set_cart_item(current_setting('test.prep_product')::uuid,null,2);
do $$declare items jsonb=jsonb_build_array(jsonb_build_object('product_id',current_setting('test.prep_product'),'quantity',1));begin
 if public.kg_store_contact_availability(current_setting('test.prep_store')::uuid)->>'reason'<>'closed' then raise exception 'FAIL paused store contact allowed';end if;
 if not exists(select 1 from public.kg_cart_items where product_id=current_setting('test.prep_product')::uuid and quantity=2) then raise exception 'FAIL closed cart blocked';end if;
 begin perform public.kg_prepare_contact(current_setting('test.prep_store')::uuid,items,gen_random_uuid());raise exception 'FAIL new closed contact';exception when check_violation then null;end;
 begin perform public.kg_prepare_contact(current_setting('test.prep_store')::uuid,items,current_setting('test.prep_request')::uuid);raise exception 'FAIL old contact bypass';exception when check_violation then null;end;
 begin perform public.kg_record_contact_activity(current_setting('test.prep_store')::uuid,current_setting('test.prep_product')::uuid,current_setting('test.prep_activity')::uuid);raise exception 'FAIL closed activity retry';exception when check_violation then null;end;
 begin update public.kg_contact_intents set status='whatsapp_opened' where request_id=current_setting('test.prep_request')::uuid;raise exception 'FAIL direct contact status bypass';exception when check_violation then null;end;
end$$;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
select public.kg_save_store_settings(current_setting('test.prep_store')::uuid,(select updated_at from public.kg_stores where id=current_setting('test.prep_store')::uuid),'{"name":"Prepared identity","whatsapp_e164":"+258841234567","opening_hours":[{"day":0,"closed":true}]}');
update public.kg_stores set is_open=true where id=current_setting('test.prep_store')::uuid;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000003',true);
select public.kg_set_cart_item(current_setting('test.prep_product')::uuid,null,3);
do $$begin
 if (public.kg_store_contact_availability(current_setting('test.prep_store')::uuid)->>'available')::boolean then raise exception 'FAIL configured schedule ignored';end if;
 begin perform public.kg_prepare_contact(current_setting('test.prep_store')::uuid,jsonb_build_array(jsonb_build_object('product_id',current_setting('test.prep_product'),'quantity',1)),gen_random_uuid());raise exception 'FAIL outside-hours contact';exception when check_violation then null;end;
end$$;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
select public.kg_admin_store_write(gen_random_uuid(),id,updated_at,'decision','{"status":"suspended"}','Suspend prepared') from public.kg_stores where id=current_setting('test.prep_store')::uuid;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000002',true);
do $$begin
 if kg_private.can_prepare_store(current_setting('test.prep_store')::uuid) or (public.kg_account_context()->'merchant_store_ids' ? current_setting('test.prep_store')) then raise exception 'FAIL suspended preparation authority';end if;
 begin perform public.kg_save_store_settings(current_setting('test.prep_store')::uuid,null,'{}');raise exception 'FAIL suspended edit';exception when insufficient_privilege then null;end;
end$$;
rollback;
