import {writeFileSync} from 'node:fs';

writeFileSync('dist/merchant-summary-qa.html', String.raw`<!doctype html>
<meta charset="utf-8">
<title>Kamby · Estados do Resumo</title>
<style>body{margin:18px;background:#ddd;font:13px system-ui}button{padding:10px}main{display:flex;gap:18px;align-items:start}iframe{width:390px;height:844px;border:0;flex:none}pre{max-width:650px;white-space:pre-wrap}</style>
<button id="run">Verificar Resumo</button>
<main><iframe title="Resumo móvel" src="/merchant-qa.html#lojista/s1"></iframe><pre>Pronto</pre></main>
<script type="module">
const frame=document.querySelector('iframe'),out=document.querySelector('pre');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const doc=()=>frame.contentDocument, find=selector=>doc()?.querySelector(selector);
const report=[];
async function until(predicate,label='estado esperado'){
  const start=Date.now();
  while(!predicate()){
    if(Date.now()-start>15000)throw Error('Tempo excedido: '+label+' · '+(find('#merchantHeaderTitle')?.textContent||'')+' · '+(find('#merchantAppliedFilters')?.textContent||'')+' · '+(find('#merchantCatalogCount')?.textContent||''));
    await pause(50);
  }
}
function check(ok,label){
  report.push((ok?'PASSOU ':'FALHOU ')+label);
  out.textContent=report.join('\n');
  if(!ok)throw Error(label);
}
function open(mode=''){
  return new Promise(resolve=>{
    frame.addEventListener('load',resolve,{once:true});
    frame.src='/merchant-qa.html?rev='+Date.now()+(mode?'&qa='+mode:'')+'#lojista/s1';
  });
}
const finished=()=>find('.mw-summary')?.getAttribute('aria-busy')==='false';
const click=selector=>find(selector).click();
document.querySelector('#run').onclick=async()=>{
  report.length=0;
  try{
    await open();
    await until(()=>finished()&&find('#kpiProductsCount')?.textContent==='2');
    check(!find('#kpiUnavailable')&&!find('[data-summary-filter="out"]'),'resumo sem indicadores de stock');
    check(find('#merchantSummaryTaskList').textContent.trim()==='Sem pendências no catálogo.','estado sem pendências');
    check(!find('.mw-summary #btnToggleStoreStatus'),'controlo de pedidos fica no separador Loja');
    for(const theme of ['light','dark']){
      doc().documentElement.dataset.theme=theme;
      for(const width of [320,390,1040]){
        frame.style.width=width+'px';
        await pause(100);
        check(doc().documentElement.scrollWidth<=doc().documentElement.clientWidth,'sem transbordo, '+theme+', '+width+' px');
      }
    }
    frame.style.width='390px';
    await until(()=>!find('#merchantSummaryPublished').disabled,'contador habilitado');
    click('#merchantSummaryPublished');
    await until(()=>!find('[data-mw="produtos"]').hidden,'abrir Produtos');
    await until(()=>doc().querySelectorAll('.mw-product-row').length===2,'dois produtos publicados');
    check(find('#merchantAppliedFilters').textContent==='Publicados','contador abre o catálogo filtrado');
    await open('attention');
    await until(()=>finished()&&find('#kpiProductsCount')?.textContent==='1','catálogo com pendências');
    check(doc().querySelectorAll('#merchantSummaryTaskList button').length===2,'pendências incluem rascunhos e restrições');
    for(const filter of ['draft','blocked']){
      click('[data-summary-filter="'+filter+'"]');
      await until(()=>!find('[data-mw="produtos"]').hidden&&doc().querySelectorAll('.mw-product-row').length===1,'carregar lista '+filter);
      check(true,'pendência '+filter+' abre somente o artigo correspondente');
      click('[data-destination="resumo"]');
    }
    await open('empty');
    await until(()=>finished()&&find('#kpiProductsCount')?.textContent==='0');
    check(!find('#merchantSummaryEmpty').hidden&&!find('#merchantFirstProduct').disabled,'catálogo vazio oferece criação');
    click('#merchantFirstProduct');
    await until(()=>find('#modalNewProduct')?.open);
    check(true,'primeiro produto usa o editor do catálogo');
    await open('summary-error');
    await until(()=>finished()&&find('#merchantSummaryTaskList button')?.textContent==='Tentar novamente');
    check(find('#kpiProductsCount').textContent==='—','erro preserva o estado sem contagens confirmadas');
    click('#merchantSummaryTaskList button');
    await until(()=>finished()&&find('#merchantSummaryTaskList button')?.textContent==='Tentar novamente');
    check(true,'nova tentativa devolve controlo em caso de erro');
    await open('summary-loading');
    await until(()=>find('.mw-summary')?.getAttribute('aria-busy')==='true');
    check(Boolean(find('#merchantSummaryTaskList .app-skeleton')),'carregamento usa esqueleto');
    out.textContent+='\nCONCLUÍDO: '+report.length+' verificações.';
  }catch(error){out.textContent+='\nERRO: '+error.message;}
};
</script>
`);
