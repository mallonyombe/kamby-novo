// Loaded before the app, only in the local browser QA build.
(() => {
  const uid = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
  const store = {id:uid(900), name:'Mercado QA', slug:'mercado', status:'approved', is_open:true, location:'Chongoene', whatsapp_e164:'258840000000'};
  const categories = [{id:uid(800), name:'Casa'}, {id:uid(801), name:'Cereais'}];
  const products = Array.from({length:61}, (_, i) => ({
    id:uid(i+1), title:i===60?'Arroz do ensaio':'Artigo '+(i+1), status:'published', moderation_status:'allowed',
    stock_status:'in', unit_reference:'un', store, store_id:store.id, category:categories[Number(i===60)],
    price_minor:i===60?9000:1200, created_at:new Date(Date.UTC(2026,8,1)-i*1000).toISOString(),
    image_url:location.origin+'/catalogue-arroz.jpg', images:[], variants:[]
  }));
  const rice = products.at(-1);
  rice.variants = ['1 kg','5 kg','10 kg'].map((name,i)=>({
    id:uid(700+i), active:true, option_name:name, sort_order:i, price_minor:[9000,39000,75000][i],
    previous_price_minor:i===1?45000:null, in_stock:i!==2, track_quantity:true, stock_quantity:[5,2,0][i]
  }));
  const scope = new URLSearchParams(location.search).get('scope');
  if (!scope) throw Error('Falta o identificador do ensaio');
  for (const kind of ['localStorage', 'sessionStorage']) {
    const real=window[kind], key=name=>'kamby-qa:'+scope+':'+name;
    const prefix = key('');
    const scopedKeys = () => Object.keys(real).filter(name => name.startsWith(prefix));
    Object.defineProperty(window,kind,{value:{
      get length(){return scopedKeys().length;},
      key:index=>scopedKeys()[index]?.slice(prefix.length) ?? null,
      getItem:name=>real.getItem(key(name)),setItem:(name,value)=>real.setItem(key(name),value),removeItem:name=>real.removeItem(key(name))
    }});
  }
  const qa=window.catalogueQA={requests:[],failStores:false,stockChanged:false,feedBlocked:false,errors:[]};
  window.addEventListener('error',e=>qa.errors.push(e.message));
  window.addEventListener('unhandledrejection',e=>qa.errors.push(String(e.reason)));
  const original=window.fetch.bind(window);
  const json=(rows,status=200)=>new Response(JSON.stringify(rows),{status,headers:{'Content-Type':'application/json'}});
  window.fetch=async (input,options={})=>{
    const url=new URL(input instanceof Request?input.url:input,location.href);
    if (url.origin===location.origin) return original(input, options);
    if (url.hostname!=='wbjhhkjriqeloiinvbii.supabase.co') throw Error('Unexpected origin in QA: '+url.origin);
    const resource=url.pathname.split('/').pop(), q=url.searchParams;
    let args={};
    if(options.body) args=JSON.parse(options.body);
    const id=q.get('id')||'';
    qa.requests.push({resource,id,kind:args.p_kind,offset:Number(q.get('offset')||0)});
    if(resource==='kg_search_catalogue') {
      if(args.p_kind==='stores'&&qa.failStores) return json({message:'Lojas indisponíveis'},503);
      const list=args.p_kind==='stores'?[store]:products;
      const found=list.filter(row=>(row.name||row.title).toLowerCase().includes(args.p_query.toLowerCase()));
      const offset=args.p_offset||0;
      return json({total:found.length,ids:found.slice(offset,offset+(args.p_limit||24)).map(row=>row.id)});
    }
    if(resource==='kg_feed_categories') return json(categories.map(c=>({id:c.id,label:c.name})));
    if(resource==='kg_store_contact_availability') return json({available:store.is_open,reason:store.is_open?'open':'closed'});
    if(resource==='kg_stores') return qa.failStores?json({},503):json([{...store,products}]);
    if(resource==='kg_products') {
      if(q.get('limit')==='0') return json([]);
      if(qa.feedBlocked&&!id) return new Promise(()=>{});
      let rows=products;
      if(id.startsWith('eq.')) rows=rows.filter(p=>p.id===id.slice(3));
      if(id.startsWith('neq.')) rows=rows.filter(p=>p.id!==id.slice(4));
      if(id.startsWith('in.(')) rows=rows.filter(p=>id.slice(4,-1).split(',').includes(p.id));
      if(q.has('category_id')) rows=rows.filter(p=>p.category.id===q.get('category_id').slice(3));
      const offset=Number(q.get('offset')||0);
      if(qa.stockChanged && id.startsWith('eq.')) rows=rows.map(p=>({...p,variants:p.variants.map(v=>({...v,in_stock:false,stock_quantity:0}))}));
      return json(rows.slice(offset,offset+Number(q.get('limit')||1000)));
    }
    if(resource==='kg_store_events') return new Response(null,{status:201});
    return json({message:'Unexpected QA endpoint: '+resource},404);
  };
  qa.feedBlocked=new URLSearchParams(location.search).has('blockFeed');
  qa.failStores=new URLSearchParams(location.search).has('failStores');
})();
