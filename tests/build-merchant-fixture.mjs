import fs from 'node:fs';
const fixture = function () {
  const now=()=>new Date().toISOString();
  const evidence=(copy)=>{let n=document.getElementById('qaEvidence');if(!n){n=document.createElement('output');n.id='qaEvidence';n.setAttribute('aria-label','Evidência do ensaio');n.style.cssText='pointer-events:none;position:fixed;top:0;left:0;z-index:99999;background:#fff;color:#000;font:11px monospace;max-width:100%;overflow-wrap:anywhere';document.body.append(n);}n.textContent=copy;};
  window.open=(url)=>{evidence('Abertura externa interceptada: '+url);return {closed:false,close(){this.closed=true;}};};
  const user={id:'qa-merchant',aud:'authenticated',role:'authenticated',email:'merchant@example.test',phone:'258841234567',app_metadata:{provider:'email'},user_metadata:{display_name:'Amélia Mondlane'}};
  const access='eyJhbGciOiJIUzI1NiJ9.'+btoa(JSON.stringify({sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600}))+'.qa-signature';
  const session={access_token:access,refresh_token:'qa-refresh',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,user};
  const mode=new URLSearchParams(location.search).get('qa');
  let signedIn=mode!=='guest';
  const memory=new Map();
  const storage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,String(value)),removeItem:key=>memory.delete(key),clear:()=>memory.clear(),key:index=>Array.from(memory.keys())[index]??null,get length(){return memory.size;}};
  Object.defineProperty(window,'localStorage',{value:storage});
  Object.defineProperty(window,'sessionStorage',{value:{...storage,getItem:key=>null,setItem:()=>{},removeItem:()=>{}}});
  if(signedIn) storage.setItem('kamby:account',JSON.stringify(session));
  storage.setItem('kamby:recent-searches',JSON.stringify(['arroz']));
  const own={id:'s1',name:'Moheim Studio',location:'Chongoene, Centro',whatsapp_e164:'+258841234567',description:'Artigos de casa',slug:'moheim-studio',status:'approved',is_open:true,opening_hours:[],updated_at:now()};
  if(['draft','pending','suspended'].includes(mode))own.status=mode;
  if(mode==='closed')own.is_open=false;
  const other={...own,id:'s2',name:'Outra loja',slug:'outra-loja'};
  const product=(id,title,store,price,status='published')=>({id,title,store_id:store.id,store,price_minor:price,stock_status:'available',status,unit_reference:'un',created_at:now(),updated_at:now(),description:'Artigo do catálogo.',category_id:title==='Arroz'?'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff':'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',image_url:location.origin+(title==='Arroz'?'/catalogue-arroz.jpg':'/catalogue-caneca.jpg'),images:[],variants:[]});
  const products=[product('p1','Caneca azul',own,12500),product('p2','Arroz',own,15000),product('p3','Artigo de outra loja',other,50000)];
  products[1].variants=[['1 kg',8500],['5 kg',42000],['10 kg',82000]].map(([option_name,price_minor],i)=>({id:'v'+(i+1),sku:'qa-'+i,option_name,price_minor,in_stock:true,stock_quantity:0,updated_at:now()}));
  if(mode==='fade'){for(let i=0;i<18;i++)products.push({...products[i%2],id:'fade-'+i,title:i%2?'Arroz de grão longo':'Caneca de cerâmica'});}
  if(mode==='attention'){products[0].stock_status='out';products[1].status='draft';const restricted=product('p4','Caneca por rever',own,65000);restricted.moderation_status='blocked';products.push(restricted);}
  if(mode==='empty')products.splice(0,products.length);
  const events=[];
  const profile={display_name:'Amélia Mondlane',location:'Chongoene'};let preferences=null,accountRequest=null;const saved=[],contacts=[],notifications=[];
  let wrote=0;
  const uploads=new Map(),created=new Map();
  let uncertainReturned=false;
  const categories=[{id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',name:'Casa & Decoração'},{id:'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff',name:'Mercearia'}];
  const json=(value,status=200,extra={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json',...extra}});
  const baseFetch=window.fetch.bind(window);
  window.fetch=async(input,options={})=>{
    const url=new URL(typeof input==='string'?input:input.url,location.href);
    if(!url.hostname.endsWith('.supabase.co')) return baseFetch(input,options);
    let body={};try{body=JSON.parse(options.body||'{}');}catch{}
    const path=url.pathname;
    if(path.endsWith('/rpc/kg_store_contact_availability'))return json({available:mode!=='closed',reason:mode==='closed'?'closed':'open'});
    if(path.endsWith('/rpc/kg_account_context'))return json({user_id:user.id,roles:['customer','merchant'],merchant_store_ids:mode==='unassigned'?[]:['s1'],admin_access:false,admin_mfa_required:false});
    if(path==='/auth/v1/user') return signedIn?json(user):json({message:'No session'},401);
    if(path==='/auth/v1/token') {
      if(body.password!=='demo-password' && !body.refresh_token) return json({code:'invalid_credentials',msg:'Invalid credentials'},400);
      signedIn=true;return json(session);
    }
    if(path==='/auth/v1/logout') {if(url.searchParams.get('scope')!=='others')signedIn=false;return new Response(null,{status:204});}
    if(path.endsWith('/kg_store_categories'))return json(categories.map(category=>({category:{...category,is_active:true}})));
    if(path.endsWith('/kg_categories')) return json(mode==='no-categories'?[]:categories);
    if(path.endsWith('/rpc/kg_product_upload_context')) {
      if(!signedIn || body.p_store_id!=='s1' || mode==='unassigned') return json({code:'42501',message:'Denied'},403);
      return json({path:user.id+'/s1/'+body.p_product_id+'/photo.'+body.p_extension});
    }
    if(path.startsWith('/storage/v1/object/kg-product-images/')) {
      if(mode==='upload-error') return json({error:'Upload failed',message:'Upload failed'},503);
      const key=decodeURIComponent(path.slice('/storage/v1/object/kg-product-images/'.length));
      uploads.set(key,true);return json({Key:'kg-product-images/'+key,Id:'qa-file'});
    }
    if(path==='/storage/v1/object/kg-product-images' && options.method==='DELETE') {
      for(const key of body.prefixes || []) uploads.delete(key);return json([]);
    }
    if(path.startsWith('/storage/v1/object/sign/kg-product-images/')) {
      const key=decodeURIComponent(path.slice('/storage/v1/object/sign/kg-product-images/'.length));
      return uploads.has(key)?json({signedURL:'/object/sign/kg-product-images/'+key+'?token=test'}):json({message:'Not found'},404);
    }
    if(path.endsWith('/rpc/kg_merchant_create_product')) {
      if(mode==='create-error') return json({code:'22023',message:'Rejected'},400);
      if(created.has(body.p_product_id)) return json(created.get(body.p_product_id));
      if(!uploads.has(body.p_image_path)) return json({code:'22023',message:'Photo missing'},400);
      const article=product(body.p_product_id,body.p_title,own,body.p_price_minor);
      article.description=body.p_description;article.category=categories.find(c=>c.id===body.p_category_id);
      article.image_url=location.origin+'/catalogue-caneca.jpg';
      if(body.p_option_name) article.variants=[{id:crypto.randomUUID(),sku:'QA-'+body.p_product_id,option_name:body.p_option_name,price_minor:body.p_price_minor,in_stock:true,stock_quantity:0,updated_at:now()}];
      products.unshift(article);
      const result={id:article.id,status:'published'};created.set(article.id,result);
      if(mode==='create-uncertain' && !uncertainReturned) {uncertainReturned=true;return json({message:'Response unavailable',code:''},503);}
      return json(result);
    }
    if(path.endsWith('/rpc/kg_save_catalogue_product')){
      if(mode==='create-error')return json({code:'22023',message:'Rejeitado'},400);
      if(mode==='save-error')return json({code:'40001',message:'Concurrent update'},409);
      if(created.has(body.p_request_id))return json(created.get(body.p_request_id));
      const doc=body.p_document;let article=products.find(p=>p.id===body.p_product_id);
      if(!article){article=product(body.p_product_id,doc.title,own,doc.price_minor,doc.status);products.unshift(article);}
      Object.assign(article,doc,{updated_at:now(),images:doc.images.map((storage_path,sort_order)=>({storage_path,sort_order})),category:categories.find(c=>c.id===doc.category_id),stock_status:doc.in_stock?'available':'out'});
      const result={id:article.id,status:article.status,updated_at:article.updated_at};created.set(body.p_request_id,result);
      if(mode==='create-uncertain'&&!uncertainReturned){uncertainReturned=true;return json({code:'',message:'Unavailable'},503);}return json(result);
    }
    if(path.endsWith('/rpc/kg_save_store_settings')){if(mode==='save-error')return json({code:'40001',message:'Concurrent'},409);evidence('Horário enviado: '+JSON.stringify(body.p_document.opening_hours));Object.assign(own,body.p_document,{updated_at:now()});return json(own);}
    if(path.endsWith('/rpc/kg_merchant_activity'))return json({days:Array.from({length:7},(_,i)=>({day:'2026-11-'+String(6+i).padStart(2,'0'),views:i*2,contacts:i})),recent:[],as_of:now()});
    if(path.endsWith('/rpc/kg_my_managed_stores')) return json(signedIn&&mode!=='unassigned'?[own]:[]);
    if(path.endsWith('/kg_profiles')) {if(options.method==='PATCH'||options.method==='POST'){if(mode==='save-error')return json({message:'save failed'},503);Object.assign(profile,body);}return json(profile);}
    if(path.endsWith('/kg_user_preferences')){if(options.method==='POST'||options.method==='PATCH'){if(mode==='save-error')return json({message:'save failed'},503);preferences={...preferences,...body};}return json(preferences);}
    if(path.endsWith('/kg_saved_products')){if(options.method==='POST'){saved.push({product_id:body.product_id,created_at:now()});return json([],201);}if(options.method==='DELETE'){const index=saved.findIndex(p=>'eq.'+p.product_id===url.searchParams.get('product_id'));if(index>=0)saved.splice(index,1);return json([]);}let rows=saved;if(url.searchParams.has('product_id'))rows=rows.filter(p=>'eq.'+p.product_id===url.searchParams.get('product_id'));return json(rows.map(s=>({...s,product:products.find(p=>p.id===s.product_id)})));}
    if(path.endsWith('/rpc/kg_record_contact_activity')){contacts.push({id:body.p_request_id,store_name:own.name,product_title:products.find(p=>p.id===body.p_product_id)?.title||'',created_at:now(),kind:'whatsapp_requested'});return json(null);}
    if(path.endsWith('/kg_contact_activity'))return json(contacts);
    if(path.endsWith('/kg_notifications'))return json(notifications);
    if(path.endsWith('/kg_account_requests')){if(options.method==='POST'){accountRequest={status:'pending',created_at:now()};return json([],201);}return json(accountRequest);}

    if(path.endsWith('/rpc/kg_merchant_metrics')&&mode==='summary-loading')return new Promise(()=>{});
    if(path.endsWith('/rpc/kg_merchant_metrics')&&mode==='summary-error')return json({message:'Metrics unavailable'},503);
    if(path.endsWith('/rpc/kg_merchant_metrics')) return json({store_views:events.filter(e=>e.kind==='store_view').length,whatsapp_clicks:events.filter(e=>e.kind==='whatsapp_click').length,active_products:products.filter(p=>p.store_id==='s1'&&p.status==='published').length,as_of:now()});
    if(path.endsWith('/rpc/kg_merchant_update_item')) {
      if(mode==='save-error') return json({code:'42501',message:'Denied'},403);
      const p=products.find(p=>p.id===body.p_product_id&&p.store_id==='s1');
      const item=body.p_variant_id?p?.variants.find(v=>v.id===body.p_variant_id):p;
      if(!item) return json({code:'42501',message:'Foreign item'},403);
      if(body.p_expected_updated_at!==item.updated_at) return json({code:'40001',message:'Stale item'},409);
      item.price_minor=body.p_price_minor;item.updated_at=now();
      if(body.p_variant_id) {item.in_stock=body.p_in_stock;p.stock_status=p.variants.some(v=>v.in_stock)?'available':'out';}
      else p.stock_status=body.p_in_stock?'available':'out';
      wrote++;return json({product_id:p.id,updated_at:item.updated_at});
    }
    if(path.endsWith('/kg_stores') && options.method==='PATCH') {
      if(url.searchParams.get('id')!=='eq.s1') return json({message:'Denied'},403);
      own.is_open=body.is_open;own.updated_at=now();return json(own);
    }
    if(path.endsWith('/kg_store_events')) {events.push(body);return new Response(null,{status:201});}
    if(path.endsWith('/kg_stores')){if(url.searchParams.has('id'))return json({...own,products:products.filter(p=>p.store_id===own.id)});return json([own,other].map(s=>({...s,products:products.filter(p=>p.store_id===s.id)})));}
    if(path.endsWith('/kg_products')) {
      if(mode==='baseline'&&url.searchParams.get('select')==='moderation_status')return json({code:'42703',message:'column moderation_status does not exist'},400);
      let rows=products;
      if(url.searchParams.has('store_id')) rows=rows.filter(p=>'eq.'+p.store_id===url.searchParams.get('store_id'));
      if(url.searchParams.has('id')) rows=rows.filter(p=>'eq.'+p.id===url.searchParams.get('id'));
      if(url.searchParams.has('title'))rows=rows.filter(p=>p.title.toLowerCase().includes(url.searchParams.get('title').replace('ilike.','').replaceAll('%','').toLowerCase()));
      if(url.searchParams.has('status')){const filter=url.searchParams.get('status');rows=rows.filter(p=>filter.startsWith('neq.')?p.status!==filter.slice(4):'eq.'+p.status===filter);}
      if(url.searchParams.get('moderation_status')==='eq.allowed')rows=rows.filter(p=>p.moderation_status!=='blocked');
      if(url.searchParams.get('moderation_status')==='eq.blocked')rows=rows.filter(p=>p.moderation_status==='blocked');
      if(url.searchParams.get('stock_status')==='eq.out')rows=rows.filter(p=>p.stock_status==='out');
      const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||1000);
      return json(rows.slice(offset,offset+limit),200,{'Content-Range':offset+'-'+(offset+rows.length-1)+'/'+rows.length});
    }
    return json([]);
  };
};
const script='<script>('+fixture.toString()+')();<\/script>';
fs.writeFileSync('dist/merchant-qa.html',fs.readFileSync('frontend/index.html','utf8').replace('<head>','<head>'+script));
console.log('Isolated merchant browser fixture: /merchant-qa.html');

fs.writeFileSync('dist/merchant-mobile-qa.html',`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kamby · Verificação mobile</title><style>body{margin:0;background:#ddd;display:flex;justify-content:center;padding:20px;}iframe{width:390px;height:844px;border:0;background:white;box-shadow:0 4px 35px #0002;border-radius:24px;}</style></head><body><iframe title="Kamby mobile" src="/merchant-qa.html#lojista/s1"></iframe></body></html>`);
