import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseNewProduct, validateProductPhoto } from '../frontend/merchant-domain.js';
const categoryId='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const photo={type:'image/png',size:128};
const fields={title:' Jarro de cerâmica ',categoryId,price:'450,50',optionName:' 500 ml ',description:' Cerâmica natural. '};
test('new article preserves exact price and the option supplied by the seller',()=>{
 assert.deepEqual(normaliseNewProduct(fields,photo),{title:'Jarro de cerâmica',categoryId,priceMinor:45050,optionName:'500 ml',description:'Cerâmica natural.',extension:'png'});
});
test('a photograph is required and limited to safe raster types and 5 MiB',()=>{
 for(const file of [null,{type:'image/svg+xml',size:128},{type:'text/html',size:128},{type:'image/png',size:0},{type:'image/jpeg',size:5242881}]) assert.throws(()=>validateProductPhoto(file),error=>error.field==='image');
 assert.equal(validateProductPhoto({type:'image/jpeg',size:5242880}),'jpg');
 assert.equal(validateProductPhoto({type:'image/webp',size:1}),'webp');
});
test('new articles require a real category and a positive price',()=>{
 for(const price of ['0','-1','NaN','1.555']) assert.throws(()=>normaliseNewProduct({...fields,price},photo),error=>error.field==='price');
 assert.throws(()=>normaliseNewProduct({...fields,categoryId:'casa'},photo),error=>error.field==='category');
});
test('enforces title, option and description limits before uploading',()=>{
 for(const [key,value,field] of [['title','A','title'],['title','x'.repeat(161),'title'],['optionName','x'.repeat(121),'option'],['description','x'.repeat(5001),'description']]) assert.throws(()=>normaliseNewProduct({...fields,[key]:value},photo),error=>error.field===field);
});
test('optional fields do not invent guarantees or configured variants',()=>{
 const product=normaliseNewProduct({...fields,optionName:'',description:''},photo);
 assert.equal(product.optionName,'');assert.equal(product.description,'');
});
