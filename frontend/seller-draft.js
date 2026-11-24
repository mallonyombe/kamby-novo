// Only business contact details are saved. Permission and consent are always read from the server.
export function sellerDraft(userId, storage) {
  const key = 'kamby:seller-setup:' + userId;
  let draft = null;
  function change(action) {
    try { action(storage || globalThis.localStorage); } catch { /* Continue in memory. */ }
  }
  change(store => {
    const saved = JSON.parse(store.getItem(key));
    if (typeof saved?.name === 'string' && typeof saved.phone === 'string') {
      draft = { name: saved.name.slice(0, 80), phone: saved.phone.slice(0, 24) };
    }
  });
  return {
    get values() { return draft; },
    save(name, phone) {
      draft = { name, phone };
      change(store => store.setItem(key, JSON.stringify(draft)));
    },
    clear() {
      draft = null;
      change(store => store.removeItem(key));
    }
  };
}
