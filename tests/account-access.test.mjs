import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadAccountAccess} from '../frontend/account-access.js';
const context={user_id:'u',roles:['customer'],merchant_store_ids:[],admin_access:false,admin_mfa_required:false};
const stores=[{id:'own',status:'approved'},{id:'other',status:'approved'},{id:'draft',status:'draft'}];
function client(responses){const calls=[];return{calls,rpc:async name=>{calls.push(name);if(!(name in responses))throw Error('Unexpected '+name);return responses[name];}};}
function current(changes={}){return client({kg_account_context:{data:{...context,...changes}},kg_my_managed_stores:{data:stores}});}
test('customer receives no merchant/admin privileges from available store rows',async()=>{
 const result=await loadAccountAccess(current(),'u');assert.deepEqual(result.stores,[]);assert.equal(result.access.adminEntry,false);
});
test('merchant sees only explicitly assigned preparation or approved shops',async()=>{
 const result=await loadAccountAccess(current({roles:['customer','merchant'],merchant_store_ids:['own','draft']}),'u');assert.deepEqual(result.stores.map(x=>x.id),['own','draft']);assert.equal(result.access.merchant,true);assert.equal(result.access.adminEntry,false);
});
for(const mfa of [false,true])test(`administrator entry retains MFA requirement ${mfa}`,async()=>{
 const result=await loadAccountAccess(current({roles:['customer','administrator'],admin_access:!mfa,admin_mfa_required:mfa}),'u');assert.equal(result.access.adminEntry,true);assert.equal(result.access.adminMfaRequired,mfa);assert.deepEqual(result.stores,[]);
});
test('missing migration safely uses protected RPCs for an assigned merchant',async()=>{
 const api=client({kg_account_context:{error:{code:'PGRST202'}},kg_admin_context:{error:{code:'42501'}},kg_my_managed_stores:{data:[stores[0]]}});
 const result=await loadAccountAccess(api,'u');assert.equal(result.access.source,'protected-legacy-rpcs');assert.equal(result.access.merchant,true);assert.equal(result.access.adminEntry,false);
});
for(const mfa of [false,true])test(`legacy administrator fallback is not promoted to merchant, MFA ${mfa}`,async()=>{
 const api=client({kg_account_context:{error:{code:'42883'}},kg_admin_context:{data:{mfa_required:mfa,permissions:mfa?[]:['stores.read']}},kg_my_managed_stores:{data:stores}});
 const result=await loadAccountAccess(api,'u');assert.equal(result.access.adminEntry,true);assert.equal(result.access.adminMfaRequired,mfa);assert.deepEqual(result.stores,[]);
});
for(const code of ['42501','PGRST301','NETWORK'])test(`failure ${code} never falls back or retains authority`,async()=>{
 const api=client({kg_account_context:{error:{code}}});await assert.rejects(loadAccountAccess(api,'u'));assert.deepEqual(api.calls,['kg_account_context']);
});
test('cross-account or malformed context fails closed',async()=>{
 for(const change of [{user_id:'other'},{admin_access:true,admin_mfa_required:true},{roles:null}])await assert.rejects(loadAccountAccess(current(change),'u'));
});
test('unknown legacy admin errors do not downgrade into merchant permissions',async()=>{
 const api=client({kg_account_context:{error:{code:'PGRST202'}},kg_admin_context:{error:{code:'NETWORK'}}});await assert.rejects(loadAccountAccess(api,'u'));assert.equal(api.calls.length,2);
});
test('both deployed merchant variants consume verified access and clear it on logout',()=>{
 for(const file of ['merchant-advanced.js','merchant-legacy.js']){const source=readFileSync(new URL('../frontend/'+file,import.meta.url),'utf8');assert.match(source,/loadAccountAccess\(platform,user.id\)/);assert.match(source,/state.access=accountResult.access/);assert.match(source,/state.user=null;state.access=null/);}
});
test('administration has no second password login and retains protected MFA check',()=>{
 const source=readFileSync(new URL('../frontend/admin.js',import.meta.url),'utf8');assert.doesNotMatch(source,/signInWithPassword/);assert.match(source,/index.html#definicoes\/entrar/);assert.match(source,/rpc\('kg_admin_context'\)/);assert.match(source,/if\(context.mfa_required\)/);
});
