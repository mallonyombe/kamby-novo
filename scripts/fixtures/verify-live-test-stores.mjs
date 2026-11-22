// Run only for the explicitly created is_test stores. Credentials are read from hidden stdin, never files/arguments.
import {createClient} from '@supabase/supabase-js';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
if(process.stdin.isTTY)process.stdin.setRawMode(true);
process.stdout.write('Ready for private test JSON\n');
const config=await new Promise(resolve=>{let text='';process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>{text+=chunk;if(text.includes('\n')){process.stdin.pause();resolve(JSON.parse(text.slice(0,text.indexOf('\n'))));}});});
if(process.stdin.isTTY)process.stdin.setRawMode(false);
const clients=[];
function check(result,label){if(result.error)throw new Error(label+': '+result.error.code+' '+result.error.message);return result.data;}
try{
 for(const account of config.accounts){const client=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});const data=check(await client.auth.signInWithPassword({email:account.email,password:account.password}),'sign in');clients.push({client,user:data.user,email:account.email});}
 const [shopA,shopB]=config.stores;
 for(let i=0;i<2;i++){const managed=check(await clients[i].client.rpc('kg_my_managed_stores'),'managed stores');assert.equal(managed.length,1);assert.equal(managed[0].id,config.stores[i].id);}
 const buyer=clients[2],caneca=shopA.products.find(p=>p.code==='caneca'),arroz=shopB.products.find(p=>p.code==='arroz');
 const pub=check(await buyer.client.from('kg_stores').select('id,is_test,status').in('id',[shopA.id,shopB.id]),'test stores');assert.equal(pub.length,2);assert(pub.every(s=>s.is_test&&s.status==='approved'));
 const save=await buyer.client.from('kg_saved_products').insert({user_id:buyer.user.id,product_id:caneca.id});if(save.error?.code!=='23505')check(save,'save product');
 const own=check(await clients[0].client.from('kg_products').select('id,price_minor,stock_status,updated_at,variants:kg_product_variants(id,price_minor,in_stock,updated_at)').eq('id',caneca.id).single(),'own item');const variant=own.variants[0];
 const first=check(await clients[0].client.rpc('kg_merchant_update_item',{p_product_id:own.id,p_variant_id:variant.id,p_price_minor:variant.price_minor+1,p_in_stock:false,p_expected_updated_at:variant.updated_at}),'edit variant');
 check(await clients[0].client.rpc('kg_merchant_update_item',{p_product_id:own.id,p_variant_id:variant.id,p_price_minor:variant.price_minor,p_in_stock:variant.in_stock,p_expected_updated_at:first.updated_at}),'restore variant');
 const foreign=await clients[0].client.rpc('kg_merchant_update_item',{p_product_id:arroz.id,p_variant_id:null,p_price_minor:1,p_in_stock:true,p_expected_updated_at:new Date().toISOString()});assert.equal(foreign.error?.code,'42501');
 const store=check(await clients[0].client.from('kg_stores').select('updated_at,is_open').eq('id',shopA.id).single(),'store version');const closed=check(await clients[0].client.from('kg_stores').update({is_open:false}).eq('id',shopA.id).eq('updated_at',store.updated_at).select('updated_at').single(),'close store');check(await clients[0].client.from('kg_stores').update({is_open:true}).eq('id',shopA.id).eq('updated_at',closed.updated_at).select('id').single(),'reopen store');
 const images=check(await buyer.client.from('kg_product_images').select('product_id,storage_path').in('product_id',config.stores.flatMap(s=>s.products.map(p=>p.id))),'gallery');assert.equal(images.length,16);
 const signed=check(await buyer.client.storage.from('kg-product-images').createSignedUrl(images[0].storage_path,60),'sign public product image');assert(signed.signedUrl);const imageResponse=await fetch(signed.signedUrl);assert(imageResponse.ok);assert.equal(imageResponse.headers.get('content-type'),'image/png');
 const createdId=crypto.randomUUID();const context=check(await clients[0].client.rpc('kg_product_upload_context',{p_store_id:shopA.id,p_product_id:createdId,p_extension:'png'}),'upload path');
 const file=await readFile(config.imageFile);check(await clients[0].client.storage.from('kg-product-images').upload(context.path,file,{contentType:'image/png',upsert:false}),'real binary upload');
 const payload={p_product_id:createdId,p_store_id:shopA.id,p_category_id:config.categoryId,p_title:'Caneca criada no teste de publicação',p_price_minor:67500,p_option_name:'500 ml',p_description:'Artigo fictício criado pelo teste real de upload e publicação do lojista. Imagem ilustrativa.',p_image_path:context.path};
 const created=check(await clients[0].client.rpc('kg_merchant_create_product',payload),'publish');assert.equal(created.id,createdId);const retry=check(await clients[0].client.rpc('kg_merchant_create_product',payload),'idempotent retry');assert.equal(retry.id,createdId);
 const read=check(await buyer.client.from('kg_products').select('id,price_minor,variants:kg_product_variants(id,option_name,price_minor),images:kg_product_images(storage_path)').eq('id',createdId).single(),'published PDP');assert.equal(read.price_minor,67500);assert.equal(read.variants.length,1);assert.equal(read.images.length,1);
 for(const [store,p]of[[shopA,caneca],[shopB,arroz]]){const variants=check(await buyer.client.from('kg_product_variants').select('id,price_minor').eq('product_id',p.id).order('price_minor').limit(1),'contact option');const requestId=crypto.randomUUID();const prepared=check(await buyer.client.rpc('kg_prepare_contact',{p_store_id:store.id,p_request_id:requestId,p_items:[{product_id:p.id,variant_id:variants[0].id,quantity:2}]}),'server contact snapshot');assert.equal(prepared.snapshot.subtotal_minor,variants[0].price_minor*2);check(await buyer.client.rpc('kg_record_contact_activity',{p_store_id:store.id,p_product_id:p.id,p_request_id:crypto.randomUUID()}),'private contact activity');}
 const notes=check(await buyer.client.from('kg_notifications').select('id').eq('user_id',buyer.user.id),'private notices');assert(notes.length>=2);
 const results={result:'PASS',accounts:clients.length,isolatedStores:2,seedGalleryImages:images.length,signedImageDownload:true,realUploadAndPublication:true,idempotentCreation:true,publishedTestProduct:createdId,priceStockAndStoreOpening:true,foreignStoreDenied:true,serverCalculatedContacts:2,notifications:notes.length};
 console.log(JSON.stringify(results));
}catch(error){console.error('FAIL: '+error.message);process.exitCode=1;}finally{for(const {client}of clients)await client.auth.signOut({scope:'local'});}
