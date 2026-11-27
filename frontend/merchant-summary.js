import {platform} from './platform.js';
import {el,icon} from './merchant-ui.js';
import {showSkeleton} from './loading.js';
import {activityChart} from './merchant-activity-chart.js';

export const summaryMarkup=`
  <p id="merchantSummaryStatus" class="mw-summary-status" role="status"></p>
  <section class="mw-summary-catalogue" aria-labelledby="merchantSummaryCatalogueTitle">
    <h3 id="merchantSummaryCatalogueTitle">Catálogo</h3>
    <button type="button" id="merchantSummaryPublished" class="mw-summary-task mw-summary-bucket">
      ${icon('products')}<span class="mw-summary-task-label">Produtos publicados</span>
      <strong class="mw-summary-task-count" id="kpiProductsCount">—</strong>
      <span class="mw-summary-chevron">${icon('next')}</span>
    </button>
    <section id="merchantSummaryTasks" class="mw-summary-tasks" aria-labelledby="merchantSummaryTasksTitle">
      <h3 id="merchantSummaryTasksTitle">Pendências</h3>
      <div id="merchantSummaryTaskList"></div>
    </section>
  </section>
  <section id="merchantPreparation" class="mw-preparation" hidden></section>
  <section class="mw-summary-activity" aria-labelledby="merchantSummaryActivityTitle">
    <div class="mw-summary-section-heading"><h3 id="merchantSummaryActivityTitle">Actividade</h3><span>Últimos 7 dias · inclui hoje</span></div>
    <dl class="mw-summary-activity-values">
      <div><dt>Visitas à loja</dt><dd id="kpiStoreViews">—</dd></div>
      <div><dt>Cliques no WhatsApp</dt><dd id="kpiWhatsAppClicks">—</dd></div>
    </dl>
    <div id="merchantSummaryChart" class="mw-summary-chart"></div>
    <button type="button" id="merchantSummaryRetry" class="mw-summary-retry" hidden>Tentar carregar os indicadores</button>
    <button type="button" id="merchantHistory" class="mw-text mw-history">${icon('activity')}Histórico de actividade</button>
  </section>`;

export function setupMerchantSummary({root,state,onProducts,onStore,onPublish,onActivity}) {
  const $=id=>root.querySelector('#'+id);
  const tasks=$('merchantSummaryTaskList');
  const chart=$('merchantSummaryChart');
  let generation=0;
  $('merchantSummaryPublished').onclick=()=>onProducts('published');
  $('merchantSummaryRetry').onclick=load;
  $('merchantHistory').onclick=onActivity;

  function syncStatus(){
    const store=state.store;
    if(!store)return;
    const labels={draft:'Loja em preparação',pending:'Loja em preparação',suspended:'Loja suspensa',rejected:'Loja não aprovada'};
    $('merchantSummaryStatus').textContent=store.status==='approved'
      ? (store.is_open===false?'Pedidos pausados':'Loja visível')
      : (labels[store.status]||'Loja indisponível');
    $('merchantSummaryStatus').dataset.state=store.status==='approved'&&store.is_open!==false?'visible':'restricted';
    const preparation=$('merchantPreparation');
    preparation.replaceChildren();
    preparation.hidden=!['draft','pending'].includes(store.status);
    if(!preparation.hidden){
      preparation.append(el('h3','','Primeiros passos'));
      preparation.append(task('Completar o perfil','Descrição, fotografias e horários','edit',onStore));
      preparation.append(task('Preparar o catálogo','Podes guardar produtos em rascunho','products',()=>onProducts('draft')));
      const button=el('button','mw-secondary','Activar loja');
      button.type='button';
      button.onclick=()=>void onPublish(button);
      preparation.append(button);
    }
  }

  function task(title,detail,glyph,action){
    const button=el('button','mw-summary-task');
    button.type='button';
    button.innerHTML=icon(glyph);
    const copy=el('span','mw-task-copy');
    copy.append(el('strong','',title),el('small','mw-muted',detail));
    const arrow=el('span','mw-summary-chevron','›');
    arrow.setAttribute('aria-hidden','true');
    button.append(copy,arrow);
    button.onclick=action;
    return button;
  }

  async function load(){
    if(!state.store)return;
    const id=state.store.id;
    const request=++generation;
    syncStatus();
    root.setAttribute('aria-busy','true');
    renderIndicators();
    showSkeleton(tasks,'rows',2);
    showSkeleton(chart,'chart');
    const products=()=>platform.from('kg_products').select('id',{count:'exact',head:true}).eq('store_id',id);
    try{
      const results=await Promise.allSettled([
        products().eq('status','published').eq('moderation_status','allowed').eq('stock_status','out'),
        products().eq('status','draft').eq('moderation_status','allowed'),
        products().eq('moderation_status','blocked').neq('status','archived'),
        products().eq('status','published').eq('moderation_status','allowed'),
        platform.rpc('kg_merchant_activity',{p_store_id:id})
      ]);
      if(request!==generation||id!==state.store?.id)return;
      const [out,drafts,blocked,published,activity]=results.map(result=>
        result.status==='fulfilled'?result.value:{error:result.reason});
      const days=activity.error?null:activity.data?.days;
      renderIndicators(published.count,days,true);
      if(![out,drafts,blocked].every(result=>Number.isInteger(result.count)))throw Error();

      tasks.replaceChildren();
      for(const [result,filter,label,glyph] of [
        [out,'out','Esgotados','products'],
        [drafts,'draft','Rascunhos','edit'],
        [blocked,'blocked','Produtos com restrições','warning']
      ]){
        if(!result.count)continue;
        const row=el('button','mw-summary-task mw-summary-bucket');
        row.type='button';
        row.dataset.summaryFilter=filter;
        row.innerHTML=icon(glyph);
        const count=el('strong','mw-summary-task-count',result.count.toLocaleString('pt-MZ'));
        const arrow=el('span','mw-summary-chevron');
        arrow.innerHTML=icon('next');
        row.append(el('span','mw-summary-task-label',label),count,arrow);
        row.onclick=()=>onProducts(filter);
        tasks.append(row);
      }
      if(!tasks.childElementCount)tasks.append(el('p','mw-muted','Sem pendências no catálogo.'));
    }catch{
      if(request!==generation||id!==state.store?.id)return;
      const retry=el('button','mw-text','Tentar novamente');
      retry.type='button';
      retry.onclick=load;
      tasks.replaceChildren(el('p','mw-muted','Não foi possível carregar as pendências.'),retry);
    }finally{
      if(request===generation)root.setAttribute('aria-busy','false');
    }
  }

  function renderIndicators(published=null,days=null,loaded=false){
    const complete=Array.isArray(days)&&days.length===7&&days.every(day=>
      typeof day.day==='string'&&Number.isInteger(day.views)&&Number.isInteger(day.contacts));
    const total=key=>complete?days.reduce((sum,day)=>sum+day[key],0):null;
    const values=[published,total('views'),total('contacts')];
    ['kpiProductsCount','kpiStoreViews','kpiWhatsAppClicks'].forEach((id,index)=>{
      const value=values[index];
      $(id).textContent=Number.isFinite(value)?value.toLocaleString('pt-MZ'):'—';
    });
    $('merchantSummaryRetry').hidden=!loaded||values.every(Number.isFinite);
    chart.replaceChildren();
    if(!complete)return;
    if(!values[1]&&!values[2]){
      chart.append(el('p','mw-muted','Sem actividade neste período.'));
      return;
    }
    const plot=activityChart(days);
    const drawing=plot.querySelector('svg');
    drawing.setAttribute('viewBox','-10 0 360 164');
    drawing.setAttribute('preserveAspectRatio','none');
    chart.append(plot);
  }

  function reset(){
    generation++;
    tasks.replaceChildren();
    root.setAttribute('aria-busy','false');
    renderIndicators();
  }
  return {load,reset,syncStatus};
}
