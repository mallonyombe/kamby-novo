import { matchCatalogue } from './search-engine.js';

export async function loadPilotCatalogue() {
  const response = await fetch('./pilot-catalogue.json');
  if (!response.ok) throw new Error('Catálogo de demonstração indisponível.');
  return createPilotCatalogue(await response.json(), location.origin);
}

export function createPilotCatalogue(seed, origin) {
  const labels = { casa: 'Casa', moda: 'Moda', eletronicos: 'Electrónica', alimentos: 'Alimentação' };
  const categories = Object.entries(labels).map(([id, name]) => ({ id, name, label: name }));
  const stores = seed.map((shop, index) => ({
    id: String(index + 1), slug: 'demonstracao-' + (index + 1), name: shop.name,
    description: shop.description, location: shop.location, status: 'approved',
    whatsapp_e164: '+12025550101', is_open: true, is_test: true
  }));
  const products = seed.flatMap((shop, index) => shop.products.map(item => ({
    id: item.code, store: stores[index], store_id: stores[index].id, title: item.title,
    category: categories.find(category => category.id === item.category), category_id: item.category,
    description: item.description, price_minor: item.price, unit_reference: item.unit,
    status: 'published', moderation_status: 'allowed', stock_status: item.stock ? 'in' : 'out',
    image_url: origin + '/catalogue-' + item.code + '.jpg', images: [],
    variants: item.variants.map(([name, price, stock], order) => ({
      id: item.code + '-' + order, option_name: name, price_minor: price, in_stock: stock,
      sort_order: order, active: true, track_quantity: false
    }))
  })));
  const searchable = {
    products: products.map(row => ({
      id: row.id, title: row.title, categoryId: row.category_id, categoryLabel: row.category?.name,
      storeName: row.store.name, priceMinor: row.price_minor, inStock: row.stock_status === 'in'
    })),
    stores: stores.map(row => ({
      ...row, isOpen: row.is_open, products: products.filter(product => product.store_id === row.id)
    }))
  };
  const matchIds = (rows, filter) => {
    if (filter?.startsWith('eq.')) return rows.filter(row => row.id === filter.slice(3));
    if (filter?.startsWith('neq.')) return rows.filter(row => row.id !== filter.slice(4));
    if (filter?.startsWith('in.(')) return rows.filter(row => filter.slice(4, -1).split(',').includes(row.id));
    return rows;
  };
  return (path, options = {}) => {
    const url = new URL(path, origin);
    const q = url.searchParams;
    const resource = url.pathname;
    if (url.origin !== origin) throw new Error('Pedido indisponível na demonstração.');
    if (resource === '/rest/v1/rpc/kg_store_contact_availability') {
      const {p_store_id} = JSON.parse(options.body);
      return {available: stores.some(s => s.id === p_store_id), reason: 'open'};
    }
    if (resource === '/rest/v1/rpc/kg_feed_categories') return categories;
    if (resource === '/rest/v1/rpc/kg_search_catalogue') {
      const args = JSON.parse(options.body);
      const result = matchCatalogue(searchable, args.p_query, {
        category: args.p_category, availableOnly: args.p_available,
        minPrice: args.p_min == null ? '' : args.p_min / 100,
        maxPrice: args.p_max == null ? '' : args.p_max / 100,
        withProductsOnly: args.p_with_products, openOnly: args.p_open,
        productSort: args.p_sort, storeSort: args.p_sort
      });
      const matches = args.p_kind === 'stores' ? result.stores : result.products;
      const offset = Number(args.p_offset) || 0;
      return { total: matches.length, ids: matches.slice(offset, offset + (Number(args.p_limit) || 24)).map(row => row.id) };
    }
    const offset = Number(q.get('offset')) || 0;
    const limit = q.has('limit') ? Number(q.get('limit')) : products.length;
    if (resource === '/rest/v1/kg_products') {
      const rows = matchIds(products, q.get('id')).filter(row =>
        (!q.has('store_id') || row.store_id === q.get('store_id').slice(3)) &&
        (!q.has('category_id') || row.category_id === q.get('category_id').slice(3)));
      return rows.slice(offset, offset + limit);
    }
    if (resource === '/rest/v1/kg_stores') {
      return matchIds(stores, q.get('id')).slice(offset, offset + limit)
        .map(store => ({ ...store, products: products.filter(product => product.store_id === store.id) }));
    }
    throw new Error('Pedido indisponível na demonstração.');
  };
}
