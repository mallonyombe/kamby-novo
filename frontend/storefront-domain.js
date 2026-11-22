import { normaliseSearch } from './search-engine.js';

export function filterStoreProducts(store, { query = '', availableOnly = false, sort = 'recent' } = {}) {
  const words = normaliseSearch(query).split(' ').filter(Boolean);
  const products = (store?.products || []).filter(product => {
    if (product.storeId !== store.id || (availableOnly && !product.inStock)) return false;
    const text = normaliseSearch([product.title, product.categoryLabel].filter(Boolean).join(' '));
    return words.every(word => text.includes(word));
  });
  return products.sort((a, b) => {
    if (sort === 'price-up') return a.priceMinor - b.priceMinor || a.title.localeCompare(b.title, 'pt');
    if (sort === 'price-down') return b.priceMinor - a.priceMinor || a.title.localeCompare(b.title, 'pt');
    return String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || a.id.localeCompare(b.id);
  });
}
