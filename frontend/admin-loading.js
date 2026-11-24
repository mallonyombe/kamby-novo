import {el} from './merchant-ui.js';

function skeleton(shape){
  const surface=el('div','admin-placeholder admin-placeholder--'+shape);
  surface.setAttribute('aria-hidden','true');
  const blocks=shape==='profile'?['cover','title','short','line','line']:
    shape==='metrics'?['metric','metric']:
    shape==='chart'?['metric','metric','cover']:
    shape==='account'?['title','line','short']:
    ['row','row','row'];
  for(const block of blocks){
    const item=el('span','admin-placeholder-'+block);
    if(block==='row')item.append(el('span'),el('span'),el('span'));
    surface.append(item);
  }
  return surface;
}

const activeLoads=new WeakMap();

export function beginAdminLoad(container,shape='rows'){
  activeLoads.get(container)?.();
  container.setAttribute('aria-busy','true');
  let placeholder;
  const timer=setTimeout(()=>{
    if(!container.isConnected)return;
    if(container.children.length){
      container.classList.add('admin-refreshing');
      return;
    }
    placeholder=skeleton(shape);
    container.append(placeholder);
  },180);
  const finish=()=>{
    clearTimeout(timer);
    placeholder?.remove();
    container.classList.remove('admin-refreshing');
    container.setAttribute('aria-busy','false');
    if(activeLoads.get(container)===finish)activeLoads.delete(container);
  };
  activeLoads.set(container,finish);
  return finish;
}
