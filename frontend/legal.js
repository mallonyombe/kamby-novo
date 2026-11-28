import { loadAccountTerms, showAccountTerms } from './account-terms.js';
import { platform } from './platform.js';

const back=document.getElementById('legalBack');
back.onclick=()=>{
 const ref=document.referrer;
 if(ref && new URL(ref).origin===location.origin && new URL(ref).pathname!==location.pathname && history.length>1) history.back();
 else location.replace('./#perfil');
};
function selectDocument(){
 const id=location.hash.slice(1)==='privacidade'?'privacidade':'termos';
 for(const section of document.querySelectorAll('main > section'))section.hidden=section.id!==id;
 const title=id==='termos'?'Termos de utilização':'Política de privacidade';
 document.getElementById('legalTitle').textContent=title;
 document.title=title+' · Kamby';
 window.scrollTo(0,0);
}
window.addEventListener('hashchange',selectDocument);
selectDocument();
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
