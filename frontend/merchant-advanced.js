import { loadAccountProfile } from './account-registration.js';
import {sellerDraft} from './seller-draft.js';
import {openSellerSetup as showSellerSetup} from './seller-setup.js';
import {bindSignOut,confirmAction,el,icon,showFeedback} from './merchant-ui.js';
import {canPrepareStore} from './merchant-domain.js';
import {setButtonBusy,showSpinner,showSkeleton} from "./loading.js";
import { catalogueConfig, platform } from './platform.js';
import { bindPasswordVisibility } from './password-visibility.js';
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
      action.append(el('span','profile-menu-label','Configurar loja'));
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
  bindPasswordVisibility(byId('accountPassword'), byId('btnShowAccountPassword'));
  const googleButton = byId('btnGoogleSignIn');
  const loginPanel = byId('settingsLoginPanel');
  let googleSettingsRequest;
  new MutationObserver(() => {
    if (loginPanel.hidden || googleSettingsRequest) return;
    googleSettingsRequest = fetch(new URL('/auth/v1/settings', catalogueConfig.supabaseUrl), {
      headers: { apikey: catalogueConfig.publishableKey },
      cache: 'no-store'
    }).then(async response => {
      if (!response.ok) throw new Error('Auth settings unavailable');
      const settings = await response.json();
      googleButton.hidden = settings.external?.google !== true;
    }).catch(() => {
      googleSettingsRequest = null;
    });
  }).observe(loginPanel, { attributes: true, attributeFilter: ['hidden'] });
  googleButton.addEventListener('click', async () => {
    googleButton.disabled = true;
    message('accountLoginError', '');
    try {
      const { error } = await platform.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: new URL('/', window.location.origin).href }
      });
      if (error) throw error;
    } catch {
      message('accountLoginError', 'Não foi possível continuar com Google. Tenta novamente.');
    } finally {
      googleButton.disabled = false;
    }
  });
  bindSignOut(() => platform.auth.signOut({scope:'local'}), () => {
    ++state.accountRequest; byId('sellerSetup')?.close();state.user=null;state.access=null;state.profile=null;state.phase='guest'; state.stores=[];settings?.clear();settings?.close(true); closeMerchant(false);purgeMerchant(); renderProfile();
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
    const button=byId('btnToggleStoreStatus');
    const status=byId('merchantOpenState');
    status.hidden=store.status!=='approved';
    status.textContent=store.is_open?'Loja aberta':'Loja fechada';
    status.dataset.open=String(store.is_open);
    button.textContent=store.is_open?'Fechar loja':'Abrir loja';
    button.disabled=state.busy||store.status!=='approved';
    button.removeAttribute('aria-pressed');
    setButtonBusy(button,state.busy);
    workspace.syncStoreStatus();
  }
  const composer=setupProductComposer({getStore:()=>view.hidden?null:state.store,onPublished:async(id,storeId,{newPublication})=>{
    await hooks.catalogueChanged(id);
    if(view.hidden||state.store?.id!==storeId)return;
    if(newPublication)await workspace.revealProduct(id);
    else await workspace.load();
  },onFeedback:copy=>showFeedback(copy)});
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
    }catch{showFeedback('Não foi possível actualizar a loja. Tenta novamente.',{tone:'error'});}
    finally{setButtonBusy(button,false);button.disabled=false;}
  });
  byId('btnToggleStoreStatus').addEventListener('click',async()=>{
    if(state.busy || !state.store || state.store.status!=='approved') return;
    const store=state.store;
    const opening=!store.is_open;
    const label=opening?'Abrir loja':'Fechar loja';
    if(!await confirmAction(label+'?',opening?'Os clientes voltam a poder enviar pedidos.':'Os clientes podem guardar artigos no carrinho e enviar pedidos quando a loja reabrir.',label))return;
    if(state.busy||view.hidden||state.store?.id!==store.id||state.store.is_open!==store.is_open)return;
    state.busy=true;
    storeState();
    try {
      const {data,error}=await platform.from('kg_stores').update({is_open:opening}).eq('id',store.id).eq('updated_at',store.updated_at).select('*').single();
      if(error)throw error;
      if(state.store?.id!==store.id||view.hidden)return;
      state.store=data;
      state.stores=state.stores.map(entry=>entry.id===data.id?data:entry);
      renderProfile();
      showFeedback(data.is_open?'Loja aberta.':'Loja fechada.');
      await hooks.catalogueChanged();
    }catch{
      if(state.store?.id===store.id&&!view.hidden)showFeedback('Não foi possível alterar a abertura. Tenta novamente.',{tone:'error'});
    }finally{
      state.busy=false;
      storeState();
    }
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
