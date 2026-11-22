import test from 'node:test';
import assert from 'node:assert/strict';
import { filterStoreProducts } from '../frontend/storefront-domain.js';
const store={id:'casa',products:[
 {id:'cup',storeId:'casa',title:'Caneca de cerâmica',priceMinor:45050,inStock:true,createdAt:'2026-11-10'},
 {id:'shoe',storeId:'casa',title:'Ténis azul',priceMinor:240000,inStock:true,createdAt:'2026-11-12'},
 {id:'audio',storeId:'casa',title:'Auriculares sem fios',priceMinor:149000,inStock:false,createdAt:'2026-11-11'},
 {id:'rice',storeId:'mercearia',title:'Arroz',priceMinor:8500,inStock:true,createdAt:'2026-11-12'}
]};
test('store search never returns a product owned by another store, including an empty query',()=>{
 assert.deepEqual(filterStoreProducts(store).map(x=>x.id),['shoe','audio','cup']);
 assert.deepEqual(filterStoreProducts(store,{query:'arroz'}),[]);
});
test('store search normalises accents, whitespace and case, and requires all query terms',()=>{
 assert.deepEqual(filterStoreProducts(store,{query:'  CANECA  ceramica '}).map(x=>x.id),['cup']);
 assert.equal(filterStoreProducts(store,{query:'caneca tenis'}).length,0);
});
test('availability and ordering refine the same store without mutating the catalogue',()=>{
 const original=JSON.stringify(store);
 assert.deepEqual(filterStoreProducts(store,{availableOnly:true,sort:'price-up'}).map(x=>x.id),['cup','shoe']);
 assert.deepEqual(filterStoreProducts(store,{sort:'price-down'}).map(x=>x.id),['shoe','audio','cup']);
 assert.equal(JSON.stringify(store),original);
});
test('unknown, markup and empty catalogue states produce no fabricated matches',()=>{
 assert.deepEqual(filterStoreProducts({id:'empty',products:[]}),[]);
 assert.deepEqual(filterStoreProducts(store,{query:'<script>'}),[]);
 assert.deepEqual(filterStoreProducts(store,{query:'produto inexistente'}),[]);
});
test('merchant artwork overrides reference photographs without inheriting a crop made for another photograph',async()=>{const{resolveStoreArtwork}=await import('../frontend/storefront-artwork.js');const artwork=resolveStoreArtwork({id:'82040807-07b8-4d39-a188-6f36259da1e1',isTest:true,bannerUrl:'https://example.com/cover.jpg',logoUrl:'https://example.com/logo.png'});assert.equal(artwork.cover,'https://example.com/cover.jpg');assert.equal(artwork.avatar,'https://example.com/logo.png');assert.equal(artwork.avatarFit,'contain');assert.equal(artwork.coverPosition,'50% 50%');});
test('real stores never receive the photographs of a seeded store',async()=>{const{resolveStoreArtwork}=await import('../frontend/storefront-artwork.js');const artwork=resolveStoreArtwork({id:'82040807-07b8-4d39-a188-6f36259da1e1',isTest:false});assert.equal(artwork.cover,'');assert.equal(artwork.avatar,'');});
test('reference cover and profile use separate aspect-specific assets',async()=>{const{resolveStoreArtwork}=await import('../frontend/storefront-artwork.js');const artwork=resolveStoreArtwork({id:'82040807-07b8-4d39-a188-6f36259da1e1',isTest:true});assert.ok(artwork.cover.endsWith('store-casa-cover.jpg'));assert.ok(artwork.avatar.endsWith('store-casa-profile.jpg'));assert.notEqual(artwork.cover,artwork.avatar);});
