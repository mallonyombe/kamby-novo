// Local verification of generated hosted SQL, not a hosted execution or HTTP test.
import { PGlite } from '@electric-sql/pglite';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const ids={sellerA:'00000000-0000-0000-0000-000000000001',sellerB:'00000000-0000-0000-0000-000000000002',buyer:'00000000-0000-0000-0000-000000000003',admin:'00000000-0000-0000-0000-000000000004'};
const generated=execFileSync(process.execPath,[new URL('./make-hosted-test.mjs',import.meta.url).pathname],{input:JSON.stringify(ids),encoding:'utf8'});
if(/delete\s+from\s+storage\.objects|insert\s+into\s+auth\.users/i.test(generated))throw new Error('Hosted generator includes a disallowed provider or Auth mutation');
const db=new PGlite();
try{
 await db.exec(read('./mock-platform.sql'));
 for(const f of readdirSync(new URL('../migrations/',import.meta.url)).filter(x=>x.endsWith('.sql')&&x<'20261123150717_seller_onboarding.sql').sort())await db.exec(read('../migrations/'+f));
 for(const [key,id] of Object.entries(ids))await db.query('insert into auth.users(id,email) values($1,$2)',[id,`${key}@example.invalid`]);
 await db.query('insert into kg_private.admins(user_id) values($1)',[ids.admin]);
 // Disposable mock emulates the native statement-level refusal, without editing
 // storage.protect_delete or any real provider protection/configuration.
 await db.exec("create function storage.mock_reject_sql_delete() returns trigger language plpgsql as $$begin raise exception 'Storage API required' using errcode='42501';end$$; create trigger mock_reject_sql_delete before delete on storage.objects for each statement execute function storage.mock_reject_sql_delete();");
 const result=await db.exec(generated);const report=result.at(-1)?.rows[0];
 if(report?.kamby_greenfield_rls_suite!=='passed_with_explicit_not_run'||report.casesProductVariantsMediaAndSnapshots!=='passed'||report.casesStorageSQLdelete!=='not_run_provider_requires_api'||report.casesStorageHTTPdeleteE2E!=='not_run'||report.casesStorageSQLselectInsertUpdate!=='passed_metadata_only')throw new Error('Hosted report loses variant evidence or explicit unexecuted cases');
 const state=await db.query('select (select count(*) from public.kg_stores)::int as stores,(select count(*) from kg_private.admins)::int as admins');
 if(state.rows[0].stores!==0||state.rows[0].admins!==1)throw new Error('Generated fixture rollback failed');
 console.log('PASS: hosted SQL generator executes with provider DELETE refusal; metadata cases pass, API DELETE remains explicitly NOT_RUN; fixtures roll back');
}catch(error){console.error('FAIL:',JSON.stringify({message:error.message,code:error.code,where:error.where}));process.exitCode=1;}
finally{await db.close();}
