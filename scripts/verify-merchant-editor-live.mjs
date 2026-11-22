// Explicit integration test for an assigned test store. Credentials arrive only on hidden stdin.
// It uploads actual binary images, creates a temporary product and archives it on completion.
import {createClient} from '@supabase/supabase-js';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
if(process.stdin.isTTY)process.stdin.setRawMode(true);
process.stdout.write('Ready for test configuration on hidden stdin.\n');
let input='';const config=await new Promise((resolve,reject)=>{process.stdin.on('data',chunk=>{input+=chunk.toString();const end=input.indexOf('\n');if(end>=0){try{resolve(JSON.parse(input.slice(0,end)));}catch(e){reject(e);}process.stdin.pause();if(process.stdin.isTTY)process.stdin.setRawMode(false);}});});
const url='https://wbjhhkjriqeloiinvbii.supabase.co',key='sb_publishable_9n2oXQLqDuaQNLEHl_Vw6A_7exV-LPl';
const client=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(30000)})}});
const seller=client(),other=client(),guest=client();let doc=null,revision=null,created=false;const productId=randomUUID(),variantId=randomUUID(),paths=[];
async function unwrap(promise){const result=await promise;if(result.error)throw result.error;return result.data;}
function assert(value,message){if(!value)throw Error(message);}
async function save(document,expected=revision,request=randomUUID(),actor=seller){return unwrap(actor.rpc('kg_save_catalogue_product',{p_request_id:request,p_store_id:config.storeId,p_product_id:productId,p_expected_updated_at:expected,p_document:document}).retry(false));}
try{
 await unwrap(seller.auth.signInWithPassword(config.seller));await unwrap(other.auth.signInWithPassword(config.other));
 const {user}=await unwrap(seller.auth.getUser());
 const stores=await unwrap(seller.rpc('kg_my_managed_stores'));assert(stores.some(s=>s.id===config.storeId),'Assigned store missing');
 doc={title:'Ensaio do editor · Teste',category_id:config.categoryId,description:'Artigo criado pela verificação do editor e arquivado ao concluir.',condition:'new',attributes:'Dados de teste',status:'draft',price_minor:0,previous_price_minor:null,stock_quantity:null,in_stock:true,images:[],variants:[]};
 const draft=await save(doc,null);created=true;revision=draft.updated_at;assert(draft.status==='draft','Draft not saved');console.log('PASS: real authenticated draft');
 const oldRevision=revision;
 for(const filename of config.images){const path=user.id+'/'+config.storeId+'/'+productId+'/'+randomUUID()+'.png';await unwrap(seller.storage.from('kg-product-images').upload(path,await readFile(filename),{contentType:'image/png',upsert:false}));paths.push(path);}
 doc={...doc,status:'published',images:paths.slice().reverse(),variants:[{id:variantId,option_name:'350 ml',price_minor:45050,previous_price_minor:60000,track_quantity:true,stock_quantity:5,in_stock:true,image_path:paths[0]}]};
 const request=randomUUID(),published=await save(doc,revision,request),retry=await save(doc,revision,request);assert(JSON.stringify(retry)===JSON.stringify(published),'Retry changed response');revision=published.updated_at;
 const product=await unwrap(seller.from('kg_products').select('*,variants:kg_product_variants(*),images:kg_product_images(*)').eq('id',productId).single());assert(product.variants.length===1&&product.variants[0].id===variantId&&Number(product.variants[0].price_minor)===45050,'Variant or exact price mismatch');assert(product.images.find(i=>i.sort_order===0).storage_path===paths[1],'Cover ordering mismatch');
 await unwrap(guest.storage.from('kg-product-images').createSignedUrl(paths[0],60));console.log('PASS: binary gallery, cover, variant image, promotion, exact cents and strict retry');
 const stale=await seller.rpc('kg_save_catalogue_product',{p_request_id:randomUUID(),p_store_id:config.storeId,p_product_id:productId,p_expected_updated_at:oldRevision,p_document:doc});assert(stale.error?.code==='40001','Stale write accepted');
 const foreign=await other.rpc('kg_save_catalogue_product',{p_request_id:randomUUID(),p_store_id:config.storeId,p_product_id:productId,p_expected_updated_at:revision,p_document:doc});assert(foreign.error?.code==='42501','Foreign merchant write accepted');
 doc={...doc,title:'Ensaio do editor actualizado · Teste',variants:[{...doc.variants[0],price_minor:47575}]};revision=(await save(doc)).updated_at;
 const stable=await unwrap(seller.from('kg_product_variants').select('id,price_minor').eq('product_id',productId).eq('active',true));assert(stable.length===1&&stable[0].id===variantId&&Number(stable[0].price_minor)===47575,'Variant identity changed');console.log('PASS: stable variant identity, concurrent update rejection and store isolation');
 const activity=await unwrap(seller.rpc('kg_merchant_activity',{p_store_id:config.storeId}));assert(activity.days.length===7&&activity.recent.some(e=>e.product_id===productId),'Activity not instrumented');
 const store=await unwrap(seller.from('kg_stores').select('*').eq('id',config.storeId).single());const settings=Object.fromEntries(['name','description','whatsapp_e164','location','address','service_area','logo_path','banner_path','opening_hours'].map(key=>[key,store[key]]));
 const changed=await unwrap(seller.rpc('kg_save_store_settings',{p_store_id:config.storeId,p_expected_updated_at:store.updated_at,p_document:{...settings,description:settings.description+' · ensaio do editor'}}));await unwrap(seller.rpc('kg_save_store_settings',{p_store_id:config.storeId,p_expected_updated_at:changed.updated_at,p_document:settings}));console.log('PASS: store settings saved and restored; recorded activity');
}catch(e){process.exitCode=1;console.error('FAIL:',e.code||'',e.message||'Integration test failed');}
finally{
 if(created&&doc&&revision){try{await save({...doc,status:'archived'});console.log('PASS: temporary product archived');}catch(e){process.exitCode=1;console.error('Archive requires review:',productId,e.code||'');}}
 await Promise.all([seller.auth.signOut({scope:'local'}),other.auth.signOut({scope:'local'})]);
}
