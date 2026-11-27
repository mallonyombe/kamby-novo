export const sidebarToggleIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M9 5v14"/></svg>';

export function bindSidebar(layout, toggle, panel) {
  const key = 'kamby:sidebar:' + panel;
  let collapsed = false;
  try {
    collapsed = localStorage.getItem(key) === 'collapsed';
  } catch {
    // The control still works when storage is unavailable.
  }

  function sync() {
    layout.dataset.sidebar = collapsed ? 'collapsed' : 'expanded';
    toggle.setAttribute('aria-expanded', String(!collapsed));
    const label = collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
  }

  toggle.addEventListener('click', () => {
    collapsed = !collapsed;
    sync();
    try {
      localStorage.setItem(key, layout.dataset.sidebar);
    } catch {
      // Keep the current preference for this view.
    }
  });
  sync();
}
