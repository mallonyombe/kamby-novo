import {setButtonBusy} from './loading.js';
import {cataloguePhoto} from './catalogue-photos.js';
import {storagePathFromSignedUrl} from './commerce-domain.js';
import {catalogueConfig} from './platform.js';
export const icons={check:'<path d="m5 12 4 4L19 6"/>',next:'<path d="m9 18 6-6-6-6"/>',trash:'<path d="M4 7h16M6 7l1 14h10l1-14M9 7V4h6v3m-5 4v6m4-6v6"/>',summary:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',products:'<path d="m12 3 9 5v8l-9 5-9-5V8l9-5Zm0 9 9-4M12 12 3 8m9 4v9M7.5 5.5l9 5"/>',activity:'<path d="M4 20V10m8 10V4m8 16v-7"/>',store:'<path d="m3 9 2-6h14l2 6M4 13v8h16v-8M3 9c0 4 6 4 6 0 0 4 6 4 6 0 0 4 6 4 6 0M9 21v-6h6v6"/>',plus:'<path d="M12 5v14M5 12h14"/>',filter:'<path d="M4 7h10m4 0h2M4 17h2m4 0h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',more:'<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',contact:'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 10 10 0 0 1-4-.9L3 21l1.8-5.5a9 9 0 1 1 16.2-4Z"/>',back:'<path d="m15 18-6-6 6-6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',edit:'<path d="m15 5 4 4M4 20l5-1L21 7l-4-4L5 15l-1 5Z"/>',warning:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 3v1"/>',image:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m3 17 5-5 4 4 4-6 5 7"/><circle cx="8" cy="8" r="1.5"/>'};
export function icon(name){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[name]||icons.products)+'</svg>';}
export function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;}
export const money=value=>new Intl.NumberFormat('pt-MZ',{minimumFractionDigits:Number(value)%100?2:0,maximumFractionDigits:2}).format(Number(value)/100)+' MT';
export function notice(node,copy){node.textContent=copy;node.hidden=!copy;}
export function confirmAction(title,copy,accept='Confirmar'){
 return new Promise(resolve=>{const d=el('dialog','local-data-dialog');const heading=el('h2','',title),description=el('p','',copy),id='confirm-'+crypto.randomUUID();heading.id=id;description.id=id+'-description';d.setAttribute('aria-labelledby',id);d.setAttribute('aria-describedby',description.id);d.append(heading,description);const actions=el('div','local-dialog-actions');const no=el('button','','Cancelar'),yes=el('button','',accept);no.type=yes.type='button';actions.append(no,yes);d.append(actions);document.body.append(d);let resolved=false;function finish(value){if(resolved)return;resolved=true;d.close();d.remove();resolve(value);}no.onclick=()=>finish(false);yes.onclick=()=>finish(true);d.oncancel=e=>{e.preventDefault();finish(false);};d.showModal();no.focus();});
}
export function showFeedback(copy, options = {}) {
 window.dispatchEvent(new CustomEvent('kamby:feedback', {detail:{copy,tone:'success',...options}}));
}

export function bindSignOut(signOut, onSuccess) {
 const trigger=document.getElementById('btnAccountSignOut');
 const dialog=document.getElementById('accountSignOutDialog');
 const cancel=document.getElementById('cancelAccountSignOut');
 const submit=document.getElementById('confirmAccountSignOut');
 const error=document.getElementById('accountSignOutError');
 trigger.addEventListener('click', () => {
   notice(error, '');
   dialog.showModal();
 });
 cancel.addEventListener('click', () => dialog.close());
 dialog.addEventListener('submit', async event => {
   event.preventDefault();
   if(submit.disabled)return;
   submit.disabled=cancel.disabled=true;
   setButtonBusy(submit,true);
   try {
     const result=await signOut();
     if(result.error)throw result.error;
   } catch {
     notice(error,'Não foi possível terminar a sessão. Tenta novamente.');
     return;
   } finally {
     submit.disabled=cancel.disabled=false;
     setButtonBusy(submit,false);
   }
   dialog.close();
   onSuccess();
   document.getElementById('btnOpenAccountSignIn').focus({preventScroll:true});
   showFeedback('Sessão terminada.');
 });
}

export async function imageUrl(platform,path,fallback=''){const replacement=cataloguePhoto(path);if(replacement)return replacement;if(!path)return fallback;try{const {data,error}=await platform.storage.from('kg-product-images').createSignedUrl(path,3600);return error?fallback:data.signedUrl;}catch{return fallback;}}


export async function showProductThumbnail(platform,product,img) {
  let fallback='';
  try {
    if(product.image_url){
      const url=new URL(product.image_url,document.baseURI);
      if(/^https?:$/.test(url.protocol)){
        if(/^\/catalogue-[a-z-]+\.jpg$/.test(url.pathname)&&url.hostname==='kamby-novo-orbion.mallonyombe123.chatgpt.site'){
          fallback=new URL(url.pathname,document.baseURI).href;
        }else fallback=url.href;
      }
    }
  }catch{}
  const oldPath=storagePathFromSignedUrl(fallback,catalogueConfig.supabaseUrl,catalogueConfig.imageBucket);
  const gallery=(product.images||[]).slice().sort((a,b)=>a.sort_order-b.sort_order).map(image=>image.storage_path);
  const paths=[...new Set([...gallery,oldPath].filter(Boolean))];
  async function next(){
    while(paths.length&&img.isConnected){
      const url=await imageUrl(platform,paths.shift());
      if(url&&img.isConnected){img.src=url;return;}
    }
    if(fallback&&img.isConnected){
      const url=fallback;
      fallback='';
      img.src=url;
    }
  }
  img.hidden=true;
  img.onload=()=>img.hidden=false;
  img.onerror=()=>{img.hidden=true;next();};
  await next();
}
