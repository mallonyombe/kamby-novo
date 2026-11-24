// Identificadores locais por navegador. A gestão recebe apenas agregados.
export function startAudience(platform) {
 let previous=0;
 const report=()=>{
  if(document.hidden||Date.now()-previous<60000)return;
  previous=Date.now();
  try{
   let device=localStorage.getItem('kamby:audience-device');
   if(!device){device=crypto.randomUUID();localStorage.setItem('kamby:audience-device',device);}
   let record=JSON.parse(localStorage.getItem('kamby:audience-session')||'null');
   if(!record||Date.now()-record.at>1800000)record={id:crypto.randomUUID()};
   record.at=Date.now();localStorage.setItem('kamby:audience-session',JSON.stringify(record));
   void platform.rpc('kg_record_app_session',{p_session:record.id,p_device:device}).then(()=>{},()=>{});
  }catch{}
 };
 report();
 document.addEventListener('visibilitychange',report);
 document.addEventListener('pointerdown',report,{passive:true});
 document.addEventListener('keydown',report);
}
