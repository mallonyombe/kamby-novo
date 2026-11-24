import {canPrepareStore} from './merchant-domain.js';
import {setButtonBusy,showSpinner,showSkeleton} from "./loading.js";
import { platform } from './platform.js';
import { parsePriceMinor, validateProductPhoto } from './merchant-domain.js';
import { el,icon,money,notice,confirmAction,imageUrl,showProductThumbnail } from './merchant-ui.js';

export function setupProductComposer(hooks){
 const dialog=document.getElementById('modalNewProduct');dialog.className='merchant-editor';
 dialog.innerHTML=`<header class="editor-header"><button type="button" id="btnCloseNewProductModal" class="mw-icon" aria-label="Voltar ao catálogo">${icon('back')}</button><h2 id="modalNewProdTitle">Novo produto</h2><span aria-hidden="true"></span></header><form id="formNewProduct" novalidate><div class="editor-scroll"><p id="newProductError" class="field-error" role="alert" hidden></p><p id="newProductProgress" class="merchant-feedback" role="status" aria-live="polite" hidden></p><section data-step="1" hidden><h3>Fotografias</h3><p class="mw-muted">Até 10 fotografias. A primeira é a capa. JPG, PNG ou WebP, até 5 MB cada.</p><div id="editorGallery" class="editor-gallery"></div><input type="file" id="inputNewProdImage" accept="image/jpeg,image/png,image/webp" multiple hidden><button type="button" id="btnChooseNewProdImg" class="mw-secondary">${icon('plus')}Adicionar fotografias</button></section><section data-step="0"><h3>Informações básicas</h3><label>Nome do produto<input id="inputNewProdTitle" maxlength="160" required autocomplete="off"></label><label>Descrição<textarea id="inputNewProdDesc" rows="4" maxlength="5000" placeholder="Materiais, utilização e conservação"></textarea></label><label>Categoria<select id="selectNewProdCat" required><option value=""></option></select><span id="editorCategoriesPending"></span></label><button type="button" id="editorRetryCategories" class="mw-text" hidden>Tentar carregar categorias</button><details class="editor-extra"><summary>Características</summary><label>Condição<select id="editorCondition"><option value="new">Novo</option><option value="used">Usado</option><option value="refurbished">Recondicionado</option></select></label><label>Informações essenciais<textarea id="editorAttributes" rows="2" maxlength="1000" ></textarea></label></details></section><section data-step="3" hidden><h3 id="editorPriceHeading">Preço e stock</h3><div id="editorPrices"></div></section><section data-step="2" hidden><details class="editor-extra" id="editorOptions"><summary>Variantes</summary><label class="mw-check"><input type="checkbox" id="editorHasVariants">Usar variantes</label><div id="editorVariantsBody" hidden><div id="editorVariants"></div><button type="button" id="editorAddVariant" class="mw-secondary">${icon('plus')}Adicionar opção</button></div></details></section><section data-step="4" hidden><h3>Revisão e publicação</h3><div id="editorReview" class="editor-review"></div></section></div><footer class="editor-footer"><button type="button" id="editorBack" class="mw-secondary" hidden>Voltar à edição</button><button type="button" id="editorSaveDraft" class="mw-secondary">Guardar rascunho</button><button type="submit" id="btnSubmitNewProduct" class="mw-primary">Continuar</button></footer></form>`;
 const q=id=>dialog.querySelector('#'+id);let model=null,reviewing=false,stockOnly=false,dirty=false,busy=false,uncertain=null,categories=[],urls=[],storeId='',photoRequest=0;
 const sections=[0,1,2,3,4].map(step=>dialog.querySelector('[data-step="'+step+'"]'));
 const fail=copy=>notice(q('newProductError'),copy);
 function changed(){dirty=true;fail('');}
 dialog.querySelector('form').addEventListener('input',changed);dialog.querySelector('form').addEventListener('change',changed);
 function lock(value){busy=value;dialog.setAttribute('aria-busy',String(value));dialog.querySelectorAll('input,select,textarea,button').forEach(node=>node.disabled=value||Boolean(uncertain));if(uncertain)q('btnSubmitNewProduct').disabled=value;}
 function collectBasics(){if(!model)return;model.title=q('inputNewProdTitle').value.trim();if(!q('selectNewProdCat').disabled)model.category_id=q('selectNewProdCat').value;model.description=q('inputNewProdDesc').value.trim();model.condition=q('editorCondition').value;model.attributes=q('editorAttributes').value.trim();}
 function showEditor(review=false){
   if(busy||uncertain)return;
   collectBasics();
   reviewing=review;
   sections.forEach((section,index)=>{
     section.hidden=review?index!==4:stockOnly?index!==3:index===4||(index===3&&model.variants.length>0);
   });
   if(review)renderReview();
   q('editorBack').hidden=!review;
   const preparing=hooks.getStore()?.status!=='approved';
   q('editorSaveDraft').hidden=review||stockOnly||preparing||model.status==='published';
   q('btnSubmitNewProduct').textContent=stockOnly?'Guardar stock':
     preparing?'Guardar rascunho':review?'Publicar produto':model.status==='published'?'Guardar alterações':'Rever e publicar';
   dialog.querySelector('.editor-scroll').scrollTop=0;
 }
 q('editorBack').onclick=()=>showEditor();
 async function loadCategories(){const expectedStore=storeId,expectedModel=model;const select=q('selectNewProdCat');select.disabled=true;select.replaceChildren(new Option('',''));showSpinner(q('editorCategoriesPending'));q('editorRetryCategories').hidden=true;try{const {data,error}=await platform.from('kg_store_categories').select('category:kg_categories(id,name,is_active)').eq('store_id',storeId);if(error)throw error;if(expectedStore!==storeId||expectedModel!==model)return;categories=(data||[]).map(x=>Array.isArray(x.category)?x.category[0]:x.category).filter(x=>x?.is_active);const select=q('selectNewProdCat');select.replaceChildren(new Option('Seleccionar categoria',''));categories.forEach(c=>select.append(new Option(c.name,c.id)));select.value=model?.category_id||'';if(!categories.length)fail('Esta loja não tem categorias atribuídas. Contacta a administração.');}catch{if(expectedStore!==storeId||expectedModel!==model)return;fail('Não foi possível carregar as categorias. Tenta novamente.');q('editorRetryCategories').hidden=false;}finally{if(expectedStore===storeId&&expectedModel===model){q('editorCategoriesPending').replaceChildren();select.disabled=busy||Boolean(uncertain);}}}
 q('editorRetryCategories').onclick=loadCategories;
 function newVariant(name=''){return{id:crypto.randomUUID(),option_name:name,price_minor:0,price:'',previous:'',in_stock:true,track_quantity:false,stock_quantity:0,quantity:'',imageKey:''};}
 async function open(product=null,duplicate=false,mode='edit'){
  const store=hooks.getStore();if(!store||!canPrepareStore(store))return;if(dialog.open&&!await close())return;release();storeId=store.id;uncertain=null;dirty=false;reviewing=false;stockOnly=mode==='stock';
  model=product?structuredClone(product):{id:crypto.randomUUID(),title:'',category_id:'',description:'',condition:'new',attributes:'',price_minor:0,stock_status:'available',status:'draft',variants:[],images:[]};
  model.id=duplicate?crypto.randomUUID():model.id;model.updated_at=duplicate?null:model.updated_at;model.title=duplicate?model.title+' · cópia':model.title;model.status=duplicate?'draft':model.status;
  model.images=(model.images||[]).sort((a,b)=>a.sort_order-b.sort_order).map(x=>({key:crypto.randomUUID(),path:x.storage_path,preview:'',file:null}));
  model.variants=(model.variants||[]).filter(v=>v.active!==false).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map(v=>({...v,id:duplicate?crypto.randomUUID():v.id,price:(Number(v.price_minor)/100).toFixed(2),previous:v.previous_price_minor?(Number(v.previous_price_minor)/100).toFixed(2):'',quantity:v.track_quantity?String(v.stock_quantity):'',imageKey:model.images.find(x=>x.path===v.image_path)?.key||''}));
  model.price=model.price_minor?(Number(model.price_minor)/100).toFixed(2):'';model.previous=model.previous_price_minor?(Number(model.previous_price_minor)/100).toFixed(2):'';model.quantity=model.stock_quantity==null?'':String(model.stock_quantity);model.in_stock=model.stock_status!=='out';
  q('modalNewProdTitle').textContent=stockOnly?'Actualizar stock':product&&!duplicate?'Editar produto':'Novo produto';
  q('editorPriceHeading').textContent=stockOnly?model.title:'Preço e stock';
  dialog.classList.toggle('stock-editor',stockOnly);
  q('inputNewProdTitle').value=model.title;q('inputNewProdDesc').value=model.description||'';q('editorCondition').value=model.condition||'new';q('editorAttributes').value=model.attributes||'';q('editorHasVariants').checked=!!model.variants.length;q('editorOptions').open=false;q('editorOptions').querySelector('summary').textContent=model.variants.length?'Variantes · '+model.variants.length:'Variantes';sections[0].querySelector('details').open=false;
  fail('');notice(q('newProductProgress'),'');lock(false);q('selectNewProdCat').value='';q('selectNewProdCat').disabled=true;renderGallery();renderVariants();showEditor();dialog.showModal();fitViewport();document.body.classList.add('merchant-editing');(stockOnly?q('editorPrices').querySelector('input:not([type=checkbox])'):q('btnCloseNewProductModal'))?.focus({preventScroll:true});if(stockOnly)return;await loadCategories();if(!model||!dialog.open||storeId!==store.id)return;
  const generation=++photoRequest;await Promise.all(model.images.map(async photo=>{photo.preview=await imageUrl(platform,photo.path);if(generation===photoRequest&&dialog.open)renderGallery();}));
 }
 function release(){++photoRequest;urls.forEach(URL.revokeObjectURL);urls=[];}
 async function close(force=false){if(!dialog.open)return true;if(!force&&(busy||uncertain)){if(uncertain)fail('Confirma o resultado do pedido antes de sair.');return false;}if(!force&&dirty&&!await confirmAction('Sair sem guardar?','As alterações deste produto ainda não foram guardadas.','Descartar'))return false;dialog.close();document.body.classList.remove('merchant-editing');release();model=null;uncertain=null;dirty=false;q('formNewProduct').reset();['editorGallery','editorVariants','editorPrices','editorReview'].forEach(id=>q(id).replaceChildren());return true;}
 q('btnCloseNewProductModal').onclick=()=>close();dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 q('btnChooseNewProdImg').onclick=()=>q('inputNewProdImage').click();q('inputNewProdImage').addEventListener('change',async e=>{await addPhotos([...e.target.files]);e.target.value='';});
 async function optimise(file){validateProductPhoto(file);const object=URL.createObjectURL(file);try{const img=new Image();img.src=object;await img.decode();if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>60000000)throw Error('A fotografia é demasiado grande.');const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.86));if(!blob)throw Error('Não foi possível preparar a fotografia.');return blob.size<file.size?new File([blob],'produto.webp',{type:'image/webp'}):file;}finally{URL.revokeObjectURL(object);}}
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
 function renderGallery(){const grid=q('editorGallery');grid.replaceChildren();model.images.forEach((photo,index)=>{const card=el('div','editor-photo');const img=el('img');img.alt='Fotografia '+(index+1);if(photo.preview)img.src=photo.preview;const up=el('button','','←'),down=el('button','','→'),remove=el('button','','Remover'),replace=el('button','','Trocar');for(const [button,glyph,label] of [[up,'back','Mover para antes'],[down,'next','Mover para depois'],[replace,'image','Trocar fotografia'],[remove,'trash','Remover fotografia']]){
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
   for(const [button,label] of [[up,'Mover para antes'],[down,'Mover para depois'],[replace,'Trocar fotografia'],[remove,'Remover fotografia']]){
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
     const target=grid.children[position<0?Math.min(index,model.images.length-1):position]?.querySelector('button');
     (target||q('btnChooseNewProdImg')).focus({preventScroll:true});
   };
   dialog.append(sheet);sheet.showModal();close.focus();
 };
 card.append(trigger);grid.append(card);});if(!model.images.length){
 const current=el('img','editor-existing-photo');
 current.alt='Fotografia actual do produto';
 if(model.image_url){grid.append(current);showProductThumbnail(platform,model,current);}
 else grid.append(el('p','mw-muted','Adiciona a primeira fotografia do produto.'));
}}
 q('editorHasVariants').onchange=async()=>{if(!q('editorHasVariants').checked&&model.variants.length){if(!await confirmAction('Retirar as opções?','O produto passa a ter um preço único. Variantes anteriores deixam de estar disponíveis para novos pedidos.','Retirar')){q('editorHasVariants').checked=true;return;}model.variants=[];}if(q('editorHasVariants').checked&&!model.variants.length)model.variants.push(newVariant());changed();renderVariants();};
 function renderVariants(){q('editorOptions').querySelector('summary').textContent=model.variants.length?'Variantes · '+model.variants.length:'Variantes';q('editorVariantsBody').hidden=!q('editorHasVariants').checked;const list=q('editorVariants');list.replaceChildren();model.variants.forEach((v,index)=>{const row=el('details','editor-variant');
 row.name='merchant-variant';
 row.open=!v.option_name;
 const heading=el('summary','',v.option_name||'Nova variante');
 row.append(heading);
 const name=el('label','','Opção '+(index+1));const input=el('input');input.value=v.option_name;input.maxLength=120;input.oninput=()=>{v.option_name=input.value;heading.textContent=input.value.trim()||'Nova variante';};name.append(input);const photoLabel=el('label','','Fotografia');const select=el('select');select.append(new Option('Galeria do produto',''));model.images.forEach((photo,i)=>select.append(new Option('Fotografia '+(i+1)+(i===0?' · Capa':''),photo.key)));select.value=v.imageKey;select.onchange=()=>v.imageKey=select.value;photoLabel.append(select);const remove=el('button','mw-text','Retirar opção');remove.type='button';remove.onclick=()=>{model.variants.splice(index,1);if(!model.variants.length)q('editorHasVariants').checked=false;changed();renderVariants();};row.append(name,photoLabel,remove);list.append(row);});renderPrices();}
 q('editorAddVariant').onclick=()=>{if(model.variants.length>=100){fail('O limite é de 100 opções por produto.');return;}model.variants.push(newVariant());changed();renderVariants();q('editorVariants').lastElementChild.querySelector('input').focus();};
 function renderPrices(){
  const container=q('editorPrices');container.replaceChildren();
  const items=model.variants.length?model.variants:[model];
  sections[3].hidden=!stockOnly&&model.variants.length>0;
  items.forEach(item=>{
   const card=el('section','editor-price-card');const name=item===model?'Produto sem variantes':item.option_name||'Opção sem nome';card.setAttribute('aria-label',name);
   const main=el('div','editor-price-main');main.append(el('strong','editor-price-name',name));
   function priceField(key,label,placeholder){const field=el('label','editor-money-field');field.append(el('span','commerce-sr-only',label+' de '+name));const input=el('input');input.type='text';input.inputMode='decimal';input.maxLength=13;input.placeholder=placeholder;input.value=item[key]||'';input.oninput=()=>item[key]=input.value;field.append(input,el('span','editor-currency','MT'));return field;}
   const priceLabel=el('div','editor-current-price');priceLabel.append(el('span','','Preço (MT)'),priceField('price','Preço actual',''));
   if(!stockOnly)main.append(priceLabel);
   const more=el('details','editor-price-details');more.open=Boolean(item.previous);more.append(el('summary','',item.previous?'Promoção activa':'Adicionar promoção'));
   const fields=el('div','editor-stock-fields');const previous=el('div','editor-promotion-field');previous.append(el('span','','Preço anterior (opcional)'),priceField('previous','Preço anterior','Sem promoção'));more.append(previous,el('p','mw-muted','Usa o preço actual para o valor promocional e indica aqui o preço anterior.'));
   const quantityLabel=el('label','','Quantidade (opcional)'),quantity=el('input');quantity.type='number';quantity.min='0';quantity.max='1000000000';quantity.step='1';quantity.placeholder='Sem limite';quantity.value=item.quantity;quantity.oninput=()=>{item.quantity=quantity.value;if(Number(quantity.value)>0){item.in_stock=true;stock.checked=true;}};quantityLabel.append(quantity);fields.append(quantityLabel);
   const stockLabel=el('label','mw-check'),stock=el('input');stock.type='checkbox';stock.checked=item.in_stock;stock.onchange=()=>item.in_stock=stock.checked;stockLabel.append(stock,document.createTextNode('Disponível para contacto'));
   fields.append(stockLabel);
   if(stockOnly){card.append(main,fields);container.append(card);}
   else{
     card.append(priceLabel,fields,more);
     if(item===model)container.append(card);
     else q('editorVariants').children[model.variants.indexOf(item)].append(card);
   }
  });
 }
 function renderReview(){const box=q('editorReview');box.replaceChildren();if(model.images[0]?.preview){const img=el('img');img.src=model.images[0].preview;img.alt=model.title;box.append(img);}box.append(el('p','mw-muted',hooks.getStore()?.name),el('h2','',model.title||'Nome do produto'),el('p','mw-muted',categories.find(c=>c.id===model.category_id)?.name||'Sem categoria'));try{const prices=(model.variants.length?model.variants:[model]).map(v=>parsePriceMinor(v.price||'0'));box.append(el('strong','editor-review-price',money(Math.min(...prices))+(new Set(prices).size>1?' – '+money(Math.max(...prices)):'')));}catch{box.append(el('p','field-error','Confere os preços antes de publicar.'));}if(!model.variants.length&&model.previous){try{const before=parsePriceMinor(model.previous),now=parsePriceMinor(model.price);if(before>now)box.append(el('del','product-previous-price',money(before)),el('span','product-discount','−'+Math.round((1-now/before)*100)+'%'));}catch{}}
 for(const variant of model.variants){
   const row=el('p','editor-review-variant');
   row.append(el('strong','',variant.option_name));
   if(variant.previous)row.append(el('del','product-previous-price',money(parsePriceMinor(variant.previous))));
   row.append(el('span','',money(parsePriceMinor(variant.price||'0'))));
   if(!variant.in_stock||variant.quantity==='0')row.append(el('span','mw-muted','Esgotado'));
   box.append(row);
 }
 if(model.description)box.append(el('p','',model.description));
 if(model.attributes)box.append(el('p','mw-muted',model.attributes));
 }
 function documentData(status){collectBasics();if(model.title.length<2)throw Error('Indica um nome com pelo menos 2 caracteres.');if(!model.category_id)throw Error('Selecciona uma categoria atribuída à loja.');if(status==='published'&&!model.images.length&&!model.image_url)throw Error('Adiciona pelo menos uma fotografia para publicar.');if(q('editorHasVariants').checked&&!model.variants.length)throw Error('Adiciona uma opção ou desactiva as variantes.');const names=new Set();function itemData(item){let price=parsePriceMinor(item.price||'0');if(status==='published'&&price<=0)throw Error('Cada preço deve ser superior a zero para publicar.');const previous=item.previous?parsePriceMinor(item.previous):null;if(previous!=null&&previous<=price)throw Error('O preço anterior deve ser superior ao actual.');const quantity=item.quantity===''?null:Number(item.quantity);if(quantity!==null&&(!Number.isInteger(quantity)||quantity<0||quantity>1000000000))throw Error('A quantidade deve ser um número inteiro positivo ou zero.');return{price_minor:price,previous_price_minor:previous,stock_quantity:quantity,in_stock:item.in_stock};}const variants=model.variants.map(v=>{const name=v.option_name.trim();if(!name||names.has(name.toLocaleLowerCase('pt')))throw Error('Cada opção precisa de um nome único.');names.add(name.toLocaleLowerCase('pt'));return{id:v.id,option_name:name,...itemData(v),track_quantity:v.quantity!=='',image_path:model.images.find(p=>p.key===v.imageKey)?.path||null};});return{title:model.title,category_id:model.category_id,description:model.description,condition:model.condition,attributes:model.attributes,status,...(variants.length?{price_minor:0,previous_price_minor:null,stock_quantity:null,in_stock:true}:itemData(model)),images:model.images.map(p=>p.path),variants};}
 async function save(status){if(busy||!model)return;if(!navigator.onLine){fail('Sem ligação. As alterações continuam neste formulário. Liga-te e tenta novamente.');return;}let document;try{document=uncertain?.document||documentData(status);}catch(e){fail(e.message);q('newProductError').scrollIntoView({block:'nearest'});return;}lock(true);fail('');setButtonBusy(q(status==='draft'&&!q('editorSaveDraft').hidden?'editorSaveDraft':'btnSubmitNewProduct'),true);let accepted=false;const wasPublished=model.status==='published';
  try{if(!uncertain){for(let i=0;i<model.images.length;i++){const photo=model.images[i];if(photo.path)continue;notice(q('newProductProgress'),'');const extension=validateProductPhoto(photo.file);const {data:auth,error:authError}=await platform.auth.getUser();if(authError||!auth.user)throw authError||Error('Sessão expirada.');const path=auth.user.id+'/'+storeId+'/'+model.id+'/'+crypto.randomUUID()+'.'+extension;const {error}=await platform.storage.from('kg-product-images').upload(path,photo.file,{upsert:false,contentType:photo.file.type});if(error)throw error;photo.path=path;}document=documentData(status);uncertain={request:crypto.randomUUID(),document,productId:model.id,expected:model.updated_at||null};}
   notice(q('newProductProgress'),'');const {data,error}=await platform.rpc('kg_save_catalogue_product',{p_request_id:uncertain.request,p_store_id:storeId,p_product_id:uncertain.productId,p_expected_updated_at:uncertain.expected,p_document:uncertain.document});if(error)throw error;accepted=true;model.updated_at=data.updated_at;model.status=data.status;dirty=false;uncertain=null;notice(q('newProductProgress'),'');const id=model.id,sid=storeId;await close(true);hooks.onFeedback(stockOnly?'Stock actualizado.':data.status==='published'?(wasPublished?'Alterações guardadas.':'Produto publicado.'):data.status==='archived'?'Produto arquivado.':'Rascunho guardado.');await hooks.onPublished(id,sid);
  }catch(e){const known=/^(22|23|40|42|P000)/.test(e.code||'');if(known)uncertain=null;fail(accepted?'O produto foi guardado. Actualiza o catálogo para consultar a versão actual.':e.code==='40001'?'Outro colaborador alterou este produto. Os teus dados continuam aqui; copia as alterações antes de reabrir a versão actual.':e.code==='42501'?'A sessão ou as permissões da loja mudaram. As alterações não foram guardadas.':known?(e.message||'Confere os dados do artigo.'):'O envio foi interrompido. '+(uncertain?'Toca em «Verificar gravação» para confirmar o mesmo pedido.':'Os dados continuam aqui. Tenta guardar novamente.'));notice(q('newProductProgress'),'');}
  finally{setButtonBusy(q('editorSaveDraft'),false);setButtonBusy(q('btnSubmitNewProduct'),false);lock(false);if(uncertain)q('btnSubmitNewProduct').textContent='Verificar gravação';}
 }
  q('editorSaveDraft').onclick=()=>save('draft');
 q('formNewProduct').onsubmit=e=>{
   e.preventDefault();
   if(uncertain){save(uncertain.document.status);return;}
   if(stockOnly){save(model.status);return;}
   if(hooks.getStore()?.status!=='approved'){save('draft');return;}
   if(reviewing||model.status==='published'){save('published');return;}
   try{documentData('published');showEditor(true);}
   catch(error){fail(error.message);q('newProductError').scrollIntoView({block:'nearest'});}
 };
 function fitViewport(){if(!dialog.open||!window.visualViewport)return;dialog.style.height=Math.round(window.visualViewport.height)+'px';dialog.style.top=Math.round(window.visualViewport.offsetTop)+'px';dialog.style.bottom='auto';}
 window.visualViewport?.addEventListener('resize',fitViewport);window.visualViewport?.addEventListener('scroll',fitViewport);window.addEventListener('resize',fitViewport);
 const beforeUnload=e=>{if(dialog.open&&dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',beforeUnload);
 return{open,close,clear:()=>{close(true);storeId='';},isBusy:()=>busy,isOpen:()=>dialog.open,isDirty:()=>dirty};
}
