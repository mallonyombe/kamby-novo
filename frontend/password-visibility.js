export function bindPasswordVisibility(input, button) {
  button.setAttribute('aria-controls', input.id);
  button.addEventListener('click', () => {
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(visible));
    button.setAttribute('aria-label', visible ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe');
  });
}

export function addPasswordVisibility(input) {
  const label = input.closest('label');
  const field = document.createElement('div');
  field.className = label.className;
  const wrap = document.createElement('span');
  wrap.className = 'account-password-wrap';
  const button = document.getElementById('btnShowAccountPassword').cloneNode(true);
  button.removeAttribute('id');
  input.id ||= 'settings-password-' + input.name;
  label.htmlFor = input.id;
  label.className = '';
  label.replaceWith(field);
  field.append(label, wrap);
  wrap.append(input, button);
  bindPasswordVisibility(input, button);
}

export function describeNewPassword(input) {
  const hint = document.createElement('small');
  hint.id = input.id + '-hint';
  hint.textContent = 'Usa pelo menos 8 caracteres.';
  input.setAttribute('aria-describedby', hint.id);
  input.closest('.settings-field').append(hint);
}
