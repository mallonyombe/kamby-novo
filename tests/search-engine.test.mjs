import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseSearch, matchCatalogue, fetchAllPages } from '../frontend/search-engine.js';
const catalogue = {
  products: [
    { id: '1', title: 'Ténis de corrida', categoryLabel: 'Calçado', storeName: 'Loja São José', inStock: true },
    { id: '2', title: 'Arroz 5 kg', categoryLabel: 'Mercearia', storeName: 'Mercado Central', inStock: false },
    { id: '3', title: 'Caneca azul', categoryLabel: 'Casa', storeName: 'Loja São José', inStock: true }
  ],
  stores: [
    { id: 's1', name: 'Loja São José', location: 'Chongoene, Centro', area: 'Centro', description: 'Calçado e artigos para casa', products: [{}] },
    { id: 's2', name: 'Mercado Central', location: 'Chongoene, Bairro Novo', area: 'Bairro Novo', description: 'Arroz e outros cereais', products: [] }
  ]
};
test('search ignores accents, case and repeated whitespace', () => {
  assert.equal(normaliseSearch('  TÉNIS   São  '), 'tenis sao');
  assert.deepEqual(matchCatalogue(catalogue, 'TENIS').products.map(p => p.id), ['1']);
});
test('matches product category, seller, and multiple words', () => {
  assert.equal(matchCatalogue(catalogue, 'calcado').products.length, 1);
  assert.equal(matchCatalogue(catalogue, 'sao jose').products.length, 2);
  assert.deepEqual(matchCatalogue(catalogue, 'loja tenis').products.map(p => p.id), ['1']);
});
test('matches store name, location, and description independently', () => {
  assert.equal(matchCatalogue(catalogue, 'chongoene').stores.length, 2);
  assert.equal(matchCatalogue(catalogue, 'cereais').stores[0].id, 's2');
  assert.equal(matchCatalogue(catalogue, 'sao jose').stores[0].id, 's1');
});
test('availability filters do not change the other result type', () => {
  assert.equal(matchCatalogue(catalogue, 'arroz', { availableOnly: true }).products.length, 0);
  assert.equal(matchCatalogue(catalogue, 'arroz', { availableOnly: true }).stores.length, 1);
  assert.equal(matchCatalogue(catalogue, 'chongoene', { withProductsOnly: true }).stores.length, 1);
});
test('empty, unknown and markup queries return no fabricated results', () => {
  for (const query of ['', '   ', 'trator', '<img src=x onerror=alert(1)>']) {
    assert.deepEqual(matchCatalogue(catalogue, query), { products: [], stores: [] });
  }
});
test('loads results past the first catalogue page without duplicates', async () => {
  const rows = Array.from({ length: 125 }, (_, id) => ({ id }));
  const offsets = [];
  const result = await fetchAllPages(async (offset, limit) => {
    offsets.push(offset); return rows.slice(offset, offset + limit);
  }, 60);
  assert.equal(result.length, 125);
  assert.deepEqual(offsets, [0, 60, 120]);
  assert.equal(new Set(result.map(row => row.id)).size, 125);
});
test('does not report a failed page as an empty successful catalogue', async () => {
  await assert.rejects(fetchAllPages(async offset => {
    if (offset) throw new Error('offline');
    return [{ id: 1 }];
  }, 1), /offline/);
});
