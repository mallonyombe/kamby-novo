import {canPrepareStore} from './merchant-domain.js';
import {platform} from './platform.js';
import {el,icon} from './merchant-ui.js';
import {showSkeleton} from './loading.js';

export const summaryMarkup=`
  <div class="mw-summary-heading"><div><h2>Resumo</h2><p id="merchantSummaryStatus" class="mw-muted" role="status"></p></div>
    <button type="button" id="merchantQuickNew" class="mw-primary" disabled>${icon('plus')}Novo produto</button>
  </div>
  <section id="merchantPreparation" class="mw-preparation" hidden></section>
  <section id="merchantSummaryTasks" class="mw-summary-tasks" aria-label="Pendências do catálogo"></section>
  <button type="button" id="merchantHistory" class="mw-text mw-history">${icon('activity')}Histórico de actividade</button>`;

export function setupMerchantSummary({root,state,onProducts,onEdit,onCreate,onStore,onPublish,onActivity}) {
  const $=id=>root.querySelector('#'+id);
  const tasks=$('merchantSummaryTasks');
  let generation=0;
  $('merchantQuickNew').onclick=onCreate;
  $('merchantHistory').onclick=onActivity;

  function syncStatus(){
    const store=state.store;
    if(!store)return;
    const labels={draft:'Loja em preparação',pending:'Loja em preparação',suspended:'Loja suspensa',rejected:'Loja não aprovada'};
    $('merchantSummaryStatus').textContent=store.status==='approved'
      ? (store.is_open===false?'Pedidos pausados':'Loja visível')
      : (labels[store.status]||'Loja indisponível');
    $('merchantQuickNew').disabled=!canPrepareStore(store);
    const preparation=$('merchantPreparation');
    preparation.replaceChildren();
    preparation.hidden=!['draft','pending'].includes(store.status);
    if(!preparation.hidden){
      preparation.append(el('h3','','Primeiros passos'));
      preparation.append(task('Completar o perfil','Descrição, fotografias e horários','edit',onStore));
      preparation.append(task('Preparar o catálogo','Podes guardar produtos em rascunho','products',()=>onProducts('draft')));
      const button=el('button','mw-primary','Activar loja');
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
    showSkeleton(tasks,'rows',2);
    const products=()=>platform.from('kg_products').select(
      '*,variants:kg_product_variants(*),images:kg_product_images(storage_path,sort_order)',{count:'exact'}
    ).eq('store_id',id);
    try{
      const [out,drafts,blocked]=await Promise.all([
        products().eq('status','published').eq('moderation_status','allowed').eq('stock_status','out').order('updated_at',{ascending:false}).limit(3),
        products().eq('status','draft').eq('moderation_status','allowed').order('updated_at',{ascending:false}).limit(2),
        platform.from('kg_products').select('id',{count:'exact',head:true}).eq('store_id',id).eq('moderation_status','blocked').neq('status','archived')
      ]);
      if(request!==generation||id!==state.store?.id)return;
      if([out,drafts,blocked].some(result=>result.error))throw Error();
      tasks.replaceChildren();
      if(!out.count&&!drafts.count&&!blocked.count){
        tasks.append(el('p','mw-muted','Sem pendências no catálogo.'));
        return;
      }
      tasks.append(el('h3','','Pendências'));
      const editable=canPrepareStore(state.store);
      for(const [result,filter,detail,label,glyph] of [
        [out,'out','Esgotado · Actualizar stock','Ver todos os esgotados','products'],
        [drafts,'draft','Rascunho · Continuar edição','Ver todos os rascunhos','edit']
      ]){
        for(const product of result.data||[]){
          tasks.append(task(product.title,editable?detail:detail.split(' · ')[0],glyph,
            ()=>editable?onEdit(product,filter):onProducts(filter)));
        }
        if(result.count>result.data?.length){
          const more=el('button','mw-text',label);
          more.type='button';
          more.onclick=()=>onProducts(filter);
          tasks.append(more);
        }
      }
      if(blocked.count){
        tasks.append(task('Produtos com restrições',blocked.count===1?'1 produto':blocked.count+' produtos','warning',()=>onProducts('blocked')));
      }
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
  }
  return {load,reset,syncStatus};
}
