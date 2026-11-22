import {writeFileSync} from 'node:fs';
writeFileSync('dist/buyer-qa.html',`<!doctype html><meta charset="utf-8"><title>Kamby · Revisão de compra</title><style>body{margin:18px;background:#ddd;font:13px system-ui}button{padding:10px;margin-right:8px;margin-bottom:10px}main{display:flex;gap:18px;align-items:flex-start}iframe{width:390px;height:844px;border:0;border-radius:18px;background:white;flex:none}pre{white-space:pre-wrap;max-width:350px}</style><button id="seed">Preparar carrinhos</button><button id="run">Verificar fluxos</button><button id="store">Abrir loja</button><button id="theme">Alternar tema</button><button id="restore">Restaurar carrinho anterior</button><main><iframe title="Kamby móvel" src="/#inicio"></iframe><pre id="results">A preparar…</pre></main><script type="module">
import {cataloguePhoto} from './catalogue-photos.js';
const frame=document.querySelector('iframe'),output=document.querySelector('#results');
const original=localStorage.getItem('kamby_cart');let report=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const doc=()=>frame.contentDocument;
async function until(fn){const start=Date.now();while(!fn()){if(Date.now()-start>15000)throw Error('Tempo excedido');await pause(100);}await new Promise(r=>frame.contentWindow.requestAnimationFrame(()=>frame.contentWindow.requestAnimationFrame(r)));}
function check(ok,label){report.push((ok?'PASSOU ':'FALHOU ')+label);output.textContent=report.join('\\n');if(!ok)throw Error(label);}
async function seed(){const q=new URLSearchParams({select:'id,title,price_minor,image_url,stock_status,store:kg_stores!inner(id,name,whatsapp_e164,location,is_test),images:kg_product_images(storage_path,sort_order),variants:kg_product_variants(id,option_name,price_minor,in_stock)',status:'eq.published'});const response=await fetch('https://wbjhhkjriqeloiinvbii.supabase.co/rest/v1/kg_products?'+q,{headers:{apikey:'sb_publishable_9n2oXQLqDuaQNLEHl_Vw6A_7exV-LPl'}});if(!response.ok)throw Error('Catálogo indisponível');const products=await response.json();const selections=[['Óleo alimentar de girassol','500 ml'],['Açúcar branco 1 kg',''],['Arroz de grão longo','10 kg'],['Caneca de cerâmica Cora','350 ml'],['Caneca de cerâmica 500 ml','']];const cart=selections.map(([title,option])=>{const p=products.find(x=>x.title===title);if(!p)throw Error(title);const s=p.store,v=p.variants.find(x=>x.option_name===option)||p.variants[0];const path=p.images?.slice().sort((a,b)=>a.sort_order-b.sort_order)[0]?.storage_path;return{productId:p.id,variantId:v?.id||'',storeId:s.id,storeName:s.name,storePhone:s.whatsapp_e164,isTest:s.is_test,storeLocation:s.location,productTitle:p.title,variantName:v?.option_name||'',priceMinor:Number(v?.price_minor??p.price_minor),imageUrl:cataloguePhoto(path)||p.image_url,quantity:1,addedAt:new Date().toISOString()};});localStorage.setItem('kamby_cart',JSON.stringify(cart));frame.src='/?revisao='+Date.now()+'#carrinho';await until(()=>doc()?.querySelectorAll('.cart-store-summary').length===2);output.textContent='Dois carrinhos preparados.';}
document.querySelector('#seed').onclick=()=>seed().catch(e=>output.textContent=e.message);
document.querySelector('#store').onclick=()=>frame.contentWindow.location.hash='#loja/82040807-07b8-4d39-a188-6f36259da1e1';
document.querySelector('#theme').onclick=()=>doc().documentElement.dataset.theme=doc().documentElement.dataset.theme==='dark'?'light':'dark';
document.querySelector('#restore').onclick=()=>{if(original==null)localStorage.removeItem('kamby_cart');else localStorage.setItem('kamby_cart',original);frame.src='/#carrinho';output.textContent='Carrinho anterior restaurado.';};
document.querySelector('#run').onclick=async()=>{document.querySelector('#run').disabled=true;report=[];try{
await seed();
for(const width of [320,390,1040]){frame.style.width=width+'px';await pause(100);check(doc().documentElement.scrollWidth<=doc().documentElement.clientWidth,'carrinhos sem transbordo em '+width+' px');}frame.style.width='390px';
check(doc().querySelectorAll('#cartGroupsContainer .cart-store-summary').length===2,'um cartão por loja');
check(doc().querySelectorAll('#cartGroupsContainer .cart-item-row').length===0,'o carrinho geral não espalha linhas de produtos');
const market=[...doc().querySelectorAll('.cart-store-summary')].find(x=>x.textContent.includes('Mercearia'));
check(market.textContent.includes('985 MT'),'subtotal da mercearia: 985 MT');market.click();
await until(()=>!doc().querySelector('#viewStoreCart').hidden);check(doc().querySelectorAll('#storeCartItems .cart-item-row').length===3,'só os três produtos desta loja');
const rows=()=>[...doc().querySelectorAll('#storeCartItems .cart-item-row')];
rows().find(x=>x.textContent.includes('Óleo')).querySelectorAll('.cart-qty-btn')[1].click();
check(doc().querySelector('#storeCartTotal').textContent.includes('1075'),'a quantidade actualiza o subtotal para 1075 MT');
check(JSON.parse(localStorage.getItem('kamby_cart')).filter(x=>x.storeName==='Casa & Estilo').every(x=>x.quantity===1),'alteração isolada por loja');
rows().find(x=>x.textContent.includes('Óleo')).querySelectorAll('.cart-qty-btn')[0].click();
check(rows().find(x=>x.textContent.includes('Açúcar')).querySelectorAll('.cart-qty-btn')[0].disabled,'menos bloqueado numa unidade');
rows().find(x=>x.textContent.includes('Açúcar')).querySelector('.cart-item-remove').click();
check(doc().querySelectorAll('#storeCartItems .cart-item-row').length===2,'remover um artigo actualiza o carrinho');doc().querySelector('#commerceToastAction').click();
check(doc().querySelectorAll('#storeCartItems .cart-item-row').length===3,'Desfazer repõe o artigo');
const oil=()=>rows().find(x=>x.textContent.includes('Óleo'));
check(oil().querySelectorAll('.cart-qty-btn')[0].disabled,'uma unidade nunca se transforma em remoção');
oil().querySelectorAll('.cart-qty-btn')[1].click();oil().querySelectorAll('.cart-qty-btn')[1].click();
check(oil().querySelector('.cart-qty-num').textContent==='3','três unidades no mesmo artigo');
oil().querySelector('.cart-item-remove').click();check(!oil()&&doc().querySelector('#storeCartTotal').textContent.includes('895'),'caixote remove todas as unidades de uma vez e actualiza total');
check(JSON.parse(localStorage.getItem('kamby_cart')).filter(x=>x.storeName==='Casa & Estilo').length===2,'remover preserva os artigos da outra loja');
doc().querySelector('#commerceToastAction').click();check(oil().querySelector('.cart-qty-num').textContent==='3','Desfazer recupera as três unidades e a variante');
oil().querySelectorAll('.cart-qty-btn')[0].click();oil().querySelectorAll('.cart-qty-btn')[0].click();
for(const width of [320,390,1040]){frame.style.width=width+'px';await pause(100);check(doc().documentElement.scrollWidth<=doc().documentElement.clientWidth&&[...doc().querySelectorAll('.cart-item-remove')].every(b=>b.getBoundingClientRect().width>=44&&b.getBoundingClientRect().height>=44),'caixotes acessíveis sem transbordo em '+width+' px');}frame.style.width='390px';

doc().querySelector('#btnStoreCartGeneral').click();frame.contentWindow.location.hash='#loja/82040807-07b8-4d39-a188-6f36259da1e1';
await until(()=>!doc().querySelector('#viewStorefront').hidden&&doc().querySelectorAll('#storefrontProductsGrid .product-card').length===5);
await until(()=>doc().querySelector('#storefrontCover img')?.naturalWidth>0&&doc().querySelector('#storefrontAvatar img')?.naturalWidth>0);
check(true,'capa e perfil carregados');
check(!doc().querySelector('#storefrontAvailability'),'sem rótulo Aberta ou Fechada');
for(const width of [320,390,1040]){frame.style.width=width+'px';await pause(120);const cover=doc().querySelector('#storefrontCover').getBoundingClientRect(),avatar=doc().querySelector('#storefrontAvatar').getBoundingClientRect();check(Math.abs(cover.width-doc().querySelector('#viewStorefront').clientWidth)<1&&avatar.width===avatar.height&&avatar.top<cover.bottom&&avatar.bottom>cover.bottom,'capa inteira e perfil circular sobreposto em '+width+' px');}frame.style.width='390px';
check(doc().querySelectorAll('#storefrontProductsGrid .product-store-badge').length===0,'não repete a loja em cada produto');
check(frame.contentWindow.getComputedStyle(doc().querySelector('#btnStorefrontWhatsApp')).backgroundColor!== 'rgb(22, 138, 66)','WhatsApp deixou de dominar a hierarquia');
doc().querySelector('#btnSearchStorefront').click();check(doc().querySelector('#storefrontSearchPanel').closest('header')&&doc().querySelector('#viewStorefront .pdp-nav-content').hidden,'pesquisa ocupa o próprio cabeçalho, sem ícone duplicado');check(doc().activeElement===doc().querySelector('#storefrontSearchInput'),'foco imediato no campo da loja');check(doc().querySelector('.storefront-hero').offsetHeight===0,'a pesquisa recolhe as imagens para dar espaço aos resultados');const field=doc().querySelector('#storefrontSearchInput');
for(const theme of ['light','dark']){doc().documentElement.dataset.theme=theme;for(const width of [320,390,1040]){frame.style.width=width+'px';await pause(100);const header=doc().querySelector('#viewStorefront header').getBoundingClientRect(),box=doc().querySelector('.storefront-search-field').getBoundingClientRect();check(box.top>=header.top&&box.bottom<=header.bottom&&doc().documentElement.scrollWidth<=doc().documentElement.clientWidth,'campo inteiro dentro do cabeçalho, '+theme+' a '+width+' px');}}
frame.style.width='390px';doc().documentElement.dataset.theme='light';frame.style.height='420px';await pause(120);check(doc().activeElement===field&&field.getBoundingClientRect().top>=0,'campo mantém foco e visibilidade quando a área disponível diminui');frame.style.height='844px';
doc().documentElement.style.setProperty('--safe-top','24px');await pause(100);check(field.getBoundingClientRect().top>=24,'pesquisa respeita área segura superior');doc().documentElement.style.removeProperty('--safe-top');
field.value='caneca';field.dispatchEvent(new Event('input',{bubbles:true}));
await until(()=>doc().querySelectorAll('#storefrontProductsGrid .product-card').length===2);check(true,'pesquisa dentro da loja encontra duas canecas');
doc().querySelector('#storefrontProductsGrid .product-card').click();await until(()=>!doc().querySelector('#viewPDP').hidden&&!doc().querySelector('#btnPdpAddToCart').disabled);doc().querySelector('#btnBackFromPDP').click();await until(()=>!doc().querySelector('#viewStorefront').hidden);check(field.value==='caneca'&&!doc().querySelector('#storefrontSearchPanel').hidden&&doc().querySelector('#viewStorefront .pdp-nav-content').hidden,'voltar do produto preserva a pesquisa e o cabeçalho certo');

field.value='arroz';field.dispatchEvent(new Event('input',{bubbles:true}));await until(()=>doc().querySelectorAll('#storefrontProductsGrid .product-card').length===0);
check(doc().querySelector('#storefrontProductsGrid').textContent.includes('Nenhum produto'),'produto de outra loja não aparece; estado vazio visível');
doc().querySelector('#btnClearStorefrontSearch').click();doc().querySelector('#storefrontAvailable').click();
check(doc().querySelectorAll('#storefrontProductsGrid .product-card').length===4,'disponibilidade exclui o produto esgotado');
doc().querySelector('#btnStorefrontSort').click();doc().querySelector('[data-sort="price-up"]').click();
check(doc().querySelector('#storefrontProductsGrid .product-card').textContent.includes('Cora'),'ordenação por menor preço');
doc().querySelector('#btnCancelStorefrontSearch').click();
check(doc().querySelector('#storefrontSearchPanel').hidden&&!doc().body.classList.contains('is-searching'),'cancelar fecha apenas a pesquisa contextual');check(doc().querySelector('.storefront-hero').offsetHeight>0,'cancelar repõe capa e perfil');
check(!doc().querySelector('#viewStorefront .pdp-nav-content').hidden&&doc().activeElement===doc().querySelector('#btnSearchStorefront'),'cancelar devolve o cabeçalho e o foco ao ícone');
const storeView=doc().querySelector('#viewStorefront');storeView.scrollTop=80;const origin=storeView.scrollTop;doc().querySelector('#btnSearchStorefront').click();doc().querySelector('#btnCancelStorefrontSearch').click();check(Math.abs(storeView.scrollTop-origin)<1,'cancelar restaura a posição anterior da loja');

doc().querySelector('#storefrontAvailable').click();
doc().querySelector('#btnStorefrontInfo').click();check(doc().querySelector('#storefrontInfoDialog').open,'informações da loja num painel próprio');doc().querySelector('#btnCloseStorefrontInfo').click();
const product=[...doc().querySelectorAll('#storefrontProductsGrid .product-card')].find(x=>x.textContent.includes('Cora'));product.click();
await until(()=>!doc().querySelector('#viewPDP').hidden&&!doc().querySelector('#btnPdpAddToCart').disabled);doc().querySelector('#btnPdpAddToCart').click();
check(frame.contentWindow.getComputedStyle(doc().querySelector('#actionVariant')).display==='grid','grelha de variantes usa o estilo integrado final');
check(!doc().querySelector('#actionVariant select')&&doc().querySelector('#actionVariant').getAttribute('role')==='radiogroup','selecção integrada sem diálogo select do sistema');
const option=[...doc().querySelectorAll('.action-variant-option')].find(x=>x.textContent.includes('500 ml'));option.click();
check(doc().querySelectorAll('.action-variant-option[aria-checked="true"]').length===1,'uma única variante seleccionada');
doc().querySelector('#btnPdpInc').click();check(doc().querySelector('#pdpSubtotalVal').textContent.includes('1200'),'variante 500 ml × 2: 1200 MT');
check(![...doc().querySelectorAll('.action-variant-option')].some(x=>x.querySelector('select')),'opções preservam nomes e preços no painel');
doc().querySelector('#btnCloseProductAction').click();doc().querySelector('#btnBackFromPDP').click();
await until(()=>!doc().querySelector('#viewStorefront').hidden);
const shoe=[...doc().querySelectorAll('#storefrontProductsGrid .product-card')].find(x=>x.textContent.includes('Ténis'));shoe.click();
await until(()=>!doc().querySelector('#viewPDP').hidden&&!doc().querySelector('#btnPdpAddToCart').disabled);doc().querySelector('#btnPdpAddToCart').click();
check(doc().querySelectorAll('.action-variant-option:disabled').length===1,'variante esgotada aparece bloqueada');
check(doc().querySelector('.action-variant-option:disabled').textContent.includes('Esgotado'),'indisponibilidade tem rótulo textual');doc().querySelector('#btnCloseProductAction').click();
check(doc().documentElement.scrollWidth<=doc().documentElement.clientWidth,'sem deslocação horizontal');
const marketStore=JSON.parse(localStorage.getItem('kamby_cart')).find(x=>x.storeName==='Mercearia do Bairro').storeId;frame.contentWindow.location.hash='#carrinho/loja/'+marketStore;
await until(()=>!doc().querySelector('#viewStoreCart').hidden);while(doc().querySelector('#storeCartItems .cart-item-remove'))doc().querySelector('#storeCartItems .cart-item-remove').click();
check(doc().querySelector('#storeCartItems').textContent.includes('está vazio')&&doc().querySelector('#btnStoreCartWhatsApp').disabled&&doc().querySelector('#storeCartTotal').textContent==='0 MT','último artigo mostra estado vazio, total zero e contacto indisponível');
check(JSON.parse(localStorage.getItem('kamby_cart')).filter(x=>x.storeName==='Casa & Estilo').length===2,'esvaziar uma loja mantém o outro carrinho');
doc().querySelector('#commerceToastAction').click();check(doc().querySelectorAll('#storeCartItems .cart-item-row').length===1,'Desfazer funciona depois de esvaziar a loja');

output.textContent+='\\nCONCLUÍDO: '+report.length+' verificações.';
}catch(e){output.textContent+='\\nERRO: '+e.message;}finally{document.querySelector('#run').disabled=false;}};
</script>`);
