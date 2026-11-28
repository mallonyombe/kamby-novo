import {canPrepareStore} from './merchant-domain.js';
import {setButtonBusy,showSpinner,showSkeleton} from "./loading.js";
import { platform } from './platform.js';
import { preparePhoto } from './prepare-photo.js';
import { parsePriceMinor, validateProductPhoto } from './merchant-domain.js';
import { el,icon,money,notice,confirmAction,imageUrl,showProductThumbnail } from './merchant-ui.js';

export function setupProductComposer(hooks){
 const dialog=document.getElementById('modalNewProduct');dialog.className='merchant-editor';
 dialog.innerHTML=`<header class="editor-header"><button type="button" id="btnCloseNewProductModal" class="mw-icon" aria-label="Voltar ao catálogo">${icon('back')}</button><h2 id="modalNewProdTitle">Novo produto</h2></header><form id="formNewProduct" novalidate><div class="editor-scroll"><p id="newProductError" class="field-error" role="alert" hidden></p><p id="newProductProgress" class="merchant-feedback" role="status" aria-live="polite" hidden></p><section data-step="1" hidden><h3>Fotografias</h3><p class="mw-muted">Até 10 fotografias · 5 MB por ficheiro</p><div id="editorGallery" class="editor-gallery"></div><input type="file" id="inputNewProdImage" accept="image/jpeg,image/png,image/webp" multiple hidden><button type="button" id="btnChooseNewProdImg" class="mw-secondary">${icon('plus')}Adicionar fotografias</button></section><section data-step="0"><h3>Dados do produto</h3><label>Nome do produto<input id="inputNewProdTitle" maxlength="160" required autocomplete="off"></label><label>Categoria<select id="selectNewProdCat" required><option value=""></option></select><span id="editorCategoriesPending"></span></label><button type="button" id="editorRetryCategories" class="mw-text" hidden>Tentar carregar categorias</button><button type="button" id="editorOpenDetails" class="editor-details-row" aria-haspopup="dialog" aria-controls="editorDetails"><span>Descrição e características</span><span id="editorDetailsValue" class="mw-muted"></span>${icon('next')}</button>
 <dialog id="editorDetails" class="mw-filter-dialog" aria-labelledby="editorDetailsTitle">
  <header><h2 id="editorDetailsTitle">Descrição e características</h2><button type="button" id="editorCloseDetails" class="mw-icon" aria-label="Fechar">${icon('close')}</button></header>
  <label>Descrição<textarea id="inputNewProdDesc" rows="2" maxlength="5000"></textarea></label>
  <label>Condição<select id="editorCondition"><option value="new">Novo</option><option value="used">Usado</option><option value="refurbished">Recondicionado</option></select></label>
  <label>Informações essenciais<textarea id="editorAttributes" rows="2" maxlength="1000"></textarea></label>
  <footer><button type="button" id="editorApplyDetails" class="mw-primary">Concluir</button></footer>
 </dialog></section><section data-step="3" hidden><h3 id="editorPriceHeading">Preço e stock</h3><div id="editorPrices"></div></section><section data-step="2" hidden><details class="editor-extra" id="editorOptions"><summary>Adicionar variantes</summary><label class="mw-check"><input type="checkbox" id="editorHasVariants">Usar variantes</label><div id="editorVariantsBody" hidden><div id="editorVariants"></div><button type="button" id="editorAddVariant" class="mw-secondary">${icon('plus')}Adicionar opção</button></div></details></section><section data-step="4" hidden><h3 tabindex="-1" id="editorReviewHeading">Pré-visualização</h3><div id="editorReview" class="editor-review"></div></section></div><footer class="editor-footer"><button type="button" id="editorSaveDraft" class="mw-secondary">Guardar rascunho</button><button type="submit" id="btnSubmitNewProduct" class="mw-primary">Continuar</button></footer></form>`;
 const q=id=>dialog.querySelector('#'+id);let model=null,reviewing=false,quickEdit=false,dirty=false,busy=false,uncertain=null,urls=[],storeId='',photoRequest=0;
 const sections=[0,1,2,3,4].map(step=>dialog.querySelector('[data-step="'+step+'"]'));
 let guided=false,stage=1,historyEntry=null,cleaningHistory=false,exitDialog=null;
 const directTitle=()=>quickEdit?'Preço e stock':'Editar produto';
 const scroll=dialog.querySelector('.editor-scroll');
 const details=q('editorDetails');
 const detailsTrigger=q('editorOpenDetails');
 const condition=q('editorCondition');
 function refreshDetailsValue(){
   q('editorDetailsValue').textContent=condition.selectedOptions[0]?.textContent||'';
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
 function collectBasics(){if(!model)return;model.title=q('inputNewProdTitle').value.trim();if(!q('selectNewProdCat').disabled)model.category_id=q('selectNewProdCat').value;model.description=q('inputNewProdDesc').value.trim();model.condition=q('editorCondition').value;model.attributes=q('editorAttributes').value.trim();}
 function showEditor(next=stage,{focus=false}={}){
   if(busy||uncertain)return;
   collectBasics();
   stage=next;
   reviewing=guided&&stage===2;
   const preparing=hooks.getStore()?.status!=='approved';
   const visible=quickEdit?[3]:reviewing?[4]:[1,0,2,3];
   sections.forEach((section,index)=>{
     section.hidden=!visible.includes(index)||(index===3&&!quickEdit&&model.variants.length>0);
   });
   if(reviewing)renderReview();
   const title=q('modalNewProdTitle');
   title.textContent=guided?(reviewing?'Rever publicação':model.updated_at?'Editar rascunho':'Novo produto'):directTitle();
   q('btnCloseNewProductModal').setAttribute('aria-label',reviewing?'Voltar à edição':'Voltar ao catálogo');
   q('editorSaveDraft').hidden=quickEdit||reviewing||preparing||model.status==='published';
   syncSubmitLabel();
   if(focus&&dialog.open){
     scroll.scrollTop=0;
     title.tabIndex=-1;
     title.focus({preventScroll:true});
   }
 }

 function syncSubmitLabel(){
   const preparing=hooks.getStore()?.status!=='approved';
   q('btnSubmitNewProduct').textContent=quickEdit||!guided?'Guardar alterações'
     :preparing?'Guardar rascunho':!reviewing&&model.variants.length?'Rever publicação':'Publicar produto';
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
     showEditor(1,{focus:true});
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
     const {data,error}=await platform.from('kg_store_categories')
       .select('category:kg_categories(id,name,is_active)').eq('store_id',expectedStore);
     if(error)throw error;
     if(expectedStore!==storeId||expectedModel!==model)return;

     const categories=(data||[]).map(row=>Array.isArray(row.category)?row.category[0]:row.category)
       .filter(category=>category?.is_active);
     const onlyCategory=categories.length===1?categories[0]:null;
     if(onlyCategory&&!model.category_id)model.category_id=onlyCategory.id;

     const options=categories.map(category=>new Option(category.name,category.id));
     if(!onlyCategory||model.category_id!==onlyCategory.id){
       options.unshift(new Option('Seleccionar categoria',''));
     }
     select.replaceChildren(...options);
     select.value=model.category_id||'';
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
 function newVariant(name=''){return{id:crypto.randomUUID(),option_name:name,price_minor:0,price:'',previous:'',in_stock:true,track_quantity:false,stock_quantity:0,quantity:'',imageKey:''};}
 async function open(product=null,duplicate=false,mode='edit'){
  const store=hooks.getStore();if(!store||!canPrepareStore(store))return;if(dialog.open&&!await close())return;release();storeId=store.id;stage=1;uncertain=null;dirty=false;reviewing=false;quickEdit=mode==='stock';guided=!quickEdit&&(!product||duplicate||product.status==='draft');dialog.classList.toggle('guided-editor',guided);
  model=product?structuredClone(product):{id:crypto.randomUUID(),title:'',category_id:'',description:'',condition:'new',attributes:'',price_minor:0,stock_status:'available',status:'draft',variants:[],images:[]};
  model.id=duplicate?crypto.randomUUID():model.id;model.updated_at=duplicate?null:model.updated_at;model.title=duplicate?model.title+' · cópia':model.title;model.status=duplicate?'draft':model.status;
  model.images=(model.images||[]).sort((a,b)=>a.sort_order-b.sort_order).map(x=>({key:crypto.randomUUID(),path:x.storage_path,preview:'',file:null}));
  model.variants=(model.variants||[]).filter(v=>v.active!==false).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map(v=>({...v,id:duplicate?crypto.randomUUID():v.id,price:(Number(v.price_minor)/100).toFixed(2),previous:v.previous_price_minor?(Number(v.previous_price_minor)/100).toFixed(2):'',quantity:v.track_quantity?String(v.stock_quantity):'',imageKey:model.images.find(x=>x.path===v.image_path)?.key||''}));
  model.price=model.price_minor?(Number(model.price_minor)/100).toFixed(2):'';model.previous=model.previous_price_minor?(Number(model.previous_price_minor)/100).toFixed(2):'';model.quantity=model.stock_quantity==null?'':String(model.stock_quantity);model.in_stock=model.stock_status!=='out';
  q('editorPriceHeading').textContent=quickEdit?model.title:'Preço e stock';
  dialog.classList.toggle('stock-editor',quickEdit);
  q('inputNewProdTitle').value=model.title;q('inputNewProdDesc').value=model.description||'';q('editorCondition').value=model.condition||'new';q('editorAttributes').value=model.attributes||'';q('editorHasVariants').checked=!!model.variants.length;q('editorOptions').open=false;q('editorOptions').querySelector('summary').textContent=model.variants.length?'Variantes · '+model.variants.length:'Adicionar variantes';refreshDetailsValue();
  fail('');notice(q('newProductProgress'),'');lock(false);q('selectNewProdCat').value='';q('selectNewProdCat').disabled=true;renderGallery();renderVariants();showEditor(1);dialog.showModal();armEditorHistory();fitViewport();document.body.classList.add('merchant-editing');(quickEdit?q('editorPrices').querySelector('input:not([type=checkbox])'):q('btnCloseNewProductModal'))?.focus({preventScroll:true});if(quickEdit)return;await loadCategories();if(!model||!dialog.open||storeId!==store.id)return;
  const generation=++photoRequest;await Promise.all(model.images.map(async photo=>{photo.preview=await imageUrl(platform,photo.path);if(generation===photoRequest&&dialog.open)renderGallery();}));
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
   for(const id of ['editorGallery','editorVariants','editorPrices','editorReview'])q(id).replaceChildren();
   return true;
 }

 function back(){
   if(busy||uncertain)return;
   fail('');clearFieldProblem();
   if(reviewing)showEditor(1,{focus:true});
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
 function renderGallery(){const grid=q('editorGallery');grid.replaceChildren();
 const thumbs=el('div','editor-photo-thumbs');
 model.images.forEach((photo,index)=>{const card=el('div','editor-photo');const img=el('img');img.alt='Fotografia '+(index+1);if(photo.preview)img.src=photo.preview;const up=el('button','','←'),down=el('button','','→'),remove=el('button','','Remover'),replace=el('button','','Trocar');for(const [button,glyph,label] of [[up,'back','Mover para antes'],[down,'next','Mover para depois'],[replace,'image','Trocar fotografia'],[remove,'trash','Remover fotografia']]){
 button.type='button';button.innerHTML=icon(glyph);button.setAttribute('aria-label',label+' '+(index+1));
 }up.setAttribute('aria-label','Mover fotografia '+(index+1)+' para antes');down.setAttribute('aria-label','Mover fotografia '+(index+1)+' para depois');up.disabled=index===0;down.disabled=index===model.images.length-1;function move(delta){[model.images[index],model.images[index+delta]]=[model.images[index+delta],model.images[index]];changed();renderGallery();}up.onclick=()=>move(-1);down.onclick=()=>move(1);remove.onclick=()=>{model.images.splice(index,1);model.variants.forEach(v=>{if(v.imageKey===photo.key)v.imageKey='';});changed();renderGallery();renderVariants();};replace.onclick=()=>{const input=el('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';input.onchange=()=>addPhotos([...input.files],photo.key);input.click();};const trigger=el('button','editor-photo-trigger');
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
   const actions=[[up,'Mover para antes'],[down,'Mover para depois'],[replace,'Trocar fotografia'],[remove,'Remover fotografia']];
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
 card.append(trigger);(index===0||!guided?grid:thumbs).append(card);});
 if(thumbs.childElementCount)grid.append(thumbs);
 if(!model.images.length){
 const current=el('img','editor-existing-photo');
 current.alt='Fotografia actual do produto';
 if(model.image_url){grid.append(current);showProductThumbnail(platform,model,current);}

}}
 q('editorHasVariants').onchange=async()=>{if(!q('editorHasVariants').checked&&model.variants.length){if(!await confirmAction('Retirar as opções?','O produto passa a ter um preço único. Variantes anteriores deixam de estar disponíveis para novos pedidos.','Retirar')){q('editorHasVariants').checked=true;return;}model.variants=[];}if(q('editorHasVariants').checked&&!model.variants.length)model.variants.push(newVariant());changed();renderVariants();};
 function renderVariants(){q('editorOptions').querySelector('summary').textContent=model.variants.length?'Variantes · '+model.variants.length:'Adicionar variantes';q('editorVariantsBody').hidden=!q('editorHasVariants').checked;const list=q('editorVariants');list.replaceChildren();model.variants.forEach((v,index)=>{const row=el('details','editor-variant');
 row.name='merchant-variant';
 row.open=!v.option_name;
 const heading=el('summary','',v.option_name||'Nova variante');
 row.append(heading);
 const name=el('label','','Opção '+(index+1));const input=el('input');input.value=v.option_name;input.maxLength=120;input.oninput=()=>{v.option_name=input.value;heading.textContent=input.value.trim()||'Nova variante';};name.append(input);const photoLabel=el('label','','Fotografia');const select=el('select');select.append(new Option('Galeria do produto',''));model.images.forEach((photo,i)=>select.append(new Option('Fotografia '+(i+1)+(i===0?' · Capa':''),photo.key)));select.value=v.imageKey;select.onchange=()=>v.imageKey=select.value;photoLabel.append(select);const remove=el('button','mw-text','Retirar opção');remove.type='button';remove.onclick=()=>{model.variants.splice(index,1);if(!model.variants.length)q('editorHasVariants').checked=false;changed();renderVariants();};row.append(name,photoLabel,remove);list.append(row);});renderPrices();}
 q('editorAddVariant').onclick=()=>{if(model.variants.length>=100){fail('O limite é de 100 opções por produto.');return;}model.variants.push(newVariant());changed();renderVariants();q('editorVariants').lastElementChild.querySelector('input').focus();};
 function renderPrices(){
  const container=q('editorPrices');container.replaceChildren();
  const items=model.variants.length?model.variants:[model];
  sections[3].hidden=!quickEdit&&(model.variants.length>0||reviewing);
  syncSubmitLabel();
  items.forEach(item=>{
   const card=el('section','editor-price-card');const name=item===model?(quickEdit?model.title:'Produto sem variantes'):item.option_name||'Opção sem nome';card.setAttribute('aria-label',name);
   const main=el('div','editor-price-main');main.append(el('strong','editor-price-name',name));
   function priceField(key,label,placeholder){const field=el('label','editor-money-field');field.append(el('span','commerce-sr-only',label+' de '+name));const input=el('input');input.type='text';input.inputMode='decimal';input.dataset.productValue=key;input.maxLength=13;input.placeholder=placeholder;input.value=item[key]||'';input.oninput=()=>item[key]=input.value;field.append(input,el('span','editor-currency','MT'));return field;}
   const priceLabel=el('div','editor-current-price');priceLabel.append(el('span','','Preço'),priceField('price','Preço actual',''));

   const more=el('details','editor-price-details');more.open=Boolean(item.previous);more.append(el('summary','',item.previous?'Promoção activa':'Adicionar promoção'));
   const fields=el('div','editor-stock-fields');const previous=el('div','editor-promotion-field');previous.append(el('span','','Preço antes da promoção'),priceField('previous','Preço anterior','Sem promoção'));more.append(previous);
   const quantityLabel=el('label','','Quantidade (opcional)'),quantity=el('input');quantity.type='number';quantity.dataset.productValue='quantity';quantity.min='0';quantity.max='1000000000';quantity.step='1';quantity.placeholder='Sem limite';quantity.value=item.quantity;quantity.oninput=()=>{item.quantity=quantity.value;if(Number(quantity.value)>0){item.in_stock=true;stock.checked=true;}};quantityLabel.append(quantity);fields.append(quantityLabel);
   const stockLabel=el('label','mw-check'),stock=el('input');stock.type='checkbox';stock.checked=item.in_stock;stock.onchange=()=>item.in_stock=stock.checked;stockLabel.append(stock,document.createTextNode('Em stock'));
   fields.append(stockLabel);
   if(quickEdit){
     if(item!==model)card.append(main);
     card.append(priceLabel,fields);
     if(item.previous)card.append(more);
     container.append(card);
   }
   else{
     const stockDetails=el('details','editor-price-details');
     stockDetails.open=item.quantity!==''||!item.in_stock;
     stockDetails.append(el('summary','','Stock'),fields);
     card.append(priceLabel,stockDetails,more);
     if(item===model)container.append(card);
     else q('editorVariants').children[model.variants.indexOf(item)].append(card);
   }
  });
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
 box.append(el('h2','',model.title||'Nome do produto'));try{const prices=(model.variants.length?model.variants:[model]).map(v=>parsePriceMinor(v.price||'0'));box.append(el('strong','editor-review-price',money(Math.min(...prices))+(new Set(prices).size>1?' – '+money(Math.max(...prices)):'')));}catch{box.append(el('p','field-error','Confere os preços antes de publicar.'));}if(!model.variants.length&&model.previous){try{const before=parsePriceMinor(model.previous),now=parsePriceMinor(model.price);if(before>now)box.append(el('del','product-previous-price',money(before)),el('span','product-discount','−'+Math.round((1-now/before)*100)+'%'));}catch{}}
 for(const variant of model.variants){
   const row=el('p','editor-review-variant');
   row.append(el('strong','',variant.option_name));
   if(variant.previous)row.append(el('del','product-previous-price',money(parsePriceMinor(variant.previous))));
   row.append(el('span','',money(parsePriceMinor(variant.price||'0'))));
   if(!variant.in_stock||variant.quantity==='0')row.append(el('span','mw-muted','Esgotado'));
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
   if(!model.category_id)throw fieldProblem('Selecciona uma categoria atribuída à loja.',category);
 }

 function requirePhoto(){
   if(!model.images.length&&!model.image_url)throw fieldProblem('Adiciona pelo menos uma fotografia.',q('btnChooseNewProdImg'));
 }

 function documentData(status){
   validateIdentity();
   if(status==='published')requirePhoto();
   const names=new Set();
   function itemData(item,card){
     const field=key=>card?.querySelector('[data-product-value="'+key+'"]');
     let price,previous;
     try{price=parsePriceMinor(item.price||'0');}catch(error){throw fieldProblem(error.message,field('price'));}
     if(status==='published'&&price<=0)throw fieldProblem('Indica um preço superior a zero.',field('price'));
     try{previous=item.previous?parsePriceMinor(item.previous):null;}catch(error){throw fieldProblem(error.message,field('previous'));}
     if(previous!=null&&previous<=price)throw fieldProblem('O preço anterior deve ser superior ao actual.',field('previous'));
     const quantity=item.quantity===''?null:Number(item.quantity);
     if(quantity!==null&&(!Number.isInteger(quantity)||quantity<0||quantity>1000000000)){
       throw fieldProblem('Indica uma quantidade inteira igual ou superior a zero.',field('quantity'));
     }
     return {price_minor:price,previous_price_minor:previous,stock_quantity:quantity,in_stock:item.in_stock};
   }
   const variants=model.variants.map((variant,index)=>{
     const row=q('editorVariants').children[index];
     const name=variant.option_name.trim();
     const key=name.toLocaleLowerCase('pt');
     if(!name||names.has(key))throw fieldProblem('Cada opção precisa de um nome único.',row.querySelector('input'));
     names.add(key);
     const card=quickEdit?q('editorPrices').children[index]:row;
     return {id:variant.id,option_name:name,...itemData(variant,card),
       track_quantity:variant.quantity!=='',image_path:model.images.find(photo=>photo.key===variant.imageKey)?.path||null};
   });
   const price=variants.length?{price_minor:0,previous_price_minor:null,stock_quantity:null,in_stock:true}:itemData(model,q('editorPrices'));
   return {title:model.title,category_id:model.category_id,description:model.description,
     condition:model.condition,attributes:model.attributes,status,...price,images:model.images.map(photo=>photo.path),variants};
 }
 async function save(status){if(busy||!model)return;if(!navigator.onLine){fail('Sem ligação. As alterações continuam neste formulário. Liga-te e tenta novamente.');return;}let document;try{document=uncertain?.document||documentData(status);}catch(e){reportProblem(e);return;}lock(true);fail('');setButtonBusy(q(status==='draft'&&!q('editorSaveDraft').hidden?'editorSaveDraft':'btnSubmitNewProduct'),true);let accepted=false;const wasPublished=model.status==='published';
  try{if(!uncertain){for(let i=0;i<model.images.length;i++){const photo=model.images[i];if(photo.path)continue;notice(q('newProductProgress'),'A enviar fotografia '+(i+1)+' de '+model.images.length+'…');const extension=validateProductPhoto(photo.file);const {data:auth,error:authError}=await platform.auth.getUser();if(authError||!auth.user)throw authError||Error('Sessão expirada.');const path=auth.user.id+'/'+storeId+'/'+model.id+'/'+crypto.randomUUID()+'.'+extension;const {error}=await platform.storage.from('kg-product-images').upload(path,photo.file,{upsert:false,contentType:photo.file.type});if(error)throw fieldProblem('Não foi possível enviar a fotografia '+(i+1)+'. Tenta novamente.',q('btnChooseNewProdImg'));photo.path=path;}document=documentData(status);uncertain={request:crypto.randomUUID(),document,productId:model.id,expected:model.updated_at||null};}
   notice(q('newProductProgress'),status==='published'?'A publicar…':'A guardar…');const {data,error}=await platform.rpc('kg_save_catalogue_product',{p_request_id:uncertain.request,p_store_id:storeId,p_product_id:uncertain.productId,p_expected_updated_at:uncertain.expected,p_document:uncertain.document});if(error)throw error;accepted=true;model.updated_at=data.updated_at;model.status=data.status;dirty=false;uncertain=null;notice(q('newProductProgress'),'');const id=model.id,sid=storeId;const message=quickEdit?'Preço e stock guardados.':data.status==='published'?(wasPublished?'Alterações guardadas.':'Produto publicado.'):data.status==='archived'?'Produto arquivado.':'Rascunho guardado.';await close(true);
   let leftFilter=false;
   try{leftFilter=await hooks.onPublished(id,sid,{newPublication:!quickEdit&&!wasPublished&&data.status==='published',quickEdit});}
   finally{hooks.onFeedback(leftFilter?'Alterações guardadas. O produto saiu do filtro actual.':message);}
  }catch(e){if(e.field){fail(e.message);q('newProductError').scrollIntoView({block:'nearest'});notice(q('newProductProgress'),'');return;}const known=/^(22|23|40|42|P000)/.test(e.code||'');if(known)uncertain=null;fail(accepted?'O produto foi guardado. Actualiza o catálogo para consultar a versão actual.':e.code==='40001'?'Outro colaborador alterou este produto. Os teus dados continuam aqui; copia as alterações antes de reabrir a versão actual.':e.code==='42501'?'A sessão ou as permissões da loja mudaram. As alterações não foram guardadas.':known?(e.message||'Confere os dados do artigo.'):'O envio foi interrompido. '+(uncertain?'Toca em «Verificar gravação» para confirmar o mesmo pedido.':'Os dados continuam aqui. Tenta guardar novamente.'));notice(q('newProductProgress'),'');}
  finally{setButtonBusy(q('editorSaveDraft'),false);setButtonBusy(q('btnSubmitNewProduct'),false);lock(false);if(uncertain)q('btnSubmitNewProduct').textContent='Verificar gravação';}
 }
 function saveDraft(){
   if(!model||busy||uncertain)return;
   try{validateIdentity();}
   catch(error){
     if(guided)showEditor(1,{focus:true});
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
   if(quickEdit||!guided){void save(model.status);return;}
   const status=hooks.getStore()?.status==='approved'?'published':'draft';
   if(status==='draft'||reviewing||!model.variants.length){void save(status);return;}
   try{
     documentData(status);
     showEditor(2,{focus:true});
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
