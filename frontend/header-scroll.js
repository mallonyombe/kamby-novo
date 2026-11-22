// Position hysteresis: direction changes never reopen a compact header.
export const HEADER_EXPAND_AT = 8;
export const HEADER_COLLAPSE_AT = 48;

export function nextHeaderState(previous, { scrollY, maxScrollY = Infinity, searching = false }) {
  let compact = Boolean(previous?.compact);
  if (Number.isFinite(scrollY)) {
    const y = Math.max(0, Math.min(scrollY, Math.max(0, maxScrollY)));
    if (y <= HEADER_EXPAND_AT) compact = false;
    else if (y >= HEADER_COLLAPSE_AT) compact = true;
  }
  return { compact, searching, visibleCompact: compact && !searching };
}

export function setupScrollHeader({ header, searchContainer, button, onScroll = () => {} }) {
  let state = { compact: header.classList.contains('is-compact') };
  let frame = 0;
  let restoreFrame = 0;

  function sync({ immediate = false } = {}) {
    if (header.hidden || document.body.classList.contains('is-subscreen')) return;
    const page = document.scrollingElement;
    state = nextHeaderState(state, {
      scrollY: window.scrollY,
      maxScrollY: page ? page.scrollHeight - page.clientHeight : Infinity,
      searching: document.body.classList.contains('is-searching')
    });
    const changed = header.classList.contains('is-compact') !== state.visibleCompact;
    if (immediate && changed) header.classList.add('is-restoring-header');
    if (changed) header.classList.toggle('is-compact', state.visibleCompact);
    searchContainer.inert = state.visibleCompact;
    searchContainer.setAttribute('aria-hidden', String(state.visibleCompact));
    button.inert = !state.visibleCompact;
    button.setAttribute('aria-hidden', String(!state.visibleCompact));
    if (immediate && changed) {
      // Commit restored geometry before showing a returning page; no expanded flash.
      void header.offsetHeight;
      window.cancelAnimationFrame(restoreFrame);
      restoreFrame = window.requestAnimationFrame(() => header.classList.remove('is-restoring-header'));
    }
    if (!state.searching) onScroll();
    return state.visibleCompact;
  }

  function schedule() {
    if (frame) return;
    frame = window.requestAnimationFrame(() => { frame = 0; sync(); });
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('pageshow', () => sync({ immediate: true }));
  sync({ immediate: true });
  return { sync };
}
