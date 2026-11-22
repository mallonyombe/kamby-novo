// Feed server-selected existing auth IDs as JSON on stdin. No users are created.
// sellerA/sellerB are legacy harness field names; current fixtures are ordinary clients.
import { readFileSync } from 'node:fs';
let raw=''; for await(const chunk of process.stdin) raw+=chunk;
const ids=JSON.parse(raw); const keys=['sellerA','sellerB','buyer','admin'];
if(new Set(keys.map(k=>ids[k])).size!==4 || keys.some(k=>!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ids[k]??''))) throw new Error('Four distinct UUIDs required');
let sql=readFileSync(new URL('./rls.sql',import.meta.url),'utf8');
function replaceOnce(before,after){
 if(sql.split(before).length!==2)throw new Error('Hosted test adaptation no longer matches the reviewed SQL fixture');
 sql=sql.replace(before,()=>after);
}
sql=sql.replace(/insert into auth\.users\(id,email\) values[\s\S]*?;/,'-- Existing auth identities selected server-side; no auth.users mutations.');
// Native Supabase blocks SQL DELETE on storage.objects before RLS is evaluated.
// Keep that provider protection intact. Test denied UPDATE here; Storage API DELETE
// is a separate HTTP E2E case and is explicitly NOT_RUN in the final result.
replaceOnce(
 " delete from storage.objects where bucket_id='kg-product-images';get diagnostics changed=row_count;\n if changed<>0 then raise exception 'FAIL: demoted creator deletes images'; end if;",
 " -- NOT_RUN: Storage SQL DELETE requires Storage API; do not bypass storage.protect_delete.\n update storage.objects set name=name where bucket_id='kg-product-images';get diagnostics changed=row_count;\n if changed<>0 then raise exception 'FAIL: demoted creator updates image metadata'; end if;"
);
// Check permitted metadata UPDATE as the second admin after its INSERT succeeds.
replaceOnce(
 "insert into storage.objects(bucket_id,name) select 'kg-product-images',owner_id::text || '/' || id::text || '/cross-admin.jpg' from public.kg_stores where name='Loja A';",
 "insert into storage.objects(bucket_id,name) select 'kg-product-images',owner_id::text || '/' || id::text || '/cross-admin.jpg' from public.kg_stores where name='Loja A';\ndo $$declare changed integer;begin\n update storage.objects set name=name where bucket_id='kg-product-images' and name like '%/cross-admin.jpg';get diagnostics changed=row_count;\n if changed<>1 then raise exception 'FAIL: second admin cannot update image metadata'; end if;\nend$$;"
);
keys.forEach((key,i)=>{sql=sql.replaceAll(`00000000-0000-0000-0000-00000000000${i+1}`,ids[key]);});
sql=sql.replace("insert into kg_private.admins(user_id) values('"+ids.admin+"');", "insert into kg_private.admins(user_id) values('"+ids.admin+"') on conflict(user_id) do nothing;");
sql+=`
select 'passed_with_explicit_not_run' as kamby_greenfield_rls_suite, 'all fixtures rolled back; auth users untouched' as verification, 'passed' as "casesCatalogueAndAccountRLS", 'passed' as "casesProductVariantsMediaAndSnapshots", 'passed_metadata_only' as "casesStorageSQLselectInsertUpdate", 'not_run_provider_requires_api' as "casesStorageSQLdelete", 'not_run' as "casesStorageHTTPdeleteE2E";
`;
process.stdout.write(sql);
