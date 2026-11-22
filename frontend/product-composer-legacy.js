import {setButtonBusy,showSpinner,showSkeleton} from "./loading.js";
import { platform, catalogueConfig } from './platform.js';
import { normaliseNewProduct, validateProductPhoto } from './merchant-domain.js';

export function setupProductComposer({getStore,onPublished,onFeedback}) {
  const byId=id=>document.getElementById(id);
  const sheet=byId('modalNewProduct'),form=byId('formNewProduct'),picker=byId('inputNewProdImage');
  const fields={title:byId('inputNewProdTitle'),category:byId('selectNewProdCat'),price:byId('inputNewProdPrice'),option:byId('inputNewProdVariant'),description:byId('inputNewProdDesc'),image:byId('btnChooseNewProdImg')};
  const submit=byId('btnSubmitNewProduct'),closeButton=byId('btnCloseNewProductModal');
  let draftStoreId='',file=null,previewUrl='',attempt=null,busy=false,photoPending=false,categoriesReady=false,categoryRequest=0,checking=false,photoRequest=0,previousOverflow='';
  function notice(id,copy) { byId(id).textContent=copy;byId(id).hidden=!copy; }
  function error(copy,field) {
    notice('newProductError',copy);
    Object.values(fields).forEach(el=>el.removeAttribute('aria-invalid'));
    if(field && fields[field]) { fields[field].setAttribute('aria-invalid','true');fields[field].focus(); }
  }
  function controls() {
    for(const el of Object.values(fields)) el.disabled=busy || checking || photoPending;
    fields.category.disabled=busy || checking || !categoriesReady;
    closeButton.disabled=busy;
    byId('btnRetryProductCategories').disabled=busy;
    submit.disabled=busy || photoPending || (!checking && !categoriesReady);
    submit.textContent=checking ? 'Verificar publicação' : 'Publicar artigo';setButtonBusy(submit,busy);setButtonBusy(fields.image,photoPending);
    sheet.setAttribute('aria-busy',String(busy));
  }
  function viewport() {
    if(!sheet.open) return;
    const vv=window.visualViewport;
    sheet.style.setProperty('--product-sheet-viewport',Math.max(160,(vv?.height || innerHeight)-8)+'px');
    sheet.style.setProperty('--product-sheet-bottom',Math.max(0,innerHeight-(vv?.height || innerHeight)-(vv?.offsetTop || 0))+'px');
  }
  function reset() {
    ++photoRequest;photoPending=false;
    form.reset();file=null;attempt=null;checking=false;
    if(previewUrl) URL.revokeObjectURL(previewUrl);previewUrl='';
    byId('previewNewProdImg').removeAttribute('src');byId('previewNewProdImg').hidden=true;byId('newProdPhotoPlaceholder').hidden=false;
    byId('btnChooseNewProdImg').textContent='Escolher fotografia';
    notice('newProductError','');notice('newProductProgress','');
    Object.values(fields).forEach(el=>el.removeAttribute('aria-invalid'));controls();
  }
  async function categories() {
    const request=++categoryRequest;
    categoriesReady=false;controls();byId('btnRetryProductCategories').hidden=true;
    fields.category.replaceChildren(new Option('',''));showSpinner(byId('newProductCategoryStatus'));
    try {
      const {data,error:loadError}=await platform.from('kg_categories').select('id,name').eq('is_active',true).order('name');
      if(loadError) throw loadError;
      if(request!==categoryRequest) return;
      const selected=fields.category.value;
      fields.category.replaceChildren(new Option('Seleccionar categoria',''));
      for(const category of data || []) fields.category.appendChild(new Option(category.name,category.id));
      if((data || []).some(category=>category.id===selected)) fields.category.value=selected;
      categoriesReady=Boolean(data?.length);
      notice('newProductCategoryStatus',categoriesReady?'':'Ainda não há categorias disponíveis.');
      byId('btnRetryProductCategories').hidden=categoriesReady;
    } catch {
      if(request!==categoryRequest) return;
      notice('newProductCategoryStatus','Não foi possível carregar as categorias.');byId('btnRetryProductCategories').hidden=false;
    } finally { if(request===categoryRequest) controls(); }
  }
  function close(force=false) {
    if(busy && !force) return;
    if(sheet.open) sheet.close();
  }
  function open() {
    const store=getStore();
    if(busy || !store || store.status!=='approved') return;
    if(draftStoreId!==store.id) {reset();draftStoreId=store.id;}
    if(!sheet.open) {
      previousOverflow=byId('viewMerchant').style.overflowY;
      byId('viewMerchant').style.overflowY='hidden';sheet.showModal();
    }
    viewport();categories();
  }
  byId('btnOpenNewProductModal').addEventListener('click',open);
  closeButton.addEventListener('click',()=>close());
  sheet.addEventListener('close',()=>{byId('viewMerchant').style.overflowY=previousOverflow;});
  sheet.addEventListener('cancel',event=>{if(busy) event.preventDefault();});
  sheet.addEventListener('click',event=>{
    if(event.target!==sheet) return;
    const rect=sheet.getBoundingClientRect();
    if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom) close();
  });
  byId('btnRetryProductCategories').addEventListener('click',categories);
  fields.image.addEventListener('click',()=>{if(!busy && !checking) picker.click();});
  picker.addEventListener('change',async()=>{
    const next=picker.files?.[0];if(!next) return;
    const request=++photoRequest;
    let nextUrl='';photoPending=true;controls();
    try {
      validateProductPhoto(next);nextUrl=URL.createObjectURL(next);
      const image=new Image();image.src=nextUrl;await image.decode();
      if(request!==photoRequest) {URL.revokeObjectURL(nextUrl);return;}
      if(!image.naturalWidth || !image.naturalHeight) throw new Error('Fotografia inválida.');
      if(previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl=nextUrl;file=next;attempt=null;
      byId('previewNewProdImg').src=previewUrl;byId('previewNewProdImg').hidden=false;byId('newProdPhotoPlaceholder').hidden=true;
      fields.image.textContent='Trocar fotografia';notice('newProductError','');
    } catch(e) {
      if(nextUrl) URL.revokeObjectURL(nextUrl);
      if(request!==photoRequest) return;
      error(e.field ? e.message : 'Não foi possível abrir esta fotografia. Escolhe outra.','image');
    } finally { if(request===photoRequest) {photoPending=false;picker.value='';controls();} }
  });
  form.addEventListener('focusin',()=>{viewport();});
  window.visualViewport?.addEventListener('resize',()=>{viewport();requestAnimationFrame(()=>{if(sheet.open && sheet.contains(document.activeElement)) document.activeElement.scrollIntoView({block:'nearest'});});});
  window.visualViewport?.addEventListener('scroll',viewport);

  function unknownOutcome(error) {
    const code=String(error?.code || '');
    return !/^\d{5}$|^PGRST/.test(code) && !['42501','23514','22023','23505'].includes(code);
  }
  async function upload(current) {
    if(current.uploaded) return;
    notice('newProductProgress','');
    const {error:uploadError}=await platform.storage.from(catalogueConfig.imageBucket).upload(current.path,current.file,{contentType:current.file.type,cacheControl:'3600',upsert:false});
    if(uploadError) {
      // A repeated upload after a lost response may already exist at this request's path.
      const {data}=await platform.storage.from(catalogueConfig.imageBucket).createSignedUrl(current.path,60);
      if(!data?.signedUrl) throw new Error('Não foi possível enviar a fotografia. Verifica a ligação e tenta novamente.');
    }
    current.uploaded=true;
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy || photoPending || (!checking && !categoriesReady)) return;
    const store=getStore();if(!store || store.id!==draftStoreId || store.status!=='approved') {error('Esta loja já não está disponível para publicação.');return;}
    let values;
    try { values=checking ? attempt.values : normaliseNewProduct({title:fields.title.value,categoryId:fields.category.value,price:fields.price.value,optionName:fields.option.value,description:fields.description.value},file); }
    catch(e) {error(e.message,e.field);return;}
    busy=true;controls();notice('newProductError','');
    let publishing=false,committed=false;
    try {
      const signature=JSON.stringify(values);
      if(!attempt || attempt.signature!==signature || attempt.file!==file) {
        attempt={id:crypto.randomUUID(),storeId:store.id,file,values,signature,path:'',uploaded:false};
      }
      const current=attempt;
      if(!current.path) {
        const {data,error:contextError}=await platform.rpc('kg_product_upload_context',{p_store_id:current.storeId,p_product_id:current.id,p_extension:values.extension});
        if(contextError) throw contextError;current.path=data.path;
      }
      await upload(current);
      notice('newProductProgress','');publishing=true;
      const {data,error:publishError}=await platform.rpc('kg_merchant_create_product',{
        p_product_id:current.id,p_store_id:current.storeId,p_category_id:values.categoryId,p_title:values.title,p_price_minor:values.priceMinor,
        p_option_name:values.optionName,p_description:values.description,p_image_path:current.path
      });
      if(publishError) throw publishError;
      committed=true;checking=false;close(true);reset();
      try { await onPublished(data.id,current.storeId);onFeedback(data.status==='published'?'Artigo publicado.':'Artigo criado. O estado actual foi definido pela gestão.'); }
      catch {onFeedback('Artigo criado. Actualiza o catálogo para ver os dados mais recentes.');}
    } catch(e) {
      if(publishing && unknownOutcome(e)) {
        checking=true;error('Não foi possível confirmar a resposta. Toca em Verificar publicação para consultar o mesmo pedido.');
      } else {
        checking=false;
        error(e.code==='42501'?'A conta já não tem autorização para publicar nesta loja.':e.code==='22023'?'Verifica os campos, a categoria e a fotografia antes de tentar novamente.':e.message?.startsWith('Não foi possível enviar')?e.message:'Não foi possível publicar. Os campos foram preservados.');
        if(attempt?.uploaded && attempt.path) {
          // The policy refuses deleting any object already attached to a product.
          await platform.storage.from(catalogueConfig.imageBucket).remove([attempt.path]).catch(()=>{});
          attempt=null;
        }
      }
    } finally {busy=false;if(!committed) notice('newProductProgress','');controls();}
  });
  return {close,clear:()=>{close(true);draftStoreId='';reset();},isBusy:()=>busy};
}
