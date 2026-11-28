import { analyticsAllowed, trackAnalytics } from './analytics.js';
import { createClient } from '@supabase/supabase-js';
export const catalogueConfig = Object.freeze({
  supabaseUrl: 'https://wbjhhkjriqeloiinvbii.supabase.co',
  publishableKey: 'sb_publishable_9n2oXQLqDuaQNLEHl_Vw6A_7exV-LPl',
  imageBucket: 'kg-product-images', pageSize: 60
});
const pilot = document.documentElement.dataset.pilot === 'true';
export const platform = createClient(catalogueConfig.supabaseUrl, catalogueConfig.publishableKey, {
  global: {
    fetch: (input, init) => {
      if (pilot) return Promise.reject(new Error('O piloto não faz pedidos ao serviço de contas.'));
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
      // The SDK can add a user session to both reads and writes. Keep those
      // responses out of the browser's HTTP cache.
      const options = { ...init, cache: 'no-store' };
      if (url.pathname === '/rest/v1/kg_store_events' || url.pathname === '/rest/v1/rpc/kg_record_contact_activity') {
        options.keepalive = true;
      }
      return fetch(input, options);
    }
  },
  auth: { storageKey: 'kamby:account', persistSession: !pilot, autoRefreshToken: !pilot, detectSessionInUrl: !pilot, flowType: 'pkce' }
});
const recorded = new Map();
export function trackStoreEvent(storeId, kind, productId=null) {
  if (pilot || !analyticsAllowed() || !storeId || !['store_view','whatsapp_click','whatsapp_intent'].includes(kind)) return;
  const duration = kind === 'store_view' ? 30 * 60 * 1000 : 1500;
  const key = 'kamby:event:' + kind + ':' + storeId;
  let previous = recorded.get(key) || 0;
  try { previous = Math.max(previous, Number(sessionStorage.getItem(key) || 0)); } catch (_error) {}
  if (Date.now() - previous < duration) return;
  recorded.set(key, Date.now());
  if (kind === 'store_view') trackAnalytics('view_store');
  if (kind === 'whatsapp_click') trackAnalytics('whatsapp_contact');
  try { sessionStorage.setItem(key, String(Date.now())); } catch (_error) {}
  if(kind==='whatsapp_click') platform.auth.getSession().then(({data})=>{if(analyticsAllowed()&&data.session)return platform.rpc('kg_record_contact_activity',{p_store_id:storeId,p_product_id:productId,p_request_id:crypto.randomUUID()});}).catch(()=>{});
  // Recording never blocks a shop or WhatsApp action. No visitor identity is collected.
  platform.from('kg_store_events').insert({ id: crypto.randomUUID(), store_id: storeId, kind })
    .then(({error}) => { if (error && error.code !== '23505') recorded.delete(key); }).catch(() => recorded.delete(key));
}
