import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requireStoreOpen,checkedStoreHandoff,formatOpeningHours,STORE_CLOSED_COPY,STORE_UNKNOWN_COPY} from '../frontend/store-availability.js';
test('availability uses uncached server RPC, not client clock',async()=>{
 let calls=0;await requireStoreOpen(async(path,options)=>{calls++;assert.equal(path,'/rest/v1/rpc/kg_store_contact_availability');assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),{p_store_id:'shop'});return {available:true};},'shop');assert.equal(calls,1);
});
test('closed, unavailable, malformed and failed responses never hand off',async()=>{
 for(const reply of [{available:false,reason:'closed'},{available:false,reason:'unavailable'},null,{available:'true'},{}]){
 let sent=false;await assert.rejects(checkedStoreHandoff(async()=>reply,'s',()=>sent=true));assert.equal(sent,false);
 }
 await assert.rejects(requireStoreOpen(async()=>{throw Error('network')},'s'),{message:STORE_UNKNOWN_COPY});
 await assert.rejects(requireStoreOpen(async()=>({available:false,reason:'closed'}),'s'),{message:STORE_CLOSED_COPY});
});
test('retry rechecks closure and does not reuse previous approval',async()=>{
 let open=true,sent=0;const request=async()=>({available:open,reason:open?'open':'closed'});
 await checkedStoreHandoff(request,'s',()=>sent++);open=false;
 await assert.rejects(checkedStoreHandoff(request,'s',()=>sent++));assert.equal(sent,1);
});
test('hours show overnight and missing weekdays without inventing hours',()=>{
 assert.equal(formatOpeningHours([]),'');
 const text=formatOpeningHours([{day:0,open:'22:00',close:'02:00',closed:false}]);
 assert.match(text,/Segunda-feira · 22:00–02:00 \(dia seguinte\)/);assert.match(text,/Terça-feira · Fechado/);
});
test('buyer paths guard before opening; cart branch remains before opening gate',()=>{
 const html=readFileSync(new URL('../frontend/index.html',import.meta.url),'utf8');
 assert.ok(html.includes('await requireStoreOpen(catalogueRequest,group.storeId)'));
 assert.ok(html.includes('await requireStoreOpen(catalogueRequest,fresh.storeId)'));
 assert.ok(html.includes('link.href = url;'));
 assert.doesNotMatch(html, /window\.open\(url/);
 assert.ok(html.includes('window.location.assign(url)'));
 assert.ok(html.indexOf("if(mode==='cart'){kambyCart=addCartLine")<html.indexOf('await requireStoreOpen(catalogueRequest,fresh.storeId)'));
});

test('general shop question stays available when closed and cannot embed an order',()=>{
 const html=readFileSync(new URL('../frontend/index.html',import.meta.url),'utf8');
 const start=html.indexOf("function contactStore() {");
 const handler=html.slice(start,html.indexOf("storefrontElements.share.addEventListener",start));
 assert.ok(handler.includes('mais informações sobre os vossos produtos'));
 assert.doesNotMatch(handler,/requireStoreOpen|store\.isOpen|readCart|storeCartGroup|currentPDP|quantity|subtotal|itemLines/);
 assert.ok(html.includes('storefrontElements.whatsapp.disabled = !store.whatsapp;'));
 assert.ok(html.includes("storefrontElements.whatsapp.querySelector('span').textContent = 'Perguntar à loja'"));
});
