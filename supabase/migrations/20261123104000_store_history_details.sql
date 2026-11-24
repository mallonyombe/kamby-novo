create or replace function kg_private.store_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare
 v_action text;
 v_metadata jsonb;
 v_changes jsonb;
 v_actor_name text;
begin
 if auth.uid() is null and current_setting('role',true) in ('anon','authenticated') then raise exception 'Sessão obrigatória' using errcode='42501'; end if;
 -- Managed stores are not applications. Existing historical applications remain intact.
 v_action=case when TG_OP='INSERT' then 'store.created'
   when new.status is distinct from old.status and new.status='approved' then 'store.published'
   when new.status is distinct from old.status and new.status='draft' then 'store.unpublished'
   when new.status is distinct from old.status and new.status='suspended' then 'store.suspended'
   else 'store.updated' end;
 select nullif(btrim(display_name),'') into v_actor_name
 from public.kg_profiles where id=auth.uid();
 v_metadata=jsonb_strip_nulls(jsonb_build_object('status',new.status,'actor_name',v_actor_name));
 if TG_OP='UPDATE' then
   select jsonb_object_agg(field,case when field in ('logo_path','banner_path') then
     jsonb_build_object('before', nullif(to_jsonb(old)->>field,'') is not null,
                        'after', nullif(to_jsonb(new)->>field,'') is not null)
   else jsonb_build_object('before',to_jsonb(old)->field,'after',to_jsonb(new)->field)
   end)
   into v_changes
   from unnest(array['name','description','whatsapp_e164','location','address','service_area','opening_hours','is_open','status','logo_path','banner_path']) as fields(field)
   where (to_jsonb(old)->field) is distinct from (to_jsonb(new)->field);
   if v_changes is not null then
     v_metadata=v_metadata||jsonb_build_object('changes',v_changes);
   end if;
 end if;
 if TG_OP='UPDATE' and new.status is distinct from old.status then
   v_metadata=v_metadata || jsonb_build_object('previous_status',old.status);
   if new.status='suspended' then v_metadata=v_metadata || jsonb_build_object('reason',trim(current_setting('kg.review_reason',true))); end if;
 end if;
 insert into public.kg_audit_events(actor_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),v_action,'store',new.id,v_metadata);
 return new;
end;$$;
revoke all on function kg_private.store_event() from public,anon,authenticated;
