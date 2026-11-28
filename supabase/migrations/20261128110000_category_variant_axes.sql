alter table public.kg_categories
  add column variant_axis text check (variant_axis in ('volume','weight','size','length'));

grant insert (variant_axis), update (variant_axis) on public.kg_categories to authenticated;

-- Products restrict category deletion. Only eligibility links can disappear with an unused category.
alter table public.kg_store_categories
  drop constraint kg_store_categories_category_id_fkey,
  add constraint kg_store_categories_category_id_fkey
    foreign key (category_id) references public.kg_categories(id) on delete cascade;

-- The existing store trigger supplies active categories to new stores.
-- Supply new active categories to existing stores in the same transaction.
create function kg_private.assign_new_category() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.kg_store_categories (store_id,category_id)
  select id,new.id from public.kg_stores
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function kg_private.assign_new_category() from public,anon,authenticated;

create trigger kg_new_category
  after insert on public.kg_categories for each row
  when (new.is_active) execute function kg_private.assign_new_category();

-- Recognise water where the catalogue already has a dedicated category.
update public.kg_categories set variant_axis='volume' where slug in ('agua','aguas');
