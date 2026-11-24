// Uma chave por produto evita que alterações a artigos diferentes se sobrescrevam entre separadores.
export const savedPrefix = 'kamby:guardado:';
const prefixFor = owner => savedPrefix + encodeURIComponent(owner || 'visitante') + ':';
const keyFor = (owner, id) => prefixFor(owner) + encodeURIComponent(id);

export function readSavedEntries(storage, owner = '') {
 const prefix = prefixFor(owner);
 const entries = [];
 for (let index = 0; index < storage.length; index++) {
  const key = storage.key(index);
  if (!key?.startsWith(prefix)) continue;
  let entry;
  try { entry = JSON.parse(storage.getItem(key)); } catch { continue; }
  if (entry?.product?.id && key === keyFor(owner, entry.product.id)) entries.push(entry);
 }
 return entries.sort((a, b) => b.at - a.at);
}

export function saveOnDevice(storage, product) {
 storage.setItem(keyFor('', product.id), JSON.stringify({ at: Date.now(), product }));
}

export function removeFromDevice(storage, owner, id) {
 storage.removeItem(keyFor(owner, id));
}

export function claimGuestEntries(storage, owner) {
 if (!owner) throw new Error('É necessária uma conta para sincronizar.');
 for (const entry of readSavedEntries(storage)) {
  // Guardar primeiro permite retomar mesmo quando o espaço local se esgota.
  storage.setItem(keyFor(owner, entry.product.id), JSON.stringify(entry));
  removeFromDevice(storage, '', entry.product.id);
 }
}

export async function sendClaimedEntries(storage, owner, active, insert) {
 const entries = readSavedEntries(storage, owner);
 const sent = [];
 for (const { product } of entries) {
  if (!active()) break;
  const result = await insert(product.id);
  if (result.error && result.error.code !== '23505') continue;
  removeFromDevice(storage, owner, product.id);
  sent.push(product.id);
 }
 return sent;
}

export function toggleGuestEntry(storage, product) {
 const key = keyFor('', product.id);
 if (storage.getItem(key)) {
  removeFromDevice(storage, '', product.id);
  return false;
 }
 saveOnDevice(storage, product);
 return true;
}

// Os cartões podem ficar prontos antes de carregar o módulo de conta/loja.
export function bindGuestHeartsUntilAccountReady() {
 const early = new AbortController();
 const options = {signal: early.signal};
 function paint() {
  let accountPending;
  let ids;
  try {
   accountPending = Boolean(localStorage.getItem('kamby:account'));
   ids = new Set(readSavedEntries(localStorage).map(entry => entry.product.id));
  } catch { return; }
  for (const button of document.querySelectorAll('[data-save-product], #btnPdpSaveProduct')) {
   if (!button.kambyPreview) continue;
   const saved = ids.has(button.kambyPreview.id);
   button.disabled = accountPending;
   button.setAttribute('aria-pressed', String(saved));
   button.setAttribute('aria-label', (saved ? 'Remover dos guardados: ' : 'Guardar ') + button.kambyPreview.title);
  }
 }
 window.addEventListener('kamby:product-ready', paint, options);
 window.addEventListener('kamby:catalogue-card', () => queueMicrotask(paintOnce), options);
 let queued = false;
 function paintOnce() {
  if (queued || early.signal.aborted) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; if (!early.signal.aborted) paint(); });
 }
 document.addEventListener('click', event => {
  const button = event.target.closest('[data-save-product], #btnPdpSaveProduct');
  if (!button?.kambyPreview || button.disabled) return;
  let message;
  try { message = toggleGuestEntry(localStorage, button.kambyPreview) ? 'Produto guardado.' : 'Produto removido dos guardados.'; }
  catch { message = 'Não foi possível actualizar os guardados neste dispositivo.'; }
  paint();
  window.dispatchEvent(new CustomEvent('kamby:feedback', {detail:message}));
 }, options);
 window.addEventListener('kamby:guardados-prontos', () => early.abort(), {once:true});
}
