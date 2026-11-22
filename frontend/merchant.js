import {editorContractReady} from './catalogue-contract.js';
export async function setupMerchant(hooks){
 const ready=await editorContractReady();
 const module=ready?await import('./merchant-advanced.js'):await import('./merchant-legacy.js');
 const controller=module.setupMerchant(hooks);
 return {...controller,canLeave:controller.canLeave||async function(){return true;}};
}
