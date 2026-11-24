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
