import {readTheme} from './settings-domain.js';
export function applyTheme(value,persist=true){
 if(!['auto','light','dark'].includes(value))return;
 if(persist)localStorage.setItem('kamby:theme',value);
 document.documentElement.dataset.theme=value;
 const dark=value==='dark'||(value==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches);
 document.documentElement.style.colorScheme=dark?'dark':'light';
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#111113':'#F6F7F9');
}
let theme='auto';try{theme=readTheme(localStorage);}catch{}
applyTheme(theme,false);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{let value='auto';try{value=readTheme(localStorage);}catch{}if(value==='auto')applyTheme('auto',false);});
window.addEventListener('storage',event=>{if(event.key==='kamby:theme')applyTheme(readTheme(localStorage),false);});
