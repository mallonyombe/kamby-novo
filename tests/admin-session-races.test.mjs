import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canShowAdminEntry} from '../frontend/account-access.js';
const source=readFileSync(new URL('../frontend/admin.js',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('async function mfa(version)'),source.indexOf("\nwindow.addEventListener('hashchange'"));
function deferred(){let resolve;return{promise:new Promise(r=>resolve=r),resolve};}
function harness(api){
 const elements=[],events=[];const wrap={children:[],append(...items){this.children.push(...items);}};
 function el(tag){const n={tag,children:[],value:'123456',append(...items){this.children.push(...items);},setAttribute(){},replaceWith(){events.push('replace');}};elements.push(n);return n;}
 const platform={auth:{mfa:api,signOut:async()=>{}}};
 const make=Function('platform','authWrap','el','button','field','feedback','setButtonBusy','start',`let sessionVersion=1;${fn};return {mfa,logout(){sessionVersion++;}};`);
 const controller=make(platform,()=>wrap,el,(copy,cls,fn)=>Object.assign(el('button'),{copy,onclick:fn}),form=>{const input=el('input');form.append(input);return input;},()=>events.push('feedback'),()=>{},async()=>events.push('start'));
 return{...controller,elements,events,wrap};
}
test('only verified matching administrative account sees administration entry',()=>{
 const admin={user:{id:'admin'},phase:'ready',access:{userId:'admin',adminEntry:true}};
 assert.equal(canShowAdminEntry(admin),true);
 for(const account of [{},{phase:'guest',access:admin.access},{user:{id:'client'},phase:'ready',access:{userId:'client',adminEntry:false}},{...admin,user:{id:'other'}},{...admin,phase:'loading'},{...admin,access:{userId:'admin',adminEntry:'true'}}])assert.equal(canShowAdminEntry(account),false);
 assert.equal(canShowAdminEntry(admin,false),false);
});
test('logout while factors load prevents stale MFA controls from mounting',async()=>{
 const wait=deferred(),h=harness({listFactors:()=>wait.promise});const loading=h.mfa(1);h.logout();wait.resolve({data:{totp:[{id:'x',status:'verified'}]}});await loading;assert.equal(h.wrap.children.length,0);
});
test('logout while enrolment resolves prevents displaying the previous account QR',async()=>{
 const wait=deferred(),h=harness({listFactors:async()=>({data:{totp:[]}}),enroll:()=>wait.promise});await h.mfa(1);const pending=h.elements.find(e=>e.copy==='Configurar autenticador').onclick();h.logout();wait.resolve({data:{id:'factor',totp:{qr_code:'data:fake'}}});await pending;assert.deepEqual(h.events,[]);assert.equal(h.elements.filter(e=>e.tag==='form').length,0);
});
test('logout while code verification resolves cannot restart old administrative screen',async()=>{
 const wait=deferred(),h=harness({listFactors:async()=>({data:{totp:[{id:'x',status:'verified'}]}}),challengeAndVerify:()=>wait.promise});await h.mfa(1);const pending=h.elements.find(e=>e.tag==='form').onsubmit({preventDefault(){}});h.logout();wait.resolve({error:null});await pending;assert.deepEqual(h.events,[]);assert.equal(h.elements.find(e=>e.tag==='input').value,'');
});
test('current verification can continue; transport rejection restores retry',async()=>{
 for(const fail of [false,true]){const h=harness({listFactors:async()=>({data:{totp:[{id:'x',status:'verified'}]}}),challengeAndVerify:async()=>{if(fail)throw Error('offline');return{error:null};}});await h.mfa(1);await h.elements.find(e=>e.tag==='form').onsubmit({preventDefault(){}});assert.deepEqual(h.events,fail?[]:['start']);assert.equal(h.elements.find(e=>e.copy==='Confirmar acesso').disabled,false);}
});
test('stale top-level administration errors are ignored',()=>{assert.match(source,/catch\(e\)\{if\(version!==sessionVersion\)return;root.replaceChildren/);});
