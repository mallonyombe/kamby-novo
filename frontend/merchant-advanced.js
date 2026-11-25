import { loadAccountProfile } from './account-registration.js';
import {sellerDraft} from './seller-draft.js';
import {openSellerSetup as showSellerSetup} from './seller-setup.js';
import {el,icon} from './merchant-ui.js';
import {canPrepareStore} from './merchant-domain.js';
import {setButtonBusy,showSpinner,showSkeleton} from "./loading.js";
import { platform } from './platform.js';
import { loadAccountAccess } from './account-access.js';
import { parsePriceMinor, initials, signInIdentity } from './merchant-domain.js';
import { fetchAllPages } from './search-engine.js';
import { setupProductComposer } from './product-composer.js';
import { setupWorkspace } from './merchant-workspace.js';
import { setupSettings } from './settings.js';

export function setupMerchant(hooks) {
  const byId = id => document.getElementById(id);
  const view = byId('viewMerchant');
  const state = { user:null, profile:null, access:null, phase:'loading', stores:[], store:null, products:[], accountRequest:0, panelRequest:0, busy:false };
  let accountPending=null, settings=null;
  const formatter = new Intl.NumberFormat('pt-MZ', { maximumFractionDigits:0 });
  const text = (id,value) => { byId(id).textContent = value; };
  function message(id, value) { const el=byId(id); el.textContent=value; el.hidden=!value; }
  function publicImage(value) {
    try { const url=new URL(value); return ['http:','https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
  }
  function renderProfile() {
    text('profileCartCountSub', hooks.cartCount() + (hooks.cartCount()===1 ? ' artigo guardado' : ' artigos guardados'));
    byId('profileLoginForm').hidden=Boolean(state.user);
    byId('btnAccountSignOut').hidden=!state.user;
    if (!state.user) {
      text('profileAvatar','K'); text('profileName','Visitante');
      text('profileContact','O teu carrinho fica guardado neste dispositivo.');
      text('profileLocation','');byId('profileLocation').hidden=true;
    }
    const container=byId('profileMerchantStores'); container.replaceChildren();
    byId('profileMerchantAccess').hidden=!state.user || !state.access?.merchant || state.phase!=='ready' || !navigator.onLine;
    if(state.access?.sellerOnboarding){
      const action=el('button','profile-menu-item');
      action.type='button';
      action.innerHTML=icon('store');
      action.append(el('span','profile-menu-label','Criar a minha loja'));
      action.onclick=()=>openSellerSetup();
      container.append(action);
    }
    state.stores.forEach(store => {
      const banner=document.createElement('div'); banner.className='merchant-access-banner';
      const meta=document.createElement('div');
      const name=document.createElement('h3'); name.textContent=store.name;
      const location=document.createElement('p'); location.textContent=({draft:'Em preparação',pending:'Em preparação',suspended:'Suspensa',closed:'Encerrada'}[store.status]||store.location||'A tua loja no Kamby');
      meta.append(name,location);
      const button=document.createElement('button'); button.type='button'; button.className='btn-enter-merchant';
      button.textContent=['draft','pending'].includes(store.status)?'Preparar':'Gerir'; button.setAttribute('aria-label',button.textContent+' '+store.name);
      button.addEventListener('click',async()=>{if(button.disabled)return;button.disabled=true;setButtonBusy(button,true);try{await openMerchant(store.id);}finally{setButtonBusy(button,false);button.disabled=false;}});
      banner.append(meta,button); container.appendChild(banner);
    });
    if(state.phase==='loading'){showSkeleton(byId('profileName'));showSkeleton(byId('profileContact'));showSkeleton(byId('profileAvatar'),'image');}
    settings?.sync();
  }

  function openSellerSetup(store=null,updateHistory=true){
    if(!state.user||(!store&&!state.access?.sellerOnboarding)||!navigator.onLine)return;
    const userId=state.user.id;
    showSellerSetup({
      platform,store,userId,isCurrent:()=>state.user?.id===userId,
      onClose:()=>{if(!updateHistory&&view.hidden&&location.hash.startsWith('#lojista/'))hooks.navigate('perfil');},
      onReady:id=>void openMerchant(id,updateHistory,true,userId)
    });
  }

  function loadAccount() {
    if(accountPending) return accountPending;
    accountPending=performLoadAccount().finally(()=>{accountPending=null;});
    return accountPending;
  }
  async function performLoadAccount() {
    const request=++state.accountRequest;
    try {
      const { data:{session},error:sessionError }=await platform.auth.getSession();
      if(sessionError) throw sessionError;
      if(!session) {
        if(request!==state.accountRequest) return;
        state.user=null;state.access=null; state.profile=null;state.phase='guest'; state.stores=[]; renderProfile();
        if(!view.hidden) closeMerchant();
        return;
      }
      const {data:{user},error}=await platform.auth.getUser();
      if(error) throw error;
      const [profileResult,accountResult]=await Promise.all([
        loadAccountProfile(platform, user),
        loadAccountAccess(platform,user.id)
      ]);
      if(request!==state.accountRequest) return;
      state.user=user;state.profile=profileResult.data||null;state.phase='ready'; state.stores=accountResult.stores;state.access=accountResult.access;
      renderProfile();
      const name=profileResult.data?.display_name || user.user_metadata?.display_name || user.user_metadata?.full_name || 'A tua conta';
      text('profileName',name); text('profileAvatar',initials(name));
      text('profileContact',user.phone ? '+'+user.phone.replace(/^\+/, '') : (/@kamby\.invalid$/i.test(user.email || '') ? '' : user.email || ''));
      text('profileLocation',profileResult.data?.location || ''); byId('profileLocation').hidden=!profileResult.data?.location;settings?.sync();
      message('profileNotice',profileResult.error ? 'Não foi possível carregar todos os dados da conta. Tenta novamente.' : '');
      if(state.store && !state.stores.some(store=>store.id===state.store.id) && !view.hidden) closeMerchant();
    } catch (_error) {
      if(request!==state.accountRequest) return;
      state.user=null;state.access=null; state.profile=null;state.phase=_error?.code==='user_banned'?'suspended':navigator.onLine?'error':'offline'; state.stores=[]; renderProfile();
      message('profileNotice',state.phase==='suspended'?'A conta está suspensa. Contacta a equipa Kamby.':navigator.onLine?'Não foi possível verificar a sessão. Volta a entrar para continuar.':'Sem ligação. Podes alterar a aparência; os dados da conta precisam de ligação.');
      if(!view.hidden) closeMerchant();
    }
  }

  byId('profileLoginForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const button=byId('btnAccountSignIn');
    if(button.disabled)return;
    if(!navigator.onLine){
      message('accountLoginError','Sem ligação à internet. Liga-te e tenta novamente.');
      return;
    }
    button.disabled=true;
    setButtonBusy(button,true);
    message('accountLoginError','');
    try {
      const identity=signInIdentity(byId('accountIdentity').value);
      const {error}=await platform.auth.signInWithPassword({...identity,password:byId('accountPassword').value});
      if(error) throw error;
      byId('accountPassword').value='';
      if(accountPending) await accountPending;
      await loadAccount();
    } catch(error) {
      const value=error.code==='invalid_credentials' ? 'Telefone, email ou palavra-passe incorrectos.' : error.code==='email_not_confirmed' ? 'Abre o e-mail de confirmação e toca no link antes de entrar.' : error.message?.startsWith('Indica') ? error.message : 'Não foi possível entrar. Verifica os dados e a ligação.';
      message('accountLoginError',value);
    } finally { setButtonBusy(button,false);button.disabled=false; }
  });
  byId('btnShowAccountPassword').addEventListener('click',()=>{
    const input=byId('accountPassword'); const visible=input.type==='password'; input.type=visible?'text':'password';
    byId('btnShowAccountPassword').setAttribute('aria-pressed',String(visible));
    byId('btnShowAccountPassword').setAttribute('aria-label',visible?'Ocultar palavra-passe':'Mostrar palavra-passe');
  });
  byId('btnAccountSignOut').addEventListener('click',async()=>{
    byId('btnAccountSignOut').disabled=true;setButtonBusy(byId('btnAccountSignOut'),true);
    let error;try{({error}=await platform.auth.signOut({scope:'local'}));}catch{error=true;}finally{setButtonBusy(byId('btnAccountSignOut'),false);byId('btnAccountSignOut').disabled=false;}
    if(error) { message('profileNotice','Não foi possível terminar a sessão. Tenta novamente.'); return; }
    ++state.accountRequest; byId('sellerSetup')?.close();state.user=null;state.access=null;state.profile=null;state.phase='guest'; state.stores=[];settings?.clear();settings?.close(true); closeMerchant(false);purgeMerchant(); renderProfile();
    message('profileNotice','Sessão terminada.');
  });

  const dialog=byId('clearLocalDataDialog');
  const clearLocalSession=()=>dialog.showModal();
  byId('btnClearLocalData').addEventListener('click',clearLocalSession);
  byId('btnCancelLocalClear').addEventListener('click',()=>dialog.close());
  byId('btnConfirmLocalClear').addEventListener('click',()=>{
    try { hooks.clearLocalData(); dialog.close(); renderProfile(); message('settingsScreenNotice','Dados locais limpos.'); }
    catch { dialog.close(); message('settingsScreenNotice','Não foi possível limpar os dados neste dispositivo.'); }
  });
  window.clearLocalSession=clearLocalSession;

  function storeState() {
    const store=state.store;if(!store)return;
    text('merchantStoreName',store.name);text('merchantStoreLocation',store.location||'');text('merchantStoreContact',store.whatsapp_e164||'');
    const button=byId('btnToggleStoreStatus');button.textContent=store.status==='approved'?(store.is_open?'Aberta':'Fechada'):'Indisponível';button.classList.toggle('closed',!store.is_open||store.status!=='approved');button.setAttribute('aria-pressed',String(store.is_open));button.setAttribute('aria-label',store.is_open?'Fechar loja':'Abrir loja');button.disabled=state.busy||store.status!=='approved';setButtonBusy(button,state.busy);workspace.syncStoreStatus();
  }
  const composer=setupProductComposer({getStore:()=>view.hidden?null:state.store,onPublished:async(id,storeId)=>{await hooks.catalogueChanged(id);if(!view.hidden&&state.store?.id===storeId)await workspace.load();},onFeedback:copy=>message('merchantFeedback',copy)});
  const workspace=setupWorkspace({state,composer,onTerms:store=>openSellerSetup(store),onChanged:hooks.catalogueChanged,onStoreChanged:store=>{state.stores=state.stores.map(s=>s.id===store.id?store:s);storeState();renderProfile();}});
  const loadMerchantData=()=>workspace.load();

  async function openMerchant(storeId,updateHistory=true,termsVerified=false,expectedUser=null) {
    const entry=location.hash;
    await loadAccount();
    if(location.hash!==entry||(expectedUser&&expectedUser!==state.user?.id))return false;
    const store=state.stores.find(item=>item.id===storeId);
    if(!state.user || !store) { hooks.navigate('perfil');await loadAccount();message('profileNotice',state.user?'Esta conta não tem acesso a esta loja.':'Inicia sessão para aceder à tua loja.');return false; }
    if(!view.hidden&&state.store?.id===store.id){return true;}
    if(!termsVerified&&['draft','pending'].includes(store.status)){
      openSellerSetup(store,updateHistory);
      return false;
    }
    workspace.reset();hooks.openSubscreen();state.store=store;view.hidden=false;view.classList.add('active');view.scrollTop=0;
    document.title=store.name+' · Gestão · Kamby';storeState();message('merchantFeedback','');
    if(!canPrepareStore(store)) message('merchantFeedback','A gestão desta loja está indisponível. Contacta a administração.');
    if(updateHistory) history.pushState({kambyMerchant:true},'','#lojista/'+encodeURIComponent(store.id));
    await loadMerchantData();return true;
  }
  function closeMerchant(updateHistory=true) {
    if(view.hidden) return;
    composer.close(true);
    ++state.panelRequest;view.hidden=true;view.classList.remove('active');hooks.closeSubscreen();
    document.title='Definições · Kamby';
    if(updateHistory) history.replaceState(null,'','#definicoes');
  }
  function purgeMerchant(){workspace.reset();state.store=null;state.products=[];byId('merchantProductsList').replaceChildren();for(const id of ['merchantStoreName','merchantStoreLocation','merchantStoreContact','merchantCatalogCount','merchantFeedback'])byId(id).textContent='';byId('accountIdentity').value='';composer.clear();}
  byId('btnBackFromMerchant').addEventListener('click',async()=>{
    if(!await workspace.canLeave())return;
    if(history.state?.kambyMerchant) history.back();else closeMerchant();
  });
  byId('btnRefreshMerchant').addEventListener('click',async()=>{
    const button=byId('btnRefreshMerchant');if(button.disabled)return;
    if(!await workspace.canLeave())return;
    button.disabled=true;setButtonBusy(button,true);
    try{
      const id=state.store?.id;await loadAccount();
      const fresh=state.stores.find(store=>store.id===id);
      if(!fresh || view.hidden)return;
      state.store=fresh;storeState();message('merchantFeedback','');await loadMerchantData();
    }catch{message('merchantFeedback','Não foi possível actualizar a loja. Tenta novamente.');}
    finally{setButtonBusy(button,false);button.disabled=false;}
  });
  byId('btnToggleStoreStatus').addEventListener('click',async()=>{
    if(state.busy || !state.store || state.store.status!=='approved') return;
    state.busy=true;storeState();
    try {
      const {data,error}=await platform.from('kg_stores').update({is_open:!state.store.is_open}).eq('id',state.store.id).eq('updated_at',state.store.updated_at)
        .select('*').single();
      if(error) throw error;
      state.store=data;state.stores=state.stores.map(store=>store.id===data.id?data:store);renderProfile();
      await hooks.catalogueChanged(); message('merchantFeedback',data.is_open?'Loja aberta.':'Loja fechada.');
    } catch { message('merchantFeedback','Não foi possível alterar a abertura. Actualiza o catálogo e tenta novamente.'); }
    finally { state.busy=false;storeState(); }
  });
  settings=setupSettings({openSellerSetup,savedProducts:hooks.savedProducts,renderProductCard:hooks.renderProductCard,getAccount:()=>state,loadAccount,openSubscreen:hooks.openSubscreen,closeSubscreen:hooks.closeSubscreen,navigate:hooks.navigate});
  platform.auth.onAuthStateChange((event,session)=>{
  // O arranque já lê a sessão. O evento inicial não invalida essa leitura.
  if(event==='INITIAL_SESSION') return;
  ++state.accountRequest;if(event==='SIGNED_OUT'||(state.user&&session?.user?.id!==state.user.id)){if(state.user)sellerDraft(state.user.id).clear();byId('sellerSetup')?.close();state.user=null;state.access=null;state.profile=null;state.phase='guest';state.stores=[];settings.clear();settings.close(true);closeMerchant(false);purgeMerchant();renderProfile();}setTimeout(async()=>{if(accountPending)await accountPending;await loadAccount();if(event==='PASSWORD_RECOVERY')settings.recovery();},0);});
  window.addEventListener('kamby:cart-updated',renderProfile);
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&state.user&&state.phase==='ready')void loadAccount();
  });
  renderProfile(); loadAccount();
  return { renderProfile, loadAccount, open:openMerchant, close:closeMerchant, isOpen:()=>!view.hidden, canLeave:workspace.canLeave, settings };
}
