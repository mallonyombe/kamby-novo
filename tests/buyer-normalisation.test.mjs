import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { variantLimit, sortVariantsForDisplay } from '../frontend/commerce-domain.js';

// Execute the actual UI normalisers, isolating network/image signing only.
const html = readFileSync(new URL('../frontend/index.html', import.meta.url), 'utf8');
function normalisers(signProductImage = async path => path ? `https://images.test/${path}` : '') {
  const dependencies = {
    firstRelation: value => Array.isArray(value) ? value[0] : value,
    displayStoreName: store => store.name,
    safeHttpUrl: value => value || '',
    cleanProductDescription: row => row.description || '',
    signProductImage, variantLimit, sortVariantsForDisplay
  };
  return Object.fromEntries([
    ['normaliseProduct', 'async function fetchPublishedProducts'],
    ['normaliseStoreProduct', 'async function normaliseStore('],
    ['normalisePDPProduct', 'function showPDPView']
  ].map(([name, next]) => {
    const start = html.indexOf(`async function ${name}(`);
    const end = html.indexOf(next, start);
    assert.ok(start >= 0 && end > start, `Locate ${name}`);
    const fn = Function(...Object.keys(dependencies), `${html.slice(start, end)};return ${name};`)(...Object.values(dependencies));
    return [name, fn];
  }));
}
const base = { id:'product', title:'Produto', price_minor:50000, stock_status:'available', stock_quantity:null, store:{id:'store', name:'Loja'}, variants:[] };
for (const [label, changes, expected] of [
  ['simple product without quantity tracking', {}, true],
  ['simple product with zero quantity', {stock_quantity:0}, false],
  ['simple product marked out', {stock_status:'out'}, false],
  ['tracked variant with zero quantity', {variants:[{id:'v',in_stock:true,track_quantity:true,stock_quantity:0}]}, false],
  ['tracked variant with positive quantity', {variants:[{id:'v',in_stock:true,track_quantity:true,stock_quantity:3}]}, true],
  ['untracked variant keeps availability flag authoritative', {variants:[{id:'v',in_stock:true,track_quantity:false,stock_quantity:0}]}, true],
  ['inactive available variants do not mask exhausted active variants', {variants:[{id:'v',in_stock:true,track_quantity:true,stock_quantity:0},{id:'inactive',active:false,in_stock:true}]}, false]
]) {
  test(`catalogue, storefront and PDP agree: ${label}`, async () => {
    const {normaliseProduct, normaliseStoreProduct, normalisePDPProduct} = normalisers();
    const row = {...base, ...changes};
    assert.equal((await normaliseProduct(row)).inStock, expected);
    assert.equal((await normaliseStoreProduct(row, row.store)).inStock, expected);
    assert.equal((await normalisePDPProduct(row)).variants.some(v => v.inStock), expected);
  });
}
test('related-product query loads quantities and tracking flags used by card availability', () => {
  const query = html.slice(html.indexOf('async function loadPDPRelated('), html.indexOf('async function fetchPDPProduct('));
  assert.match(query, /stock_status,stock_quantity/);
  assert.match(query, /variants:kg_product_variants\(price_minor,in_stock,stock_quantity,track_quantity,active\)/);
});
test('variant image uses surviving gallery index when an earlier image cannot be signed', async () => {
  const {normalisePDPProduct} = normalisers(async path => { if(path==='bad') throw Error('unavailable'); return `https://images.test/${path}`; });
  const product = await normalisePDPProduct({...base, images:[{storage_path:'bad',sort_order:0},{storage_path:'good',sort_order:1}], variants:[{id:'v',image_path:'good',in_stock:true},{id:'missing',image_path:'bad',in_stock:true}]});
  const variant = product.variants.find(v=>v.id==='v');
  assert.equal(variant.imageIndex,0);
  assert.equal(product.images[variant.imageIndex],'https://images.test/good');
  assert.equal(product.variants.find(v=>v.id==='missing').imageIndex,-1);
});
test('deduplicated gallery URLs retain the correct index for every storage path', async () => {
  const {normalisePDPProduct} = normalisers(async path => path==='third'?'https://images.test/other':'https://images.test/shared');
  const product = await normalisePDPProduct({...base, images:['first','second','third'].map((storage_path,sort_order)=>({storage_path,sort_order})), variants:['first','second','third'].map(id=>({id,image_path:id,in_stock:true}))});
  assert.equal(product.images.length,2);
  for(const [id,index] of [['first',0],['second',0],['third',1]]) assert.equal(product.variants.find(v=>v.id===id).imageIndex,index);
});
test('legacy gallery fallback does not impersonate a failed variant-specific image', async () => {
  const {normalisePDPProduct} = normalisers(async ()=>'');
  const product = await normalisePDPProduct({...base,image_url:'https://images.test/legacy',images:[{storage_path:'bad',sort_order:0}],variants:[{id:'v',image_path:'bad',in_stock:true}]});
  assert.deepEqual(product.images,['https://images.test/legacy']);
  assert.equal(product.variants[0].imageIndex,-1);
});
