export function normalisePriceFilter(value){
 const text=String(value??'').trim().replace(',','.');
 return /^\d{1,10}(?:\.\d{1,2})?$/.test(text)&&Number(text)<=9000000000?text:'';
}
// Search only the published, approved catalogue supplied by the application's API.
export function normaliseSearch(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt').replace(/\s+/g, ' ').trim();
}

export function matchCatalogue(catalogue, query, filters = {}) {
  const words = normaliseSearch(query).split(' ').filter(Boolean);
  if (!words.length) return { products: [], stores: [] };
  const matches = fields => {
    const text = normaliseSearch(fields.filter(Boolean).join(' '));
    return words.every(word => text.includes(word));
  };
  const result = {
    products: catalogue.products.filter(product =>
      (!filters.availableOnly || product.inStock) &&
      (!filters.category || filters.category==='all'||product.categoryId===filters.category) &&
      (!normalisePriceFilter(filters.minPrice)||product.priceMinor>=Math.round(Number(normalisePriceFilter(filters.minPrice))*100)) &&
      (!normalisePriceFilter(filters.maxPrice)||product.priceMinor<=Math.round(Number(normalisePriceFilter(filters.maxPrice))*100)) &&
      matches([product.title, product.categoryLabel, product.storeName])),
    stores: catalogue.stores.filter(store =>
      (!filters.withProductsOnly || store.products.length > 0) &&
      (!filters.openOnly || store.isOpen) &&
      matches([store.name, store.location, store.area, store.description]))
  };
  if(filters.productSort==='price-up')result.products.sort((a,b)=>a.priceMinor-b.priceMinor);
  if(filters.productSort==='price-down')result.products.sort((a,b)=>b.priceMinor-a.priceMinor);
  if(filters.storeSort==='name')result.stores.sort((a,b)=>a.name.localeCompare(b.name,'pt'));
  return result;
}

export async function fetchAllPages(loadPage, pageSize) {
  const result = [];
  for (let offset = 0; ; offset += pageSize) {
    const rows = await loadPage(offset, pageSize);
    result.push(...rows);
    if (rows.length < pageSize) return result;
  }
}
