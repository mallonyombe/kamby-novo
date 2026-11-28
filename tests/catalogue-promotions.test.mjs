import assert from 'node:assert/strict';
import {test} from 'node:test';
import {effectiveCataloguePath,promotionPriceAt} from '../frontend/catalogue-promotions.js';

test('promotion includes the start and excludes the end',()=>{
  const promotion={price_minor:7500,previous_price_minor:10000,
    promotion_starts_at:'2026-12-01T06:00:00Z',promotion_ends_at:'2026-12-03T17:00:00Z'};
  const starts=Date.parse(promotion.promotion_starts_at);
  const ends=Date.parse(promotion.promotion_ends_at);
  assert.deepEqual([starts-1,starts,ends-1,ends].map(now=>promotionPriceAt(promotion,now)),[10000,7500,7500,10000]);
  assert.equal(promotionPriceAt({...promotion,promotion_starts_at:null},starts-1),7500);
  assert.equal(promotionPriceAt({...promotion,promotion_ends_at:null},ends),7500);
  assert.equal(promotionPriceAt({price_minor:10000},starts),10000);
});

test('public catalogue prices use computed fields in both products and embedded variants',()=>{
  const select='id,products:kg_products(id,price_minor,previous_price_minor,variants:kg_product_variants(price_minor,previous_price_minor,active))';
  const path='/rest/v1/kg_stores?'+new URLSearchParams({select,status:'eq.approved'});
  const url=new URL(effectiveCataloguePath(path),'https://catalogue.invalid');
  assert.equal(url.searchParams.get('select'),select.replace(/\b(previous_price_minor|price_minor)\b/g,'$1:effective_$1'));
  assert.equal(url.searchParams.get('status'),'eq.approved');
  const rpc='/rest/v1/rpc/kg_search_catalogue';
  assert.equal(effectiveCataloguePath(rpc),rpc);
});
