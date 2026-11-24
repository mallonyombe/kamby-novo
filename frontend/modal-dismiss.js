// Use o mesmo evento cancelável de Escape para respeitar a validação própria do editor.
export function requestModalDismiss(dialog) {
 if (!dialog.open || modalBusy(dialog)) return false;
 if (dialog.dispatchEvent(new Event('cancel', {cancelable:true}))) dialog.close();
 return true;
}
function modalBusy(dialog) {
 return dialog.getAttribute('aria-busy') === 'true' ||
  [...dialog.querySelectorAll('[aria-busy="true"]')].some(node => node.closest('dialog') === dialog);
}
export function outsideModal(rect, point) {
 return point.clientX < rect.left || point.clientX >= rect.right ||
  point.clientY < rect.top || point.clientY >= rect.bottom;
}
export function enableModalDismiss(root = document) {
 let gesture = null;
 const openers = new WeakMap();
 function onBackdrop(event) {
  const dialog = event.target;
  if (!(dialog instanceof HTMLDialogElement) || !dialog.open) return null;
  // Neste visualizador o próprio diálogo é transparente e ocupa todo o ecrã.
  if (dialog.hasAttribute('data-backdrop-surface')) return dialog;
  return outsideModal(dialog.getBoundingClientRect(), event) ? dialog : null;
 }
 root.addEventListener('pointerdown', event => {
  gesture = event.isPrimary && event.button === 0 ? onBackdrop(event) : null;
 }, true);
 root.addEventListener('pointerup', event => {
  if (onBackdrop(event) !== gesture || !event.isPrimary) gesture = null;
 }, true);
 root.addEventListener('pointercancel', () => { gesture = null; }, true);
 root.addEventListener('click', event => {
  const dialog = onBackdrop(event);
  if (gesture && gesture === dialog) {
   event.preventDefault();
   event.stopPropagation();
   requestModalDismiss(dialog);
  }
  gesture = null;
 }, true);
 root.addEventListener('cancel', event => {
  if (event.target instanceof HTMLDialogElement && modalBusy(event.target)) {
   event.preventDefault();
   event.stopImmediatePropagation();
  }
 }, true);
 root.addEventListener('beforetoggle', event => {
  if (event.target instanceof HTMLDialogElement && event.newState === 'open') {
   openers.set(event.target, root.activeElement);
  }
 }, true);
 root.addEventListener('close', event => {
  const trigger = openers.get(event.target);
  if (!trigger) return;
  openers.delete(event.target);
  // A restauração nativa tem prioridade, incluindo modais sobrepostos.
  if (root.activeElement === root.body && trigger.isConnected && trigger.getClientRects().length) {
   trigger.focus({preventScroll:true});
  }
 }, true);
}

export function protectModalEdits(dialog, form, confirmDiscard) {
 let dirty = false, confirming = false;
 form.addEventListener('input', () => { dirty = true; });
 dialog.addEventListener('cancel', async event => {
  if (!dirty || !dialog.open) return;
  event.preventDefault();
  if (confirming) return;
  confirming = true;
  try {
   if (await confirmDiscard() && dialog.open && !modalBusy(dialog)) dialog.close();
  } finally { confirming = false; }
 });
}
