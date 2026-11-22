import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../frontend/buyer-polish.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../frontend/index.html',import.meta.url),'utf8');
const luminance=hex=>hex.replace('#','').match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
test('small-text brand inks and muted text meet 4.5:1 on their light/dark surfaces',()=>{
 for(const [ink,bg] of [['#A84900','#FFFFFF'],['#A84900','#F6F7F9'],['#BA0644','#EFEFF2'],['#FFAC66','#1D1D20'],['#FF86AF','#2B2B30'],['#69717D','#F6F7F9'],['#A1A1AD','#1D1D20']]) assert.ok(contrast(ink,bg)>=4.5,`${ink} on ${bg}`);
 assert.match(html,/--text-muted: #69717D;/);assert.match(html,/--text-muted: #A1A1AD;/);
 for(const ink of ['#A84900','#BA0644','#FFAC66','#FF86AF'])assert.ok(css.includes(ink));
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
