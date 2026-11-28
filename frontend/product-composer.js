import {variantAxes,categorySearchKey} from './category-variants.js';
import {canPrepareStore} from './merchant-domain.js';
import {setButtonBusy,showSpinner} from "./loading.js";
import { platform } from './platform.js';
import { preparePhoto } from './prepare-photo.js';
import { parsePriceMinor, validateProductPhoto } from './merchant-domain.js';
import { promotionInstant,sellerPriceFields,visibleSellerPrice } from './seller-pricing.js';
import { el,icon,money,notice,imageUrl,showProductThumbnail } from './merchant-ui.js';

export function setupProductComposer(hooks){
 const dialog=document.getElementById('modalNewProduct');dialog.className='merchant-editor';
 dialog.innerHTML=`<header class="pdp-top-bar editor-navigation"><div class="pdp-nav-content"><button type="button" id="btnCloseNewProductModal" class="pdp-back-btn" aria-label="Voltar ao catálogo">${icon('back')}</button><h2 class="pdp-top-title" id="modalNewProdTitle">Novo produto</h2></div></header><form id="formNewProduct" novalidate><div class="editor-scroll"><p id="newProductError" class="field-error" role="alert" hidden></p><p id="newProductProgress" class="merchant-feedback" role="status" aria-live="polite" hidden></p><section data-step="1" hidden><h3>Fotografias</h3><p class="mw-muted">Até 10 fotografias · 5 MB por ficheiro</p><div class="editor-gallery-row"><div id="editorGallery" class="editor-gallery"></div><button type="button" id="btnChooseNewProdImg" class="mw-secondary" aria-label="Adicionar fotografias">${icon('plus')}<span>Adicionar</span></button></div><input type="file" id="inputNewProdImage" accept="image/jpeg,image/png,image/webp" multiple hidden></section><section data-step="0"><h3>Dados do produto</h3><label>Nome do produto<input id="inputNewProdTitle" maxlength="160" required autocomplete="off"></label><label id="editorCategoryFilter" hidden>Pesquisar categorias<input id="editorCategorySearch" type="search" autocomplete="off" aria-controls="selectNewProdCat"><span id="editorCategoryMatches" class="mw-muted" role="status"></span></label><label>Categoria<select id="selectNewProdCat" required><option value=""></option></select><span id="editorCategoriesPending"></span></label><button type="button" id="editorRetryCategories" class="mw-text" hidden>Tentar carregar categorias</button><button type="button" id="editorOpenDetails" class="editor-details-row" aria-haspopup="dialog" aria-controls="editorDetails"><span>Descrição e características</span><span id="editorDetailsValue" class="mw-muted"></span>${icon('next')}</button>
 <dialog id="editorDetails" class="mw-filter-dialog" aria-labelledby="editorDetailsTitle">
  <header><h2 id="editorDetailsTitle">Descrição e características</h2><button type="button" id="editorCloseDetails" class="mw-icon" aria-label="Fechar">${icon('close')}</button></header>
  <label>Descrição<textarea id="inputNewProdDesc" rows="2" maxlength="5000"></textarea></label>
  <label>Condição<select id="editorCondition"><option value="new">Novo</option><option value="used">Usado</option><option value="refurbished">Recondicionado</option></select></label>
  <label>Informações essenciais<textarea id="editorAttributes" rows="2" maxlength="1000"></textarea></label>
  <footer><button type="button" id="editorApplyDetails" class="mw-primary">Concluir</button></footer>
 </dialog></section><section data-step="3" hidden><h3 id="editorPriceHeading">Preço</h3><div id="editorPrices"></div></section><section data-step="2" hidden><label class="settings-switch editor-switch"><span>Variantes</span><input type="checkbox" id="editorEnableVariants" role="switch" aria-controls="editorVariantsBody"></label><p id="editorVariantsRemoved" class="mw-muted" hidden>As variantes serão retiradas ao guardar.</p><div id="editorVariantsBody" hidden><div id="editorVariantPresets" class="editor-presets"></div><div id="editorVariants"></div><button type="button" id="editorAddVariant" class="mw-secondary">${icon('plus')}Adicionar opção</button></div></section><section data-step="4" hidden><h3 tabindex="-1" id="editorReviewHeading">Pré-visualização</h3><div id="editorReview" class="editor-review"></div></section></div><footer class="pdp-sticky-bar editor-footer"><div class="pdp-sticky-inner"><button type="button" id="editorSaveDraft" class="mw-secondary">Guardar rascunho</button><button type="submit" id="btnSubmitNewProduct" class="merchant-primary-button">Continuar</button></div></footer></form>`;
 const q=id=>dialog.querySelector('#'+id);let model=null,reviewing=false,quickEdit=false,dirty=false,busy=false,uncertain=null,urls=[],storeId='',photoRequest=0;
 const sections=[0,1,2,3,4].map(step=>dialog.querySelector('[data-step="'+step+'"]'));
 let categories=[];
 let guided=false,stage=1,historyEntry=null,cleaningHistory=false,exitDialog=null;
 const directTitle=()=>quickEdit?'Preço e promoção':'Editar produto';
 const activeVariants=()=>model.variantsEnabled?model.variants:[];
 const scroll=dialog.querySelector('.editor-scroll');
 const details=q('editorDetails');
 const detailsTrigger=q('editorOpenDetails');
 const condition=q('editorCondition');
 function refreshDetailsValue(){
   q('editorDetailsValue').textContent='Condição: '+(condition.selectedOptions[0]?.textContent||'');
 }
 detailsTrigger.onclick=()=>{
   details.showModal();
   q('editorCloseDetails').focus({preventScroll:true});
 };
 q('editorCloseDetails').onclick=()=>details.close();
 q('editorApplyDetails').onclick=()=>details.close();
 details.addEventListener('close',()=>{
   refreshDetailsValue();
   if(dialog.open)detailsTrigger.focus({preventScroll:true});
 });
 const fail=copy=>notice(q('newProductError'),copy);
 function changed(){dirty=true;fail('');clearFieldProblem();}
 dialog.querySelector('form').addEventListener('input',changed);dialog.querySelector('form').addEventListener('change',changed);
 function lock(value){busy=value;dialog.setAttribute('aria-busy',String(value));dialog.querySelectorAll('input,select,textarea,button').forEach(node=>node.disabled=value||Boolean(uncertain));if(uncertain)q('btnSubmitNewProduct').disabled=value;}
 function collectBasics(){if(!model)return;model.title=q('inputNewProdTitle').value.trim();model.description=q('inputNewProdDesc').value.trim();model.condition=q('editorCondition').value;model.attributes=q('editorAttributes').value.trim();}
 function showEditor(next=stage,{focus=false}={}){
   if(busy||uncertain)return;
   collectBasics();
   stage=next;
   reviewing=guided&&stage===3;
   const preparing=hooks.getStore()?.status!=='approved';
   const visible=quickEdit?[3]:!guided?[1,0,2,3]:stage===1?[1,0]:reviewing?[4]:[2,3];
   sections.forEach((section,index)=>{
     section.hidden=!visible.includes(index);
   });
   if(reviewing)renderReview();
   const title=q('modalNewProdTitle');
   title.textContent=guided?(reviewing?'Rever publicação':stage===2?'Preço e variantes':model.updated_at?'Editar rascunho':'Novo produto'):directTitle();
   q('btnCloseNewProductModal').setAttribute('aria-label',guided&&stage>1?'Voltar à etapa anterior':'Voltar ao catálogo');
   q('editorSaveDraft').hidden=quickEdit||reviewing||preparing||model.status==='published';
   syncSubmitLabel();
   if(focus&&dialog.open){
     scroll.scrollTop=0;
     title.tabIndex=-1;
     title.focus({preventScroll:true});
   }
 }

 function saveAsDraft(){
   return model.status==='published'&&hooks.getStore()?.status!=='approved';
 }

 function syncSubmitLabel(){
   const preparing=hooks.getStore()?.status!=='approved';
   q('btnSubmitNewProduct').textContent=saveAsDraft()?'Guardar como rascunho':quickEdit||!guided?'Guardar alterações'
     :stage===1?'Continuar':preparing?'Guardar rascunho':!reviewing&&activeVariants().length?'Rever publicação':'Publicar produto';
 }

 function fieldProblem(copy,input){
   const error=new Error(copy);
   error.field=input;
   return error;
 }

 function reportProblem(error){
   const input=error.field;
   clearFieldProblem();
   if(!input){fail(error.message);q('newProductError').scrollIntoView({block:'nearest'});return;}
   if(guided&&input.closest('section[data-step]')?.hidden){
     showEditor(input.closest('[data-step]')?.matches('[data-step="2"],[data-step="3"]')?2:1,{focus:true});
   }
   for(let group=input.closest('details');group;group=group.parentElement.closest('details'))group.open=true;
   const message=el('span','editor-field-error',error.message);
   message.id='editorFieldError';
   message.setAttribute('role','alert');
   (input.closest('label')||input).after(message);
   input.setAttribute('aria-invalid','true');
   input.setAttribute('aria-describedby',message.id);
   input.focus();
 }

 function clearFieldProblem(){
   dialog.querySelector('#editorFieldError')?.remove();
   for(const input of dialog.querySelectorAll('[aria-describedby="editorFieldError"]')){
     input.removeAttribute('aria-invalid');
     input.removeAttribute('aria-describedby');
   }
 }
 function paintCategories(){
   const select=q('selectNewProdCat');
   const query=categorySearchKey(q('editorCategorySearch').value);
   const matches=categories.filter(category=>categorySearchKey(category.name).includes(query));
   const choices=matches.slice(0,20);
   const selected=categories.find(category=>category.id===model.category_id);
   if(selected&&!choices.includes(selected))choices.unshift(selected);
   select.replaceChildren(new Option('Seleccionar categoria',''),...choices.map(category=>new Option(category.name,category.id)));
   select.value=selected?.id||'';
   q('editorCategoryMatches').textContent=matches.length>20?'A pesquisar entre '+categories.length+' categorias. Escreve um nome para reduzir a lista.':query&&!matches.length?'Nenhuma categoria encontrada.':'';
 }
 q('editorCategorySearch').oninput=event=>{event.stopPropagation();paintCategories();};
 q('editorCategorySearch').onchange=event=>event.stopPropagation();
 q('selectNewProdCat').onchange=event=>{
   model.category_id=event.target.value;
   renderVariantPresets();
 };
 async function loadCategories(){
   const expectedStore=storeId,expectedModel=model;
   const select=q('selectNewProdCat');
   const pending=q('editorCategoriesPending');
   const retry=q('editorRetryCategories');
   select.disabled=true;
   select.replaceChildren(new Option('',''));
   showSpinner(pending);
   retry.hidden=true;

   try{
     const assigned=[];
     const pageSize=200;
     for(let offset=0;;offset+=pageSize){
       const {data,error}=await platform.from('kg_store_categories')
         .select('category:kg_categories(id,name,is_active,variant_axis)').eq('store_id',expectedStore)
         .order('category_id').range(offset,offset+pageSize-1);
       if(expectedStore!==storeId||expectedModel!==model)return;
       if(error)throw error;
       assigned.push(...data);
       if(data.length<pageSize)break;
     }
     categories=assigned.map(row=>Array.isArray(row.category)?row.category[0]:row.category)
       .filter(category=>category?.is_active).sort((a,b)=>a.name.localeCompare(b.name,'pt'));
     if(categories.length===1&&!model.category_id)model.category_id=categories[0].id;
     q('editorCategoryFilter').hidden=categories.length<=12;
     paintCategories();
     renderVariantPresets();
     if(!categories.length)fail('Esta loja não tem categorias atribuídas. Contacta a administração.');
   }catch{
     if(expectedStore!==storeId||expectedModel!==model)return;
     fail('Não foi possível carregar as categorias. Tenta novamente.');
     retry.hidden=false;
   }finally{
     if(expectedStore===storeId&&expectedModel===model){
       pending.replaceChildren();
       select.disabled=busy||Boolean(uncertain);
     }
   }
 }
 q('editorRetryCategories').onclick=loadCategories;
 function newVariant(name=''){
   return {id:crypto.randomUUID(),option_name:name,...sellerPriceFields({}),in_stock:true,quantity:'',imageKey:''};
 }
 async function open(product=null,duplicate=false,mode='edit'){
  const store=hooks.getStore();if(!store||!canPrepareStore(store))return;if(dialog.open&&!await close())return;release();storeId=store.id;stage=1;uncertain=null;dirty=false;reviewing=false;quickEdit=mode==='price'||mode==='stock';guided=!quickEdit&&(!product||duplicate||product.status==='draft');dialog.classList.toggle('guided-editor',guided);
  categories=[];q('editorCategoryFilter').hidden=true;q('editorCategorySearch').value='';q('editorCategoryMatches').textContent='';
  model=product?structuredClone(product):{id:crypto.randomUUID(),title:'',category_id:'',description:'',condition:'new',attributes:'',price_minor:0,stock_status:'available',status:'draft',variants:[],images:[]};
  model.id=duplicate?crypto.randomUUID():model.id;model.updated_at=duplicate?null:model.updated_at;model.title=duplicate?model.title+' · cópia':model.title;model.status=duplicate?'draft':model.status;
  model.images=(model.images||[]).sort((a,b)=>a.sort_order-b.sort_order).map(x=>({key:crypto.randomUUID(),path:x.storage_path,preview:'',file:null}));
  model.variants=(model.variants||[]).filter(v=>v.active!==false).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map(v=>({
   ...v,id:duplicate?crypto.randomUUID():v.id,...sellerPriceFields(v),
   quantity:v.track_quantity?String(v.stock_quantity):'',
   imageKey:model.images.find(photo=>photo.path===v.image_path)?.key||''
  }));
  Object.assign(model,sellerPriceFields(model));
  model.quantity=model.stock_quantity==null?'':String(model.stock_quantity);
  model.in_stock=model.stock_status!=='out';
  model.variantsEnabled=model.variants.length>0;
  model.hadVariants=model.variantsEnabled&&!duplicate;
  if(model.variants.length){
   const commonPrice=Math.min(...model.variants.map(v=>Number(v.price)));
   model.price=commonPrice?commonPrice.toFixed(2):'';
   for(const variant of model.variants)if(variant.price===model.price)variant.price='';
  }
  q('editorPriceHeading').textContent=model.title;
  q('editorPriceHeading').hidden=!quickEdit;
  dialog.classList.toggle('price-editor',quickEdit);
  q('inputNewProdTitle').value=model.title;
  q('inputNewProdDesc').value=model.description||'';
  q('editorCondition').value=model.condition||'new';
  q('editorAttributes').value=model.attributes||'';
  refreshDetailsValue();
  fail('');notice(q('newProductProgress'),'');lock(false);q('selectNewProdCat').value='';q('selectNewProdCat').disabled=true;renderGallery();renderVariants();showEditor(1);dialog.showModal();armEditorHistory();fitViewport();document.body.classList.add('merchant-editing');(quickEdit?q('editorPrices').querySelector('input:not([type=checkbox])'):q('btnCloseNewProductModal'))?.focus({preventScroll:true});if(quickEdit)return;await loadCategories();if(!model||!dialog.open||storeId!==store.id)return;
  const generation=++photoRequest;
  await Promise.all(model.images.map(async photo=>{photo.preview=await imageUrl(platform,photo.path);}));
  if(generation===photoRequest&&dialog.open)renderGallery();
 }
 function release(){++photoRequest;urls.forEach(URL.revokeObjectURL);urls=[];}
 function armEditorHistory(){
   historyEntry={hash:location.hash};
   history.pushState({...history.state,kambyEditor:true},'');
 }

 function chooseExit(){
   if(exitDialog)return Promise.resolve('continue');
   return new Promise(resolve=>{
     const prompt=el('dialog','local-data-dialog editor-exit-dialog');
     exitDialog=prompt;
     const title=el('h2','','Sair do editor?');
     title.id='productEditorExitTitle';
     prompt.setAttribute('aria-labelledby',title.id);
     const actions=el('div','local-dialog-actions');
     for(const [value,label] of [['continue','Continuar a editar'],...(!quickEdit&&model.status!=='published'?[['draft','Guardar rascunho']]:[]),['discard','Descartar']]){
       const control=el('button','',label);
       control.type='button';
       control.onclick=()=>prompt.close(value);
       actions.append(control);
     }
     prompt.append(title,el('p','','As alterações ainda não foram guardadas.'),actions);
     prompt.addEventListener('close',()=>{
       exitDialog=null;
       prompt.remove();
       resolve(prompt.returnValue||'continue');
     },{once:true});
     document.body.append(prompt);
     prompt.showModal();
     actions.firstChild.focus();
   });
 }

 async function close(force=false){
   if(!dialog.open)return true;
   if(!force&&(busy||uncertain)){
     if(uncertain)fail('Confirma o resultado do pedido antes de sair.');
     return false;
   }
   if(!force&&dirty){
     const decision=await chooseExit();
     if(decision==='draft'){void saveDraft();return false;}
     if(decision!=='discard')return false;
   }
   exitDialog?.close();
   if(details.open)details.close();
   dialog.close();
   if(historyEntry&&location.hash===historyEntry.hash&&history.state?.kambyEditor){
     cleaningHistory=true;
     history.back();
   }
   historyEntry=null;
   document.body.classList.remove('merchant-editing');
   release();
   model=null;uncertain=null;dirty=false;
   clearFieldProblem();
   q('formNewProduct').reset();
   q('editorGallery').after(q('btnChooseNewProdImg'));
   for(const id of ['editorGallery','editorVariants','editorPrices','editorReview'])q(id).replaceChildren();
   return true;
 }

 function back(){
   if(busy||uncertain)return;
   fail('');clearFieldProblem();
   if(guided&&stage>1)showEditor(stage-1,{focus:true});
   else void close();
 }

 window.addEventListener('popstate',event=>{
   if(cleaningHistory){
     cleaningHistory=false;
     event.stopImmediatePropagation();
     return;
   }
   if(!dialog.open||location.hash!==historyEntry?.hash)return;
   event.stopImmediatePropagation();
   history.pushState({...history.state,kambyEditor:true},'');
   if(exitDialog){exitDialog.close();return;}
   const nested=[...document.querySelectorAll('dialog[open]')].at(-1);
   if(nested&&nested!==dialog){nested.close();return;}
   back();
 },true);
 q('btnCloseNewProductModal').onclick=back;
 dialog.addEventListener('cancel',event=>{if(event.target!==dialog)return;event.preventDefault();back();});
 q('btnChooseNewProdImg').onclick=()=>q('inputNewProdImage').click();q('inputNewProdImage').addEventListener('change',async e=>{await addPhotos([...e.target.files]);e.target.value='';});
 async function optimise(file) {
   validateProductPhoto(file);
   const image = await preparePhoto(file, 1600);
   validateProductPhoto(image);
   return image;
 }
 async function addPhotos(files,replaceKey=null){
   if(!model||busy||!files.length)return;
   const target=model,prepared=[];
   lock(true);
   setButtonBusy(q('btnChooseNewProdImg'),true);
   try{
     if(target.images.length+files.length-(replaceKey?1:0)>10)throw Error('Podes adicionar até 10 fotografias.');
     for(const file of files){
       const optimised=await optimise(file);
       if(model!==target)return;
       prepared.push({key:replaceKey||crypto.randomUUID(),file:optimised,path:'',preview:''});
     }
     for(const photo of prepared){
       photo.preview=URL.createObjectURL(photo.file);
       urls.push(photo.preview);
     }
     if(replaceKey){
       const index=target.images.findIndex(photo=>photo.key===replaceKey);
       if(index<0)return;
       target.images.splice(index,1,prepared[0]);
     }else target.images.push(...prepared);
     changed();
     renderGallery();
     renderVariants();
   }catch(error){if(target===model)fail(error.message||'Fotografia inválida.');}
   finally{
     if(target===model){
       setButtonBusy(q('btnChooseNewProdImg'),false);
       lock(false);
     }
   }
 }
 function renderGallery(){const grid=q('editorGallery'), add=q('btnChooseNewProdImg');grid.replaceChildren();
 model.images.forEach((photo,index)=>{const card=el('div','editor-photo');const img=el('img');img.alt='Fotografia '+(index+1);if(photo.preview)img.src=photo.preview;const up=el('button','','←'),down=el('button','','→'),remove=el('button','editor-photo-remove'),replace=el('button','','Trocar');for(const [button,glyph,label] of [[up,'back','Mover para antes'],[down,'next','Mover para depois'],[replace,'image','Trocar fotografia'],[remove,'trash','Remover fotografia']]){
 button.type='button';button.innerHTML=icon(glyph);button.setAttribute('aria-label',label+' '+(index+1));
 }up.setAttribute('aria-label','Mover fotografia '+(index+1)+' para antes');down.setAttribute('aria-label','Mover fotografia '+(index+1)+' para depois');up.disabled=index===0;down.disabled=index===model.images.length-1;function move(delta){[model.images[index],model.images[index+delta]]=[model.images[index+delta],model.images[index]];changed();renderGallery();}up.onclick=()=>move(-1);down.onclick=()=>move(1);remove.onclick=()=>{model.images.splice(index,1);model.variants.forEach(v=>{if(v.imageKey===photo.key)v.imageKey='';});changed();renderGallery();
 const next=grid.querySelectorAll('.editor-photo')[Math.min(index,model.images.length-1)]?.querySelector('.editor-photo-remove');
 (next||q('btnChooseNewProdImg')).focus({preventScroll:true});
 };replace.onclick=()=>{const input=el('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';input.onchange=()=>addPhotos([...input.files],photo.key);input.click();};const trigger=el('button','editor-photo-trigger');
 trigger.type='button';
 trigger.setAttribute('aria-label','Opções da fotografia '+(index+1));
 trigger.append(img);
 if(index===0)trigger.append(el('span','editor-cover','Capa'));
 trigger.onclick=()=>{
   const sheet=el('dialog','mw-filter-dialog mw-photo-options');
   sheet.setAttribute('aria-label','Opções da fotografia '+(index+1));
   const header=el('header');
   const close=el('button','mw-icon');
   close.type='button';close.innerHTML=icon('close');close.setAttribute('aria-label','Fechar');
   close.onclick=()=>sheet.close();
   header.append(el('h2','','Fotografia '+(index+1)),close);
   sheet.append(header);
   if(photo.preview){
     const preview=el('img','editor-photo-full');
     preview.src=photo.preview;
     preview.alt=img.alt;
     sheet.append(preview);
   }
   const actions=[[up,'Mover para antes'],[down,'Mover para depois'],[replace,'Trocar fotografia']];
   if(index>0){
     const makeCover=el('button');
     makeCover.type='button';
     makeCover.innerHTML=icon('check');
     makeCover.onclick=()=>{
       model.images.splice(index,1);
       model.images.unshift(photo);
       changed();
       renderVariants();
     };
     actions.unshift([makeCover,'Definir como capa']);
   }
   for(const [button,label] of actions){
     button.className='mw-photo-option';button.append(document.createTextNode(label));
     const perform=button.onclick;
     button.onclick=()=>{sheet.close();perform();};
     sheet.append(button);
   }
   sheet.onclose=()=>{
     sheet.remove();
     if(!model)return;
     renderGallery();
     const position=model.images.findIndex(item=>item.key===photo.key);
     const target=grid.querySelectorAll('.editor-photo')[position<0?Math.min(index,model.images.length-1):position]?.querySelector('button');
     (target||q('btnChooseNewProdImg')).focus({preventScroll:true});
   };
   dialog.append(sheet);sheet.showModal();close.focus();
 };
 card.append(trigger,remove);grid.append(card);});

 if(!model.images.length){
 const current=el('img','editor-existing-photo');
 current.alt='Fotografia actual do produto';
 if(model.image_url){grid.append(current);showProductThumbnail(platform,model,current);}

 }
 add.hidden=model.images.length>=10;
}
 function renderVariantPresets(){
   const presets=q('editorVariantPresets');
   presets.replaceChildren();
   const axis=variantAxes[categories.find(category=>category.id===model.category_id)?.variant_axis];
   if(!axis)return;
   const selected=new Set(model.variants.map(variant=>categorySearchKey(variant.option_name)));
   for(const value of axis.examples){
     if(selected.has(categorySearchKey(value)))continue;
     const add=el('button','mw-secondary',value);
     add.type='button';
     add.onclick=()=>{
       const position=Array.from(presets.children).indexOf(add);
       if(!addVariant(value))return;
       const next=presets.children[Math.min(position,presets.children.length-1)]||q('editorAddVariant');
       next.focus({preventScroll:true});
     };
     presets.append(add);
   }
 }
 function renderVariants(){
   q('editorEnableVariants').checked=model.variantsEnabled;
   q('editorVariantsBody').hidden=!model.variantsEnabled;
   q('editorVariantsRemoved').hidden=model.variantsEnabled||!model.hadVariants;
   const list=q('editorVariants');
   list.replaceChildren();
   activeVariants().forEach((variant,index)=>{
     const row=el('details','editor-variant');
     row.name='merchant-variant';
     row.open=!variant.option_name;
     const heading=el('summary','',variant.option_name||'Nova variante');
     heading.insertAdjacentHTML('beforeend',icon('next'));
     const name=el('label','','Nome da opção');
     const input=el('input');
     input.value=variant.option_name;input.maxLength=120;
     input.oninput=()=>{
       variant.option_name=input.value;
       heading.firstChild.textContent=input.value.trim()||'Nova variante';
       renderVariantPresets();
     };
     name.append(input);
     const remove=el('button','mw-secondary editor-remove-option','Retirar opção');
     remove.type='button';
     remove.onclick=()=>{
       model.variants.splice(index,1);
       changed();
       renderVariants();
       (list.children[Math.min(index,list.children.length-1)]?.querySelector('summary')||q('editorAddVariant')).focus();
     };
     row.append(heading,name,remove);
     list.append(row);
   });
   renderVariantPresets();
   renderPrices();
 }
 function addVariant(name=''){
   if(model.variants.length>=100){fail('O limite é de 100 opções por produto.');return false;}
   model.variants.push(newVariant(name));
   changed();
   renderVariants();
   if(!name){
     const row=q('editorVariants').lastElementChild;
     row.open=true;
     row.querySelector('input').focus();
   }
   return true;
 }
 q('editorEnableVariants').onchange=event=>{
   model.variantsEnabled=event.target.checked;
   renderVariants();
 };
 q('editorAddVariant').onclick=()=>addVariant();
 function priceCard(item,{common=false}={}){
   const variant=item!==model;
   const card=el('section','editor-price-card');
   const name=variant?(item.option_name||'Nova variante'):model.title;
   if(quickEdit&&variant)card.append(el('h4','editor-price-name',name));
   function priceField(key,label,placeholder){
     const control=el('label','editor-price-field');
     control.append(el('span','',label));
     const field=el('span','editor-money-field');
     const input=el('input');
     input.type='text';
     input.inputMode='decimal';
     input.dataset.productValue=key;
     input.maxLength=13;
     input.placeholder=placeholder;
     input.value=item[key].replace('.',',');
     input.oninput=()=>item[key]=input.value;
     field.append(input,el('span','editor-currency','MT'));
     control.append(field);
     return control;
   }
   const label=common?'Preço comum':variant?'Preço da variante (opcional)':'Preço';
   card.append(priceField('price',label,variant?'Usa o preço comum':''));
   if(common)return card;

   const toggle=el('label','settings-switch editor-switch');
   toggle.append(el('span','','Promoção'));
   const enabled=el('input');
   enabled.type='checkbox';
   enabled.setAttribute('role','switch');
   enabled.checked=item.promotionEnabled;
   const fields=el('div','editor-promo-fields');
   fields.id='editorPromotion-'+item.id;
   enabled.setAttribute('aria-controls',fields.id);
   fields.hidden=!enabled.checked;
   enabled.onchange=()=>{
     item.promotionEnabled=enabled.checked;
     fields.hidden=!enabled.checked;
   };
   toggle.append(enabled);
   fields.append(priceField('promoPrice','Preço promocional','Obrigatório'));

   const schedule=el('dialog','mw-filter-dialog editor-schedule-sheet');
   const trigger=el('button','editor-details-row editor-schedule-trigger');
   trigger.type='button';
   trigger.setAttribute('aria-haspopup','dialog');
   const caption=el('span','mw-muted');
   trigger.append(el('span','','Programar promoção'),caption);
   trigger.insertAdjacentHTML('beforeend',icon('next'));
   const title=el('h2','','Programar promoção');
   title.id='schedule-title-'+item.id;
   schedule.setAttribute('aria-labelledby',title.id);
   const header=el('header');
   const close=el('button','mw-icon');
   close.type='button';
   close.setAttribute('aria-label','Fechar');
   close.innerHTML=icon('close');
   close.onclick=()=>schedule.close();
   header.append(title,close);
   const dates=el('div','editor-promotion-dates');
   const controls={};
   const boundaries=[['promotionStart','Início','Começa agora'],['promotionEnd','Fim','Sem data de fim']];
   for(const [key,copy,placeholder] of boundaries){
     const range=el('fieldset','editor-promotion-boundary');
     range.append(el('legend','',copy));
     const date=el('input');
     date.type='date';
     date.dataset.productValue=key+'Date';
     const time=el('input');
     time.type='time';
     time.dataset.productValue=key+'Time';
     const dateLabel=el('label','', 'Data');
     dateLabel.append(date);
     const timeLabel=el('label','', 'Hora (opcional)');
     timeLabel.append(time);
     const fallback=el('span','mw-muted',placeholder);
     function reflectDate(){
       timeLabel.hidden=!date.value;
       fallback.hidden=Boolean(date.value);
     }
     date.addEventListener('input',reflectDate);
     controls[key]={date,time,reflectDate};
     range.append(fallback,dateLabel,timeLabel);
     dates.append(range);
   }
   const footer=el('footer');
   const apply=el('button','mw-primary','Concluir');
   apply.type='button';
   footer.append(apply);
   const error=el('p','field-error');
   error.setAttribute('role','alert');
   error.hidden=true;
   function updateCaption(){
     const short=date=>date.split('-').reverse().slice(0,2).join('/');
     const start=item.promotionStartDate,end=item.promotionEndDate;
     caption.textContent=start&&end?short(start)+' – '+short(end):start?'A partir de '+short(start):end?'Até '+short(end):'Começa agora';
   }
   updateCaption();
   trigger.onclick=()=>{
     for(const [key,{date,time,reflectDate}] of Object.entries(controls)){
       date.value=item[key+'Date'];
       time.value=item[key+'Time'];
       reflectDate();
     }
     notice(error,'');
     schedule.showModal();
   };
   schedule.addEventListener('input',event=>event.stopPropagation());
   schedule.addEventListener('change',event=>event.stopPropagation());
   schedule.addEventListener('close',()=>{if(trigger.isConnected&&dialog.open)trigger.focus({preventScroll:true});});
   apply.onclick=()=>{
     try{
       const start=controls.promotionStart,end=controls.promotionEnd;
       if([start.date,start.time,end.date,end.time].some(input=>input.validity.badInput))throw Error('Verifica as datas e horas.');
       const from=promotionInstant(start.date.value,start.date.value?start.time.value:'');
       const to=promotionInstant(end.date.value,end.date.value?end.time.value:'',true);
       if(from&&to&&Date.parse(to)<=Date.parse(from))throw Error('O fim deve ser depois do início da promoção.');
       for(const [key,{date,time}] of Object.entries(controls)){
         item[key+'Date']=date.value;
         item[key+'Time']=date.value?time.value:'';
       }
       updateCaption();
       changed();
       schedule.close();
     }catch(failure){notice(error,failure.message);}
   };
   schedule.append(header,el('p','mw-muted','Hora de Moçambique. Sem hora, aplica-se o dia inteiro.'),dates,error,footer);
   fields.append(trigger,schedule);
   card.append(toggle,fields);
   return card;
 }
 function renderPrices(){
   const container=q('editorPrices');
   container.replaceChildren(priceCard(model,{common:model.variantsEnabled}));
   for(const [index,variant] of activeVariants().entries()){
     const card=priceCard(variant);
     if(quickEdit)container.append(card);
     else{
       const row=q('editorVariants').children[index];
       row.lastElementChild.before(card);
     }
   }
   syncSubmitLabel();
 }

 function renderReview(){
 const box=q('editorReview');
 box.replaceChildren();
 const photos=model.images.filter(photo=>photo.preview);
 if(!photos.length&&model.image_url){
   const legacyImage=el('img');
   legacyImage.alt=model.title;
   box.append(legacyImage);
   void showProductThumbnail(platform,model,legacyImage);
 }
 if(photos.length){
   const frame=el('div','editor-review-gallery');
   const img=el('img');
   const cover=el('span','editor-review-photo-count');
   function selectPhoto(index){
     img.src=photos[index].preview;
     img.alt=model.title+', fotografia '+(index+1);
     cover.textContent=index===0?'Capa':(index+1)+' / '+photos.length;
     for(const [position,button] of [...frame.querySelectorAll('button')].entries())button.setAttribute('aria-pressed',String(position===index));
   }
   frame.append(img,cover);
   if(photos.length>1){
     const thumbs=el('div','editor-review-thumbs');
     thumbs.setAttribute('role','group');
     thumbs.setAttribute('aria-label','Fotografias do produto');
     for(const [index,photo] of photos.entries()){
       const button=el('button');
       button.type='button';
       button.setAttribute('aria-label',index===0?'Ver capa':'Ver fotografia '+(index+1));
       const thumb=el('img');
       thumb.src=photo.preview;
       thumb.alt='';
       button.append(thumb);
       button.onclick=()=>selectPhoto(index);
       thumbs.append(button);
     }
     frame.append(thumbs);
   }
   selectPhoto(0);
   box.append(frame);
 }
 box.append(el('h2','',model.title||'Nome do produto'));
 const variants=activeVariants();
 const now=Date.now();
 const shown=(variants.length?variants:[model]).map(item=>visibleSellerPrice(item,model.price,now));
 const amounts=shown.map(item=>item.price);
 box.append(el('strong','editor-review-price',money(Math.min(...amounts))+(new Set(amounts).size>1?' – '+money(Math.max(...amounts)):'')));
 for(const [index,variant] of variants.entries()){
   const row=el('p','editor-review-variant');
   const price=shown[index];
   row.append(el('strong','',variant.option_name));
   if(price.previous)row.append(el('del','product-previous-price',money(price.previous)));
   row.append(el('span','',money(price.price)));
   box.append(row);
 }
 box.append(el('p','mw-muted',hooks.getStore()?.name));
 if(model.description)box.append(el('p','',model.description));
 if(model.attributes)box.append(el('p','mw-muted',model.attributes));
 }
 function validateIdentity(){
   collectBasics();
   const name=q('inputNewProdTitle');
   const category=q('selectNewProdCat');
   if(model.title.length<2)throw fieldProblem('Indica um nome com pelo menos 2 caracteres.',name);
   if(!model.category_id||(!quickEdit&&!categories.some(item=>item.id===model.category_id))){
     throw fieldProblem('Selecciona uma categoria atribuída à loja.',category.disabled?null:category);
   }
 }

 function requirePhoto(){
   if(!model.images.length&&!model.image_url)throw fieldProblem('Adiciona pelo menos uma fotografia.',q('btnChooseNewProdImg'));
 }

 function documentData(status){
   validateIdentity();
   if(status==='published')requirePhoto();
   const names=new Set();
   const active=activeVariants();
   if(model.variantsEnabled&&!active.length){
     throw fieldProblem('Adiciona pelo menos uma variante.',q('editorAddVariant'));
   }

   const commonCard=q('editorPrices').firstElementChild;
   function itemData(item,card){
     const field=key=>card.querySelector('[data-product-value="'+key+'"]');
     const ownPrice=item.price.trim();
     const regularField=(ownPrice||item===model)?field('price'):commonCard.querySelector('[data-product-value="price"]');
     let regular;
     try{regular=parsePriceMinor(ownPrice||model.price.trim()||'0');}
     catch(error){throw fieldProblem(error.message,regularField);}
     if(status==='published'&&regular<=0)throw fieldProblem('Indica um preço superior a zero.',regularField);
     let price=regular,previous=null,start=null,end=null;
     if(item.promotionEnabled){
       const value=field('promoPrice');
       if(!item.promoPrice)throw fieldProblem('Indica o preço promocional.',value);
       try{price=parsePriceMinor(item.promoPrice);}
       catch(error){throw fieldProblem(error.message,value);}
       if(status==='published'&&price<=0)throw fieldProblem('Indica um preço promocional superior a zero.',value);
       if(price>=regular)throw fieldProblem('O preço promocional deve ser inferior ao preço normal.',value);
       previous=regular;
       try{
         start=promotionInstant(item.promotionStartDate,item.promotionStartTime);
         end=promotionInstant(item.promotionEndDate,item.promotionEndTime,true);
       }catch(error){throw fieldProblem(error.message,card.querySelector('.editor-schedule-trigger'));}
       if(start&&end&&Date.parse(end)<=Date.parse(start)){
         throw fieldProblem('O fim deve ser depois do início da promoção.',card.querySelector('.editor-schedule-trigger'));
       }
     }
     return {
       price_minor:price,previous_price_minor:previous,promotion_starts_at:start,promotion_ends_at:end,
       stock_quantity:item.quantity===''?null:Number(item.quantity),in_stock:item.in_stock
     };
   }
   const variants=active.map((variant,index)=>{
     const row=q('editorVariants').children[index];
     const name=variant.option_name.trim();
     const key=name.toLocaleLowerCase('pt');
     if(!name||names.has(key))throw fieldProblem('Cada opção precisa de um nome único.',row.querySelector('input'));
     names.add(key);
     const card=quickEdit?q('editorPrices').children[index+1]:row.querySelector('.editor-price-card');
     return {id:variant.id,option_name:name,...itemData(variant,card),
       track_quantity:variant.quantity!=='',image_path:model.images.find(photo=>photo.key===variant.imageKey)?.path||null};
   });
   const price=variants.length?{price_minor:0,previous_price_minor:null,promotion_starts_at:null,promotion_ends_at:null,stock_quantity:null,in_stock:true}:itemData(model,commonCard);
   return {title:model.title,category_id:model.category_id,description:model.description,
     condition:model.condition,attributes:model.attributes,status,...price,images:model.images.map(photo=>photo.path),variants};
 }
 function saveAccessMessage(message){
   if(message==='A gestão precisa de activar a loja antes da publicação'){
     return 'A loja precisa de ser aprovada para publicares este produto. As alterações continuam no editor.';
   }
   if(message==='Produto bloqueado pela administração'){
     return 'Este produto foi restringido pela gestão. Contacta o apoio da Kamby.';
   }
   return 'Não foi possível guardar. Confirma se ainda tens acesso à loja. As alterações continuam no editor.';
 }

 async function save(status){if(busy||!model)return;if(!navigator.onLine){fail('Sem ligação. As alterações continuam neste formulário. Liga-te e tenta novamente.');return;}let document;try{document=uncertain?.document||documentData(status);}catch(e){reportProblem(e);return;}lock(true);fail('');setButtonBusy(q(status==='draft'&&!q('editorSaveDraft').hidden?'editorSaveDraft':'btnSubmitNewProduct'),true);let accepted=false;const wasPublished=model.status==='published';
  try{if(!uncertain){for(let i=0;i<model.images.length;i++){const photo=model.images[i];if(photo.path)continue;notice(q('newProductProgress'),'A enviar fotografia '+(i+1)+' de '+model.images.length+'…');const extension=validateProductPhoto(photo.file);const {data:auth,error:authError}=await platform.auth.getUser();if(authError||!auth.user)throw authError||Error('Sessão expirada.');const path=auth.user.id+'/'+storeId+'/'+model.id+'/'+crypto.randomUUID()+'.'+extension;const {error}=await platform.storage.from('kg-product-images').upload(path,photo.file,{upsert:false,contentType:photo.file.type});if(error)throw fieldProblem('Não foi possível enviar a fotografia '+(i+1)+'. Tenta novamente.',q('btnChooseNewProdImg'));photo.path=path;}document=documentData(status);uncertain={request:crypto.randomUUID(),document,productId:model.id,expected:model.updated_at||null};}
   notice(q('newProductProgress'),status==='published'?'A publicar…':'A guardar…');const {data,error}=await platform.rpc('kg_save_catalogue_product',{p_request_id:uncertain.request,p_store_id:storeId,p_product_id:uncertain.productId,p_expected_updated_at:uncertain.expected,p_document:uncertain.document});if(error)throw error;accepted=true;model.updated_at=data.updated_at;model.status=data.status;dirty=false;uncertain=null;notice(q('newProductProgress'),'');const id=model.id,sid=storeId;const message=quickEdit?'Preço guardado.':data.status==='published'?(wasPublished?'Alterações guardadas.':'Produto publicado.'):data.status==='archived'?'Produto arquivado.':'Rascunho guardado.';await close(true);
   let leftFilter=false;
   try{leftFilter=await hooks.onPublished(id,sid,{newPublication:!quickEdit&&!wasPublished&&data.status==='published',quickEdit});}
   finally{hooks.onFeedback(leftFilter?'Alterações guardadas. O produto saiu do filtro actual.':message);}
  }catch(e){if(e.field){fail(e.message);q('newProductError').scrollIntoView({block:'nearest'});notice(q('newProductProgress'),'');return;}const known=/^(22|23|40|42|P000)/.test(e.code||'');if(known)uncertain=null;fail(accepted?'O produto foi guardado. Actualiza o catálogo para consultar a versão actual.':e.code==='40001'?'Outro colaborador alterou este produto. Os teus dados continuam aqui; copia as alterações antes de reabrir a versão actual.':e.code==='42501'?saveAccessMessage(e.message):known?(e.message||'Confere os dados do artigo.'):'O envio foi interrompido. '+(uncertain?'Toca em «Verificar gravação» para confirmar o mesmo pedido.':'Os dados continuam aqui. Tenta guardar novamente.'));notice(q('newProductProgress'),'');q('newProductError').scrollIntoView({block:'nearest'});}
  finally{setButtonBusy(q('editorSaveDraft'),false);setButtonBusy(q('btnSubmitNewProduct'),false);lock(false);if(uncertain)q('btnSubmitNewProduct').textContent='Verificar gravação';}
 }
 function saveDraft(){
   if(!model||busy||uncertain)return;
   try{validateIdentity();}
   catch(error){
     reportProblem(error);
     return;
   }
   void save('draft');
 }

 q('editorSaveDraft').onclick=saveDraft;
 q('formNewProduct').onsubmit=event=>{
   event.preventDefault();
   if(!model||busy||details.open)return;
   clearFieldProblem();
   fail('');
   if(uncertain){void save(uncertain.document.status);return;}
   if(quickEdit||!guided){void save(saveAsDraft()?'draft':model.status);return;}
   const status=hooks.getStore()?.status==='approved'?'published':'draft';
   if(stage>1&&(status==='draft'||reviewing||!activeVariants().length)){void save(status);return;}
   try{
     if(stage===1){
       validateIdentity();
       if(status==='published')requirePhoto();
       showEditor(2,{focus:true});
     }else{
       documentData(status);
       showEditor(3,{focus:true});
     }
   }catch(error){reportProblem(error);}
 };
 window.addEventListener('beforeunload',event=>{
   if(!dialog.open||(!dirty&&!busy&&!uncertain))return;
   event.preventDefault();
   event.returnValue='';
 });
 function fitViewport(){if(!dialog.open||!window.visualViewport)return;dialog.style.height=Math.round(window.visualViewport.height)+'px';dialog.style.top=Math.round(window.visualViewport.offsetTop)+'px';dialog.style.bottom='auto';}
 window.visualViewport?.addEventListener('resize',fitViewport);window.visualViewport?.addEventListener('scroll',fitViewport);window.addEventListener('resize',fitViewport);
 const beforeUnload=e=>{if(dialog.open&&dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',beforeUnload);
 return{open,close,clear:()=>{close(true);storeId='';},isBusy:()=>busy,isOpen:()=>dialog.open,isDirty:()=>dirty};
}
