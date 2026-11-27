import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../frontend/buyer-polish.css',import.meta.url),'utf8');
const tokens=readFileSync(new URL('../frontend/design-tokens.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../frontend/index.html',import.meta.url),'utf8');
const luminance=hex=>hex.replace('#','').match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
test('small-text brand inks and muted text meet 4.5:1 on their light/dark surfaces',()=>{
 for(const [ink,bg] of [['#A84900','#FFFFFF'],['#A84900','#F6F7F9'],['#BA0644','#EFEFF2'],['#FFAC66','#1D1D20'],['#FF86AF','#2B2B30'],['#69717D','#F6F7F9'],['#A1A1AD','#1D1D20']]) assert.ok(contrast(ink,bg)>=4.5,`${ink} on ${bg}`);
 assert.match(html,/--text-muted: #69717D;/);assert.match(html,/--text-muted: #A1A1AD;/);
 assert.match(css,/--buyer-accent-ink:var\(--ui-selection\)/);
 for(const ink of ['#a84900','#ffac66'])assert.ok(tokens.includes(ink));
 for(const ink of ['#BA0644','#FF86AF'])assert.ok(css.includes(ink));
});
test('buyer polish preserves uncropped products and reduces all motion on request',()=>{
 assert.match(css,/\.product-img-wrap img,\.pdp-gallery-slide img\s*\{\s*object-fit:contain;/);
 assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\*,\*::before,\*::after/);assert.match(css,/animation-iteration-count:1!important/);assert.match(css,/scroll-behavior:auto!important/);
 assert.ok(html.indexOf('buyer-polish.css')>html.indexOf('chrome-fade.css'));
});
test('cart accessible labels distinguish singular and plural',()=>{
 assert.ok(html.includes("count === 1 ? ' artigo, subtotal ' : ' artigos, subtotal '"));
 assert.ok(html.includes("count===1?' artigo':' artigos'"));
});

test('brief feedback expires even when the touch browser retains hover',async()=>{
 const [success,error]=await Promise.all([feedbackHarness(),feedbackHarness({tone:'error'})]);
 assert.equal(success.timer.delay,3200);
 assert.equal(error.timer.delay,5000);
 await success.timer.run();
 await error.timer.run();
 assert.equal(success.toast.hidden,true);
 assert.equal(error.toast.hidden,true);
});

test('undo lasts 5.5 seconds and stays available while its action has focus',async()=>{
 const h=await feedbackHarness({action:()=>{},label:'Desfazer'});
 assert.equal(h.timer.delay,5500);
 h.document.activeElement=h.action;
 await h.timer.run();
 assert.equal(h.toast.hidden,false);
 assert.equal(h.timer.delay,1000);
 h.document.activeElement=null;
 await h.timer.run();
 assert.equal(h.toast.hidden,true);
});

function feedbackHarness({action,label,tone}={}){
 const definition=html.slice(html.indexOf('      function showCommerceToast('),html.indexOf('      function updateScopedCartBadges('));
 const toast={hidden:true,dataset:{},matches:()=>true};
 const button={};
 const document={activeElement:null,querySelectorAll:()=>[],getElementById:()=>({})};
 const h={toast,action:button,document};
 const run=Function('feedbackToast','feedbackAction','document','matchMedia','setTimeout','currentFeedbackPage',
  `let feedbackRevision=0, feedbackPage, feedbackDialog, feedbackTimer;
   function dismissFeedback(){feedbackRevision++;feedbackToast.hidden=true;}
   ${definition}
   return showCommerceToast;`)(toast,button,document,()=>({matches:true}),
    (run,delay)=>{h.timer={run,delay};},()=> '#carrinho');
 run('Artigo removido.',action,label,tone);
 return h;
}
