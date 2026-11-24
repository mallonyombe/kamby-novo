import {listIcon,bindListSearch,paintFilterIcon} from './list-controls.js';
import {canPrepareStore,initials,storeHoursDocument} from './merchant-domain.js';
import {summaryMarkup,setupMerchantSummary} from './merchant-summary.js';
import {setButtonBusy,showSpinner,showSkeleton} from "./loading.js";
import {activityChart} from './merchant-activity-chart.js';
import {resolveStoreArtwork} from './storefront-artwork.js';
import {platform} from './platform.js';
import {el,icon,money,notice,confirmAction,imageUrl,showProductThumbnail} from './merchant-ui.js';
export function setupWorkspace({state,composer,onChanged,onStoreChanged,onTerms}){
 const view=document.getElementById('viewMerchant'),body=view.querySelector('.merchant-body');let tab='resumo',generation=0,paging=false,hasMore=false,total=0,offset=0,rows=[],activity=null,storeDirty=false,storeBusy=false,hoursDirty=false;const filters={q:'',status:'all',category:'',available:'all',min:'',max:'',sort:'recent'};const positions={};let storeAssets={logo_path:null,banner_path:null};
 body.className='merchant-workspace';body.innerHTML=`<aside class="mw-sidebar"><div class="mw-brand">${icon('store')}<div><strong id="merchantSidebarName"></strong><span>Espaço do lojista</span></div></div><nav class="merchant-own-nav" aria-label="Navegação do lojista"></nav><a class="mw-return" href="#definicoes">Voltar ao Kamby</a></aside><div class="mw-content"><p class="merchant-feedback" id="merchantFeedback" role="status" aria-live="polite" hidden></p><p class="merchant-feedback" id="merchantOffline" role="status" hidden></p><section data-mw="resumo" class="mw-summary">${summaryMarkup}</section><section data-mw="produtos" hidden><div class="mw-page-heading"><h2>Produtos</h2><button type="button" id="btnOpenNewProductModal" class="mw-primary">${icon('plus')}Novo</button></div><div class="mw-search-row kamby-search-panel" id="merchantSearchPanel" hidden><label class="mw-search">${icon('search')}<input id="merchantSearch" type="search" placeholder="Pesquisar no catálogo" aria-label="Pesquisar produtos por nome ou identificador" autocomplete="off"></label></div><button type="button" class="kamby-list-icon" id="merchantFilterButton" aria-label="Filtros do catálogo">${icon('filter')}</button><div class="mw-list-meta"><span id="merchantCatalogCount"></span><button type="button" id="merchantClearFilters" class="mw-text" hidden>Limpar filtros</button></div><div id="merchantProductsList" class="mw-product-list"></div><p id="merchantListSentinel" class="mw-muted" role="status"></p></section><section data-mw="actividade" hidden><div class="mw-page-heading"><div><button type="button" class="mw-icon" id="merchantHistoryBack" aria-label="Voltar ao resumo">${icon('back')}</button><h2>Actividade</h2><p>Últimos 7 dias</p></div></div><dl id="merchantActivityList" class="mw-traffic"></dl><div id="merchantActivityChart" class="mw-chart"></div></section><section data-mw="loja" class="mw-shop-profile" hidden>
 <div id="merchantStoreArtwork" class="mw-profile-photos"></div>
 <div class="mw-profile-info"><div><h2 id="merchantStoreName"></h2><p id="merchantStoreLocation"></p><p id="merchantStoreContact" hidden></p></div><button type="button" class="btn-store-status" id="btnToggleStoreStatus">—</button></div>
 <p id="merchantStoreDescription" class="mw-profile-description"></p>
 <div class="mw-profile-actions">
   <button type="button" id="merchantEditProfile" class="mw-primary">${icon('edit')}Editar perfil</button>
   <a id="merchantPublicPreview" class="mw-text mw-profile-preview">${icon('eye')}Ver loja pública</a>
 </div>
 <button type="button" id="merchantPublishStore" class="mw-primary" hidden>Activar loja</button><p id="merchantProfileNotice" class="mw-muted" role="status" hidden></p>
 <div id="merchantProfileDetails" class="mw-profile-details"></div>
 <dialog id="merchantStoreEditor" class="mw-filter-dialog mw-store-editor" aria-labelledby="merchantStoreEditorTitle">
 <form id="merchantStoreForm"><header><h2 id="merchantStoreEditorTitle">Editar perfil</h2><button type="button" id="merchantCloseStoreEditor" aria-label="Fechar editor">${icon('close')}</button></header><details class="mw-settings-group" open><summary>Identidade</summary><label>Nome da loja<input name="name" minlength="2" maxlength="80" required></label><label>Descrição<textarea name="description" rows="3" maxlength="2000"></textarea></label></details><details class="mw-settings-group"><summary>WhatsApp e localização</summary><label>WhatsApp comercial<input name="whatsapp_e164" type="tel" placeholder="+258 84 123 4567" required></label><label>Localidade<input name="location" maxlength="120" placeholder="Chongoene"></label><label>Endereço<textarea name="address" maxlength="300" rows="2"></textarea></label><label>Área de atendimento<input name="service_area" maxlength="300" placeholder="Ex.: Chongoene e arredores"></label></details><details class="mw-settings-group"><summary>Horário de atendimento</summary><p class="mw-muted">Sem horário definido, vale a abertura manual. Hora de Moçambique. Fora do horário definido, os clientes podem guardar no carrinho, mas não enviar pedidos.</p><div id="merchantOpeningHours"></div></details><p class="merchant-feedback" id="merchantStoreSaveNotice" role="status" hidden></p><footer><button id="merchantSaveStore" class="mw-primary" type="submit">Guardar perfil</button></footer></form></dialog></section></div>`;
 const $=id=>view.querySelector('#'+id);const set=(id,value)=>$(id).textContent=value;const feedback=copy=>notice($('merchantFeedback'),copy);
 const searchPanel=$('merchantSearchPanel');
 const searchButton=listIcon('search','Pesquisar produtos');
 const filterButton=$('merchantFilterButton');
 const productHeading=body.querySelector('[data-mw="produtos"] .mw-page-heading');
 const productActions=el('div','kamby-list-actions');
 const createButton=$('btnOpenNewProductModal');
 productHeading.append(productActions);
 productActions.append(searchButton,filterButton,createButton);
 bindListSearch(searchButton,searchPanel,$('merchantSearch'));
 filterButton.setAttribute('aria-haspopup','dialog');
 const publishButton=$('merchantPublishStore');
 async function publishStore(button){
   const store=state.store;
   if(!['draft','pending'].includes(store?.status)||storeBusy||button.disabled)return;
   if(!await confirmAction('Activar loja?','A loja ficará visível no Kamby. Os produtos em rascunho podem ser publicados no catálogo.','Activar loja'))return;
   if(state.store?.id!==store.id||storeBusy||view.hidden)return;
   storeBusy=true;
   button.disabled=true;
   setButtonBusy(button,true);
   try{
     const {data,error}=await platform.rpc('kg_publish_seller_store',{p_store_id:store.id});
     if(error)throw error;
     const updated=Array.isArray(data)?data[0]:data;
     if(updated?.id!==store.id||updated.status!=='approved')throw Error();
     if(state.store?.id!==store.id||view.hidden)return;
     state.store=updated;
     onStoreChanged(updated);
     renderProfile();
     feedback('A tua loja está visível no Kamby.');
     await onChanged();
   }catch(error){
     if(state.store?.id!==store.id||view.hidden)return;
     if(error?.details==='seller_terms_required')onTerms(store);
     else feedback('Não foi possível activar a loja. Tenta novamente.');
   }finally{
     storeBusy=false;
     button.disabled=false;
     setButtonBusy(button,false);
   }
 }
 publishButton.onclick=()=>void publishStore(publishButton);
 const nav=body.querySelector('nav');nav.setAttribute('aria-label','Navegação da loja');[['resumo','summary','Resumo'],['produtos','products','Produtos'],['loja','store','Loja']].forEach(([id,image,name])=>{const b=el('button');b.type='button';b.dataset.destination=id;b.innerHTML=icon(image);b.append(el('span','',name));b.onclick=()=>switchTab(id);nav.append(b);});
 function renderFilters(){
   const active=filters.status!=='all'||filters.category||filters.available!=='all'||filters.min||filters.max||filters.sort!=='recent';
   paintFilterIcon(filterButton,active);
   $('merchantClearFilters').hidden=!active;
 }
 async function switchTab(next){if(storeBusy||next===tab&&body.dataset.activeTab===tab)return;if(tab==='loja'&&next!=='loja'&&storeDirty&&!await confirmAction('Sair sem guardar?','As configurações da loja ainda não foram guardadas.','Descartar'))return;storeDirty=false;positions[tab]=view.scrollTop;tab=next;body.querySelectorAll('[data-mw]').forEach(s=>s.hidden=s.dataset.mw!==tab);body.dataset.activeTab=tab;nav.querySelectorAll('button').forEach(b=>{b.setAttribute('aria-current',b.dataset.destination===tab?'page':'false');});view.scrollTop=positions[tab]||0;if(tab==='actividade')loadActivity();if(tab==='loja'){renderStoreForm();renderProfile();}if(tab==='produtos'&&!rows.length)await loadProducts(true);}
 let debounce; $('merchantSearch').oninput=()=>{clearTimeout(debounce);filters.q=$('merchantSearch').value.trim();debounce=setTimeout(()=>{renderFilters();loadProducts(true);},220);};
 $('merchantClearFilters').onclick=()=>{Object.assign(filters,{status:'all',category:'',available:'all',min:'',max:'',sort:'recent'});renderFilters();loadProducts(true);};
 const filterDialog=el('dialog','mw-filter-dialog');filterDialog.innerHTML='<form><header><h2>Filtros do catálogo</h2><button type="button" aria-label="Fechar filtros">'+icon('close')+'</button></header><label>Categoria<select name="category"><option value="">Todas as categorias</option></select></label><label>Disponibilidade<select name="available"><option value="all">Todas</option><option value="available">Disponíveis</option><option value="out">Esgotados</option></select></label><label>Estado<select name="status"><option value="all">Todos</option><option value="published">Publicados</option><option value="draft">Rascunhos</option><option value="archived">Arquivados</option><option value="blocked">Bloqueados pela administração</option></select></label><details class="mw-filter-extra"><summary>Preço e ordenação</summary><div class="editor-two-columns"><label>Preço mínimo (MT)<input name="min" type="number" min="0" step="0.01"></label><label>Preço máximo (MT)<input name="max" type="number" min="0" step="0.01"></label></div><label>Ordenação<select name="sort"><option value="recent">Mais recentes</option><option value="name">Nome A–Z</option><option value="low">Menor preço</option><option value="high">Maior preço</option></select></label></details><p class="field-error" role="alert" hidden></p><footer><button type="submit" class="mw-primary">Aplicar filtros</button></footer></form>';filterDialog.querySelector('h2').id='merchantFilterTitle';filterDialog.setAttribute('aria-labelledby','merchantFilterTitle');document.body.append(filterDialog);filterDialog.querySelector('header button').onclick=()=>filterDialog.close();
 $('merchantFilterButton').onclick=()=>{for(const key of Object.keys(filters)){const field=filterDialog.querySelector('[name="'+key+'"]');if(field)field.value=key==='status'&&filters.status==='out'?'published':key==='available'&&filters.status==='out'?'out':filters[key];}filterDialog.showModal();};
 filterDialog.querySelector('form').onsubmit=e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));if(data.min&&data.max&&Number(data.min)>Number(data.max)){notice(filterDialog.querySelector('[role="alert"]'),'O preço máximo deve ser superior ao mínimo.');return;}Object.assign(filters,data);filterDialog.close();renderFilters();loadProducts(true);};
 async function loadCategories(){const {data,error}=await platform.from('kg_store_categories').select('category:kg_categories(id,name,is_active)').eq('store_id',state.store.id);if(error)return;const cats=(data||[]).map(x=>Array.isArray(x.category)?x.category[0]:x.category).filter(x=>x?.is_active);const select=filterDialog.querySelector('[name="category"]');select.replaceChildren(new Option('Todas as categorias',''));cats.forEach(c=>select.append(new Option(c.name,c.id)));}
 function queryProducts(pageSize=30){let query=platform.from('kg_products').select('*,category:kg_categories(name),variants:kg_product_variants(*),images:kg_product_images(storage_path,sort_order)',{count:'exact'}).eq('store_id',state.store.id);if(filters.q){if(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(filters.q))query=query.eq('id',filters.q);else query=query.ilike('title','%'+filters.q.replace(/[\\%_]/g,'\\$&')+'%');}if(['published','draft','archived'].includes(filters.status))query=query.eq('status',filters.status);if(['published','draft'].includes(filters.status))query=query.eq('moderation_status','allowed');else if(filters.status==='all')query=query.neq('status','archived');if(filters.status==='blocked')query=query.eq('moderation_status','blocked').neq('status','archived');if(filters.status==='out')query=query.eq('stock_status','out').eq('status','published').eq('moderation_status','allowed');else if(filters.available==='out')query=query.eq('stock_status','out');if(filters.available==='available')query=query.neq('stock_status','out');if(filters.category)query=query.eq('category_id',filters.category);if(filters.min)query=query.gte('price_minor',Math.round(Number(filters.min)*100));if(filters.max)query=query.lte('price_minor',Math.round(Number(filters.max)*100));const sort={recent:['created_at',false],name:['title',true],low:['price_minor',true],high:['price_minor',false]}[filters.sort]||['created_at',false];return query.order(sort[0],{ascending:sort[1]}).order('id').range(offset,offset+pageSize-1);}
 async function loadProducts(reset=false, preserve=false){if(view.hidden||!state.store)return;const visibleCount=preserve?Math.max(30,rows.length):30;const scrollTop=view.scrollTop;if(reset){generation++;offset=0;rows=[];hasMore=true;paging=false;if(!preserve)$('merchantProductsList').replaceChildren(...Array.from({length:3},()=>el('div','mw-product-skeleton')));}if(paging||!hasMore)return;const request=generation,storeId=state.store.id;paging=true;showSpinner($('merchantListSentinel'));try{const {data,count,error}=await queryProducts(visibleCount);if(error)throw error;if(request!==generation||storeId!==state.store?.id)return;rows.push(...data);offset+=data.length;total=count??rows.length;hasMore=offset<total;renderProducts();if(preserve&&tab==='produtos')view.scrollTop=scrollTop;set('merchantListSentinel','');set('merchantCatalogCount',total+' '+(total===1?'produto encontrado':'produtos encontrados'));}catch{if(request!==generation)return;if(!rows.length)$('merchantProductsList').replaceChildren(el('p','mw-empty','Não foi possível carregar o catálogo.'));set('merchantListSentinel','');const retry=el('button','mw-secondary','Tentar novamente');retry.type='button';retry.onclick=()=>loadProducts(!rows.length);$('merchantProductsList').append(retry);feedback('Verifica a ligação. Os filtros foram preservados.');}finally{if(request===generation)paging=false;}}
 const observer=new IntersectionObserver(entries=>{if(entries.some(x=>x.isIntersecting)&&tab==='produtos')loadProducts();},{root:view,rootMargin:'180px'});observer.observe($('merchantListSentinel'));
 function renderProducts(){
   const list=$('merchantProductsList');
   closeMenu();
   list.replaceChildren();
   if(!rows.length){
     list.append(el('p','mw-empty',filters.q||!$('merchantClearFilters').hidden?'Nenhum produto encontrado.':'Ainda não há produtos no catálogo.'));
     return;
   }
   for(const product of rows){
     const blocked=product.moderation_status==='blocked';
     const editable=!blocked&&canPrepareStore(state.store);
     const article=el('article','mw-product-row');
     const entry=el(editable?'button':'div','mw-product-entry');
     if(editable){
       entry.type='button';
       entry.onclick=()=>composer.open(product);
       entry.setAttribute('aria-label','Editar '+product.title);
     }
     const photo=el('span','mw-product-photo');
     photo.innerHTML=icon('products');
     const meta=el('span','mw-product-meta');
     const prices=(product.variants||[]).filter(v=>v.active!==false).map(v=>Number(v.price_minor));
     if(!prices.length)prices.push(Number(product.price_minor));
     const price=Math.min(...prices);
     const details=el('span','mw-row-details');
     const publication={published:'Publicado',draft:'Rascunho',archived:'Arquivado'}[product.status];
     if(publication&&!blocked)details.append(el('span','mw-product-state',publication));
     if(blocked)details.append(el('span','mw-stock-alert','Com restrição'));
     if(product.stock_status==='out'&&product.status==='published')details.append(el('span','mw-stock-alert','Esgotado'));
     meta.append(el('strong','mw-product-name',product.title),
       el('span','mw-product-price',price>0?(new Set(prices).size>1?'Desde ':'')+money(price):'Preço por definir'),details);
     entry.append(photo,meta);
     article.append(entry);
     if(editable){
       const actions=el('div','mw-product-actions');
       const menu=el('button','mw-icon');
       menu.type='button';
       menu.setAttribute('aria-label','Opções de '+product.title);
       menu.setAttribute('aria-haspopup','menu');
       menu.setAttribute('aria-expanded','false');
       menu.innerHTML=icon('more');
       menu.onclick=()=>menu.getAttribute('aria-expanded')==='true'?closeMenu():openProductMenu(product,menu);
       actions.append(menu);
       article.append(actions);
     }
     list.append(article);
     const img=el('img');
     img.alt='';
     img.decoding='async';
     photo.append(img);
     showProductThumbnail(platform,product,img);
   }
 }
 let menuNode=null,menuAnchor=null;
 function closeMenu(){
   menuNode?.remove();
   menuAnchor?.setAttribute('aria-expanded','false');
   menuNode=menuAnchor=null;
 }
 function openProductMenu(product,anchor){
   closeMenu();
   const menu=el('div','mw-context-menu');
   menu.setAttribute('role','menu');
   const entries=[['Duplicar como rascunho',()=>composer.open(product,true)]];
   if(product.status==='published')entries.unshift(['Ocultar produto',()=>setPublication(product,'draft')]);
   if(product.status!=='archived')entries.push(['Arquivar produto',()=>setPublication(product,'archived')]);
   if(product.status==='archived'){
     entries.unshift(['Repor como rascunho',()=>setPublication(product,'draft')]);
     entries.push(['Apagar definitivamente',()=>deleteArchivedProduct(product)]);
   }
   for(const [name,action] of entries){
     const button=el('button','',name);
     button.type='button';
     button.setAttribute('role','menuitem');
     button.onclick=()=>{closeMenu();anchor.focus();action();};
     menu.append(button);
   }
   anchor.parentElement.append(menu);
   menuNode=menu;
   menuAnchor=anchor;
   anchor.setAttribute('aria-expanded','true');
   const buttons=[...menu.querySelectorAll('button')];
   buttons[0].focus();
   menu.onkeydown=e=>{
     if(e.key==='Escape'){closeMenu();anchor.focus();}
     else if(e.key==='ArrowDown'||e.key==='ArrowUp'){
       e.preventDefault();
       const delta=e.key==='ArrowDown'?1:buttons.length-1;
       buttons[(buttons.indexOf(document.activeElement)+delta)%buttons.length].focus();
     }
   };
 }
 document.addEventListener('click',e=>{if(menuNode&&!e.target.closest('.mw-product-actions'))closeMenu();});
 function documentFrom(p,status){return{title:p.title,category_id:p.category_id,description:p.description||'',condition:p.condition||'new',attributes:p.attributes||'',status,price_minor:p.price_minor,previous_price_minor:p.previous_price_minor,stock_quantity:p.stock_quantity,in_stock:p.stock_status!=='out',images:(p.images||[]).sort((a,b)=>a.sort_order-b.sort_order).map(i=>i.storage_path),variants:(p.variants||[]).filter(v=>v.active!==false).map(v=>({id:v.id,option_name:v.option_name,price_minor:v.price_minor,previous_price_minor:v.previous_price_minor,in_stock:v.in_stock,track_quantity:v.track_quantity,stock_quantity:v.stock_quantity,image_path:v.image_path}))};}
 async function deleteArchivedProduct(product){
   if(!await confirmAction('Apagar «'+product.title+'»?', 'O produto será removido definitivamente do catálogo.', 'Apagar'))return;
   const {error}=await platform.rpc('kg_delete_archived_product',{
     p_store_id:product.store_id,p_product_id:product.id,p_expected_updated_at:product.updated_at
   });
   if(error){
     feedback(error.code==='40001'?'O produto mudou. Consulta a versão actual antes de apagar.':'Não foi possível confirmar a remoção. Actualiza o catálogo.');
     await load();
     return;
   }
   await onChanged(product.id);
   await load();
   feedback('Produto apagado.');
 }
 async function setPublication(product,status){
   const archived=status==='archived',restoring=product.status==='archived';
   const title=archived?'Arquivar produto?':restoring?'Repor como rascunho?':'Ocultar produto?';
   const detail=archived?'Deixa de aparecer na loja e fica disponível no filtro Arquivados.':
     restoring?'Podes editar o produto antes de o publicar novamente.':'O produto passa a rascunho e deixa de aparecer na loja.';
   if(!await confirmAction(title,detail,archived?'Arquivar':restoring?'Repor':'Ocultar'))return;
   const {error}=await platform.rpc('kg_save_catalogue_product',{
     p_request_id:crypto.randomUUID(),p_store_id:product.store_id,p_product_id:product.id,
     p_expected_updated_at:product.updated_at,p_document:documentFrom(product,status)
   });
   if(error){
     feedback(error.code==='40001'?'O produto foi alterado noutra sessão. Actualiza o catálogo.':'Não foi possível confirmar a alteração. Actualiza o catálogo antes de tentar novamente.');
     return;
   }
   await onChanged(product.id);
   await load();
   feedback(archived?'Produto arquivado.':restoring?'Produto reposto nos rascunhos.':'Produto ocultado. Disponível nos rascunhos.');
 }
 async function openSummaryCatalogue(status){
   Object.assign(filters,{q:'',status,category:'',available:'all',min:'',max:'',sort:'recent'});
   $('merchantSearch').value='';
   renderFilters();
   await switchTab('produtos');
   view.scrollTop=0;
   await loadProducts(true);
 }
 $('merchantHistoryBack').onclick=()=>switchTab('resumo');
 const summary=setupMerchantSummary({
   root:body.querySelector('[data-mw="resumo"]'),state,onProducts:openSummaryCatalogue,
   onEdit:(product,filter)=>composer.open(product,false,filter==='out'?'stock':'edit'),
   onCreate:()=>composer.open(),onStore:()=>switchTab('loja'),onPublish:publishStore,onActivity:()=>switchTab('actividade')
 });
 const loadSummary=()=>summary.load();
 async function loadActivity(){showSkeleton($('merchantActivityChart'),'chart');showSkeleton($('merchantActivityList'),'rows',3);const id=state.store.id;const {data,error}=await platform.rpc('kg_merchant_activity',{p_store_id:id});if(id!==state.store?.id||view.hidden)return;if(error){$('merchantActivityList').replaceChildren();set('merchantActivityChart','Não foi possível carregar os eventos. Actualiza para tentar novamente.');return;}activity=data;const chart=$('merchantActivityChart');chart.replaceChildren(el('h3','','Visitas e cliques WhatsApp'));const legend=el('div','mw-chart-legend');legend.append(el('span','','Visitas à loja'),el('span','','Cliques WhatsApp'));chart.append(legend);chart.append(activityChart(data.days));const table=el('table','mw-events-table');const caption=el('caption','','Valores diários');table.append(caption);const head=el('tr');['Dia','Visitas','Cliques WhatsApp'].forEach(t=>head.append(el('th','',t)));table.append(head);data.days.forEach(d=>{const tr=el('tr');[d.day,d.views,d.contacts].forEach(x=>tr.append(el('td','',x)));table.append(tr);});const details=el('details');details.append(el('summary','','Consultar valores'),table);chart.append(details);const list=$('merchantActivityList');
   list.replaceChildren();
   for(const [key,label] of [['views','Visitas à loja'],['contacts','Cliques no WhatsApp']]){
     const metric=el('div');
     const total=data.days.reduce((sum,day)=>sum+Number(day[key]||0),0);
     metric.append(el('dt','',label),el('dd','',total.toLocaleString('pt-MZ')));
     list.append(metric);
   }
 }

 async function load(){if(!state.store)return;const id=state.store.id;const {data,error}=await platform.from('kg_stores').select('*').eq('id',id).single();if(view.hidden||state.store?.id!==id)return;if(!error){state.store=data;onStoreChanged(data);}set('merchantSidebarName',state.store.name);summary.syncStatus();const unavailable=!canPrepareStore(state.store);$('btnOpenNewProductModal').disabled=$('merchantQuickNew').disabled=unavailable;await Promise.all([loadSummary(),loadProducts(true,tab==='produtos'),loadCategories()]);if(tab==='loja'&&!storeDirty){renderStoreForm();renderProfile();}if(tab==='actividade')loadActivity();}
 const form=$('merchantStoreForm');form.oninput=e=>{storeDirty=true;if(/^(day|open|close)-/.test(e.target.name||''))hoursDirty=true;notice($('merchantStoreSaveNotice'),'Alterações por guardar.');};
 function renderStoreForm(){const s=state.store;if(!s)return;hoursDirty=false;storeAssets={logo_path:s.logo_path||null,banner_path:s.banner_path||null};['name','description','whatsapp_e164','location','address','service_area'].forEach(key=>form.elements[key].value=s[key]||'');$('merchantPublicPreview').href='#loja/'+s.id;$('merchantPublicPreview').hidden=s.status!=='approved';const hours=$('merchantOpeningHours');hours.replaceChildren();['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'].forEach((day,index)=>{const value=s.opening_hours?.find(x=>x.day===index)||{closed:true,open:'08:00',close:'17:00'};const row=el('div','mw-hours');const label=el('label','mw-check');const check=el('input');check.type='checkbox';check.checked=!value.closed;check.name='day-'+index;label.append(check,document.createTextNode(day));const from=el('input'),to=el('input');from.type=to.type='time';from.name='open-'+index;to.name='close-'+index;from.value=value.open||'08:00';to.value=value.close||'17:00';from.setAttribute('aria-label','Abertura '+day);to.setAttribute('aria-label','Fecho '+day);from.disabled=to.disabled=value.closed||!canPrepareStore(s);check.onchange=()=>{from.disabled=to.disabled=!check.checked;storeDirty=true;hoursDirty=true;};row.append(label,from,el('span','','–'),to);hours.append(row);});form.querySelectorAll('input,textarea,button').forEach(n=>{if(!n.name?.startsWith('open-')&&!n.name?.startsWith('close-'))n.disabled=!canPrepareStore(s);});storeDirty=false;notice($('merchantStoreSaveNotice'),'');}
 const storeEditor=$('merchantStoreEditor');
 const profileNotice=copy=>notice($('merchantProfileNotice'),copy);
 $('merchantEditProfile').onclick=()=>{
   if(storeBusy||!canPrepareStore(state.store))return;
   renderStoreForm();
   storeEditor.showModal();
 };
 async function closeStoreEditor(){
   if(storeBusy)return;
   if(storeDirty&&!await confirmAction('Sair sem guardar?','As alterações ao perfil continuam por guardar.','Descartar'))return;
   storeDirty=false;
   storeEditor.close();
 }
 $('merchantCloseStoreEditor').onclick=closeStoreEditor;
 storeEditor.oncancel=event=>{event.preventDefault();closeStoreEditor();};

 function renderProfile(){
   publishButton.hidden=!['draft','pending'].includes(state.store?.status);
   const store=state.store;
   if(!store)return;
   const editable=canPrepareStore(store);
   $('merchantEditProfile').hidden=!editable;
   set('merchantStoreDescription',store.description||'');
   $('merchantStoreDescription').hidden=!store.description;
   const details=$('merchantProfileDetails');
   details.replaceChildren();
   for(const [label,value] of [
     ['WhatsApp',store.whatsapp_e164],
     ['Endereço',store.address],
     ['Área de atendimento',store.service_area],
     ['Horário',store.opening_hours?.some(day=>!day.closed)?'Horário semanal definido':'Abertura manual']
   ]){
     if(!value)continue;
     const row=el('div','mw-profile-detail');
     row.append(el('span','',label),el('strong','',value));
     details.append(row);
   }
   const artwork=$('merchantStoreArtwork');
   const fallback=resolveStoreArtwork({id:store.id,isTest:store.is_test===true});
   artwork.replaceChildren();
   for(const [key,kind,label,fallbackUrl] of [
     ['banner_path','cover','Foto de capa',fallback.cover],
     ['logo_path','avatar','Logótipo',fallback.avatar]
   ]){
     const frame=el('div','mw-profile-'+kind);
     const photo=el('button','mw-profile-image');
     photo.type='button';
     photo.setAttribute('aria-label',label);
     if(kind==='avatar')photo.append(el('span','',initials(store.name)));
     else photo.innerHTML=icon('image');
     const img=el('img');
     img.alt='';
     img.hidden=true;
     img.onload=()=>img.hidden=false;
     img.onerror=()=>img.hidden=true;
     photo.append(img);
     const path=store[key];
     if(path)imageUrl(platform,path).then(url=>{if(url&&img.isConnected)img.src=url;});
     else if(fallbackUrl){img.src=fallbackUrl;img.style.objectPosition=kind==='cover'?fallback.coverPosition:fallback.avatarPosition;}
     const actions=()=>openPhotoActions({key,kind,label,img,path,editable});
     photo.onclick=actions;
     photo.disabled=!editable&&!path&&!fallbackUrl;
     frame.append(photo);
     if(editable){
       const edit=el('button','mw-photo-edit');
       edit.type='button';
       edit.setAttribute('aria-label','Opções de '+label.toLocaleLowerCase('pt'));
       edit.innerHTML=icon('image');
       edit.onclick=actions;
       frame.append(edit);
     }
     artwork.append(frame);
   }
 }
 function openPhotoActions({key,kind,label,img,path,editable}){
   if(storeBusy)return;
   const dialog=el('dialog','mw-filter-dialog mw-photo-options');
   const heading=el('h2','',label);
   heading.id='merchantPhotoOptionsTitle';
   dialog.setAttribute('aria-labelledby',heading.id);
   const header=el('header');
   const close=el('button','mw-icon');
   close.type='button';
   close.innerHTML=icon('close');
   close.setAttribute('aria-label','Fechar opções');
   close.onclick=()=>dialog.close();
   header.append(heading,close);
   dialog.append(header);
   function action(label,glyph,handler){
     const button=el('button','mw-photo-option');
     button.type='button';
     button.innerHTML=icon(glyph);
     button.append(document.createTextNode(label));
     button.onclick=()=>{dialog.close();handler();};
     dialog.append(button);
   }
   if(!img.hidden&&img.naturalWidth)action('Ver fotografia','eye',()=>{
     const viewer=document.getElementById('storeArtworkViewer');
     const full=document.getElementById('storeArtworkFull');
     document.getElementById('storeArtworkTitle').textContent=label;
     viewer.dataset.artwork=kind;
     full.alt=label+' de '+state.store.name;
     full.width=img.naturalWidth;
     full.height=img.naturalHeight;
     full.src=img.currentSrc||img.src;
     viewer.onclick=event=>{if(event.target===viewer)viewer.close();};
     viewer.showModal();
   });
   if(editable)action(path||!img.hidden?'Alterar fotografia':'Adicionar fotografia','image',()=>{
     const input=el('input');
     input.type='file';
     input.accept='image/jpeg,image/png,image/webp';
     const storeId=state.store.id;
     input.onchange=()=>{if(state.store?.id===storeId)saveArtwork(key,input.files[0]);};
     input.click();
   });
   if(editable&&path)action('Remover fotografia','trash',async()=>{
     const storeId=state.store.id;
     if(await confirmAction('Remover '+label.toLocaleLowerCase('pt')+'?','A fotografia deixa de aparecer no perfil da loja.','Remover')&&state.store?.id===storeId)saveArtwork(key,null);
   });
   if(dialog.children.length===1)dialog.append(el('p','mw-muted','Fotografia indisponível.'));
   dialog.onclose=()=>dialog.remove();
   document.body.append(dialog);
   dialog.showModal();
 }
 async function saveArtwork(key,file){
   const store=state.store;
   if(storeBusy||!canPrepareStore(store)||file===undefined)return;
   const extension=file&&{'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
   if(file&&(!extension||file.size<1||file.size>5242880)){
     profileNotice('Escolhe JPG, PNG ou WebP até 5 MB.');
     return;
   }
   if(!navigator.onLine){profileNotice('Sem ligação. Tenta novamente quando estiveres online.');return;}
   storeBusy=true;
   profileNotice(file?'A guardar fotografia…':'A remover fotografia…');
   try{
     let path=null;
     if(file){
       const {data:{user},error}=await platform.auth.getUser();
       if(error||!user)throw error||Error();
       if(state.store?.id!==store.id)return;
       path=[user.id,store.id,store.id,crypto.randomUUID()+'.'+extension].join('/');
       const {error:uploadError}=await platform.storage.from('kg-product-images').upload(path,file,{upsert:false,contentType:file.type});
       if(uploadError)throw uploadError;
     }
     if(state.store?.id!==store.id)return;
     const document={name:store.name,whatsapp_e164:store.whatsapp_e164,opening_hours:store.opening_hours||[]};
     for(const field of ['description','location','address','service_area','logo_path','banner_path'])document[field]=store[field]||null;
     document[key]=path;
     const {data,error}=await platform.rpc('kg_save_store_settings',{p_store_id:store.id,p_expected_updated_at:store.updated_at,p_document:document});
     if(error)throw error;
     if(state.store?.id!==store.id)return;
     state.store=data;
     onStoreChanged(data);
     renderProfile();
     profileNotice(file?'Fotografia actualizada.':'Fotografia removida.');
     await onChanged();
   }catch(error){
     if(state.store?.id===store.id)profileNotice(error?.code==='40001'?'A loja mudou noutra sessão. Actualiza e tenta novamente.':'Não foi possível guardar a alteração da fotografia.');
   }finally{storeBusy=false;}
 }
 form.addEventListener('invalid',event=>{const group=event.target.closest('details');if(group)group.open=true;},true);
 form.onsubmit=async e=>{e.preventDefault();if(storeBusy||!canPrepareStore(state.store))return;if(!navigator.onLine){notice($('merchantStoreSaveNotice'),'Sem ligação. As alterações continuam aqui.');return;}const doc=Object.fromEntries(new FormData(form));const document={...Object.fromEntries(['name','description','whatsapp_e164','location','address','service_area'].map(key=>[key,doc[key]||''])),logo_path:storeAssets.logo_path||null,banner_path:storeAssets.banner_path||null,opening_hours:storeHoursDocument(state.store.opening_hours,hoursDirty,Array.from({length:7},(_,day)=>({day,closed:!form.elements['day-'+day].checked,open:form.elements['open-'+day].value,close:form.elements['close-'+day].value})))};document.whatsapp_e164='+'+document.whatsapp_e164.replace(/\D/g,'');storeBusy=true;$('merchantSaveStore').disabled=true;setButtonBusy($('merchantSaveStore'),true);showSpinner($('merchantStoreSaveNotice'));try{const {data,error}=await platform.rpc('kg_save_store_settings',{p_store_id:state.store.id,p_expected_updated_at:state.store.updated_at,p_document:document});if(error)throw error;state.store=data;set('merchantSidebarName',data.name);onStoreChanged(data);storeDirty=false;hoursDirty=false;storeEditor.close();renderProfile();profileNotice('Perfil actualizado.');await onChanged();}catch(error){notice($('merchantStoreSaveNotice'),error.code==='40001'?'A loja mudou noutra sessão. Copia as tuas alterações antes de actualizar.':'Não foi possível confirmar a gravação. Os dados continuam aqui. Actualiza a loja antes de tentar novamente.');}finally{storeBusy=false;setButtonBusy($('merchantSaveStore'),false);$('merchantSaveStore').disabled=false;}};
 $('btnOpenNewProductModal').onclick=()=>composer.open();
 function online(){const offline=!navigator.onLine;notice($('merchantOffline'),offline?'Sem ligação. Podes consultar os dados carregados; as alterações exigem ligação.':'');}window.addEventListener('offline',online);window.addEventListener('online',online);
 async function canLeave(){if(storeBusy)return false;if(!await composer.close())return false;if(storeDirty&&!await confirmAction('Sair sem guardar?','As configurações da loja ainda não foram guardadas.','Descartar'))return false;storeDirty=false;return true;}
 function reset(){generation++;if(storeEditor.open)storeEditor.close();profileNotice('');summary.reset();rows=[];activity=null;storeDirty=false;hoursDirty=false;storeBusy=false;offset=0;tab='resumo';body.dataset.activeTab='resumo';nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-current',b.dataset.destination==='resumo'?'page':'false'));closeMenu();$('merchantProductsList').replaceChildren();$('merchantActivityList').replaceChildren();$('merchantActivityChart').replaceChildren();$('merchantStoreArtwork').replaceChildren();$('merchantOpeningHours').replaceChildren();Object.assign(filters,{q:'',status:'all',category:'',available:'all',min:'',max:'',sort:'recent'});$('merchantSearch').value='';renderFilters();form.reset();body.querySelectorAll('[data-mw]').forEach(n=>n.hidden=n.dataset.mw!=='resumo');}
 window.addEventListener('beforeunload',e=>{if(!view.hidden&&(storeDirty||storeBusy)){e.preventDefault();e.returnValue='';}});
 renderFilters();switchTab('resumo');online();return{load,loadProducts,canLeave,reset,switchTab,syncStoreStatus:summary.syncStatus,isDirty:()=>storeDirty};
}
