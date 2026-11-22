// Shared visual feedback. Loading labels are accessible, never painted as copy.
const pendingColours = new WeakMap();
export function setButtonBusy(button, busy) {
  if (!button) return;
  if (busy && !pendingColours.has(button)) {
    pendingColours.set(button, button.style.getPropertyValue('--pending-colour'));
    button.style.setProperty('--pending-colour', getComputedStyle(button).color);
  }
  button.classList.toggle('is-pending', busy);
  button.setAttribute('aria-busy', String(busy));
  if (!busy && pendingColours.has(button)) {
    const previous = pendingColours.get(button);
    if (previous) button.style.setProperty('--pending-colour', previous);
    else button.style.removeProperty('--pending-colour');
    pendingColours.delete(button);
  }
}
export function showSpinner(container, label = 'A carregar') {
  if (!container) return;
  const spinner = document.createElement('span');
  spinner.className = 'app-spinner';
  spinner.setAttribute('role', 'progressbar');
  spinner.setAttribute('aria-label', label);
  container.hidden = false;
  container.replaceChildren(spinner);
}
export function showSkeleton(container, shape = 'text', count = 1) {
  if (!container) return;
  const skeleton = document.createElement('span');
  skeleton.className = 'app-skeleton app-skeleton--' + shape;
  skeleton.setAttribute('role', 'progressbar');
  skeleton.setAttribute('aria-label', 'A carregar');
  for (let i = 0; i < count; i++) {
    const part = document.createElement('span');
    part.className = 'app-skeleton-part';
    part.setAttribute('aria-hidden', 'true');
    skeleton.append(part);
  }
  container.replaceChildren(skeleton);
}
