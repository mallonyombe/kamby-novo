import test from 'node:test';
import assert from 'node:assert/strict';
import {canPrepareStore,storeHoursDocument} from '../frontend/merchant-domain.js';
import {readFileSync} from 'node:fs';
test('preparation only for draft, pending and approved stores',()=>{
 for(const status of ['draft','pending','approved'])assert.equal(canPrepareStore({status}),true);
 for(const status of ['suspended','rejected','closed','unknown',null])assert.equal(canPrepareStore({status}),false);
 assert.equal(canPrepareStore(null),false);
});
test('preparation does not expose public preview or unlock opening controls',()=>{
 const workspace=readFileSync(new URL('../frontend/merchant-workspace.js',import.meta.url),'utf8');
 const account=readFileSync(new URL('../frontend/merchant-advanced.js',import.meta.url),'utf8');
 assert.ok(workspace.includes("$('merchantPublicPreview').hidden=s.status!=='approved'"));
 assert.ok(account.includes("button.disabled=state.busy||store.status!=='approved'"));
 assert.ok(account.includes("hooks.cartCount()"));
});

test('editing identity preserves manual hours and existing weekly schedule',()=>{
 const weekly=[{day:0,closed:false,open:'22:00',close:'02:00'}];
 assert.deepEqual(storeHoursDocument([],false,weekly),[]);
 assert.deepEqual(storeHoursDocument(undefined,false,weekly),[]);
 assert.deepEqual(storeHoursDocument(weekly,false,[]),weekly);
 assert.deepEqual(storeHoursDocument([],true,weekly),weekly);
});
