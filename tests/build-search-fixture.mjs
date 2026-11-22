// Browser QA only: writes an ignored dist page, never the production source.
import fs from 'node:fs';
const stores = [
  { id: 's1', name: 'Loja São José', slug: 'loja-sao-jose', description: 'Calçado e artigos para casa', whatsapp_e164: '258840000001', location: 'Chongoene, Centro', status: 'approved' },
  { id: 's2', name: 'Mercearia Central', slug: 'mercearia-central', description: 'Arroz e cereais', whatsapp_e164: '258840000002', location: 'Chongoene, Bairro Novo', status: 'approved' },
  { id: 's3', name: 'Loja Nova', slug: 'loja-nova', description: 'Artigos de casa', whatsapp_e164: '', location: 'Chongoene', status: 'approved' }
];
const products = [
  { id: 'p1', title: 'Ténis de corrida', store_id: 's1', store: stores[0], price_minor: 150000, stock_status: 'in', category: { id: 'c1', name: 'Calçado' } },
  { id: 'p2', title: 'Arroz 5 kg', store_id: 's2', store: stores[1], price_minor: 45000, stock_status: 'out', category: { id: 'c2', name: 'Mercearia' } },
  { id: 'p3', title: 'Caneca azul', store_id: 's1', store: stores[0], price_minor: 25000, stock_status: 'in', category: { id: 'c3', name: 'Casa' } },
  ...Array.from({ length: 60 }, (_, i) => ({ id: 'extra' + i, title: 'Artigo ' + i, store_id: 's1', store: stores[0], price_minor: 10000, stock_status: 'in', category: { id: 'c3', name: 'Casa' } })),
  { id: 'p64', title: 'Caneca da última página', store_id: 's1', store: stores[0], price_minor: 30000, stock_status: 'in', category: { id: 'c3', name: 'Casa' } }
].map(p => ({ ...p, description: 'Produto de teste isolado.', status: 'published', unit_reference: 'un', created_at: '2026-11-11T00:00:00Z', variants: [], images: [] }));
const script = `<script>
const QA_STORES = ${JSON.stringify(stores)};
const QA_PRODUCTS = ${JSON.stringify(products)};
const originalFetch = window.fetch;
let qaProductRequests = 0;
window.fetch = async function(input, options) {
  const url = new URL(input, location.href);
  if (!url.hostname.endsWith('.supabase.co')) return originalFetch(input, options);
  if (new URLSearchParams(location.search).get('qa') === 'offline') return new Response('{}', { status: 503 });
  if (url.pathname.endsWith('/kg_products') && ++qaProductRequests === 2 && new URLSearchParams(location.search).get('qa') === 'retry') return new Response('{}', { status: 503 });
  let rows = [];
  if (url.pathname.endsWith('/kg_products')) {
    rows = QA_PRODUCTS;
    if (url.searchParams.has('id')) rows = rows.filter(p => p.id === url.searchParams.get('id').slice(3));
  } else if (url.pathname.endsWith('/kg_stores')) {
    rows = QA_STORES.map(s => ({ ...s, products: QA_PRODUCTS.filter(p => p.store_id === s.id) }));
  }
  const offset = Number(url.searchParams.get('offset') || 0);
  const limit = Number(url.searchParams.get('limit') || 1000);
  return new Response(JSON.stringify(rows.slice(offset, offset + limit)), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
<\/script>`;
const source = fs.readFileSync('frontend/index.html','utf8');
fs.writeFileSync('dist/search-qa.html', source.replace('<head>', '<head>' + script));
console.log('Isolated browser fixture: /search-qa.html');
