function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function loadAccountTerms(client) {
  const {data, error} = await client.rpc('kg_current_account_terms');
  if (error) throw error;
  if (!isText(data?.version) || !isText(data.title) || typeof data.accepted !== 'boolean'
      || (data.user_id !== null && !isText(data.user_id))
      || !Array.isArray(data.sections) || !data.sections.length
      || !data.sections.every(section => isText(section?.title) && isText(section.body))) {
    throw new Error('Não foi possível verificar o documento dos termos.');
  }
  return data;
}

function element(tag, text) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}

export function showAccountTerms(container, documentData) {
  const version = element('p', 'Versão ' + documentData.version);
  version.className = 'account-terms-version';
  container.append(version);
  for (const section of documentData.sections) {
    const group = element('section');
    group.append(element('h3', section.title), element('p', section.body));
    container.append(group);
  }
}

export async function ensureAccountTerms(client, onGuest, {isCurrent = () => true} = {}) {
  let terms = await loadAccountTerms(client);
  if (!isCurrent()) return false;
  if (!terms.user_id) throw new Error('Inicia sessão para aceitar os termos.');
  const userId = terms.user_id;
  if (terms.accepted) return true;

  return new Promise(resolve => {
    const dialog = element('dialog');
    dialog.className = 'account-terms-dialog';
    const header = element('header');
    const title = element('h2', 'Termos actualizados');
    title.id = 'accountTermsDialogTitle';
    title.tabIndex = -1;
    dialog.setAttribute('aria-labelledby', title.id);
    const intro = element('p', 'Revê os termos para continuares a usar a tua conta.');
    intro.id = 'accountTermsDialogIntro';
    dialog.setAttribute('aria-describedby', intro.id);
    header.append(title, intro);
    const content = element('div');
    content.className = 'account-terms-content';
    content.tabIndex = 0;
    content.setAttribute('role', 'region');
    content.setAttribute('aria-label', 'Texto dos termos de utilização');
    const error = element('p');
    error.hidden = true;
    error.setAttribute('role', 'status');
    const footer = element('footer');
    const guest = element('button', 'Continuar como visitante');
    const accept = element('button', 'Aceitar os termos');
    guest.type = accept.type = 'button';
    guest.className = 'account-terms-back';
    accept.className = 'account-terms-accept';
    footer.append(accept, guest);
    dialog.append(header, content, error, footer);
    showAccountTerms(content, terms);

    let closed = false;
    let subscription;
    function close(result) {
      if (closed) return;
      closed = true;
      subscription?.unsubscribe();
      dialog.close();
      dialog.remove();
      resolve(result);
    }

    async function submit(action) {
      if (accept.disabled) return;
      if (!isCurrent()) { close(false); return; }
      accept.disabled = guest.disabled = true;
      error.hidden = true;
      try {
        await action();
      } catch {
        if (!isCurrent()) { close(false); return; }
        error.textContent = 'Não foi possível concluir. Verifica a ligação e tenta novamente.';
        error.hidden = false;
      } finally {
        accept.disabled = guest.disabled = false;
      }
    }

    guest.onclick = () => submit(async () => { await onGuest(); close(false); });
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      guest.focus();
    });
    accept.onclick = () => submit(async () => {
      const result = await client.rpc('kg_accept_account_terms', {p_version: terms.version, p_user_id: userId});
      if (!isCurrent()) { close(false); return; }
      if (result.error?.code === '40001') {
        terms = await loadAccountTerms(client);
        if (!isCurrent() || terms.user_id !== userId) { close(false); return; }
        if (terms.accepted) { close(true); return; }
        content.replaceChildren();
        showAccountTerms(content, terms);
        content.scrollTop = 0;
        error.textContent = 'Os termos foram actualizados. Lê a nova versão.';
        error.hidden = false;
        title.focus();
        return;
      }
      if (result.error) throw result.error;
      close(true);
    });

    document.body.append(dialog);
    dialog.showModal();
    title.focus();
    ({data: {subscription}} = client.auth.onAuthStateChange((_event, session) => {
      if (!isCurrent() || session?.user?.id !== userId) close(false);
    }));
    if (closed) subscription.unsubscribe();
  });
}
