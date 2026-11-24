import {setButtonBusy} from "./loading.js";
export function setupProductActionSheet({ getSelection, setVariant, setQuantity, onConfirm, formatPrice }) {
  const $ = id => document.getElementById(id);
  const dialog = $('productActionSheet');
  const options = $('actionVariant');
  let mode = 'cart', busy = false, previousFocus = null;

  function render({ keepNotice = false } = {}) {
    const selection = getSelection(mode);
    if (!selection) return;
    const { product, variant, quantity, limit } = selection;
    $('productActionTitle').textContent = mode === 'cart' ? 'Adicionar ao carrinho' : 'Pedido pelo WhatsApp';
    $('actionProductName').textContent = product.title;
    $('actionStoreName').textContent = product.storeName;
    const photo = product.images[variant.imageIndex >= 0 ? variant.imageIndex : 0];
    $('actionProductImage').hidden = !photo;
    if (photo) $('actionProductImage').src = photo;
    options.replaceChildren();
    product.variants.forEach(option => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'action-variant-option'; button.dataset.variantId = option.id;
      button.setAttribute('role', 'radio'); button.setAttribute('aria-checked', String(option.id === variant.id));
      button.tabIndex = option.id === variant.id ? 0 : -1;
      button.disabled = busy || !option.inStock;
      const name = document.createElement('span'), price = document.createElement('span'), mark = document.createElement('span');
      name.className = 'action-variant-name'; name.textContent = option.name;
      price.className = 'action-variant-price'; price.textContent = option.inStock ? formatPrice(option.priceMinor) : 'Esgotado';
      if (option.inStock && option.previousPriceMinor > option.priceMinor) {
        const previous = document.createElement('del');
        previous.textContent = formatPrice(option.previousPriceMinor);
        price.append(' ', previous);
        button.setAttribute('aria-label', option.name + ', ' + formatPrice(option.priceMinor) +
          ', antes ' + formatPrice(option.previousPriceMinor));
      }
      mark.className = 'action-variant-mark'; mark.setAttribute('aria-hidden', 'true');
      button.append(name, price, mark);
      button.onclick = () => choose(option.id);
      options.append(button);
    });
    options.setAttribute('aria-disabled', String(busy));
    $('btnCloseProductAction').disabled = busy;
    $('actionVariantLabel').hidden = !product.variants.some(option => option.id);
    $('pdpQtyVal').textContent = String(quantity);
    $('pdpSubtotalVal').textContent = formatPrice(variant.priceMinor * quantity);
    $('btnPdpDec').disabled = busy || quantity <= 1;
    $('btnPdpInc').disabled = busy || quantity >= limit;
    $('actionConfirm').textContent = mode === 'cart' ? 'Adicionar ao carrinho' : 'Continuar no WhatsApp';
    $('actionConfirm').disabled = busy || limit < 1 || !variant.inStock;
    setButtonBusy($('actionConfirm'),busy);
    if (!keepNotice) {
      $('productActionNotice').textContent = limit < 1 ? 'Já atingiste a quantidade disponível neste carrinho.' : '';
      $('productActionNotice').hidden = limit >= 1;
    }
  }
  function choose(id) {
    if (busy) return;
    const next = getSelection(mode)?.product.variants.find(variant => variant.id === id);
    if (!next?.inStock) return;
    setVariant(id); setQuantity(1); render();
    [...options.querySelectorAll('button')].find(button => button.dataset.variantId === id)?.focus({ preventScroll: true });
  }
  options.onkeydown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key) || busy) return;
    event.preventDefault();
    const variants = getSelection(mode).product.variants.filter(variant => variant.inStock);
    let index = variants.findIndex(variant => variant.id === getSelection(mode).variant.id);
    index = event.key === 'Home' ? 0 : event.key === 'End' ? variants.length - 1 : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + variants.length) % variants.length;
    if (variants[index]) choose(variants[index].id);
  };
  function fit() {
    if (!dialog.open || !window.visualViewport) return;
    dialog.style.setProperty('--action-height', Math.round(window.visualViewport.height) + 'px');
    dialog.style.bottom = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop) + 'px';
  }
  function open(nextMode) {
    const selection = getSelection(nextMode);
    if (!selection?.variant.inStock) return;
    mode = nextMode; setQuantity(1); busy = false; previousFocus = document.activeElement;
    render(); dialog.showModal(); fit();
  }
  function close(force = false) {
    if (busy && !force) return false;
    if (dialog.open) dialog.close();
    busy = false; previousFocus?.focus({ preventScroll: true }); return true;
  }
  $('btnCloseProductAction').onclick = () => close();
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  $('btnPdpDec').onclick = () => { const selection = getSelection(mode); if (selection.quantity > 1) { setQuantity(selection.quantity - 1); render(); } };
  $('btnPdpInc').onclick = () => { const selection = getSelection(mode); if (selection.quantity < selection.limit) { setQuantity(selection.quantity + 1); render(); } };
  $('actionConfirm').onclick = async () => {
    const selection = getSelection(mode);
    if (busy || !selection || selection.limit < selection.quantity) return;
    busy = true; render(); $('productActionNotice').hidden = true;
    try { if (await onConfirm(mode, selection) !== false) close(true); }
    catch (error) { $('productActionNotice').textContent = error.safeMessage || error.message || 'Não foi possível concluir. Tenta novamente.'; $('productActionNotice').hidden = false; }
    finally { busy = false; setButtonBusy($('actionConfirm'),false);if (dialog.open) render({ keepNotice: true }); }
  };
  window.visualViewport?.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('scroll', fit);
  return { open, close, refresh: () => { if (dialog.open) render(); }, isOpen: () => dialog.open };
}
