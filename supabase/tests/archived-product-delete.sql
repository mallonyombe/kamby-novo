begin;
update kg_private.seller_terms set active=false where active;
insert into auth.users(id,email) values
 ('96000000-0000-0000-0000-000000000001','owner-delete@example.invalid'),
 ('96000000-0000-0000-0000-000000000002','other-delete@example.invalid');
insert into public.kg_profiles(id,display_name)
 select id,email from auth.users where email like '%-delete@example.invalid';
insert into kg_private.seller_activations(user_id) values('96000000-0000-0000-0000-000000000001');
insert into kg_private.seller_terms values('delete-fixture','Termos de teste','Termos fictícios para teste.',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','96000000-0000-0000-0000-000000000001',true);
select public.kg_accept_seller_terms('delete-fixture');
select set_config('test.delete_store',public.kg_create_seller_store('Loja','+258841234567')::text,true);
do $$declare
 sid uuid=current_setting('test.delete_store')::uuid;
 pid uuid=gen_random_uuid();
 doc jsonb;
 stamp timestamptz;
begin
 select jsonb_build_object('category_id',category_id,'title','Artigo de ensaio','status','draft','price_minor',500,'images',jsonb_build_array(),'variants',jsonb_build_array()) into strict doc
 from public.kg_store_categories where store_id=sid limit 1;
 stamp=(public.kg_save_catalogue_product(gen_random_uuid(),sid,pid,null,doc)->>'updated_at')::timestamptz;
 begin perform public.kg_delete_archived_product(sid,pid,stamp);raise exception 'deleted draft';exception when insufficient_privilege then null;end;
 stamp=(public.kg_save_catalogue_product(gen_random_uuid(),sid,pid,stamp,doc||'{"status":"archived"}')->>'updated_at')::timestamptz;
 begin perform public.kg_delete_archived_product(sid,pid,stamp-interval '1 second');raise exception 'ignored newer edit';exception when serialization_failure then null;end;
 perform set_config('request.jwt.claim.sub','96000000-0000-0000-0000-000000000002',true);
 begin perform public.kg_delete_archived_product(sid,pid,stamp);raise exception 'foreign deletion';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','96000000-0000-0000-0000-000000000001',true);
 perform public.kg_delete_archived_product(sid,pid,stamp);
 perform public.kg_delete_archived_product(sid,pid,stamp);
 if exists(select 1 from public.kg_products where id=pid) then raise exception 'still in catalogue';end if;
 if (select count(*) from public.kg_catalogue_activity where product_id=pid and kind='deleted')<>1 then raise exception 'wrong activity count';end if;
end$$;
rollback;
