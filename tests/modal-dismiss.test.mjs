import test from 'node:test';
import assert from 'node:assert/strict';
import {outsideModal,protectModalEdits,requestModalDismiss} from '../frontend/modal-dismiss.js';

const box = {left:20,top:40,right:300,bottom:420};
test('a tap on panel padding is inside; backdrop on every side is outside',()=>{
 for(const [x,y,outside] of [[20,40,false],[299,419,false],[270,50,false],[19,100,true],[130,39,true],[300,100,true],[100,420,true]]) {
  assert.equal(outsideModal(box,{clientX:x,clientY:y}),outside);
 }
});
class Dialog extends EventTarget {
 open=true;busy=false;
 getAttribute(){ return String(this.busy); }
 querySelectorAll(){return [];}
 close(){this.open=false;}
}
test('dismiss uses the editor cancel handler and never interrupts a busy submission',()=>{
 const modal=new Dialog();let calls=0;
 modal.addEventListener('cancel',e=>{e.preventDefault();calls++;});
 modal.busy=true;requestModalDismiss(modal);assert.equal(calls,0);
 modal.busy=false;requestModalDismiss(modal);assert.equal(calls,1);assert.equal(modal.open,true);
});
test('discard is confirmed once and declining keeps the unsaved form open',async()=>{
 const modal=new Dialog(),form=new EventTarget();let answer,requests=0;
 protectModalEdits(modal,form,()=>{requests++;return new Promise(resolve=>{answer=resolve;});});
 form.dispatchEvent(new Event('input'));requestModalDismiss(modal);requestModalDismiss(modal);
 assert.equal(requests,1);assert.equal(modal.open,true);answer(false);await Promise.resolve();
 assert.equal(modal.open,true);requestModalDismiss(modal);answer(true);await Promise.resolve();assert.equal(modal.open,false);
});
