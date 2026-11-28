import test from 'node:test';
import assert from 'node:assert/strict';
import {promotionInstant,sellerPriceFields,visibleSellerPrice} from '../frontend/seller-pricing.js';

test('promotion dates use Mozambique civil time and include the entire last day',()=>{
 assert.equal(promotionInstant('2026-12-20',''), '2026-12-19T22:00:00.000Z');
 assert.equal(promotionInstant('2026-12-20','',true), '2026-12-20T22:00:00.000Z');
 assert.equal(promotionInstant('2026-12-20','09:15'), '2026-12-20T07:15:00.000Z');
 assert.equal(promotionInstant('',''),null);
 assert.throws(()=>promotionInstant('','09:30'),/data/);
 assert.throws(()=>promotionInstant('2026-02-30',''),/data/);
});

test('existing active and scheduled promotions reopen with separate normal and discounted prices',()=>{
 const fields=sellerPriceFields({
  price_minor:7500,previous_price_minor:9000,
  promotion_starts_at:'2026-12-19T22:00:00Z',
  promotion_ends_at:'2026-12-20T22:00:00Z'
 });
 assert.equal(fields.price,'90.00');
 assert.equal(fields.promoPrice,'75.00');
 assert.equal(fields.promotionEnabled,true);
 assert.equal(fields.promotionStartDate,'2026-12-20');
 assert.equal(fields.promotionStartTime,'');
 assert.equal(fields.promotionEndDate,'2026-12-20');
 assert.equal(fields.promotionEndTime,'');
});

test('a variant can inherit the common price before and after its promotion',()=>{
 const fields={...sellerPriceFields({previous_price_minor:9000,price_minor:7500,
  promotion_starts_at:'2026-12-20T06:00:00Z',promotion_ends_at:'2026-12-20T07:00:00Z'}),price:''};
 assert.deepEqual(visibleSellerPrice(fields,'90.00',Date.parse('2026-12-20T05:59:59Z')),{price:9000});
 assert.deepEqual(visibleSellerPrice(fields,'90.00',Date.parse('2026-12-20T06:00:00Z')),{price:7500,previous:9000});
 assert.deepEqual(visibleSellerPrice(fields,'90.00',Date.parse('2026-12-20T07:00:00Z')),{price:9000});
 assert.deepEqual(visibleSellerPrice({...fields,promotionEnabled:false},'90.00',Date.parse('2026-12-20T06:00:00Z')),{price:9000});
});
