import {el,icon} from './merchant-ui.js';
import {setButtonBusy,showSpinner} from './loading.js';
import {sellerDraft} from './seller-draft.js';
import {listIcon} from './list-controls.js';

export function openSellerSetup({platform,store,userId,isCurrent,onReady,onClose}){
 const existing=document.getElementById('sellerSetup');
 if(existing||!userId)return;
 const draft=sellerDraft(userId);
 const dialog=el('dialog','mw-filter-dialog seller-setup');
 dialog.id='sellerSetup';
 dialog.setAttribute('aria-labelledby','sellerSetupTitle');
 const title=el('h2');
 title.id='sellerSetupTitle';
 title.tabIndex=-1;
 const close=listIcon('close','Fechar');
 close.onclick=()=>dialog.close();
 const header=el('header');
 header.append(title,close);
 const content=el('div','seller-setup-content');
 dialog.append(header,content);
 let busy=false,finished=false;
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 dialog.addEventListener('close',()=>{
  dialog.remove();
  if(!finished)onClose?.();
 },{once:true});
 document.body.append(dialog);
 dialog.showModal();

 function shown(copy,step){
  title.textContent=copy;
  const panel=el('div','seller-setup-step');
  if(step){
   const progress=el('ol','seller-progress');
   progress.setAttribute('aria-label','Configuração da loja');
   for(const [i,label] of ['Termos','A tua loja'].entries()){
    const item=el('li','',label);
    if(i===step-1)item.setAttribute('aria-current','step');
    else if(i<step-1)item.dataset.done='true';
    progress.append(item);
   }
   panel.append(progress);
  }
  content.replaceChildren(panel);
  title.focus({preventScroll:true});
  return panel;
 }
 function action(copy,fn){
  const button=el('button','mw-primary',copy);
  button.type='button';
  button.onclick=fn;
  return button;
 }
 function alert(){
  const error=el('p','field-error');
  error.setAttribute('role','alert');
  return error;
 }
 async function run(button,error,fn){
  if(busy||!isCurrent())return;
  error.textContent='';
  busy=close.disabled=button.disabled=true;
  setButtonBusy(button,true);
  try{await fn();}
  catch(failure){if(dialog.open&&isCurrent())error.textContent=failure?.messageForSeller||'Não foi possível concluir. Tenta novamente.';}
  finally{busy=close.disabled=button.disabled=false;setButtonBusy(button,false);}
 }
 function finish(id){
  if(!dialog.open||!isCurrent())return;
  draft.clear();
  finished=true;
  dialog.close();
  onReady(id);
 }
 function create(){
  const panel=shown('Configurar loja',2);
  const form=el('form');
  function field(label,type,maxLength){
   const wrapper=el('label','',label),input=el('input');
   input.type=type;
   input.required=true;
   input.maxLength=maxLength;
   wrapper.append(input);
   form.append(wrapper);
   return input;
  }
  const name=field('Nome da loja','text',80);
  name.minLength=2;
  name.autocomplete='organization';
  const phone=field('WhatsApp comercial','tel',24);
  phone.placeholder='+258 84 123 4567';
  phone.autocomplete='tel';
  name.value=draft.values?.name||'';
  phone.value=draft.values?.phone||'';
  draft.save(name.value,phone.value);
  form.oninput=()=>draft.save(name.value,phone.value);
  const error=alert();
  const submit=action('Criar rascunho');
  submit.type='submit';
  form.append(error,submit);
  form.onsubmit=event=>{
   event.preventDefault();
   const number=phone.value.replace(/\s/g,'');
   if(name.value.trim().length<2||!/^\+[1-9]\d{7,14}$/.test(number)||(/^\+258/.test(number)&&![12,13].includes(number.length))){
    error.textContent='Confere o nome e o WhatsApp com indicativo.';
    return;
   }
   void run(submit,error,async()=>{
    const {data,error:failure}=await platform.rpc('kg_create_seller_store',{p_name:name.value.trim(),p_whatsapp:number});
    if(failure?.details==='seller_terms_required')return loadTerms();
    if(failure||!data)throw failure||Error();
    finish(data);
   });
  };
  panel.append(form);
 }
 async function loadTerms(){
  const pending=shown('Termos de vendedor');
  showSpinner(pending);
  let result;
  try{result=await platform.rpc('kg_current_seller_terms');}catch{}
  if(!dialog.open||!isCurrent())return;
  const terms=result?.data;
  const valid=terms && typeof terms.accepted==='boolean' &&
   [terms.version,terms.title,terms.body].every(value=>typeof value==='string'&&value.trim());
  if(result?.error||!valid){
   const panel=shown('Termos de vendedor');
   panel.append(el('p','mw-muted',result&&!result.error?'Os termos de vendedor ainda não estão disponíveis.':'Não foi possível carregar os termos.'),action('Tentar novamente',loadTerms));
   return;
  }
  if(terms.accepted)return store?finish(store.id):create();
  const panel=shown(terms.title,1);
  panel.append(el('p','mw-muted','Versão '+terms.version));
  const documentText=el('div','seller-terms-text');
  documentText.tabIndex=0;
  documentText.setAttribute('role','region');
  documentText.setAttribute('aria-label','Texto dos termos');
  documentText.textContent=terms.body;
  const error=alert();
  const accept=action('Aceitar e continuar',()=>void run(accept,error,async()=>{
   const {error:failure}=await platform.rpc('kg_accept_seller_terms',{p_version:terms.version});
   if(failure?.code==='40001')return loadTerms();
   if(failure)throw failure;
   if(dialog.open&&isCurrent()){
    if(store)finish(store.id);
    else create();
   }
  }));
  panel.append(documentText,error,accept);
 }
 void loadTerms();
}
