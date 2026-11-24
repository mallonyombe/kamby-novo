import test from 'node:test';
import assert from 'node:assert/strict';
import {readSavedEntries,saveOnDevice,removeFromDevice,claimGuestEntries,sendClaimedEntries} from '../frontend/guardados-locais.js';
import {isTestContact,whatsappURL} from '../frontend/whatsapp.js';

function browserStorage() {
 const data = new Map();
 return {
  get length() { return data.size; },
  key(index) { return [...data.keys()][index]; },
  getItem: key => data.get(key) ?? null,
  setItem: (key, value) => data.set(key, value),
  removeItem: key => data.delete(key)
 };
}
const rice = {id:'rice',title:'Arroz de grão longo',priceMinor:82000};
const cup = {id:'cup',title:'Caneca',priceMinor:20000};
test('guest hearts persist individually and can be removed without touching other products', () => {
 const storage = browserStorage();
 saveOnDevice(storage,rice);saveOnDevice(storage,cup);saveOnDevice(storage,rice);
 assert.equal(readSavedEntries(storage).length,2);
 removeFromDevice(storage,'',cup.id);
 assert.deepEqual(readSavedEntries(storage).map(x=>x.product),[rice]);
});
test('sign-in merges duplicates, preserves failed writes for the same account and isolates subsequent guests',async()=>{
 const storage=browserStorage();
 saveOnDevice(storage,rice);saveOnDevice(storage,cup);
 claimGuestEntries(storage,'A');
 const inserted = await sendClaimedEntries(storage,'A',()=>true,async id=>({error:{code:id==='rice'?'23505':'503'}}));
 assert.deepEqual(inserted,['rice']);assert.deepEqual(readSavedEntries(storage),[]);
 saveOnDevice(storage,{id:'tea'});claimGuestEntries(storage,'B');
 assert.deepEqual(readSavedEntries(storage,'B').map(x=>x.product.id),['tea']);
 assert.deepEqual(readSavedEntries(storage,'A').map(x=>x.product.id),['cup']);
 await sendClaimedEntries(storage,'A',()=>false,()=>assert.fail('account changed'));
 assert.equal(readSavedEntries(storage,'A').length,1);
 await sendClaimedEntries(storage,'A',()=>true,async()=>({error:null}));
 assert.equal(readSavedEntries(storage,'A').length,0);
 assert.equal(readSavedEntries(storage,'B').length,1);
});
test('handoff targets wa.me and encodes real message content once; demo contacts stay local',()=>{
 const message='Arroz 5 kg & café\nTotal: 820 MT';
 const url=new URL(whatsappURL('+258 84 123 4567',message));
 assert.equal(url.origin,'https://wa.me');assert.equal(url.pathname,'/258841234567');assert.equal(url.searchParams.get('text'),message);
 assert.throws(()=>whatsappURL('','Oi'));assert.equal(isTestContact(false,'+1 202 555 0101'),true);
 assert.equal(isTestContact(true,'258841234567'),true);assert.equal(isTestContact(false,'258841234567'),false);
});
