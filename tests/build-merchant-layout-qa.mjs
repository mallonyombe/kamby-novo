import {writeFileSync} from 'node:fs';

writeFileSync('dist/merchant-layout-qa.html', String.raw`<!doctype html>
<meta charset="utf-8">
<title>Kamby · Revisão do catálogo</title>
<style>body{margin:18px;background:#ddd;font:13px system-ui}button{padding:10px}main{display:flex;gap:18px;align-items:start}iframe{width:390px;height:844px;border:0;flex:none}pre{max-width:650px;white-space:pre-wrap}</style>
<button id="run">Verificar catálogo</button>
<main><iframe title="Catálogo móvel" src="/merchant-qa.html#lojista/s1"></iframe><pre>Pronto</pre></main>
<script type="module">
const frame=document.querySelector('iframe'),out=document.querySelector('pre');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const doc=()=>frame.contentDocument, find=selector=>doc()?.querySelector(selector);
const report=[];
async function until(predicate){
  const start=Date.now();
  while(!predicate()){
    if(Date.now()-start>15000)throw Error('Tempo excedido');
    await pause(50);
  }
}
function check(ok,label){
  report.push((ok?'PASSOU ':'FALHOU ')+label);
  out.textContent=report.join('\n');
  if(!ok)throw Error(label);
}
const click=selector=>find(selector).click();
const fill=(selector,value)=>{
  const field=find(selector);
  field.value=value;
  field.dispatchEvent(new Event('input',{bubbles:true}));
};
document.querySelector('#run').onclick=async()=>{
  report.length=0;
  try{
    await until(()=>find('#kpiProductsCount')?.textContent==='2');
    check(doc().querySelectorAll('.merchant-own-nav button').length===4,'quatro destinos próprios do lojista');
    click('[data-destination="produtos"]');
    await until(()=>doc()?.querySelectorAll('.mw-product-row').length===2);
    check(find('#floatingNavbar').classList.contains('is-hidden'),'painel recolhe a navegação do comprador');
    click('#merchantFilterButton');
    check(!find('.mw-filter-dialog select[name="available"]'),'catálogo sem filtro de stock');
    click('.mw-filter-dialog header button');

    find('[data-product-id="p1"] .mw-product-actions > button').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}));
    const menu=find('[data-product-id="p1"] .mw-context-menu');
    check(menu&&!menu.contains(doc().activeElement),'toque abre o menu sem mover o foco para a primeira opção');
    const editPrice=Array.from(menu.querySelectorAll('button')).find(button=>button.textContent==='Editar preço');
    editPrice.click();
    const editor=find('#modalNewProduct');
    check(editor.open&&find('#modalNewProdTitle').textContent.includes('Preço'),'Editar preço abre o editor rápido');
    check(!find('.editor-stock-fields'),'editor rápido sem campos de stock');
    const promotion='#editorPrices input[role="switch"]';
    check(!find(promotion).checked&&find('.editor-promo-fields').hidden,'preço abre com configuração da promoção recolhida');
    check(find(promotion).offsetWidth===42&&find(promotion).offsetHeight===24,'interruptor mantém 42 × 24 px');
    check(find('.editor-navigation.pdp-top-bar')&&find('.editor-footer.pdp-sticky-bar'),'editor usa o cabeçalho e o rodapé partilhados');
    click(promotion);
    check(!find('.editor-promo-fields').hidden,'interruptor revela preço promocional');
    click('.editor-schedule-trigger');
    check(find('.editor-schedule-sheet').open,'calendário abre numa folha própria');
    const start=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
    const end=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
    fill('[data-product-value="promoPrice"]','100,25');
    fill('[data-product-value="promotionStartDate"]',start);
    fill('[data-product-value="promotionEndDate"]',end);
    click('.editor-schedule-sheet[open] footer button');

    for(const theme of ['light','dark']){
      doc().documentElement.dataset.theme=theme;
      for(const width of [320,390,1040]){
        frame.style.width=width+'px';
        await pause(120);
        check(editor.scrollWidth<=editor.clientWidth,'editor sem transbordo, '+theme+', '+width+' px');
      }
    }
    frame.style.width='390px';
    click('#btnSubmitNewProduct');
    await until(()=>!editor.open&&doc().documentElement.dataset.qaProduct);
    const saved=JSON.parse(doc().documentElement.dataset.qaProduct);
    check(saved.price_minor===10025&&saved.previous_price_minor===12500,'promoção enviada com os dois preços em cêntimos');
    check(saved.promotion_starts_at?.endsWith('22:00:00.000Z')&&saved.promotion_ends_at?.endsWith('22:00:00.000Z'),'intervalo por dias convertido da hora de Moçambique');
    await until(()=>find('[data-product-id="p1"] .mw-product-price')?.textContent.includes('125'));
    check(true,'catálogo conserva o preço normal antes do início');

    fill('#merchantSearch','Arroz');
    await until(()=>doc().querySelectorAll('.mw-product-row').length===1);
    check(find('.mw-product-name').textContent==='Arroz','pesquisa actua apenas no catálogo atribuído');
    click('.mw-product-entry');
    await until(()=>editor.open&&!find('#selectNewProdCat').disabled);
    check(find('#editorEnableVariants').checked&&doc().querySelectorAll('#editorVariants .editor-variant').length===3,'variantes existentes continuam activas com os respectivos preços');
    check(!find('.editor-stock-fields'),'edição completa também omite stock');
    click('#btnCloseNewProductModal');
    click('[data-destination="actividade"]');
    await until(()=>find('.mw-activity-svg'));
    check(doc().querySelectorAll('.mw-series').length===2,'gráfico inclui visitas e cliques');
    click('[data-destination="loja"]');
    check(find('#merchantStoreForm').elements.name.value==='Moheim Studio','perfil da loja conserva o formulário próprio');
    check(doc().querySelectorAll('.mw-hours').length===7,'formulário mantém horário semanal');
    out.textContent+='\nCONCLUÍDO: '+report.length+' verificações.';
  }catch(error){out.textContent+='\nERRO: '+error.message;}
};
</script>
`);
