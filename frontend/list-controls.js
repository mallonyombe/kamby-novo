import { el, icon } from './merchant-ui.js';

export function listIcon(name, label) {
 const button = el('button', 'kamby-list-icon');
 button.type = 'button';
 button.setAttribute('aria-label', label);
 button.innerHTML = icon(name);
 return button;
}

export function bindListSearch(trigger, panel, input) {
 trigger.setAttribute('aria-controls', panel.id);
 const setOpen = open => {
  panel.hidden = !open;
  trigger.setAttribute('aria-expanded', String(open));
  if (open) input.focus();
 };
 trigger.setAttribute('aria-expanded', String(!panel.hidden));
 trigger.onclick = () => {
  if (panel.hidden) return setOpen(true);
  input.value = '';
  input.dispatchEvent(new Event('input', {bubbles:true}));
  setOpen(false);
  trigger.focus();
 };
 input.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
   event.preventDefault();
   trigger.click();
  }
 });
}

export function paintFilterIcon(button, active) {
 button.classList.toggle('kamby-filter-active', Boolean(active));
 const label = button.dataset.filterLabel || button.getAttribute('aria-label');
 button.dataset.filterLabel = label;
 button.setAttribute('aria-label', active ? label + ' (activos)' : label);
}
