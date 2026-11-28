import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPilotCatalogue } from '../frontend/pilot-catalogue.js';
import { isTestContact } from '../frontend/whatsapp.js';

const seed = JSON.parse(readFileSync(new URL('../scripts/fixtures/test-stores.json', import.meta.url)));
const catalogue = createPilotCatalogue(seed, 'https://pilot.example');

test('pilot stores always use simulated contact and a multi-store catalogue', () => {
  const stores = catalogue('/rest/v1/kg_stores');
  assert.equal(stores.length, 2);
  for (const store of stores) {
    assert.ok(isTestContact(store.is_test, store.whatsapp_e164));
    assert.ok(store.products.every(product => product.store_id === store.id));
  }
});

test('pilot catalogue supports filtered search and rejects external or account requests', () => {
  const result = catalogue('/rest/v1/rpc/kg_search_catalogue', {
    body: JSON.stringify({p_kind:'products', p_query:'arroz', p_max:10000})
  });
  assert.deepEqual(result, {total:1, ids:['arroz']});
  assert.throws(() => catalogue('/auth/v1/user'));
  assert.throws(() => catalogue('https://external.example/rest/v1/kg_products'));
});
