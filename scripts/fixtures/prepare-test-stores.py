"""Emit idempotent DML for the explicitly authorised test batch. Input: creator and account IDs."""
import sys,json
from pathlib import Path
context=json.loads(sys.stdin.read());stores=json.loads(Path(__file__).with_name('test-stores.json').read_text())
for store in stores:store['seller_id']=next(x['id']for x in context['accounts']if x['email']==store['email'])
profiles=[{'id':x['id'],'name':('Cliente · Teste'if x['email'].startswith('cliente')else'Lojista · Teste')}for x in context['accounts']]
payload=json.dumps({'stores':stores,'profiles':profiles},ensure_ascii=False)
print("begin;\nselect set_config('seed.payload', $seed$"+payload+"$seed$,true);")
print("insert into public.kg_profiles(id,display_name,location) select (p->>'id')::uuid,p->>'name','Chongoene' from jsonb_array_elements(current_setting('seed.payload')::jsonb->'profiles')p on conflict(id)do nothing;")
print("set local role authenticated;\nselect set_config('request.jwt.claim.sub','"+context['creator']+"',true);")
print('''do $$declare s jsonb;p jsonb;v jsonb;st public.kg_stores%rowtype;pid uuid;cat uuid;summary jsonb='[]';products jsonb;variant_index int;begin
 for s in select value from jsonb_array_elements(current_setting('seed.payload')::jsonb->'stores')loop
  select * into st from public.kg_stores where name=s->>'name' and is_test;
  if not found then
   st=public.kg_create_store(s->>'name',s->>'description',s->>'phone',s->>'location','approved');
   update public.kg_stores set is_test=true where id=st.id;
  end if;
  perform public.kg_assign_merchant(st.id,(s->>'seller_id')::uuid,true);
  products='[]';
  for p in select value from jsonb_array_elements(s->'products')loop
   select id into cat from public.kg_categories where slug=p->>'category' and is_active;
   if cat is null then raise exception 'Missing category';end if;
   select id into pid from public.kg_products where store_id=st.id and title=p->>'title';
   if not found then
    insert into public.kg_products(store_id,category_id,title,description,price_minor,currency,stock_status,status,unit_reference)
    values(st.id,cat,p->>'title',p->>'description',(p->>'price')::bigint,'MZN',case when(p->>'stock')::boolean then'available'else'out'end,'published',p->>'unit')returning id into pid;
    variant_index=0;
    for v in select value from jsonb_array_elements(p->'variants')loop
     variant_index=variant_index+1;
     insert into public.kg_product_variants(product_id,sku,option_name,price_minor,in_stock)values(pid,'KAMBY-QA-20261112-'||(p->>'code')||'-'||variant_index,v->>0,(v->>1)::bigint,(v->>2)::boolean);
    end loop;
   end if;
   products=products||jsonb_build_array(jsonb_build_object('id',pid,'code',p->>'code','title',p->>'title'));
  end loop;
  summary=summary||jsonb_build_array(jsonb_build_object('id',st.id,'owner_id',st.owner_id,'name',st.name,'products',products));
 end loop;
 perform set_config('seed.result',summary::text,true);
end$$;
select current_setting('seed.result')::jsonb as stores;
commit;''')
