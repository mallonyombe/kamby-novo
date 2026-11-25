import {enableModalDismiss, requestModalDismiss, protectModalEdits} from './modal-dismiss.js';
import {listIcon,bindListSearch,paintFilterIcon} from './list-controls.js';
import {platform} from './platform.js';
import {el,icon,icons,money,showProductThumbnail,imageUrl,confirmAction} from './merchant-ui.js';
import {resolveStoreArtwork} from './storefront-artwork.js';
import {initials} from './merchant-domain.js';
import {beginAdminLoad} from './admin-loading.js';
import {setButtonBusy} from './loading.js';
import {areas,storeStates,nextStates,adminError,validateStore} from './admin-domain.js';
enableModalDismiss();
const confirmDiscard = () => confirmAction('Sair sem guardar?', 'As alterações ainda não foram guardadas.', 'Descartar');
icons.users='<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m3 10v-3a5 5 0 0 0-3-4"/>';
icons.categories='<path d="M3 4h7v7H3zm11 0h7v7h-7zM3 15h7v6H3zm11 0h7v6h-7z"/>';
icons.shield='<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm0 4v6m0 3v1"/>';
icons.settings='<circle cx="12" cy="12" r="3"/><path d="m10 2 4 0 1 3 3 1 3 3-1 3 1 3-3 3-3 1-1 3h-4l-1-3-3-1-3-3 1-3-1-3 3-3 3-1 1-3Z"/>';
icons.menu='<path d="M4 6h16M4 12h16M4 18h16"/>';
const root=document.querySelector('#adminRoot');const listPositions=new Map(),listSettings=new Map(),storeNames=new Map(),readCache=new Map();
const storeSectionTitles={catalogo:'Catálogo',acessos:'Responsáveis',historico:'Histórico',identidade:'Editar loja'};
let renderedRoute=null;
let formDirty=false,previousHash=location.hash,restoringHash=false;
let permissions=[],revision=0,toastTimer,sessionVersion=0,currentArea='overview';
const date=v=>v?new Intl.DateTimeFormat('pt-MZ',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Maputo'}).format(new Date(v)):'—';
const can=p=>permissions.includes(p);const $=(selector,within=root)=>within.querySelector(selector);
function feedback(copy){let n=document.querySelector('#adminFeedback');if(!n){n=el('p','feedback');n.id='adminFeedback';n.setAttribute('role','status');document.body.append(n);}n.textContent=copy;n.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.hidden=true,4500);}
function state(node,title,copy,retry,tone='neutral',actionLabel='Tentar novamente'){
  const panel=el('div','state-panel');
  panel.dataset.tone=tone;
  const message=el('div');
  message.setAttribute('role','status');
  message.append(el('h2','',title));
  if(copy)message.append(el('p','',copy));
  panel.append(message);
  if(retry)panel.append(button(actionLabel,'secondary',retry));
  node.replaceChildren(panel);
}
function loadFailure(node,error,retry,subject='os dados'){
  if(error?.code==='42501'||error?.code==='PGRST301'){
    state(node,'Confirma o acesso','Volta a confirmar a sessão de gestor.',start,'warning','Confirmar acesso');
  }else if(error?.code==='P0002'){
    state(node,'Ficha indisponível','A ficha pode ter sido removida.',null,'neutral');
  }else if(!navigator.onLine){
    state(node,'Sem ligação','Volta a ligar-te à internet para continuar.',retry,'warning');
  }else{
    state(node,'Não foi possível carregar '+subject,'Tenta novamente daqui a pouco.',retry,'error');
  }
}
async function rpc(name,args){const {data,error}=await platform.rpc(name,args);if(error)throw error;return data;}
async function read(area,params={}){
  const key=JSON.stringify([area,params]);
  const cached=readCache.get(key);
  if(cached&&cached.expires>Date.now())return cached.data;
  const session=sessionVersion;
  const request=revision;
  const data=await rpc('kg_admin_read',{p_area:area,...params});
  if(session===sessionVersion&&request===revision){
    if(readCache.size>=60)readCache.delete(readCache.keys().next().value);
    readCache.set(key,{data,expires:Date.now()+20000});
  }
  return data;
}
function status(value){const n=el('span','status',storeStates[value]||({published:'Publicado',draft:'Rascunho',archived:'Arquivado',open:'Nova',resolved:'Resolvida',dismissed:'Arquivada'}[value])||value);n.dataset.state=value;return n;}
function heading(title,action){const h=el('header','page-heading'),t=el('div');t.append(el('h1','',title));h.append(t);if(action)h.append(action);return h;}
function button(copy,cls,fn,ico){const b=el('button',cls);b.type='button';if(ico)b.innerHTML=icon(ico);b.append(document.createTextNode(copy));b.onclick=fn;return b;}
const mobileAreas=['overview','stores','moderation'];
function navMarkup(destinations){
  return areas.filter(([id])=>destinations.includes(id)&&can(id+'.read')).map(([id,label,glyph])=>
    '<a href="#'+id+'" data-area="'+id+'">'+icon(glyph)+'<span>'+(id==='overview'?'Início':label)+'</span></a>'
  ).join('');
}

function shell(){
  const brand='<img src="icone.svg" alt="" width="32" height="32"><span>Kamby</span>';
  const primary=navMarkup(mobileAreas);
  const other=navMarkup(areas.map(([id])=>id).filter(id=>!mobileAreas.includes(id)));
  root.innerHTML=`
    <div class="admin-shell">
      <header class="admin-topbar" aria-label="Navegação da gestão">
        <button type="button" class="icon-button admin-drawer-trigger" aria-label="Abrir menu"
          aria-controls="adminDrawer" aria-expanded="false">${icon('menu')}</button>
        <h1 id="adminPrimaryTitle" tabindex="-1"></h1>
        <span id="adminPrimaryActions" class="admin-primary-actions"></span>
      </header>
      <dialog id="adminDrawer" class="admin-drawer" aria-labelledby="adminDrawerTitle">
        <div class="admin-drawer-body">
          <header class="admin-drawer-head">
            <h2 id="adminDrawerTitle">Gestor</h2>
            <button type="button" class="icon-button admin-drawer-close" aria-label="Fechar menu"
              autofocus>${icon('close')}</button>
          </header>
          <nav class="admin-nav" aria-label="Navegação do Gestor">
            ${primary?'<div class="admin-nav-group">'+primary+'</div>':''}
            ${other?'<div class="admin-nav-group">'+other+'</div>':''}
          </nav>
          <div class="admin-drawer-footer">
            <a href="index.html">Abrir Kamby</a>
            <button type="button" data-signout>Terminar sessão</button>
          </div>
        </div>
      </dialog>
      <div id="adminContext"></div>
      <main id="adminMain" tabindex="-1"></main>
    </div>`;
  const drawer=$('#adminDrawer');
  const toggle=$('.admin-drawer-trigger');
  const close=$('.admin-drawer-close');
  toggle.onclick=()=>{
    if(drawer.open)return;
    drawer.showModal();
    toggle.setAttribute('aria-expanded','true');
    const active=$('[aria-current="page"]',drawer);
    (active||close).focus();
  };
  close.onclick=()=>drawer.close();
  drawer.addEventListener('close',()=>{
    if(drawer.open)return;
    toggle.setAttribute('aria-expanded','false');
    if(toggle.getClientRects().length)toggle.focus({preventScroll:true});
  });
  drawer.onclick=event=>{ if(event.target.closest('a'))drawer.close(); };
  $('[data-signout]',drawer).onclick=async event=>{
    const action=event.currentTarget;
    action.disabled=true;
    try{
      const {error}=await platform.auth.signOut({scope:'local'});
      if(error)throw error;
      if(root.contains(drawer))await start();
    }catch{
      feedback('Não foi possível terminar a sessão. Tenta novamente.');
      action.disabled=false;
    }
  };
}
function showRouteHeader(area,id,section){
  const context=$('#adminContext');
  const subpage=Boolean(id);
  $('.admin-shell').dataset.subpage=String(subpage);
  context.replaceChildren();
  const primaryTitle=$('#adminPrimaryTitle');
  const primaryActions=$('#adminPrimaryActions');
  if(primaryActions)primaryActions.replaceChildren();
  if(!subpage){
    primaryTitle.textContent=areas.find(([key])=>key===area)?.[1]||'Gestão';
    return;
  }
  const top=el('header','admin-subbar');
  const back=el('a','detail-back');
  const nested=id&&section!=='resumo';
  const fallback=mobileAreas.find(destination=>can(destination+'.read'));
  back.href=id&&['users','categories'].includes(area)?'#'+area:nested?'#stores/'+id:id?'#stores':fallback?'#'+fallback:'index.html#perfil';
  back.setAttribute('aria-label',nested?'Voltar à loja':id?'Voltar às lojas':'Voltar');
  back.innerHTML=icon('back');
  back.onclick=event=>{
    if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    const target=new URL(back.href).hash;
    const parent=history.state?.adminParent;
    if(parent===target||(parent===''&&target==='#overview')){
      event.preventDefault();
      history.back();
    }
  };
  const title=id?(['users','categories'].includes(area)?(area==='users'?'Utilizador':'Categoria'):(storeSectionTitles[section]||storeNames.get(id)||'Loja')):areas.find(([key])=>key===area)[1];
  const label=el('h1','',title);
  label.tabIndex=-1;
  top.append(back,label,el('span','subbar-spacer'));
  context.append(top);
}

let edgeStart;
root.addEventListener('touchstart',event=>{
  edgeStart=null;
  const back=$('#adminContext .detail-back');
  if(!back||event.touches.length!==1||document.querySelector('dialog[open]')||
     event.target.closest('input,textarea,select,button,a,[contenteditable]'))return;
  const touch=event.touches[0];
  if(touch.clientX<=24)edgeStart={x:touch.clientX,y:touch.clientY,back};
},{passive:true});
root.addEventListener('touchcancel',()=>{edgeStart=null;},{passive:true});
root.addEventListener('touchend',event=>{
  const start=edgeStart;
  edgeStart=null;
  if(!start?.back.isConnected||event.touches.length)return;
  const touch=event.changedTouches[0];
  const distance=touch.clientX-start.x;
  if(distance>=72&&Math.abs(touch.clientY-start.y)<distance*.45)start.back.click();
},{passive:true});

async function route(){
  if(restoringHash){restoringHash=false;return;}
  const main=$('#adminMain');
  if(!main)return;
  const destination=location.hash;
  if(formDirty&&destination!==previousHash){
    if(!await confirmAction('Sair sem guardar?','Os dados editados ainda não foram guardados.','Descartar')){
      restoringHash=true;
      location.hash=previousHash;
      return;
    }
    if(location.hash!==destination)return;
    formDirty=false;
  }
  if(renderedRoute!==null)listPositions.set(renderedRoute,window.scrollY);
  if(!history.state?.adminEntry){
    history.replaceState({...history.state,adminEntry:true,adminParent:renderedRoute},'');
  }
  const refresh=renderedRoute===destination;
  if(refresh)readCache.clear();
  previousHash=destination;
  const request=++revision;
  const [area='overview',id,section='resumo']=destination.slice(1).split('/');
  currentArea=areas.some(([key])=>key===area)?area:'overview';
  const routeArea=currentArea;
  const drawer=$('#adminDrawer');
  if(drawer.open)drawer.close();
  root.querySelectorAll('[data-area]').forEach(node=>{
    if(node.dataset.area===routeArea)node.setAttribute('aria-current','page');
    else node.removeAttribute('aria-current');
  });
  if(!refresh){
    renderedRoute=null;
    main.replaceChildren();
    showRouteHeader(routeArea,id,section);
    window.scrollTo(0,0);
  }
  if(!can(routeArea+'.read')){
    state(main,'Sem acesso','A tua conta não tem autorização para esta área.');
    return;
  }
  const shape=id&&section==='resumo'?'profile':routeArea==='overview'?'metrics':'rows';
  const finish=beginAdminLoad(main,shape);
  try{
    if(['users','categories'].includes(routeArea)&&id)await entityDetail(main,routeArea,id,request);
    else if(routeArea==='stores'&&id)await storeDetail(main,id,request,section);
    else if(routeArea==='overview')await overview(main,request);
    else if(routeArea==='analytics')await analytics(main,request);
    else await listing(main,routeArea,request);
    if(request!==revision)return;
    renderedRoute=destination;
    if(!refresh){
      window.scrollTo(0,listPositions.get(destination)||0);
      const title=$('#adminContext h1')||$('#adminPrimaryTitle')||$('h1',main);
      if(title){title.tabIndex=-1;title.focus({preventScroll:true});}
    }
  }catch(error){
    if(request===revision)loadFailure(main,error,route);
  }finally{
    if(request===revision)finish();
  }
}
async function overview(main,request){
  const data=await read('overview');
  if(request!==revision)return;
  const actions=el('section','operations-queue');
  actions.append(el('h2','section-heading','Por rever'));
  const format=new Intl.NumberFormat('pt-MZ');
  for(const [key,label,target,filter,glyph] of [
    ['reports','Denúncias por rever','moderation','open','shield']
  ]){
    if(!data[key]||!can(target+'.read'))continue;
    const link=el('a','attention-row');
    link.href='#'+target;
    link.onclick=()=>sessionStorage.setItem('kamby:admin-filter:'+target,filter);
    const mark=el('span','queue-icon');
    mark.innerHTML=icon(glyph);
    const arrow=el('span','queue-chevron');
    arrow.innerHTML=icon('next');
    link.append(mark,el('span','queue-label',label),el('strong','queue-count',format.format(data[key])),arrow);
    actions.append(link);
  }
  if(actions.children.length===1)actions.append(el('p','queue-empty','Tudo em dia'));
  main.replaceChildren();
  if(can('analytics.read'))void renderAudience(main,7,request);
  if(can('analytics.read')){
    const activity=el('section','overview-metrics');
    const header=el('div','overview-metrics-heading');
    header.append(el('h2','','Actividade'),el('span','muted','Últimos 7 dias'));
    const values=el('div');
    values.className='overview-pending-metrics';
    const link=el('a','overview-activity');
    link.href='#analytics';
    link.innerHTML='<span>Ver relatório</span>'+icon('next');
    activity.append(header,values,link);
    main.append(activity,actions);
    const finish=beginAdminLoad(values,'metrics');
    try{
      const report=await read('analytics',{p_days:7});
      if(request!==revision)return;
      const metrics=el('dl','overview-metric-grid');
      for(const [key,label] of [['views','Visitas às lojas'],['contacts','Cliques no WhatsApp']]){
        const total=report.rows.reduce((sum,row)=>sum+Number(row[key]||0),0);
        const metric=el('div');
        metric.append(el('dt','',label),el('dd','',format.format(total)));
        metrics.append(metric);
      }
      values.replaceChildren(metrics);
    }catch{
      if(request===revision)values.replaceChildren(el('p','muted','Não foi possível carregar os indicadores.'));
    }finally{finish();}
  }else main.append(actions);
}
const configs={stores:{title:'Lojas',search:'Pesquisar por nome',filters:[['','Todas'],['draft','Em preparação'],['approved','Activas'],['suspended','Suspensas'],['trash','Eliminadas']],empty:'Nenhuma loja encontrada'},products:{title:'Produtos',search:'Pesquisar produto',filters:[['','Todos'],['published','Publicados'],['draft','Rascunhos'],['archived','Arquivados']],empty:'Nenhum produto encontrado'},users:{title:'Utilizadores',search:'Pesquisar por nome',empty:'Nenhuma conta encontrada'},categories:{title:'Categorias',search:'Pesquisar categorias',empty:'Nenhuma categoria encontrada'},moderation:{title:'Moderação',search:'Pesquisar denúncia',filters:[['open','Novas'],['resolved','Resolvidas'],['dismissed','Arquivadas'],['','Todas']],empty:'Sem denúncias nesta fila'},system:{title:'Auditoria',search:'Pesquisar alterações',empty:'Sem eventos encontrados'}};
function stateFilter(choices, current, onApply) {
  const trigger=listIcon('filter','Filtros');
  trigger.setAttribute('aria-haspopup','dialog');
  paintFilterIcon(trigger,current!==choices[0][0]);
  trigger.onclick=()=>{
    const sheet=dialog('Filtros','');
    const form=el('form');
    const label=el('label','field','Estado');
    const select=el('select','filter-select');
    for(const [value,text] of choices)select.append(new Option(text,value));
    select.value=current;
    label.append(select);
    const controls=el('div','dialog-actions');
    const apply=button('Aplicar filtros','primary');
    apply.type='submit';
    controls.append(button('Cancelar','quiet',()=>sheet.close()),apply);
    form.append(label,controls);
    form.onsubmit=event=>{
      event.preventDefault();
      current=select.value;
      paintFilterIcon(trigger,current!==choices[0][0]);
      sheet.close();
      onApply(current);
    };
    sheet.append(form);
    sheet.showModal();
  };
  return trigger;
}
async function listing(main,area,request){const cfg=configs[area];let q=listSettings.get(area)?.q||'',offset=0,total=0,fetchVersion=0,filter=sessionStorage.getItem('kamby:admin-filter:'+area)??listSettings.get(area)?.filter??cfg.filters?.[0][0]??'';sessionStorage.removeItem('kamby:admin-filter:'+area);const search=el('label','search-field');search.innerHTML=icon('search');const input=el('input');input.type='search';input.placeholder=cfg.search;input.setAttribute('aria-label',cfg.search);input.value=q;search.append(input);const toolbar=el('div','toolbar');toolbar.append(search);const list=el('div','data-list'),meta=el('p','list-meta'),more=button('Mais resultados','secondary load-more',()=>load(true));more.hidden=true;
 const actions=el('div','kamby-list-actions');
 const searchButton=listIcon('search','Pesquisar');
 actions.append(searchButton);
 toolbar.id='adminSearchPanel';
 toolbar.classList.add('kamby-search-panel');
 toolbar.hidden=!q;
 bindListSearch(searchButton,toolbar,input);
 const contextualActions=$('#adminContext .subbar-spacer')||$('#adminPrimaryActions');
 if(contextualActions){
  contextualActions.replaceChildren(actions);
  contextualActions.closest('.admin-subbar')?.classList.toggle('has-list-filters',Boolean(cfg.filters));
  main.replaceChildren(toolbar);
 }else{
  main.replaceChildren(heading(cfg.title,actions),toolbar);
 }
 if(cfg.filters){
  actions.append(stateFilter(cfg.filters,filter,value=>{
   clearTimeout(timer);
   filter=value;
   load();
  }));
 }
 main.append(meta,list,more);
 let timer;input.oninput=()=>{clearTimeout(timer);q=input.value.trim();fetchVersion++;timer=setTimeout(()=>load(),250);};
 async function load(append=false){const n=++fetchVersion;if(!append)offset=0;const finish=beginAdminLoad(list);more.disabled=true;list.setAttribute('aria-busy','true');try{listSettings.set(area,{q,filter});const data=await read(area,{p_query:q,p_state:filter,p_offset:offset});if(n!==fetchVersion||request!==revision)return;total=data.total;
 let rows=data.rows;
 if(area==='products'&&rows.length){
   const {data:photos,error}=await platform.from('kg_products').select('*,images:kg_product_images(storage_path,sort_order),variants:kg_product_variants(*)').in('id',rows.map(row=>row.id));
   if(n!==fetchVersion||request!==revision)return;
   if(!error)rows=rows.map(row=>({...row,...photos.find(product=>product.id===row.id)}));
 }
 if(!append)list.replaceChildren();
 for(const row of rows)list.append(renderRow(area,row));offset+=data.rows.length;meta.textContent=total+' '+(area==='stores'?(total===1?'loja encontrada':'lojas encontradas'):(total===1?'resultado':'resultados'));if(!offset)state(list,cfg.empty,q?'Ajusta a pesquisa ou os filtros.':'');more.hidden=offset>=total; }catch(e){if(n===fetchVersion&&request===revision){if(append)feedback(adminError(e));else {meta.textContent='';more.hidden=true;loadFailure(list,e,()=>load(),area==='moderation'?'as denúncias':'a lista');}}}finally{if(n===fetchVersion){more.disabled=false;finish();}}}await load();}
function renderRow(area,row){
 if(area==='system')return auditRow(row);
 if(area==='products'){
   const entry=productRow(row);
   entry.onclick=async()=>{
     entry.disabled=true;
     try{
       const {data,error}=await platform.from('kg_products').select('*,images:kg_product_images(storage_path,sort_order),variants:kg_product_variants(*)').eq('id',row.id).single();
       if(error)throw error;
       openProduct(data);
     }catch{feedback('Não foi possível abrir o produto. Tenta novamente.');}
     finally{entry.disabled=false;}
   };
   return entry;
 }
 if(area==='stores'){storeNames.set(row.id,row.name);const b=button('','store-row',()=>{location.hash='stores/'+row.id;});const mark=el('span','store-mark');mark.innerHTML=icon('store');const text=el('div');text.append(el('p','row-title',row.name),el('p','row-sub',(row.merchant_name||'Responsável por atribuir')+' · '+row.product_count+' produtos'));b.append(mark,text,status(row.status),el('span','chevron','›'));return b;}
 const n=el('article','simple-row'),top=el('div','simple-row-top');top.append(el('p','row-title',row.title||row.display_name||row.name||row.action||(row.target_type==='store'?'Denúncia de loja':'Denúncia de produto')));if(row.status)top.append(status(row.status));n.append(top);
 if(area==='products'){n.append(el('p','row-sub',row.store_name+' · '+(row.category_name||'Sem categoria')),el('p','',money(row.price_minor)));if(row.moderation_status==='blocked')n.append(el('p','row-sub','Produto oculto pela moderação'));}
 if(area==='users'){
   const seller=Boolean(row.seller_active||row.stores);
   const card=button('', 'store-row',()=>{location.hash='users/'+row.id;});
   const mark=el('span','store-mark');mark.innerHTML=icon('users');
   const copy=el('span');copy.append(el('span','row-title',row.display_name),el('span','row-sub',sellerStateLabel(row,seller)));
   const next=el('span','chevron');next.innerHTML=icon('next');
   card.append(mark,copy,next);
   return card;
 }
 if(area==='categories'){
 const entry=button('', 'store-row',()=>{location.hash='categories/'+row.id;});
 const copy=el('span');copy.append(el('span','row-title',row.name),el('span','row-sub',row.products+' produtos'));
 entry.append(copy);entry.insertAdjacentHTML('beforeend',icon('next'));return entry;
 }
 if(area==='moderation'){
   n.append(el('p','row-sub',row.reason),el('p','caption',date(row.created_at)));
   n.append(button('Rever denúncia','quiet',()=>reviewReport(row)));
 }

 return n;}
async function reviewReport(report){
  const sheet=dialog('Rever denúncia',report.reason);
  sheet.append(el('p','caption',date(report.created_at)));
  const targetId=report.target_id;
  if(targetId){
    const link=el('a','secondary','Abrir conteúdo denunciado');
    link.href='index.html#'+(report.target_type==='store'?'loja/':'produto/')+targetId;
    sheet.append(link);
  }
  if(report.status==='open'){
    const form=el('form');
    protectModalEdits(sheet, form, confirmDiscard);
    const reason=field(form,'Motivo da decisão','reason','','textarea',2000);
    reason.required=true;
    reason.minLength=3;
    const decision=el('select');
    decision.setAttribute('aria-label','Decisão');
    decision.append(new Option('Marcar como resolvida','resolved'),new Option('Arquivar denúncia','dismissed'));
    const error=el('p','field-error');
    error.setAttribute('role','alert');
    const submit=button('Guardar decisão','primary');
    submit.type='submit';
    form.append(decision,error,submit);
    form.onsubmit=async event=>{
      event.preventDefault();
      if(!form.reportValidity()||submit.disabled)return;
      submit.disabled=true;
      setButtonBusy(submit,true);
      try{
        await rpc('kg_resolve_report',{p_report_id:report.id,p_status:decision.value,p_reason:reason.value.trim()});
        sheet.close();
        feedback('Decisão guardada.');
        await route();
      }catch(failure){error.textContent=adminError(failure);}
      finally{submit.disabled=false;setButtonBusy(submit,false);}
    };
    sheet.append(form);
  }else if(report.resolution_reason)sheet.append(el('p','',report.resolution_reason));
  if(can('stores.write')&&product.updated_at){
   const controls=el('div','dialog-actions'),error=el('p','field-error');error.setAttribute('role','status');sheet.append(error);
   const choices=product.moderation_status==='blocked'?[['allow','Permitir no catálogo']]:product.status==='archived'?[['restore','Restaurar rascunho']]:product.status==='published'?[['hide','Ocultar do público'],['archive','Arquivar']]:[['publish','Publicar'],['archive','Arquivar']];
   for(const [action,label] of choices){
    const control=button(label,'secondary',async()=>{
     if(!await confirmAction(label+'?',product.title,'Confirmar'))return;
     control.disabled=true;setButtonBusy(control,true);
     try{await rpc('kg_admin_product_action',{p_id:product.id,p_action:action,p_expected:product.updated_at});sheet.close();readCache.clear();feedback('Produto actualizado.');await route();}
     catch(failure){error.textContent=adminError(failure);}
     finally{control.disabled=false;setButtonBusy(control,false);}
    });controls.append(control);
   }
   sheet.append(controls);
  }
  sheet.append(button('Fechar','quiet',()=>requestModalDismiss(sheet)));
  sheet.showModal();
}
function field(form,label,name,value='',type='text',max){const l=el('label','field',label),input=el(type==='textarea'?'textarea':'input');input.name=name;input.value=value||'';if(type!=='textarea')input.type=type;else input.rows=3;if(max)input.maxLength=max;l.append(input);form.append(l);return input;}
function identityForm(store={},onSave){const form=el('form','admin-identity-form');field(form,'Nome da loja','name',store.name,'text',80).required=true;field(form,'WhatsApp comercial','whatsapp_e164',store.whatsapp_e164,'tel',20).required=true;field(form,'Localidade','location',store.location,'text',120);field(form,'Descrição','description',store.description,'textarea',2000);const error=el('p','field-error');error.setAttribute('role','alert');form.append(error);const save=button(store.id?'Rever alterações':'Continuar','primary');save.type='submit';form.append(save);form.onsubmit=async e=>{e.preventDefault();const values=Object.fromEntries(new FormData(form));error.textContent=validateStore(values);if(error.textContent)return;await onSave(values);};return form;}
const auditFields={
  name:['Nome','Nome da loja alterado'],description:['Descrição','Descrição alterada'],
  whatsapp_e164:['WhatsApp','WhatsApp alterado'],location:['Localidade','Localidade alterada'],
  address:['Endereço','Endereço alterado'],service_area:['Área de atendimento','Área de atendimento alterada'],
  opening_hours:['Horário','Horário alterado'],is_open:['Atendimento','Atendimento alterado'],
  status:['Estado','Estado da loja alterado'],logo_path:['Logótipo','Logótipo alterado'],banner_path:['Capa','Capa alterada']
};
const auditDay=new Intl.DateTimeFormat('pt-MZ',{day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Maputo'});
const auditTime=new Intl.DateTimeFormat('pt-MZ',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Maputo'});
function auditValue(field,value){
  if(value==null||value==='')return '—';
  if(field==='status')return storeStates[value]||String(value);
  if(field==='is_open')return value?'Aberto':'Fechado';
  if(field==='logo_path'||field==='banner_path')return 'Imagem definida';
  if(field==='opening_hours'&&Array.isArray(value)){
    const days=['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
    return value.length?value.map(day=>days[day.day]+' · '+(day.closed?'Fechado':day.open+'–'+day.close)).join('\n'):'Sem horário definido';
  }
  return String(value);
}
function auditRow(event,actorName='',localHistory=false){
  const meta=event.metadata||{};
  const changes=Object.entries(meta.changes||{}).filter(([field])=>Object.hasOwn(auditFields,field));
  const details=el('details','audit-event');
  const summary=el('summary');
  const copy=el('span');
  copy.append(el('strong','row-title',changes.length===1?auditFields[changes[0][0]][1]:auditTitle(event.action)));
  const actor=meta.actor_name||actorName;
  const fields=changes.length>1?changes.map(([field])=>auditFields[field][0]).join(', '):'';
  const context=[actor,fields].filter(Boolean).join(' · ');
  if(context)copy.append(el('span','row-sub',context));
  const when=el('time','audit-time',localHistory?auditTime.format(new Date(event.created_at)):date(event.created_at));
  when.dateTime=event.created_at;
  const arrow=el('span');
  arrow.innerHTML=icon('next');
  summary.append(copy,when,arrow);
  const content=el('div','audit-content');
  if(localHistory){
    const exactTime=new Intl.DateTimeFormat('pt-MZ',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Africa/Maputo'});
    content.append(el('p','','Hora · '+exactTime.format(new Date(event.created_at))));
  }
  if(!actor)content.append(el('p','','Responsável indisponível'));
  if(meta.reason)content.append(el('p','',meta.reason));
  const before=meta.before_status||meta.previous_status;
  const after=meta.after_status||meta.status;
  if(before&&after&&before!==after&&!changes.some(([field])=>field==='status')){
    changes.push(['status',{before,after}]);
  }
  for(const [field,values] of changes){
    const change=el('dl','audit-change');
    const isImage=field==='logo_path'||field==='banner_path';
    change.append(el('dt','',auditFields[field][0]));
    if(isImage){
      change.append(el('dd','',values.before&&values.after?'Imagem substituída':values.after?'Imagem adicionada':'Imagem removida'));
    }else{
      change.append(el('dd','','Antes · '+auditValue(field,values.before)),el('dd','','Depois · '+auditValue(field,values.after)));
    }
    content.append(change);
  }
  if(!changes.length&&['store.updated','admin.store.identity'].includes(event.action)){
    content.append(el('p','','Os campos alterados não ficaram registados.'));
  }
  if(event.resource_id||event.actor_id){
    const references=el('details','audit-details');
    references.append(el('summary','','Dados técnicos'));
    if(event.resource_id)references.append(el('p','safe-id','Recurso · '+event.resource_id));
    if(event.actor_id)references.append(el('p','safe-id','Responsável · '+event.actor_id));
    content.append(references);
  }
  details.append(summary,content);
  return details;
}

function auditTitle(action=''){
  const exact={
    'admin.store.identity':'Dados da loja actualizados',
    'admin.store.access':'Acesso à loja alterado',
    'admin.store.decision':'Estado da loja alterado',
    'store.updated':'Dados da loja alterados',
    'admin.user.seller_activated':'Modo vendedor activado','store.created':'Loja criada','store.published':'Loja publicada',
    'store.suspended':'Loja suspensa','store.unpublished':'Loja retirada do catálogo'
  };
  if(exact[action])return exact[action];
  const entity=action.includes('variant')?'Variante':action.includes('product')?'Produto':action.includes('store')?'Loja':action.includes('report')?'Denúncia':'Registo';
  const verb=/delete|remove/.test(action)?'removido':/insert|creat/.test(action)?'criado':'actualizado';
  return entity+' '+(entity==='Loja'||entity==='Variante'||entity==='Denúncia'?verb.replace(/o$/,'a'):verb);
}

function storePhoto(store,kind){
  const frame=el('span','admin-store-photo '+kind);
  frame.append(el('span','',kind==='avatar'?initials(store.name):''));
  const image=el('img');
  image.alt='';
  image.hidden=true;
  image.onload=()=>image.hidden=false;
  image.onerror=()=>image.hidden=true;
  frame.append(image);
  const fallback=resolveStoreArtwork({id:store.id,isTest:store.is_test===true});
  const path=store[kind==='avatar'?'logo_path':'banner_path'];
  if(kind==='cover'&&!path&&!fallback.cover){frame.hidden=true;}
  if(path)imageUrl(platform,path).then(url=>{if(url&&image.isConnected)image.src=url;});
  else if(fallback[kind==='avatar'?'avatar':'cover'])image.src=fallback[kind==='avatar'?'avatar':'cover'];
  return frame;
}

async function storeDetail(main,id,request,section){
  if(!/^[\da-f-]{36}$/i.test(id))throw {code:'P0002'};
  const data=await read('store',{p_store_id:id});
  if(request!==revision)return;
  const store=data.store;
  storeNames.set(id,store.name);
  const title=$('#adminContext h1');
  if(title&&section==='resumo')title.textContent=store.name;
  const content=el('section','store-content');
  main.replaceChildren(content);

  if(section==='resumo'){
    const profile=el('div','admin-store-profile');
    profile.append(storePhoto(store,'cover'),storePhoto(store,'avatar'));
    content.append(profile,status(store.status));
    if(store.location)content.append(el('p','row-sub',store.location));
    if(store.description)content.append(el('p','store-description',store.description));
    const actions=el('div','store-profile-actions');
    if(store.status==='approved'){
      const preview=el('a','secondary','Ver loja pública');
      preview.href='index.html#loja/'+id;
      actions.append(preview);
    }
    if(can('stores.write'))actions.append(button('Editar loja','quiet',()=>location.hash='stores/'+id+'/identidade','edit'));
    content.append(actions);
    const navigation=el('nav','store-sections');
    navigation.setAttribute('aria-label','Gestão da loja');
    for(const [key,label,glyph,allowed] of [
      ['catalogo','Catálogo','products',can('products.read')],
      ['acessos','Responsáveis','users',can('stores.access')],
      ['historico','Histórico','activity',can('system.read')]
    ]){
      if(!allowed)continue;
      const link=el('a','store-section-link');
      link.href='#stores/'+id+'/'+key;
      link.innerHTML=icon(glyph);
      link.append(el('span','',label));
      const arrow=el('span','chevron');
      arrow.innerHTML=icon('next');
      link.append(arrow);
      navigation.append(link);
    }
    content.append(navigation);
    if(can('stores.decide')){
     const operation=store.deleted_at?'restore':'trash';
     const action=button(store.deleted_at?'Restaurar loja':'Eliminar loja','secondary',async()=>{
      if(!await confirmAction(store.deleted_at?'Restaurar loja?':'Eliminar loja?','A loja e os produtos ficam guardados na lixeira. A reposição mantém a loja encerrada até à reactivação.','Confirmar'))return;
      action.disabled=true;
      try{await rpc('kg_admin_store_bin',{p_store_id:id,p_action:operation,p_name:store.name,p_expected_updated_at:store.updated_at});readCache.clear();feedback('Estado actualizado.');await route();}
      catch(error){feedback(adminError(error));}finally{action.disabled=false;}
     });
     content.append(action);
    }

    const decisions=nextStates(store.status).filter(next=>!['draft','pending'].includes(store.status)||next==='closed');
    if(can('stores.decide')&&decisions.length){
      const options=button('Gerir estado da loja','quiet',()=>{
        const sheet=dialog('Estado da loja',storeStates[store.status]);
        for(const next of decisions){
          const label={approved:'Reactivar loja',suspended:'Suspender loja',closed:'Encerrar loja',rejected:'Recusar loja',draft:'Reabrir como rascunho'}[next];
          sheet.append(button(label,'store-section-link',()=>{
            sheet.close();
            writeDialog(store,'decision',{status:next},label,next==='approved'
              ?'Os clientes vão poder ver a loja e os produtos aprovados.'
              :'A loja deixa de aparecer no Kamby e de receber novos pedidos.');
          }));
        }
        sheet.append(button('Cancelar','quiet',()=>sheet.close()));
        sheet.showModal();
      });
      content.append(options);
    }
    return;
  }
  if(section==='identidade'){
    if(!can('stores.write'))return state(content,'Só consulta','Sem permissão para editar esta loja.');
    const form=identityForm(store,values=>writeDialog(store,'identity',values,'Guardar alterações','Os clientes vão ver os novos dados na página da loja.'));
    form.addEventListener('input',()=>formDirty=true);
    content.append(form);
    return;
  }
  if(section==='acessos'){
    if(!can('stores.access'))return state(content,'Sem acesso','Sem permissão para gerir responsáveis.');
    for(const member of data.members.filter(member=>member.active)){
      const row=el('a','member-row');row.href='#users/'+member.user_id;
      const avatar=el('span','entity-avatar',initials(member.display_name||''));
      row.append(avatar,el('span','row-title',member.display_name||'Responsável'),el('span','row-sub',member.joined_at?'Desde '+date(member.joined_at):'Responsável activo'));
      if(member.has_photo)platform.storage.from('kg-profile-photos').createSignedUrl(member.user_id+'/avatar',300).then(({data})=>{if(data?.signedUrl&&avatar.isConnected){const image=el('img');image.alt='';image.src=data.signedUrl;avatar.replaceChildren(image);}});

      content.append(row);
    }
    if(!data.members.some(member=>member.active))content.append(el('p','muted','Sem responsável activo.'));
    return;
  }
  if(section==='historico'){
    if(!can('system.read'))return state(content,'Sem acesso','Sem permissão para consultar o histórico.');
    if(!data.history.length)content.append(el('p','muted','Sem alterações registadas.'));
    let currentDay;
    const actors=new Map(data.members.map(member=>[member.user_id,member.display_name]));
    const sorted=[...data.history].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
    for(const event of sorted){
      const day=auditDay.format(new Date(event.created_at));
      if(day!==currentDay){content.append(el('h2','audit-day',day));currentDay=day;}
      content.append(auditRow({...event,resource_id:id},actors.get(event.actor_id),true));
    }
    return;
  }
  if(section==='catalogo'){
    const key='store-catalogue:'+id;
    const previous=listSettings.get(key);
    let filter=previous?.filter||'published';
    let generation=0,offset=0,timer;
    const tools=el('div','toolbar kamby-search-panel');
    tools.id='storeCatalogueSearch';
    const field=el('label','search-field');
    field.innerHTML=icon('search');
    const search=el('input');
    search.type='search';
    search.placeholder='Pesquisar nesta loja';
    search.setAttribute('aria-label',search.placeholder);
    search.value=previous?.q||'';
    field.append(search);
    tools.append(field);
    tools.hidden=!search.value;
    const actions=el('div','kamby-list-actions');
    const searchButton=listIcon('search','Pesquisar');
    bindListSearch(searchButton,tools,search);
    actions.append(searchButton,stateFilter([['published','Publicados'],['draft','Rascunhos'],['archived','Arquivados']],filter,value=>{
      clearTimeout(timer);
      filter=value;
      load();
    }));
    const context=$('#adminContext .subbar-spacer');
    if(context){
      context.closest('.admin-subbar').classList.add('has-list-filters');
      context.replaceChildren(actions);
    }else content.append(actions);
    const list=el('div');
    const more=button('Mais produtos','secondary load-more',()=>load(true));
    more.hidden=true;
    content.append(tools,list,more);
    async function load(append=false){
      const current=++generation;
      if(!append)offset=0;
      const finish=beginAdminLoad(list);
      more.disabled=true;
      try{
        listSettings.set(key,{q:search.value.trim(),filter});
        let query=platform.from('kg_products').select('*,images:kg_product_images(storage_path,sort_order),variants:kg_product_variants(*)',{count:'exact'}).eq('store_id',id).eq('status',filter);
        if(search.value.trim())query=query.ilike('title','%'+search.value.trim().replace(/[\\%_]/g,'\\$&')+'%');
        const {data:products,count,error}=await query.order('created_at',{ascending:false}).order('id').range(offset,offset+29);
        if(error)throw error;
        if(current!==generation||request!==revision)return;
        if(!append)list.replaceChildren();
        for(const product of products)list.append(productRow(product));
        offset+=products.length;
        more.hidden=offset>=count;
        if(!offset)list.append(el('p','muted','Sem produtos neste filtro.'));
      }catch(error){
        if(current===generation&&request===revision){
          if(append)feedback('Não foi possível carregar mais produtos.');
          else loadFailure(list,error,()=>load(),'o catálogo');
        }
      }finally{if(current===generation){more.disabled=false;finish();}}
    }
    search.oninput=()=>{clearTimeout(timer);generation++;timer=setTimeout(()=>load(),220);};
    await load();
  }
}

function productRow(product){
  const row=button('','admin-product-row',()=>openProduct(product));
  const img=el('img');
  img.alt='';
  const photo=el('span','product-thumbnail');
  photo.innerHTML=icon('image');
  photo.append(img);
  const copy=el('span','product-row-copy');
  const prices=(product.variants||[]).filter(v=>v.active!==false).map(v=>Number(v.price_minor));
  if(!prices.length)prices.push(Number(product.price_minor));
  const minimum=Math.min(...prices);
  copy.append(el('strong','',product.title),el('span','row-sub',(new Set(prices).size>1?'Desde ':'')+money(minimum)));
  copy.append(el('span','row-sub',({published:'Publicado',draft:'Rascunho',archived:'Arquivado'})[product.status]||''));
  if(product.store_name)copy.append(el('span','row-sub',product.store_name));
  if(product.moderation_status==='blocked')copy.append(el('span','row-sub','Produto oculto pela moderação'));
  row.append(photo,copy);
  const arrow=el('span','chevron');
  arrow.innerHTML=icon('next');
  row.append(arrow);
  queueMicrotask(()=>{if(img.isConnected)showProductThumbnail(platform,product,img);});
  return row;
}

function openProduct(product){
  const sheet=dialog(product.title,'');
  const gallery=el('div','admin-product-gallery');
  const image=el('img');
  image.alt=product.title;
  gallery.append(image);
  sheet.append(gallery);
  showProductThumbnail(platform,product,image);
  sheet.append(el('p','product-detail-price',money(product.price_minor)));
  if(product.previous_price_minor>product.price_minor)sheet.append(el('del','row-sub',money(product.previous_price_minor)));
  if(product.description)sheet.append(el('p','product-description',product.description));
  for(const variant of product.variants||[]){
    if(variant.active===false)continue;
    const row=el('div','member-row');
    row.append(el('span','',variant.option_name),el('strong','',money(variant.price_minor)));
    sheet.append(row);
  }
  const publicLink=el('a','secondary','Ver produto na loja');
  publicLink.href='index.html#produto/'+product.id;
  if(product.status==='published')sheet.append(publicLink);
  if(can('stores.write')&&product.updated_at){
   const controls=el('div','dialog-actions'),error=el('p','field-error');error.setAttribute('role','status');sheet.append(error);
   const choices=product.moderation_status==='blocked'?[['allow','Permitir no catálogo']]:product.status==='archived'?[['restore','Restaurar rascunho']]:product.status==='published'?[['hide','Ocultar do público'],['archive','Arquivar']]:[['publish','Publicar'],['archive','Arquivar']];
   for(const [action,label] of choices){
    const control=button(label,'secondary',async()=>{
     if(!await confirmAction(label+'?',product.title,'Confirmar'))return;
     control.disabled=true;setButtonBusy(control,true);
     try{await rpc('kg_admin_product_action',{p_id:product.id,p_action:action,p_expected:product.updated_at});sheet.close();readCache.clear();feedback('Produto actualizado.');await route();}
     catch(failure){error.textContent=adminError(failure);}
     finally{control.disabled=false;setButtonBusy(control,false);}
    });controls.append(control);
   }
   sheet.append(controls);
  }
  sheet.append(button('Fechar','quiet',()=>requestModalDismiss(sheet)));
  sheet.showModal();
}

function dialog(title,copy){const d=el('dialog','admin-dialog'),h=el('h2','',title);h.id='adminDialogTitle';d.setAttribute('aria-labelledby',h.id);d.append(h);if(copy)d.append(el('p','dialog-impact',copy));d.addEventListener('close',()=>d.remove());document.body.append(d);return d;}
async function writeDialog(store,operation,document,title,copy){
 const sheet=dialog(title,copy),form=el('form');
 protectModalEdits(sheet, form, confirmDiscard);
 const reason=field(form,'Motivo da alteração','reason','','textarea',2000);
 reason.required=true;
 reason.minLength=3;
 const error=el('p','field-error');
 error.setAttribute('role','alert');
 const actions=el('div','dialog-actions'),cancel=button('Cancelar','secondary',()=>requestModalDismiss(sheet));
 const submit=button('Confirmar','primary');
 submit.type='submit';
 actions.append(cancel,submit);
 form.append(error,actions);
 sheet.append(form);
 const requestId=crypto.randomUUID();
 form.onsubmit=async event=>{
  event.preventDefault();
  if(submit.disabled||!form.reportValidity())return;
  submit.disabled=cancel.disabled=true;
  setButtonBusy(submit,true);
  try{
   await rpc('kg_admin_store_write',{p_request_id:requestId,p_store_id:store.id,p_expected_updated_at:store.updated_at,p_operation:operation,p_document:document,p_reason:reason.value.trim()});
   sheet.close();
   formDirty=false;
   feedback('Alteração guardada.');
   await route();
  }catch(failure){
   error.textContent=adminError(failure);
   if(failure.code==='40001'){
    submit.hidden=true;
    actions.append(button('Actualizar ficha','secondary',()=>{sheet.close();route();}));
   }
  }finally{submit.disabled=cancel.disabled=false;setButtonBusy(submit,false);}
 };
 sheet.showModal();
 reason.focus();
}
function sellerStateLabel(row,seller){
 const labels={
   customer:'Cliente',activated:'Modo vendedor activo',preparing:'Loja em preparação',
   public:'Loja pública',paused:'Atendimento pausado',suspended:'Loja suspensa',closed:'Loja encerrada'
 };
 return labels[row.seller_state]||(seller?'Vendedor':'Cliente');
}
async function entityDetail(main,area,id,request){
 let offset=0;
 const data=await rpc('kg_admin_detail',{p_kind:area,p_id:id,p_offset:0});
 if(request!==revision)return;
 const item=data.record;
 main.replaceChildren();
 const profile=el('section','entity-profile');
 if(area==='users'){
  const avatar=el('span','entity-avatar',initials(item.display_name||''));
  if(item.has_photo)platform.storage.from('kg-profile-photos').createSignedUrl(item.id+'/avatar',300).then(({data})=>{if(data?.signedUrl&&avatar.isConnected){const image=el('img');image.src=data.signedUrl;image.alt='';avatar.replaceChildren(image);}});
  profile.append(avatar);
 }
 profile.append(el('h1','',item.display_name||item.name));
 main.append(profile);
 const fields=el('dl','admin-detail-fields');
 const field=(label,value)=>{const block=el('div');block.append(el('dt','',label),el('dd','',value||'Não indicado'));fields.append(block);};
 if(area==='users'){
  if(item.email)field('Email',item.email);
  if(item.phone)field('Telefone',item.phone);
  if(item.location)field('Localização',item.location);
  field('Conta criada',date(item.created_at));
  if(item.last_sign_in_at)field('Último início de sessão',date(item.last_sign_in_at));
  field('Modo vendedor',data.seller_active||data.total?'Activado':'Cliente');
  main.append(fields);
  if(!data.seller_active&&!data.total&&can('stores.access')){
   main.append(button('Activar modo vendedor','secondary',()=>openUserCard(item,false)));
  }
 }else{
  field('Endereço da categoria',item.slug);field('Estado',item.is_active?'Activa':'Inactiva');
  main.append(fields);
  if(can('stores.write')){
   const form=el('form','admin-detail-fields');
   const name=el('label','','Nome da categoria'),input=el('input');input.value=item.name;input.required=true;input.maxLength=60;name.append(input);
   const label=el('label'),active=el('input');active.type='checkbox';active.checked=item.is_active;label.append(active,document.createTextNode('Categoria activa'));
   const save=button('Guardar alterações','primary');save.type='submit';
   const error=el('p','field-error');error.setAttribute('role','status');
   form.append(name,label,error,save);
   input.oninput=active.onchange=()=>{formDirty=true;};
   form.onsubmit=async event=>{
    event.preventDefault();if(save.disabled)return;
    save.disabled=true;setButtonBusy(save,true);
    try{
     const {data:changed,error:failure}=await platform.from('kg_categories').update({name:input.value.trim(),is_active:active.checked}).eq('id',id).eq('name',item.name).eq('is_active',item.is_active).select('id').maybeSingle();
     if(failure)throw failure;
     if(!changed)throw {code:'40001'};
     formDirty=false;feedback('Categoria actualizada.');await route();
    }catch(failure){error.textContent=adminError(failure);}
    finally{save.disabled=false;setButtonBusy(save,false);}
   };
   main.append(form);
  }
 }
 main.append(el('h2','entity-section-title',area==='users'?'Lojas associadas':'Produtos nesta categoria'));
 const list=el('div','data-list'),more=button('Mais resultados','secondary',()=>load());
 main.append(list,more);
 function paint(rows){
  for(const row of rows){
   if(area==='users'){
    const link=el('a','store-row');link.href='#stores/'+row.id;
    link.append(el('span','row-title',row.name),status(row.status),el('span','row-sub',row.active?'Acesso activo':'Acesso revogado'));list.append(link);
   }else list.append(renderRow('products',row));
  }
 }
 async function load(){
  more.disabled=true;
  try{
   const next=await rpc('kg_admin_detail',{p_kind:area,p_id:id,p_offset:offset});
   if(request!==revision)return;
   paint(next.rows);offset+=next.rows.length;more.hidden=offset>=next.total;
  }catch(failure){feedback(adminError(failure));}
  finally{more.disabled=false;}
 }
 paint(data.rows);offset=data.rows.length;more.hidden=offset>=data.total;
 if(!data.rows.length)list.append(el('p','muted',area==='users'?'Sem lojas associadas.':'Sem produtos nesta categoria.'));
}
function openUserCard(row,seller){
 const sheet=dialog(row.display_name,sellerStateLabel(row,seller));
 sheet.append(el('p','caption','Conta criada em '+date(row.created_at)));
 const actions=el('div','dialog-actions');
 const close=button('Fechar','quiet',()=>sheet.close());
 actions.append(close);
 if(!seller&&can('stores.access')){
  const activate=button('Activar modo vendedor','primary',async()=>{
   if(activate.disabled)return;
   activate.disabled=true;
   close.disabled=true;
   setButtonBusy(activate,true);
   try{
    await rpc('kg_admin_activate_seller',{p_user_id:row.id});
    sheet.close();
    feedback('Modo vendedor activo.');
    await route();
   }catch(failure){error.textContent=adminError(failure);}
   finally{
    activate.disabled=false;
    close.disabled=false;
    setButtonBusy(activate,false);
   }
  });
  const error=el('p','field-error');
  error.setAttribute('role','alert');
  sheet.append(error);
  actions.append(activate);
 }
 sheet.append(actions);
 sheet.showModal();
 close.focus();
}
async function renderAudience(container,days,request){
 const section=el('section','admin-audience');section.append(el('h2','','Utilização do Kamby'));container.append(section);
 const finish=beginAdminLoad(section,'metrics');
 try{
  const data=await rpc('kg_admin_audience',{p_days:days});
  if(request!==revision||!section.isConnected)return;
  const values=el('dl');
  for(const [key,label] of [['sessions','Sessões'],['active_devices','Dispositivos activos'],['returning_devices','Recorrentes']]){
   const cell=el('div');cell.append(el('dt','',label),el('dd','',Number(data[key]||0).toLocaleString('pt-MZ')));values.append(cell);
  }
  section.append(values,el('p','caption',data.started_at?'Recolha desde '+date(data.started_at):'A recolha começa com as próximas visitas.'));
  const help=el('details');help.append(el('summary','','Como são medidos'));
  help.append(el('p','caption','Uma sessão termina após 30 minutos sem actividade. Activos e recorrentes contam navegadores deste período. Recorrentes têm pelo menos duas sessões. Os dados são conservados por 90 dias.'));
  section.append(help);
 }catch{section.append(el('p','muted','Métricas de utilização indisponíveis.'));}finally{finish();}
}
async function analytics(main,request){let days=7;const select=el('select','filter-select admin-period-select');select.setAttribute('aria-label','Período de actividade');for(const value of [7,30]){const o=el('option','',value+' dias');o.value=value;select.append(o);}const content=el('div');const actions=$('#adminPrimaryActions');if(actions)actions.replaceChildren(select);main.replaceChildren(content);let n=0;async function load(){const version=++n;const finish=beginAdminLoad(content,'chart');try{const data=await read('analytics',{p_days:days});if(request!==revision||version!==n)return;content.replaceChildren();const legend=el('div','legend');legend.append(el('span','','Visitas às lojas'),el('span','','Cliques WhatsApp'));content.append(legend);const graph=el('div','analytics-bars');graph.setAttribute('aria-hidden','true');const max=Math.max(1,...data.rows.flatMap(r=>[r.views,r.contacts]));for(const day of data.rows){const bar=el('div','day-bar');for(const value of [day.views,day.contacts]){const line=el('span');line.style.height=(Number(value)/max*100)+'%';bar.append(line);}graph.append(bar);}const totals=el('dl','traffic-totals');
 for(const [key,label] of [['views','Visitas às lojas'],['contacts','Cliques no WhatsApp']]){
   const item=el('div');
   item.append(el('dt','',label),el('dd','',data.rows.reduce((sum,day)=>sum+Number(day[key]||0),0).toLocaleString('pt-MZ')));
   totals.append(item);
 }
 content.prepend(totals);
 content.append(graph);const table=el('table');table.innerHTML='<caption class="caption">Eventos registados · dias em Maputo</caption><thead><tr><th scope="col">Dia</th><th scope="col">Visitas</th><th scope="col">Cliques WhatsApp</th></tr></thead>';const tbody=el('tbody');for(const day of data.rows){const tr=el('tr');for(const value of [day.day,day.views,day.contacts])tr.append(el('td','',value));tbody.append(tr);}table.append(tbody);const values=el('details','audit-details');
 values.append(el('summary','','Consultar valores diários'),table);
 content.append(values);await renderAudience(content,days,request);}catch(e){if(version===n)state(content,'Não foi possível actualizar',adminError(e),load);}finally{if(version===n)finish();}}select.onchange=()=>{days=Number(select.value);load();};await load();}
async function start(){const version=++sessionVersion;permissions=[];++revision;readCache.clear();renderedRoute=null;root.replaceChildren();const pending=el('div','auth-shell');root.append(pending);const finish=beginAdminLoad(pending,'account');try{const {data:{session}}=await platform.auth.getSession();if(version!==sessionVersion)return;if(!session){login();return;}const context=await rpc('kg_admin_context');if(version!==sessionVersion)return;if(context.mfa_required){await mfa(version);return;}permissions=context.permissions;shell();await route();}catch(e){if(version!==sessionVersion)return;root.replaceChildren();const wrap=el('div','auth-shell');state(wrap,e.code==='42501'?'Sem acesso':'Administração indisponível',adminError(e),start);wrap.append(button('Terminar sessão','quiet',async()=>{await platform.auth.signOut({scope:'local'});start();}));root.append(wrap);}finally{finish();}}
function authWrap(title,copy){const wrap=el('main','auth-shell');wrap.innerHTML='<div class="auth-brand"><img src="icone.svg" alt="">Kamby</div>';wrap.append(el('h1','',title),el('p','muted',copy));root.replaceChildren(wrap);return wrap;}
function login(){const wrap=authWrap('Administração','Usa a mesma conta do Kamby. O acesso administrativo exige autorização e confirmação de segurança.'),link=el('a','primary','Entrar no Kamby');link.href='index.html#definicoes/entrar';wrap.append(link);}
window.addEventListener('beforeunload',event=>{if(formDirty){event.preventDefault();event.returnValue='';}});
async function mfa(version){
 const current=()=>version===sessionVersion;
 if(!current())return;
 const wrap=authWrap('Confirmar acesso','A administração exige autenticação em dois factores.');
 const {data,error}=await platform.auth.mfa.listFactors();
 if(!current())return;
 if(error)throw error;
 const existing=data.totp?.find(f=>f.status==='verified');let factor=existing?.id;
 if(!factor){
  const setup=button('Configurar autenticador','primary',async()=>{
   if(!current()||setup.disabled)return;
   setup.disabled=true;
   try{
    const {data,error}=await platform.auth.mfa.enroll({factorType:'totp',friendlyName:'Kamby Administração '+Date.now(),issuer:'Kamby'});
    if(!current())return;
    if(error)throw error;
    const secret=data.totp?.secret;
    if(!secret)throw new Error('Chave indisponível');
    factor=data.id;
    const manual=el('section','admin-mfa-manual');
    const key=el('code','admin-mfa-key',secret);
    const result=el('p','muted');
    result.setAttribute('role','status');
    const copy=button('Copiar chave','primary',async()=>{
      if(!current())return;
      try{
        await navigator.clipboard.writeText(secret);
        if(current())result.textContent='Chave copiada.';
      }catch{
        if(current())result.textContent='Mantém o dedo sobre a chave para a seleccionar e copiar.';
      }
    });
    manual.append(
      el('h2','','Chave de configuração'),
      el('p','muted','Na app autenticadora, escolhe introduzir uma chave, dá-lhe o nome Kamby e selecciona a opção baseada no tempo.'),
      key,copy,result,
      el('p','muted','Volta aqui e introduz o código de seis dígitos que a app mostrar.')
    );
    setup.replaceWith(manual);
    codeForm();
   }catch{if(current()){feedback('Não foi possível configurar o autenticador.');setup.disabled=false;}}
  });wrap.append(setup);
 }else codeForm();
 function codeForm(){
  if(!current())return;
  const form=el('form'),code=field(form,'Código do autenticador','code','','text',6);
  code.inputMode='numeric';code.autocomplete='one-time-code';code.pattern='[0-9]{6}';code.required=true;
  const error=el('p','field-error');error.setAttribute('role','alert');
  const submit=button('Confirmar acesso','primary');submit.type='submit';form.append(error,submit);wrap.append(form);
  form.onsubmit=async e=>{
   e.preventDefault();if(!current()||submit.disabled)return;
   submit.disabled=true;setButtonBusy(submit,true);
   try{
    const {error:failed}=await platform.auth.mfa.challengeAndVerify({factorId:factor,code:code.value});
    if(!current())return;
    if(failed){error.textContent='O código não foi aceite. Confere o autenticador e tenta novamente.';}
    else await start();
   }catch{if(current())error.textContent='Não foi possível confirmar o acesso. Tenta novamente.';}
   finally{code.value='';if(current()){submit.disabled=false;setButtonBusy(submit,false);}}
  };
 }
 wrap.append(button('Terminar sessão','quiet',async()=>{if(!current())return;await platform.auth.signOut({scope:'local'});if(current())start();}));
}

window.addEventListener('hashchange',()=>route());platform.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){++sessionVersion;permissions=[];++revision;readCache.clear();storeNames.clear();listPositions.clear();listSettings.clear();renderedRoute=null;formDirty=false;root.replaceChildren();login();}});start();
