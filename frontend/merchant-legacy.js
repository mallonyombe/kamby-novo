import {setButtonBusy,showSpinner,showSkeleton} from "./loading.js";
import {legacyComposerMarkup} from './merchant-legacy-markup.js';
import { platform } from './platform.js';
import { loadAccountAccess } from './account-access.js';
import { parsePriceMinor, initials, signInIdentity } from './merchant-domain.js';
import { fetchAllPages } from './search-engine.js';
import { setupProductComposer } from './product-composer-legacy.js';
import { setupSettings } from './settings.js';

export function setupMerchant(hooks) {
  const byId = id => document.getElementById(id);
  const modal=byId('modalNewProduct');modal.className='kamby-modal-sheet';modal.innerHTML=legacyComposerMarkup;
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
    byId('profileMerchantAccess').hidden=!state.user || !state.stores.length || state.phase!=='ready' || !navigator.onLine;
    state.stores.forEach(store => {
      const banner=document.createElement('div'); banner.className='merchant-access-banner';
      const meta=document.createElement('div');
      const name=document.createElement('h3'); name.textContent=store.name;
      const location=document.createElement('p'); location.textContent=({draft:'Em preparação',pending:'Em análise',suspended:'Suspensa',closed:'Encerrada'}[store.status]||store.location||'A tua loja no Kamby');
      meta.append(name,location);
      const button=document.createElement('button'); button.type='button'; button.className='btn-enter-merchant';
      button.textContent=['draft','pending'].includes(store.status)?'Preparar':'Gerir'; button.setAttribute('aria-label',button.textContent+' '+store.name);
      button.addEventListener('click',async()=>{if(button.disabled)return;button.disabled=true;setButtonBusy(button,true);try{await openMerchant(store.id);}finally{setButtonBusy(button,false);button.disabled=false;}});
      banner.append(meta,button); container.appendChild(banner);
    });
    if(state.phase==='loading'){showSkeleton(byId('profileName'));showSkeleton(byId('profileContact'));showSkeleton(byId('profileAvatar'),'image');}
    settings?.sync();
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
        platform.from('kg_profiles').select('display_name,location').eq('id',user.id).maybeSingle(),
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
    event.preventDefault(); const button=byId('btnAccountSignIn'); if(button.disabled)return;button.disabled=true;setButtonBusy(button,true);
    message('accountLoginError','');
    try {
      const identity=signInIdentity(byId('accountIdentity').value);
      const {error}=await platform.auth.signInWithPassword({...identity,password:byId('accountPassword').value});
      if(error) throw error;
      byId('accountPassword').value='';
      if(accountPending) await accountPending;
      await loadAccount();
    } catch(error) {
      const value=error.code==='invalid_credentials' ? 'Telefone, email ou palavra-passe incorrectos.' : error.code==='email_not_confirmed' ? 'A conta ainda não foi confirmada.' : error.message?.startsWith('Indica') ? error.message : 'Não foi possível entrar. Verifica os dados e a ligação.';
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
    ++state.accountRequest; state.user=null;state.access=null;state.profile=null;state.phase='guest'; state.stores=[];settings?.clear();settings?.close(true); closeMerchant(false);purgeMerchant(); renderProfile();
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

  async function fetchProducts(storeId) {
    return fetchAllPages(async(offset,size)=>{
      const {data,error}=await platform.from('kg_products').select('id,store_id,title,price_minor,stock_status,status,image_url,updated_at,variants:kg_product_variants(id,option_name,price_minor,in_stock,updated_at),images:kg_product_images(storage_path,sort_order)')
        .eq('store_id',storeId).order('created_at',{ascending:false}).order('id').range(offset,offset+size-1);
      if(error) throw error; return data || [];
    },60);
  }
  function storeState() {
    const store=state.store; if(!store) return;
    text('merchantStoreName',store.name); text('merchantStoreAvatar',initials(store.name));
    text('merchantStoreLocation',store.location || ''); text('merchantStoreContact',store.whatsapp_e164 || '');
    const button=byId('btnToggleStoreStatus');
    button.textContent=store.status==='approved' ? store.is_open ? 'Aberta' : 'Fechada' : store.status==='suspended' ? 'Suspensa' : 'Não publicada';
    button.classList.toggle('closed',!store.is_open || store.status!=='approved');
    button.setAttribute('aria-pressed',String(store.is_open));
    button.setAttribute('aria-label',store.is_open?'Fechar loja':'Abrir loja');
    button.disabled=state.busy || store.status!=='approved';setButtonBusy(button,state.busy);
    byId('btnOpenNewProductModal').disabled=store.status!=='approved';
  }
  function emptyCatalog(copy) { const p=document.createElement('p');p.className='merchant-empty';p.textContent=copy;byId('merchantProductsList').replaceChildren(p); }
  async function loadMerchantData() {
    const store=state.store; if(!store || view.hidden) return;
    const request=++state.panelRequest;
    byId('btnRefreshMerchant').disabled=true;setButtonBusy(byId('btnRefreshMerchant'),true);
    showSkeleton(byId('merchantProductsList'),'rows',3);
    text('merchantMetricsTime',''); text('merchantCatalogCount','');
    for(const id of ['kpiStoreViews','kpiWhatsAppClicks','kpiProductsCount']) showSkeleton(byId(id),'metric');
    try {
      const [products,metrics]=await Promise.all([fetchProducts(store.id),platform.rpc('kg_merchant_metrics',{p_store_id:store.id})]);
      if(request!==state.panelRequest || view.hidden) return;
      state.products=products;
      text('merchantCatalogCount',formatter.format(products.length)+' artigos');
      if(metrics.error){for(const id of ['kpiStoreViews','kpiWhatsAppClicks','kpiProductsCount'])text(id,'—');message('merchantFeedback','Não foi possível carregar os indicadores.');}
      else {
        text('kpiStoreViews',formatter.format(metrics.data.store_views));
        text('kpiWhatsAppClicks',formatter.format(metrics.data.whatsapp_clicks));
        text('kpiProductsCount',formatter.format(metrics.data.active_products));
        text('merchantMetricsTime','Actualizado agora');
      }
      renderCatalog();
    } catch { if(request===state.panelRequest && !view.hidden) { for(const id of ['kpiStoreViews','kpiWhatsAppClicks','kpiProductsCount'])text(id,'—');emptyCatalog('Não foi possível carregar o catálogo. Usa Actualizar catálogo para tentar novamente.');message('merchantFeedback','Verifica a ligação à Internet.'); } }
    finally { if(request===state.panelRequest){setButtonBusy(byId('btnRefreshMerchant'),false);byId('btnRefreshMerchant').disabled=false;} }
  }

  function editForm(product,variant) {
    const item=variant || product;
    const form=document.createElement('form'); form.className='merchant-edit-form';
    if(variant) { const label=document.createElement('p');label.className='merchant-variant-name';label.textContent=variant.option_name;form.appendChild(label); }
    const controls=document.createElement('div');controls.className='merchant-edit-controls';
    const field=document.createElement('label');field.className='merchant-price-field';
    const input=document.createElement('input');input.type='text';input.inputMode='decimal';input.autocomplete='off';input.maxLength=13;
    input.value=(Number(item.price_minor)/100).toFixed(2);
    input.setAttribute('aria-label','Preço de '+product.title+(variant?', '+variant.option_name:''));
    const currency=document.createElement('span');currency.textContent='MT';field.append(input,currency);
    const save=document.createElement('button');save.type='submit';save.className='merchant-price-save';save.textContent='Guardar';save.disabled=true;
    const stock=document.createElement('button');stock.type='button';stock.className='btn-stock-toggle';
    const inStock=variant ? variant.in_stock : product.stock_status!=='out';
    stock.textContent=inStock?'Em stock':'Esgotado';stock.classList.toggle('out',!inStock);
    stock.setAttribute('aria-label',(inStock?'Marcar como esgotado: ':'Marcar como disponível: ')+product.title+(variant?', '+variant.option_name:''));
    stock.setAttribute('aria-pressed',String(inStock));
    input.disabled=stock.disabled=state.store.status!=='approved';
    const error=document.createElement('p');error.className='merchant-edit-error';error.setAttribute('role','alert');error.hidden=true;
    controls.append(field,save,stock);form.append(controls,error);
    input.addEventListener('input',()=>{ save.disabled=state.store.status!=='approved' || input.value===(Number(item.price_minor)/100).toFixed(2);error.hidden=true; });
    async function persist(nextStock) {
      let minor;
      try { minor=parsePriceMinor(input.value); } catch(e) { error.textContent=e.message;error.hidden=false;input.focus();return; }
      input.disabled=save.disabled=stock.disabled=true;setButtonBusy(save,true);error.hidden=true;
      let committed=false;
      try {
        const {data,error:writeError}=await platform.rpc('kg_merchant_update_item',{
          p_product_id:product.id,p_variant_id:variant?.id || null,p_price_minor:minor,p_in_stock:nextStock,p_expected_updated_at:item.updated_at
        });
        if(writeError) throw writeError;
        committed=true;
        // Only show the new value after the database has accepted the versioned write.
        item.price_minor=minor; item.updated_at=data.updated_at;
        if(variant) variant.in_stock=nextStock; else product.stock_status=nextStock?'available':'out';
        const currentStore=state.store.id;
        await hooks.catalogueChanged(product.id);
        if(state.store?.id!==currentStore || view.hidden) return;
        await loadMerchantData(); message('merchantFeedback','Alteração guardada.');
      } catch(e) {
        error.textContent=committed ? 'Alteração guardada. Não foi possível actualizar a vista; recarrega o catálogo.' : e.code==='40001'?'O artigo foi alterado noutra sessão. Actualiza o catálogo antes de guardar.':'Não foi possível guardar. A alteração não foi aplicada.';
        error.hidden=false;
      } finally {
        input.disabled=stock.disabled=state.store?.status!=='approved';save.disabled=false;setButtonBusy(save,false);save.textContent='Guardar';
      }
    }
    form.addEventListener('submit',event=>{event.preventDefault();persist(inStock);});
    stock.addEventListener('click',()=>persist(!inStock));
    return form;
  }
  function renderCatalog() {
    const list=byId('merchantProductsList');list.replaceChildren();
    if(!state.products.length) { emptyCatalog('Esta loja ainda não tem artigos.');return; }
    state.products.forEach(product=>{
      const card=document.createElement('article');card.className='merchant-product-card';
      const heading=document.createElement('div');heading.className='merchant-product-title-row';
      const placeholder=document.createElement('div');placeholder.className='merchant-prod-img';placeholder.setAttribute('aria-hidden','true');heading.appendChild(placeholder);
      const path=(product.images || []).slice().sort((a,b)=>a.sort_order-b.sort_order)[0]?.storage_path;
      const imageUrl=publicImage(product.image_url);
      function addImage(url) { if(!url) return;const img=document.createElement('img');img.src=url;img.alt='';img.className='merchant-prod-img';img.loading='lazy';img.addEventListener('error',()=>img.replaceWith(placeholder),{once:true});placeholder.replaceWith(img); }
      if(path) platform.storage.from('kg-product-images').createSignedUrl(path,3600).then(({data})=>{if(card.isConnected) addImage(data?.signedUrl || imageUrl);}).catch(()=>{}); else addImage(imageUrl);
      const meta=document.createElement('div');meta.className='merchant-prod-meta';
      const title=document.createElement('h3');title.className='merchant-prod-title';title.textContent=product.title;
      const status=document.createElement('p');status.className='merchant-product-status';status.textContent=product.status==='published'?'Publicado':product.status==='draft'?'Rascunho':'Arquivado';
      meta.append(title,status);heading.appendChild(meta);card.appendChild(heading);
      if(product.variants?.length) product.variants.forEach(variant=>card.appendChild(editForm(product,variant)));else card.appendChild(editForm(product,null));
      list.appendChild(card);
    });
  }

  async function openMerchant(storeId,updateHistory=true) {
    await loadAccount();
    const store=state.stores.find(item=>item.id===storeId);
    if(!state.user || !store) { hooks.navigate('perfil');await loadAccount();message('profileNotice',state.user?'Esta conta não tem acesso a esta loja.':'Inicia sessão para aceder à tua loja.');return false; }
    hooks.openSubscreen();state.store=store;view.hidden=false;view.classList.add('active');view.scrollTop=0;
    document.title=store.name+' · Gestão · Kamby';storeState();message('merchantFeedback','');
    if(store.status!=='approved') message('merchantFeedback','A gestão do catálogo está indisponível enquanto a loja não estiver aprovada.');
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
  function purgeMerchant(){state.store=null;state.products=[];byId('merchantProductsList').replaceChildren();for(const id of ['merchantStoreName','merchantStoreLocation','merchantStoreContact','merchantStoreAvatar','kpiStoreViews','kpiWhatsAppClicks','kpiProductsCount','merchantMetricsTime','merchantCatalogCount','merchantFeedback'])byId(id).textContent='';byId('accountIdentity').value='';composer.clear();}
  byId('btnBackFromMerchant').addEventListener('click',()=>{
    if(history.state?.kambyMerchant) history.back();else closeMerchant();
  });
  byId('btnRefreshMerchant').addEventListener('click',async()=>{
    const id=state.store?.id;await loadAccount();
    const fresh=state.stores.find(store=>store.id===id);
    if(!fresh || view.hidden) return;state.store=fresh;storeState();message('merchantFeedback','');loadMerchantData();
  });
  byId('btnToggleStoreStatus').addEventListener('click',async()=>{
    if(state.busy || !state.store || state.store.status!=='approved') return;
    state.busy=true;storeState();
    try {
      const {data,error}=await platform.from('kg_stores').update({is_open:!state.store.is_open}).eq('id',state.store.id).eq('updated_at',state.store.updated_at)
        .select('id,name,location,whatsapp_e164,status,is_open,updated_at').single();
      if(error) throw error;
      state.store=data;state.stores=state.stores.map(store=>store.id===data.id?data:store);renderProfile();
      await hooks.catalogueChanged(); message('merchantFeedback',data.is_open?'Loja aberta.':'Loja fechada.');
    } catch { message('merchantFeedback','Não foi possível alterar a abertura. Actualiza o catálogo e tenta novamente.'); }
    finally { state.busy=false;storeState(); }
  });
  const composer=setupProductComposer({
    getStore:()=>view.hidden ? null : state.store,
    onPublished:async(productId,storeId)=>{
      await hooks.catalogueChanged(productId);
      if(!view.hidden && state.store?.id===storeId) await loadMerchantData();
    },
    onFeedback:copy=>message('merchantFeedback',copy)
  });
  settings=setupSettings({savedProducts:hooks.savedProducts,renderProductCard:hooks.renderProductCard,getAccount:()=>state,loadAccount,openSubscreen:hooks.openSubscreen,closeSubscreen:hooks.closeSubscreen,navigate:hooks.navigate});
  platform.auth.onAuthStateChange((event,session)=>{++state.accountRequest;if(event==='SIGNED_OUT'||(state.user&&session?.user?.id!==state.user.id)){state.user=null;state.access=null;state.profile=null;state.phase='guest';state.stores=[];settings.clear();settings.close(true);closeMerchant(false);purgeMerchant();renderProfile();}setTimeout(async()=>{if(accountPending)await accountPending;await loadAccount();if(event==='PASSWORD_RECOVERY')settings.recovery();},0);});
  window.addEventListener('kamby:cart-updated',renderProfile);
  renderProfile(); loadAccount();
  return { renderProfile, loadAccount, open:openMerchant, close:closeMerchant, isOpen:()=>!view.hidden, settings };
}
