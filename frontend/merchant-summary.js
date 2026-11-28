import {platform} from './platform.js';
import {el,icon} from './merchant-ui.js';
import {showSkeleton} from './loading.js';
import {merchantOrderLabel} from './merchant-domain.js';

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
  <div id="merchantSummaryEmpty" class="mw-summary-empty" hidden>
    <p>Ainda não há produtos no catálogo.</p>
    <button type="button" id="merchantFirstProduct" class="mw-primary">Adicionar primeiro produto</button>
  </div>`;

export function setupMerchantSummary({root,state,onProducts,onStore,onPublish,onCreate}) {
  const $=id=>root.querySelector('#'+id);
  const tasks=$('merchantSummaryTaskList');
  const empty=$('merchantSummaryEmpty');
  const catalogue=$('merchantSummaryPublished').parentElement;
  const count=$('kpiProductsCount');
  let generation=0;
  $('merchantSummaryPublished').onclick=()=>onProducts('published');
  $('merchantFirstProduct').onclick=onCreate;

  function syncStatus(){
    const store=state.store;
    if(!store)return;
    const labels={draft:'Loja em preparação',pending:'Loja em preparação',suspended:'Loja suspensa',rejected:'Loja não aprovada'};
    $('merchantSummaryStatus').textContent=store.status==='approved'
      ? merchantOrderLabel(store)
      : (labels[store.status]||'Loja indisponível');
    $('merchantSummaryStatus').dataset.state=store.status==='approved'&&store.is_open!==false?'visible':'restricted';
    const preparation=$('merchantPreparation');
    preparation.replaceChildren();
    preparation.hidden=!['draft','pending'].includes(store.status);
    if(!preparation.hidden){
      preparation.append(el('h3','','Preparar a loja'));
      preparation.append(task('Completar o perfil','Descrição, fotografias e horários','edit',onStore));
      preparation.append(task('Preparar o catálogo','Podes guardar produtos em rascunho','products',()=>onProducts('draft')));
      const button=el('button','mw-primary','Publicar loja');
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
    const arrow=el('span','mw-summary-chevron');
    arrow.innerHTML=icon('next');
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
    catalogue.hidden=false;
    empty.hidden=true;
    count.textContent='—';
    $('merchantSummaryPublished').disabled=true;
    showSkeleton(tasks,'rows',2);
    const products=()=>platform.from('kg_products').select('id',{count:'exact',head:true}).eq('store_id',id);
    try{
      const results=await Promise.allSettled([
        products().eq('status','draft').eq('moderation_status','allowed'),
        products().eq('moderation_status','blocked').neq('status','archived'),
        products().eq('status','published').eq('moderation_status','allowed')
      ]);
      if(request!==generation||id!==state.store?.id)return;
      const [drafts,blocked,published]=results.map(result=>
        result.status==='fulfilled'?result.value:{error:result.reason});
      if(Number.isInteger(published.count)){
        count.textContent=published.count.toLocaleString('pt-MZ');
        $('merchantSummaryPublished').disabled=!published.count;
      }
      if(![drafts,blocked,published].every(result=>Number.isInteger(result.count)))throw Error();
      const noProducts=published.count===0&&drafts.count===0&&blocked.count===0;
      const approved=state.store.status==='approved';
      empty.hidden=!noProducts||!approved;
      catalogue.hidden=noProducts;
      if(noProducts)return;

      tasks.replaceChildren();
      for(const [result,filter,label,glyph] of [
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

  function reset(){
    generation++;
    tasks.replaceChildren();
    root.setAttribute('aria-busy','false');
    empty.hidden=true;
    catalogue.hidden=false;
    count.textContent='—';
  }
  return {load,reset,syncStatus};
}
