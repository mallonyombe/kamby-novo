export function variantLimit(variant){
 const tracked=variant.track_quantity===true||(variant.track_quantity==null&&Number(variant.stock_quantity)>0);
 return tracked?Math.max(0,Math.min(99,Number(variant.stock_quantity)||0)):99;
}
export function quantityLimit(product,variant,mode,cart){
 const maximum=Math.min(99,Number(variant.maxQuantity??99));
 const saved=mode==='cart'?(cart||[]).filter(item=>item.storeId===product.storeId&&item.productId===product.id&&String(item.variantId||'')===String(variant.id||'')).reduce((sum,item)=>sum+Number(item.quantity||0),0):0;
 return Math.max(0,maximum-saved);
}
export function addCartLine(cart,product,variant,quantity,now=new Date().toISOString()){
 if(!Number.isInteger(quantity)||quantity<1||!variant.inStock||quantity>quantityLimit(product,variant,'cart',cart))throw Error('Revê a quantidade deste artigo.');
 const next=cart.map(item=>({...item}));const existing=next.find(item=>item.storeId===product.storeId&&item.productId===product.id&&String(item.variantId||'')===String(variant.id||''));
 if(existing)existing.quantity+=quantity;
 else next.push({productId:product.id,variantId:variant.id||'',storeId:product.storeId,storeName:product.storeName,storePhone:product.storePhone,isTest:product.isTest===true,storeLocation:product.storeLocation,productTitle:product.title,variantName:variant.name,sku:variant.sku,priceMinor:variant.priceMinor,imageUrl:product.images[variant.imageIndex>=0?variant.imageIndex:0]||'',quantity,addedAt:now});
 return next;
}
export function storeCartGroup(cart,storeId){
 const entries=cart.map((item,index)=>({item,index})).filter(({item})=>item.storeId===storeId);
 if(!entries.length)return null;const first=entries[0].item;
 return{storeId,storeName:first.storeName,storePhone:first.storePhone,isTest:first.isTest===true,storeLocation:first.storeLocation,items:entries,subtotalMinor:entries.reduce((sum,{item})=>sum+item.priceMinor*item.quantity,0)};
}
export function readCartFromStorage(storage, normalise = item => item) {
 function parse(raw) { try { const value=JSON.parse(raw||'[]');return Array.isArray(value)?value:[]; } catch { return []; } }
 try {
  const raw=storage.getItem('kamby_cart'),legacyRaw=storage.getItem('kamby_cart_demo');
  const merged=parse(raw).slice(),legacy=parse(legacyRaw);
  for(const item of legacy)if(!merged.some(line=>line.storeId===item.storeId&&line.productId===item.productId&&line.variantId===item.variantId))merged.push(item);
  const items=merged.map(normalise).filter(Boolean);
  // Reading another tab's cart must not write stale quantities back to storage.
  // Write only once when an actual legacy migration is still required.
  if(legacyRaw!==null){
   const latest=storage.getItem('kamby_cart');
   if(latest!==raw)return parse(latest).map(normalise).filter(Boolean);
   if(legacy.length)storage.setItem('kamby_cart',JSON.stringify(items));
   storage.removeItem('kamby_cart_demo');
  }
  return items;
 } catch { return []; }
}
export function sortVariantsForDisplay(variants) {
 const sizes=['XXS','XS','S','M','L','XL','XXL','XXXL'];
 function measure(name) {
  const text=String(name||'').trim();
  const size=sizes.indexOf(text.toUpperCase());
  if(size>=0)return{kind:'size',value:size};
  const match=text.toLowerCase().match(/^(\d+(?:[.,]\d+)?)\s*(ml|l|litros?|kg|g|cm|mm)?$/);
  if(!match)return null;
  const unit=match[2]||'',value=Number(match[1].replace(',','.'));
  if(['ml','l','litro','litros'].includes(unit))return{kind:'volume',value:value*(unit==='ml'?1:1000)};
  if(['kg','g'].includes(unit))return{kind:'weight',value:value*(unit==='kg'?1000:1)};
  if(['cm','mm'].includes(unit))return{kind:'length',value:value*(unit==='cm'?10:1)};
  return{kind:'number',value};
 }
 return variants.slice().sort((a,b)=>{
  if(Number.isFinite(a.sortOrder)&&Number.isFinite(b.sortOrder)&&a.sortOrder!==b.sortOrder)return a.sortOrder-b.sortOrder;
  const left=measure(a.name),right=measure(b.name);
  if(left&&right&&left.kind===right.kind)return left.value-right.value;
  return String(a.name).localeCompare(String(b.name),'pt',{numeric:true,sensitivity:'base'});
 });
}
export function currentCatalogueMode(search,storage){
 const requested=new URLSearchParams(search).get('catalogo');
 if(requested==='demo'||requested==='publico'){try{storage?.setItem('kamby:catalogue-mode',requested);}catch{}return requested;}
 try{return storage?.getItem('kamby:catalogue-mode')==='demo'?'demo':'publico';}catch{return'publico';}
}
export function baselineCataloguePath(path){
 if(!path.startsWith('/rest/v1/'))return path;
 const url=new URL(path,'https://catalogue.invalid');
 const select=url.searchParams.get('select');
 const pending=new Set(['previous_price_minor','moderation_status','condition','attributes','track_quantity','active','image_path','logo_path','banner_path','address','service_area','opening_hours']);
 if(select){let value=select.split(/([(),])/).filter(part=>!pending.has(part)).join('').replace(/,+/g,',').replace(/\(,/g,'(').replace(/,\)/g,')').replace(/^,|,$/g,'');
 value=value.replace(/variants:kg_product_variants\(([^)]*)\)/g,(_,fields)=>'variants:kg_product_variants('+fields.split(',').filter(field=>field!=='sort_order').join(',')+')');
 // Products gained quantity later; variants already had this column in the original contract.
 value=value.replace(/(^|,)stock_quantity(?=,|$)/g,'$1').replace(/,+/g,',').replace(/^,|,$/g,'');url.searchParams.set('select',value);}
 for(const key of [...url.searchParams.keys()])if(pending.has(key)||pending.has(key.split('.').at(-1)))url.searchParams.delete(key);
 return url.pathname+'?'+url.searchParams.toString();
}
export function storagePathFromSignedUrl(value,supabaseUrl,bucket){
 try{const url=new URL(value),base=new URL(supabaseUrl),prefix='/storage/v1/object/sign/'+bucket+'/';if(url.origin!==base.origin||!url.pathname.startsWith(prefix))return'';const path=decodeURIComponent(url.pathname.slice(prefix.length));return path.length<=500&&!/(^|\/)\.\.?(\/|$)/.test(path)?path:'';}catch{return'';}
}

// The card quotes an option that can be bought. Other discounted options
// get their own label without implying a discount on the displayed price.
export function cardOffer(row) {
  const variants = (row.variants || []).filter(option => option.active !== false);
  const available = variants.filter(option => option.in_stock && variantLimit(option) > 0);
  const options = available.length ? available : variants.length ? variants : [row];
  const prices = options.map(option => Number(option.price_minor) || 0);
  const priceMinor = Math.min(...prices);
  const cheapest = options.filter(option => Number(option.price_minor) === priceMinor);
  const previous = new Set(cheapest.map(option => Number(option.previous_price_minor) || 0));
  const previousPriceMinor = previous.size === 1 ? [...previous][0] : 0;
  return {
    priceMinor,
    previousPriceMinor,
    priceMode: new Set(prices).size > 1 ? 'from' : 'fixed',
    otherOffer: previousPriceMinor <= priceMinor &&
      options.some(option => Number(option.previous_price_minor) > Number(option.price_minor))
  };
}
