import {canPrepareStore} from './merchant-domain.js';
import {platform} from './platform.js';
import {el,icon} from './merchant-ui.js';
import {showSkeleton} from './loading.js';

export const summaryMarkup=`
  <div class="mw-summary-status" id="merchantSummaryStatus" role="status"></div>
  <div class="mw-summary-heading"><h2>Resumo</h2><button type="button" id="merchantQuickNew" class="mw-primary" disabled>${icon('plus')}Novo produto</button></div>
  <section id="merchantPreparation" class="mw-preparation" aria-label="Preparar loja" hidden></section>
  <section class="mw-summary-catalogue" aria-labelledby="merchantSummaryCatalogueTitle">
    <h3 id="merchantSummaryCatalogueTitle">Catálogo</h3>
    <div class="mw-summary-counts">
      <button type="button" data-summary-filter="published" aria-label="Ver produtos publicados" disabled><strong id="kpiProductsCount">—</strong><span>Publicados</span></button>
      <button type="button" data-summary-filter="out" aria-label="Ver produtos esgotados" disabled><strong id="kpiUnavailable">—</strong><span>Esgotados</span></button>
    </div>
  </section>
  <section id="merchantSummaryTasks" class="mw-summary-tasks" aria-label="Pendências do catálogo"></section>
  <section class="mw-summary-activity" aria-labelledby="merchantSummaryActivityTitle">
    <div class="mw-summary-section-heading"><h3 id="merchantSummaryActivityTitle">Actividade</h3><span>Últimos 7 dias</span></div>
    <dl class="mw-summary-activity-values"><div><dt>Visitas à loja</dt><dd id="kpiStoreViews">—</dd></div><div><dt>Cliques WhatsApp</dt><dd id="kpiWhatsAppClicks">—</dd></div></dl>
  </section>
  <p class="mw-summary-updated" id="merchantMetricsTime"></p>`;

export function setupMerchantSummary({root,state,onProducts,onCreate,onStore}) {
  const $=id=>root.querySelector('#'+id),tasks=$('merchantSummaryTasks');
  const ids=['kpiProductsCount','kpiUnavailable','kpiStoreViews','kpiWhatsAppClicks'];
  let generation=0;
  root.querySelector('#merchantQuickNew').onclick=onCreate;
  root.addEventListener('click',event=>{const action=event.target.closest('[data-summary-filter]');if(action&&!action.disabled)onProducts(action.dataset.summaryFilter);});
  function syncStatus(){
    const store=state.store;if(!store)return;
    const approved=store.status==='approved',open=approved&&store.is_open!==false;
    const labels={draft:'Loja em preparação',pending:'Loja em análise',suspended:'Loja suspensa',rejected:'Loja não aprovada'};
    $('merchantSummaryStatus').textContent=approved?(open?'Loja visível':'Pedidos pausados'):(labels[store.status]||'Loja indisponível');
    $('merchantSummaryStatus').dataset.state=open?'visible':approved?'paused':'restricted';
    $('merchantQuickNew').disabled=!canPrepareStore(store);
    const published=root.querySelector('[data-summary-filter="published"]');published.querySelector('span').textContent=approved?'Publicados':'Prontos';published.setAttribute('aria-label',approved?'Ver produtos publicados':'Ver produtos preparados');
    const preparation=$('merchantPreparation');preparation.replaceChildren();preparation.hidden=!['draft','pending'].includes(store.status);
    if(!preparation.hidden){
      preparation.append(el('p','mw-muted',store.status==='pending'?'Em análise. Podes continuar a preparar a loja.':'Prepara os dados e o catálogo. A gestão activa a loja.'));
      const actions=el('div','mw-preparation-actions');
      for(const [label,action] of [['Dados da loja',onStore],['Preparar catálogo',()=>onProducts('all')]]){const b=el('button','mw-text',label);b.type='button';b.onclick=action;actions.append(b);}
      preparation.append(actions,el('small','mw-muted','Ainda não visível aos clientes.'));
    }
  }
  function renderTasks({out,drafts,blocked}) {
    tasks.replaceChildren();
    const entries=[['out',out,out===1?'produto esgotado':'produtos esgotados'],['draft',drafts,drafts===1?'rascunho por publicar':'rascunhos por publicar'],['blocked',blocked,blocked===1?'produto com restrições':'produtos com restrições']].filter(([,n])=>n>0);
    if(!entries.length){
      const healthy=el('p','mw-summary-healthy');healthy.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>';
      healthy.append(el('span','','Sem pendências no catálogo'));tasks.append(healthy);return;
    }
    tasks.append(el('h3','','Atenção'));
    for(const [filter,count,label] of entries){const row=el('button','mw-summary-task');row.type='button';row.dataset.summaryFilter=filter;row.innerHTML=icon(filter==='draft'?'edit':'warning');row.append(el('span','',count+' '+label));const arrow=el('span','mw-summary-chevron','›');arrow.setAttribute('aria-hidden','true');row.append(arrow);tasks.append(row);}
  }
  function reset(){generation++;root.setAttribute('aria-busy','false');ids.forEach(id=>$(id).textContent='—');tasks.replaceChildren();$('merchantMetricsTime').textContent='';root.querySelectorAll('[data-summary-filter]').forEach(b=>b.disabled=true);}
  async function load(){
    if(!state.store)return;
    const id=state.store.id,request=++generation;
    syncStatus();root.setAttribute('aria-busy','true');
    ids.forEach(id=>showSkeleton($(id),'metric'));showSkeleton(tasks,'rows',1);$('merchantMetricsTime').textContent='';root.querySelectorAll('[data-summary-filter]').forEach(b=>b.disabled=true);
    const count=()=>platform.from('kg_products').select('id',{count:'exact',head:true}).eq('store_id',id);
    try{
      const [metrics,published,out,drafts,blocked]=await Promise.all([
        platform.rpc('kg_merchant_metrics',{p_store_id:id}),
        count().eq('status','published').eq('moderation_status','allowed'),
        count().eq('status','published').eq('moderation_status','allowed').eq('stock_status','out'),
        count().eq('status','draft').eq('moderation_status','allowed'),
        count().eq('moderation_status','blocked').neq('status','archived')
      ]);
      if(request!==generation||id!==state.store?.id)return;
      if([metrics,published,out,drafts,blocked].some(r=>r.error)||!metrics.data)throw Error();
      const values=[published.count,out.count,metrics.data.store_views,metrics.data.whatsapp_clicks];
      if([...values,drafts.count,blocked.count].some(n=>n==null||!Number.isFinite(Number(n))))throw Error();
      ids.forEach((id,i)=>$(id).textContent=new Intl.NumberFormat('pt-MZ').format(Number(values[i])));
      renderTasks({out:Number(out.count),drafts:Number(drafts.count||0),blocked:Number(blocked.count||0)});
      $('merchantMetricsTime').textContent='Actualizado às '+new Intl.DateTimeFormat('pt-MZ',{hour:'2-digit',minute:'2-digit'}).format(new Date(metrics.data.as_of||Date.now()));
      root.querySelectorAll('[data-summary-filter]').forEach(b=>b.disabled=false);
    }catch{
      if(request!==generation||id!==state.store?.id)return;
      ids.forEach(id=>$(id).textContent='—');tasks.replaceChildren();
      const message=el('p','mw-summary-error','Não foi possível actualizar o resumo.');message.setAttribute('role','alert');const retry=el('button','mw-summary-retry','Tentar novamente');retry.type='button';retry.onclick=load;tasks.append(message,retry);
    }finally{if(request===generation)root.setAttribute('aria-busy','false');}
  }
  return {load,reset,syncStatus};
}
