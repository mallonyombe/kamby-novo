import {platform} from './platform.js';
export {baselineCataloguePath} from './commerce-domain.js';
let readiness;
export function editorContractReady(){
 if(!readiness){let timer;readiness=Promise.race([
   Promise.resolve(platform.from('kg_products').select('moderation_status').limit(0)).then(({error})=>!error).catch(()=>false),
   new Promise(resolve=>{timer=setTimeout(()=>resolve(false),5000);})
 ]).finally(()=>clearTimeout(timer));}
 return readiness;
}
