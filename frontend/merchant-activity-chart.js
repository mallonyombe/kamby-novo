import {el} from './merchant-ui.js';
export function activityChart(days) {
  const box=el('div','mw-activity-plot');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.classList.add('mw-activity-svg');svg.setAttribute('viewBox','0 0 340 164');svg.setAttribute('role','img');svg.setAttribute('aria-label','Visitas à loja e cliques no WhatsApp nos últimos sete dias');
  const rows=(days||[]).slice(-7),maximum=Math.max(1,...rows.flatMap(d=>[Number(d.views)||0,Number(d.contacts)||0]));
  const x=i=>16+i*308/Math.max(1,rows.length-1),y=v=>144-(Number(v)||0)*124/maximum;
  function shape(tag,attrs){const n=document.createElementNS(svg.namespaceURI,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));svg.append(n);return n;}
  for(const value of [0,maximum/2,maximum])shape('line',{x1:16,x2:324,y1:y(value),y2:y(value),class:'mw-chart-grid'});
  for(const [key,cls] of [['views','visits'],['contacts','contacts']]){
    shape('polyline',{points:rows.map((d,i)=>x(i)+','+y(d[key])).join(' '),fill:'none',class:'mw-series '+cls});
  }
  const marker=shape('line',{x1:16,x2:16,y1:12,y2:146,class:'mw-chart-marker'});
  const dots=['views','contacts'].map((key,i)=>shape('circle',{cx:16,cy:144,r:4,class:'mw-point '+(i?'contacts':'visits')}));
  box.append(svg);const selectors=el('div','mw-chart-days');selectors.setAttribute('role','group');selectors.setAttribute('aria-label','Consultar dia');const detail=el('p','mw-chart-selection');detail.setAttribute('role','status');
  const fullDate=new Intl.DateTimeFormat('pt-MZ',{day:'numeric',month:'short'});
  function select(index){const d=rows[index];marker.setAttribute('x1',x(index));marker.setAttribute('x2',x(index));dots.forEach((n,i)=>{n.setAttribute('cx',x(index));n.setAttribute('cy',y(d[i?'contacts':'views']));});[...selectors.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));detail.textContent=fullDate.format(new Date(d.day+'T12:00:00'))+' · '+d.views+' visitas · '+d.contacts+' cliques WhatsApp';}
  rows.forEach((d,i)=>{const date=new Date(d.day+'T12:00:00'),b=el('button','',new Intl.DateTimeFormat('pt-MZ',{weekday:'short'}).format(date).replace('.',''));b.type='button';b.setAttribute('aria-label',fullDate.format(date)+': '+d.views+' visitas e '+d.contacts+' cliques WhatsApp');b.onclick=()=>select(i);selectors.append(b);});
  box.append(selectors,detail);if(rows.length)select(rows.length-1);return box;
}
