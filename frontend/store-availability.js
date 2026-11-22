// The server owns the clock and opening rules. Never infer permission from device time.
export const STORE_CLOSED_COPY = 'Loja fechada. Podes guardar os artigos no carrinho e voltar mais tarde.';
export const STORE_UNKNOWN_COPY = 'Não foi possível confirmar se a loja está aberta. Tenta novamente.';
export async function requireStoreOpen(request, storeId) {
  let status;
  try {
    status = await request('/rest/v1/rpc/kg_store_contact_availability', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({p_store_id:storeId})
    });
  } catch { throw new Error(STORE_UNKNOWN_COPY); }
  if (status?.available !== true) throw new Error(status?.reason === 'closed' ? STORE_CLOSED_COPY : STORE_UNKNOWN_COPY);
  return status;
}
// Guards every handoff, including a second click after a popup was blocked.
export async function checkedStoreHandoff(request, storeId, handoff) {
  await requireStoreOpen(request, storeId);
  return handoff();
}
export function formatOpeningHours(hours) {
  const days=['Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado','Domingo'];
  if (!Array.isArray(hours) || !hours.length) return '';
  return days.map((name,day)=>{
    const item=hours.find(h=>h && h.day===day);
    if (!item || item.closed) return name+' · Fechado';
    return name+' · '+item.open+'–'+item.close+(item.close<item.open?' (dia seguinte)':'');
  }).join('\n');
}
