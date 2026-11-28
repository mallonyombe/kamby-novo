import { loadAccountTerms, showAccountTerms } from './account-terms.js';
import { platform } from './platform.js';

const status = document.getElementById('legalTermsStatus');
const version = new URLSearchParams(location.search).get('versao');
try {
  let terms;
  if (version) {
    if (!/^[a-zA-Z0-9.-]{1,48}$/.test(version)) throw new Error('Versão inválida.');
    const {data, error} = await platform.rpc('kg_read_terms_version', {p_version: version});
    if (error || !data || data.version !== version) throw error || new Error('Versão indisponível.');
    terms = data;
  } else {
    terms = await loadAccountTerms(platform);
  }
  document.getElementById('termsTitle').textContent = terms.title;
  showAccountTerms(document.getElementById('legalTerms'), terms);
  status.hidden = true;
} catch {
  status.textContent = 'Não foi possível carregar os termos. Verifica a ligação e actualiza esta página.';
}
