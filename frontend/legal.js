import { loadAccountTerms, showAccountTerms } from './account-terms.js';
import { platform } from './platform.js';

const back=document.getElementById('legalBack');
back.onclick=()=>{
 const ref=document.referrer;
 if(ref && new URL(ref).origin===location.origin && new URL(ref).pathname!==location.pathname && history.length>1) history.back();
 else location.replace('./#perfil');
};
const documents = {
 termos: 'Termos de utilização',
 privacidade: 'Política de privacidade',
 denuncias: 'Denúncias e direitos de autor'
};
const version = new URLSearchParams(location.search).get('versao');
let termsRequest;

function selectDocument(){
 const hash=location.hash.slice(1);
 const id=Object.hasOwn(documents,hash)?hash:'termos';
 for(const section of document.querySelectorAll('main > section'))section.hidden=section.id!==id;
 document.getElementById('legalTitle').textContent=documents[id];
 document.title=documents[id]+' · Kamby';
 window.scrollTo(0,0);
 if(id==='termos')termsRequest ||= loadTerms();
}

const privacy=document.getElementById('privacidade');
if(version&&location.hash==='#privacidade'&&version!==privacy.dataset.version){
 const archive=document.getElementById('privacy-'+version);
 if(archive instanceof HTMLTemplateElement)privacy.replaceChildren(archive.content.cloneNode(true));
 else {
  const heading=document.getElementById('privacyTitle');
  const status=document.createElement('p');
  status.textContent='Esta versão da Política de privacidade está indisponível.';
  privacy.replaceChildren(heading,status);
 }
}

async function loadTerms(){
 const status=document.getElementById('legalTermsStatus');
 try {
  let terms;
  if (version) {
   if (!/^[a-zA-Z0-9.-]{1,48}$/.test(version)) throw new Error('Versão inválida.');
   const {data,error}=await platform.rpc('kg_read_terms_version',{p_version:version});
   if (error||!data||data.version!==version) throw error||new Error('Versão indisponível.');
   terms=data;
  } else {
   terms=await loadAccountTerms(platform);
  }
  document.getElementById('termsTitle').textContent=terms.title;
  showAccountTerms(document.getElementById('legalTerms'),terms);
  status.hidden=true;
 } catch {
  status.textContent='Não foi possível carregar os termos. Verifica a ligação e actualiza esta página.';
 }
}

window.addEventListener('hashchange',selectDocument);
selectDocument();
