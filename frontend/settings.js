import {setButtonBusy,showSpinner,showSkeleton} from "./loading.js";
import {platform} from './platform.js';
import {canShowAdminEntry} from './account-access.js';
import {initials} from './merchant-domain.js';
import {profileValues,passwordError,readTheme} from './settings-domain.js';
import {applyTheme} from './theme.js';
const paths={user:'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',bookmark:'M5 3h14v18l-7-5-7 5Z',shield:'m12 3 9 4v6c0 5-9 8-9 8s-9-3-9-8V7Z M8 12l3 3 5-6',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',help:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3v1',info:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M12 10v7m0-11v1',key:'M9 15a6 6 0 1 0-6-6 6 6 0 0 0 6 6 M13 13l8 8m-3-3 3-3',device:'M4 3h16v13H4Z M8 21h8m-4-5v5',chevron:'m9 6 6 6-6 6'};
function icon(name){const n=document.createElementNS('http://www.w3.org/2000/svg','svg');n.setAttribute('viewBox','0 0 24 24');n.setAttribute('fill','none');n.setAttribute('stroke','currentColor');n.setAttribute('aria-hidden','true');n.classList.add('settings-menu-icon');const p=document.createElementNS(n.namespaceURI,'path');p.setAttribute('d',paths[name]||paths.info);n.append(p);return n;}
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function button(copy,cls,action){const b=node('button',copy,cls);b.type='button';if(action)b.addEventListener('click',action);return b;}
export function setupSettings({getAccount,loadAccount,openSubscreen,closeSubscreen,navigate}){
 const $=id=>document.getElementById(id),view=$('viewSettingsSubscreen'),body=$('settingsSubscreenContent');
 let screen='',generation=0,busy=false,dirty=false,accountId=null,returnFocus='',returnScroll=0,recovery=false,currentProduct=null;
 let savedState = new Map();
 let pendingReads = new Set();
 let pendingWrites = new Set();
 let savedFrame = 0;
 let afterSignIn = '';
 const privateScreens=['pessoais','actividade','guardados','seguranca','palavra-passe','sessoes','notificacoes','encerramento'];
 const titles={entrar:'Iniciar sessão',pessoais:'Dados pessoais',actividade:'Contactos',guardados:'Guardados',seguranca:'Segurança e acesso','palavra-passe':'Palavra-passe',sessoes:'Sessões',notificacoes:'Notificações',encerramento:'Encerramento da conta',aparencia:'Aparência',ajuda:'Ajuda e suporte',sobre:'Sobre o Kamby',recuperacao:'Recuperar acesso'};
 function notice(copy){$('settingsScreenNotice').textContent=copy;$('settingsScreenNotice').hidden=!copy;}
 function row(name,sub,kind,target,disabled=false){const b=button('','profile-menu-item',()=>{returnFocus=target;open(target);});b.dataset.settingsTarget=target;b.append(icon(kind));const c=node('span',undefined,'profile-menu-copy');c.append(node('span',name,'profile-menu-label'));if(sub)c.append(node('span',sub,'profile-menu-sub'));b.append(c,icon('chevron'));b.disabled=disabled;return b;}
 function confirm(title,copy,accept,action){const dialog=$('settingsConfirmDialog');$('settingsConfirmTitle').textContent=title;$('settingsConfirmCopy').textContent=copy;$('settingsConfirmAccept').textContent=accept;$('settingsConfirmAccept').onclick=()=>{dialog.close();action();};dialog.showModal();}
 $('settingsConfirmCancel').addEventListener('click',()=>$('settingsConfirmDialog').close());
 function clearSensitive(){generation++;busy=false;dirty=false;accountId=null;recovery=false;resetSavedState();body.replaceChildren();$('accountPassword').value='';$('accountLoginError').hidden=true;}
 function sync(){const a=getAccount();const id=a.user?.id||null;
  if(accountId&&accountId!==id){clearSensitive();if(!view.hidden&&privateScreens.includes(screen))close(true);}
  if (accountId !== id) resetSavedState();
  accountId=id;
  $('settingsGuestIntro').hidden=Boolean(a.user)||a.phase==='loading';$('settingsAccountCard').hidden=!a.user&&a.phase!=='loading';
  $('settingsAccountMenu').hidden=a.phase==='loading';$('btnRetryAccount').hidden=!['error','offline'].includes(a.phase);
  const menu=$('settingsAccountMenu');menu.replaceChildren();
  const activities = node('div', undefined, 'profile-menu-list');
  const unavailable = Boolean(a.user) && (!navigator.onLine || a.phase !== 'ready');
  $('btnProfilePersonal').hidden = !a.user || unavailable;
  activities.append(row('Guardados', null, 'heart', 'guardados', unavailable));
  if (a.user) activities.append(row('Contactos', null, 'bookmark', 'actividade', unavailable));
  menu.append(activities);
  const work = $('profileWorkMenu');
  work.replaceChildren();
  work.hidden = !canShowAdminEntry(a, navigator.onLine);
  if (!work.hidden) {
   const link=node('a',a.access.adminMfaRequired?'Administração · confirmar segurança':'Abrir administração','profile-menu-item');link.href='admin.html';link.dataset.accountAdmin='true';work.append(link);
  }
  const publicMenu = $('settingsPublicMenu');
  publicMenu.replaceChildren(row('Definições', null, 'sun', 'preferencias'), row('Ajuda', null, 'help', 'ajuda'));
  if (!a.user) publicMenu.prepend(row('Aparência', null, 'sun', 'aparencia'));
  if (a.user && !view.hidden && screen === 'entrar') {
   const destination = afterSignIn;
   afterSignIn = '';
   close(true);
   navigate('perfil');
   if (destination) open(destination);
  }
  scheduleSavedRefresh();
 }
 function formError(form,copy){let p=form.querySelector('[role="alert"]');if(!p){p=node('p',undefined,'field-error');p.setAttribute('role','alert');form.append(p);}p.textContent=copy;p.hidden=!copy;}
 function field(form,name,label,value='',type='text',required=false){const l=node('label',label,'settings-field'),i=node('input');i.type=type;i.name=name;i.value=value;i.required=required;i.autocomplete='off';l.append(i);form.append(l);return i;}
 function lead(title,copy){if(title)body.append(node('h2',title,'settings-lead'));if(copy)body.append(node('p',copy,'settings-copy'));}
 function empty(title,copy){const box=node('div',undefined,'search-zero-box');box.append(node('h2',title,'settings-lead'),node('p',copy));body.append(box);}
 async function ownedWrite(table,id,values){const update=()=>platform.from(table).update(values).eq(table==='kg_profiles'?'id':'user_id',id).select().maybeSingle();let r=await update();if(r.error)throw r.error;if(r.data)return r.data;r=await platform.from(table).insert({[table==='kg_profiles'?'id':'user_id']:id,...values}).select().single();if(r.error?.code==='23505')r=await update();if(r.error)throw r.error;return r.data;}
 function saveForm(form,copy,action){const submit=button(copy,'merchant-primary-button');submit.type='submit';form.append(submit);form.addEventListener('submit',async event=>{event.preventDefault();if(busy)return;busy=true;submit.disabled=true;setButtonBusy(submit,true);const request=generation;formError(form,'');try{await action();if(request!==generation)return;}catch(error){if(request===generation)formError(form,error.safeMessage||'Não foi possível guardar. Verifica a ligação e tenta novamente.');}finally{if(request===generation){busy=false;setButtonBusy(submit,false);submit.disabled=false;}}});return submit;}
 async function renderScreen(){const request=++generation;body.replaceChildren();notice('');$('settingsLoginPanel').hidden=screen!=='entrar';$('settingsSubscreenTitle').textContent=titles[screen];document.title=titles[screen]+' · Kamby';const a=getAccount();
  $('settingsDeviceActions').hidden = screen !== 'preferencias';
  if (screen === 'preferencias') {
   const group = node('div', undefined, 'profile-menu-list');
   const unavailable = !navigator.onLine || a.phase !== 'ready';
   if (a.user) group.append(row('Segurança e acesso', null, 'shield', 'seguranca', unavailable), row('Notificações', null, 'bell', 'notificacoes', unavailable));
   group.append(row('Aparência', null, 'sun', 'aparencia'), row('Sobre o Kamby', null, 'info', 'sobre'));
   body.append(group);
   return;
  }
  if(privateScreens.includes(screen)&&!a.user){open('entrar',false);return;}
  if(screen==='entrar')return;
  if(screen==='aparencia'){lead('À tua maneira','Escolhe a aparência do Kamby.');const g=node('div',undefined,'settings-group');let theme='auto';try{theme=readTheme(localStorage);}catch{}for(const [value,label,sub] of [['auto','Automático','Acompanha o dispositivo'],['light','Claro','Superfícies claras'],['dark','Escuro','Superfícies escuras']]){const l=node('label',undefined,'settings-choice'),c=node('span',label),i=node('input');c.append(node('small',sub));i.type='radio';i.name='appearance';i.value=value;i.checked=value===theme;i.addEventListener('change',()=>{try{applyTheme(value);notice('Aparência actualizada.');}catch{notice('Não foi possível guardar a preferência neste dispositivo.');i.checked=false;g.querySelector('input[value="'+theme+'"]').checked=true;}});l.append(icon('sun'),c,i);g.append(l);}body.append(g);const historyLabel=node('label',undefined,'settings-choice'),copy=node('span','Guardar pesquisas recentes'),check=node('input');check.type='checkbox';try{check.checked=localStorage.getItem('kamby:search-history')!=='off';}catch{}check.addEventListener('change',()=>{try{localStorage.setItem('kamby:search-history',check.checked?'on':'off');if(!check.checked)localStorage.removeItem('kamby:recent-searches');window.dispatchEvent(new Event('kamby:search-history'));notice('Preferência guardada.');}catch{check.checked=!check.checked;notice('Não foi possível guardar a preferência.');}});historyLabel.append(copy,check);body.append(historyLabel);return;}
  if(screen==='pessoais'){lead('Os teus dados','O telefone e o email pertencem ao acesso à conta.');const form=node('form',undefined,'settings-form');const name=field(form,'name','Nome completo',a.profile?.display_name||a.user.user_metadata?.display_name||a.user.user_metadata?.full_name||'','text',true);name.maxLength=80;name.autocomplete='name';const location=field(form,'location','Localização',a.profile?.location||'');location.maxLength=120;const phone=field(form,'phone','Telefone',a.user.phone?'+'+a.user.phone.replace(/^\+/, ''):'Não associado');phone.readOnly=true;const email=field(form,'email','Email',a.user.email||'Não associado');email.readOnly=true;form.addEventListener('input',()=>{dirty=true;});body.append(form);saveForm(form,'Guardar alterações',async()=>{let values;try{values=profileValues(name.value,location.value);}catch(e){throw{safeMessage:e.message};}const id=a.user.id;await ownedWrite('kg_profiles',id,values);if(id!==getAccount().user?.id)return;dirty=false;await loadAccount();notice('Dados guardados.');});return;}
  if(screen==='seguranca'){const g=node('div',undefined,'settings-group');g.append(row('Alterar palavra-passe',null,'key','palavra-passe'),row('Sessões','Terminar acesso noutros dispositivos','device','sessoes'),row('Recuperar acesso',null,'help','recuperacao'),row('Encerramento da conta','Pedir análise à equipa Kamby','user','encerramento'));body.append(g);return;}
  if(screen==='palavra-passe'){lead(null,recovery?'Define uma nova palavra-passe para concluir a recuperação.':'Confirma o acesso à conta antes de alterar a palavra-passe.');const form=node('form',undefined,'settings-form');let current=null;if(!recovery){current=field(form,'current','Palavra-passe actual','','password',true);current.autocomplete='current-password';}const next=field(form,'new','Nova palavra-passe','','password',true),repeat=field(form,'confirmation','Confirmar nova palavra-passe','','password',true);next.autocomplete=repeat.autocomplete='new-password';next.maxLength=repeat.maxLength=128;const show=node('label',undefined,'settings-choice'),check=node('input');check.type='checkbox';show.append(node('span','Mostrar palavras-passe'),check);check.addEventListener('change',()=>[current,next,repeat].filter(Boolean).forEach(i=>i.type=check.checked?'text':'password'));form.append(show);body.append(form);saveForm(form,'Actualizar palavra-passe',async()=>{const err=passwordError(next.value,repeat.value);if(err)throw{safeMessage:err};try{if(current){const identity=a.user.email?{email:a.user.email}:{phone:a.user.phone};const {error}=await platform.auth.signInWithPassword({...identity,password:current.value});if(error)throw{safeMessage:'Não foi possível confirmar a palavra-passe actual.'};}const {error}=await platform.auth.updateUser({password:next.value});if(error)throw{safeMessage:error.code==='same_password'?'Escolhe uma palavra-passe diferente.':error.code==='reauthentication_needed'?'É necessária uma nova confirmação de acesso. Volta a entrar e tenta novamente.':'Não foi possível actualizar a palavra-passe. Volta a entrar ou recupera o acesso.'};recovery=false;notice('Palavra-passe actualizada.');}finally{[current,next,repeat].filter(Boolean).forEach(i=>i.value='');}});return;}
  if(screen==='sessoes'){lead('Sessão actual','Este dispositivo tem sessão iniciada na tua conta.');const g=node('div',undefined,'settings-group');g.append(row('Terminar outras sessões','Mantém a sessão deste dispositivo','device','sessoes'));g.replaceChild(g.firstChild.cloneNode(true),g.firstChild);g.firstChild.onclick=()=>confirm('Terminar outras sessões?','Os outros dispositivos terão de voltar a entrar. O acesso já emitido pode manter-se até expirar.','Terminar',async()=>{if(busy)return;busy=true;const action=g.firstChild;action.disabled=true;setButtonBusy(action,true);try{const {error}=await platform.auth.signOut({scope:'others'});notice(error?'Não foi possível terminar as outras sessões.':'As outras sessões já não podem ser renovadas.');}finally{setButtonBusy(action,false);action.disabled=false;busy=false;}});body.append(g);return;}
  if(screen==='recuperacao'){lead('Recuperar acesso','Indica o email associado à conta para pedir uma ligação de recuperação.');const form=node('form',undefined,'settings-form'),email=field(form,'email','Email da conta',a.user?.email||'','email',true);email.autocomplete='email';body.append(form);saveForm(form,'Pedir ligação',async()=>{const {error}=await platform.auth.resetPasswordForEmail(email.value.trim(),{redirectTo:new URL('/?account=recovery',window.location.origin).href});if(error)throw{safeMessage:'Não foi possível pedir a ligação. Tenta novamente mais tarde.'};notice('Se existir uma conta com este email, receberás uma ligação de recuperação. Verifica também o spam.');});body.append(node('p','Para contas apenas com telefone, a recuperação precisa de assistência da equipa Kamby.','settings-copy'));return;}
  if(screen==='actividade'||screen==='guardados'){const pending=node('div');body.append(pending);showSkeleton(pending,'rows',3);const result=screen==='guardados'?await platform.from('kg_saved_products').select('product_id,created_at,product:kg_products(id,title,price_minor,status,store:kg_stores(name),variants:kg_product_variants(price_minor))').eq('user_id',a.user.id).order('created_at',{ascending:false}).limit(100):await platform.from('kg_contact_activity').select('id,store_name,product_title,created_at,kind').eq('user_id',a.user.id).order('created_at',{ascending:false}).limit(100);if(request!==generation)return;pending.remove();if(result.error){empty('Não foi possível carregar','Verifica a ligação e tenta novamente.');body.append(button('Tentar novamente','settings-text-action',renderScreen));return;}if(!result.data?.length){empty(screen==='guardados'?'Ainda não guardaste produtos':'Ainda não há contactos',screen==='guardados'?'Toca no coração de um produto para o guardar.':'Os pedidos de abertura do WhatsApp aparecem aqui.');return;}for(const item of result.data){const card=node('article',undefined,'settings-item'),meta=node('div');if(screen==='guardados'){const p=item.product;meta.append(node('strong',p?.title||'Produto indisponível'),node('p',p?.store?.name||'O produto já não está publicado.'));if(p){const go=button('Ver produto','settings-text-action',()=>{close(true);window.dispatchEvent(new CustomEvent('kamby:navigate-product',{detail:{id:p.id}}));});meta.append(go);}const remove=button('Remover','settings-text-action',async()=>{remove.disabled=true;setButtonBusy(remove,true);const {error}=await platform.from('kg_saved_products').delete().eq('user_id',a.user.id).eq('product_id',item.product_id);if(request!==generation)return;if(error){setButtonBusy(remove,false);remove.disabled=false;notice('Não foi possível remover o produto.');}else { savedState.set(item.product_id, false); paintSavedButtons(); renderScreen(); }});card.append(meta,remove);}else{meta.append(node('strong',item.store_name),node('p',item.product_title),node('p','Abertura do WhatsApp solicitada · '+new Intl.DateTimeFormat('pt-MZ',{dateStyle:'medium'}).format(new Date(item.created_at))));card.append(meta);}body.append(card);}if(screen==='actividade')body.append(node('p','Um contacto não confirma envio de mensagem, encomenda ou pagamento.','settings-copy'));return;}
  if(screen==='notificacoes'){lead('Preferências de avisos','Os avisos são apresentados aqui, dentro do Kamby.');const pending=node('div');body.append(pending);showSkeleton(pending,'rows',3);const [pref,notes]=await Promise.all([platform.from('kg_user_preferences').select('catalogue_alerts,account_alerts').eq('user_id',a.user.id).maybeSingle(),platform.from('kg_notifications').select('id,title,body,read_at,created_at').eq('user_id',a.user.id).order('created_at',{ascending:false}).limit(50)]);if(request!==generation)return;pending.remove();if(pref.error||notes.error){empty('Não foi possível carregar','Verifica a ligação e tenta novamente.');body.append(button('Tentar novamente','settings-text-action',renderScreen));return;}let values=pref.data||{catalogue_alerts:true,account_alerts:true};const g=node('div',undefined,'settings-group');for(const [key,label,sub]of[['catalogue_alerts','Produtos guardados','Alterações de preço e disponibilidade'],['account_alerts','Pedidos da conta','Actualizações do pedido de encerramento']]){const l=node('label',undefined,'settings-choice'),copy=node('span',label),input=node('input');copy.append(node('small',sub));input.type='checkbox';input.checked=values[key];input.addEventListener('change',async()=>{const value=input.checked;input.disabled=true;const pending=node('span');l.append(pending);showSpinner(pending);try{await ownedWrite('kg_user_preferences',a.user.id,{...values,[key]:value});if(request!==generation)return;values[key]=value;notice('Preferência guardada.');}catch{if(request!==generation)return;input.checked=!value;notice('Não foi possível guardar a preferência.');}finally{pending.remove();input.disabled=false;}});l.append(copy,input);g.append(l);}body.append(g);if(!notes.data.length)empty('Sem avisos','Os novos avisos aparecem aqui.');for(const n of notes.data){const article=node('article',undefined,'settings-item'+(!n.read_at?' settings-notification-unread':'')),meta=node('div');meta.append(node('strong',n.title),node('p',n.body));article.append(meta);if(!n.read_at){const read=button('Lido','settings-text-action',async()=>{read.disabled=true;setButtonBusy(read,true);const {error}=await platform.from('kg_notifications').update({read_at:new Date().toISOString()}).eq('id',n.id).eq('user_id',a.user.id);if(request!==generation)return;if(error){setButtonBusy(read,false);read.disabled=false;notice('Não foi possível marcar como lido.');}else{article.classList.remove('settings-notification-unread');read.remove();}});article.append(read);}body.append(article);}return;}
  if(screen==='encerramento'){const pending=node('div');body.append(pending);showSkeleton(pending,'rows',2);const {data,error}=await platform.from('kg_account_requests').select('status,created_at').eq('user_id',a.user.id).maybeSingle();if(request!==generation)return;pending.remove();if(error){empty('Não foi possível carregar','Tenta novamente mais tarde.');return;}if(data){const statuses={pending:'Pedido em análise',processing:'Pedido em tratamento',completed:'Pedido concluído pela gestão',declined:'Pedido revisto pela gestão'};empty(statuses[data.status]||'Pedido registado','O pedido não elimina a conta automaticamente.');return;}lead('Encerramento da conta','Pede à equipa Kamby a análise do encerramento da tua conta. A conta mantém-se activa enquanto o pedido é tratado.');body.append(button('Pedir encerramento','settings-text-action profile-sign-out',()=>confirm('Registar pedido de encerramento?','O pedido será enviado à gestão da plataforma. Esta acção não apaga os teus dados imediatamente.','Registar pedido',async()=>{if(busy)return;busy=true;const action=body.querySelector('button');action.disabled=true;setButtonBusy(action,true);try{const {error}=await platform.from('kg_account_requests').insert({user_id:a.user.id});if(error&&error.code!=='23505')notice('Não foi possível registar o pedido.');else renderScreen();}finally{setButtonBusy(action,false);action.disabled=false;busy=false;}})));return;}
  if(screen==='ajuda'){lead('Como podemos ajudar?');for(const [q,copy]of[['Como contactar uma loja?','Abre um produto ou uma loja e escolhe Negociar. A conversa continua no WhatsApp.'],['O contacto confirma a compra?','Não. Confirma o preço, a disponibilidade, o pagamento e a entrega com a loja.'],['Como recuperar o acesso?','Usa Esqueci a palavra-passe na entrada da conta. A recuperação por email depende de um email associado.'],['Onde ficam os meus produtos?','Os produtos adicionados ficam no Carrinho deste dispositivo. Os produtos guardados na conta aparecem em Actividade.']]){const d=node('details',undefined,'settings-group'),s=node('summary',q);s.style.padding='16px';const p=node('p',copy,'settings-copy');p.style.padding='0 16px';d.append(s,p);body.append(d);}return;}
  if(screen==='sobre'){lead('Kamby','Orbion Technology');body.append(node('p','Descobre produtos e lojas e contacta cada vendedor pelo WhatsApp.','settings-copy'),node('p','Os termos e a política de privacidade formais ainda não foram disponibilizados.','settings-copy'));}
 }
 async function open(target,updateHistory=true){if(!titles[target])return false;if(!view.hidden&&screen===target&&!dirty)return true;if(busy)return false;if(dirty){confirm('Descartar alterações?','Há dados que ainda não foram guardados.','Descartar',()=>{dirty=false;open(target,updateHistory);});return false;}
  afterSignIn = '';
  if(privateScreens.includes(target)&&!getAccount().user){await loadAccount();if(!getAccount().user){afterSignIn=target;target='entrar';}}
  if(view.hidden){returnScroll=window.scrollY;openSubscreen();}
  screen=target;view.hidden=false;view.classList.add('active');view.scrollTop=0;document.getElementById('viewProfile').inert=true;
  if(updateHistory)history.pushState({kambySettings:true},'','#definicoes/'+target);
  try{await renderScreen();}catch{if(screen===target){body.replaceChildren();empty('Não foi possível carregar','Verifica a ligação e tenta novamente.');body.append(button('Tentar novamente','settings-text-action',()=>renderScreen()));}}
  return true;
 }
 function close(force=false){if(view.hidden)return true;if(!force&&(busy||dirty)){if(dirty)confirm('Descartar alterações?','Há dados que ainda não foram guardados.','Descartar',()=>{dirty=false;close(true);history.replaceState(null,'','#perfil');});return false;}generation++;dirty=false;body.replaceChildren();$('accountPassword').value='';view.hidden=true;view.classList.remove('active');closeSubscreen();window.scrollTo({top:returnScroll,behavior:'auto'});document.querySelector('[data-settings-target="'+returnFocus+'"]')?.focus({preventScroll:true});document.title='Perfil · Kamby';return true;}
 $('btnProfilePersonal').addEventListener('click', () => { returnFocus = 'pessoais'; open('pessoais'); });
 $('btnBackSettings').addEventListener('click', async () => {
  const parent = ['palavra-passe', 'sessoes', 'encerramento'].includes(screen) ? 'seguranca'
   : ['seguranca', 'notificacoes', 'sobre'].includes(screen) || (screen === 'aparencia' && getAccount().user) ? 'preferencias' : '';
  if (parent) {
   if (await open(parent, false)) history.replaceState(null, '', '#definicoes/' + parent);
   return;
  }
  if (close()) history.replaceState(null, '', '#perfil');
 });
 $('btnOpenAccountSignIn').addEventListener('click',()=>open('entrar'));$('btnForgotPassword').addEventListener('click',()=>open('recuperacao'));$('btnRetryAccount').addEventListener('click',async()=>{const b=$('btnRetryAccount');if(b.disabled)return;b.disabled=true;setButtonBusy(b,true);try{await loadAccount();}finally{setButtonBusy(b,false);b.disabled=false;}});
 window.addEventListener('online',()=>{loadAccount();if(!view.hidden&&!dirty)renderScreen();});window.addEventListener('offline',()=>{sync();if(!view.hidden)notice('Sem ligação. A aparência continua disponível; as alterações da conta precisam de ligação.');});
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 function resetSavedState() {
  savedState = new Map();
  pendingReads = new Set();
  pendingWrites = new Set();
 }
 function savedButtons() {
  const cards = Array.from(document.querySelectorAll('[data-save-product]'), button => [button.dataset.saveProduct, button]);
  if (currentProduct) cards.push([currentProduct, $('btnPdpSaveProduct')]);
  return cards;
 }
 function paintSavedButtons(entries = savedButtons()) {
  for (const [id, button] of entries) {
   const pressed = savedState.get(id) === true;
   const title = button.dataset.productTitle;
   button.setAttribute('aria-pressed', String(pressed));
   button.setAttribute('aria-label', title ? 'Guardar ' + title : 'Guardar produto');
   button.disabled = pendingWrites.has(id);
   const label = button.querySelector('span');
   if (label) label.textContent = pressed ? 'Guardado' : 'Guardar';
  }
 }
 function scheduleSavedRefresh() {
  if (savedFrame) return;
  savedFrame = requestAnimationFrame(() => {
   savedFrame = 0;
   const entries = savedButtons();
   paintSavedButtons(entries);
   const userId = getAccount().user?.id;
   if (!userId) return;
   const ids = [...new Set(entries.map(([id]) => id))].filter(id => !savedState.has(id) && !pendingReads.has(id) && !pendingWrites.has(id));
   for (let index = 0; index < ids.length; index += 50) {
    readSavedProducts(userId, ids.slice(index, index + 50));
   }
  });
 }
 async function readSavedProducts(userId, ids) {
  const state = savedState;
  const reads = pendingReads;
  ids.forEach(id => reads.add(id));
  try {
   const { data, error } = await platform.from('kg_saved_products').select('product_id').eq('user_id', userId).in('product_id', ids);
   if (error || state !== savedState || userId !== getAccount().user?.id) return;
   const saved = new Set(data.map(row => row.product_id));
   for (const id of ids) {
    if (!state.has(id) && !pendingWrites.has(id)) state.set(id, saved.has(id));
   }
   paintSavedButtons();
  } finally {
   ids.forEach(id => reads.delete(id));
  }
 }
 async function toggleSavedProduct(id, trigger) {
  if (!id || pendingWrites.has(id)) return;
  const userId = getAccount().user?.id;
  if (!userId) {
   if (await open('entrar')) notice('Inicia sessão para guardar produtos na tua conta.');
   return;
  }
  const state = savedState;
  const writes = pendingWrites;
  writes.add(id);
  paintSavedButtons();
  const stillCurrent = () => state === savedState && userId === getAccount().user?.id;
  const feedback = detail => window.dispatchEvent(new CustomEvent('kamby:feedback', { detail }));
  try {
   const existing = await platform.from('kg_saved_products').select('product_id').eq('user_id', userId).eq('product_id', id).maybeSingle();
   if (!stillCurrent()) return;
   if (existing.error) throw existing.error;
   const saved = Boolean(existing.data);
   const result = saved
    ? await platform.from('kg_saved_products').delete().eq('user_id', userId).eq('product_id', id)
    : await platform.from('kg_saved_products').insert({ user_id: userId, product_id: id });
   if (!stillCurrent()) return;
   if (result.error && (saved || result.error.code !== '23505')) throw result.error;
   state.set(id, !saved);
   const icon = trigger?.querySelector('svg');
   if (!saved && icon && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    icon.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.16)' }, { transform: 'scale(1)' }],
      { duration: 220, easing: 'ease-out' });
   }
   feedback(saved ? 'Produto removido dos guardados.' : 'Produto guardado.');
  } catch {
   if (stillCurrent()) feedback('Não foi possível actualizar os guardados. Tenta novamente.');
  } finally {
   writes.delete(id);
   if (stillCurrent()) paintSavedButtons();
  }
 }
 window.addEventListener('kamby:catalogue-card', scheduleSavedRefresh);
 window.addEventListener('kamby:product-loading', () => { currentProduct = null; });
 window.addEventListener('kamby:product-ready', event => {
  currentProduct = event.detail.id;
  paintSavedButtons([[currentProduct, $('btnPdpSaveProduct')]]);
  scheduleSavedRefresh();
 });
 document.addEventListener('click', event => {
  const button = event.target.closest('[data-save-product]');
  if (button) toggleSavedProduct(button.dataset.saveProduct, button);
 });
 $('btnPdpSaveProduct').addEventListener('click', event => toggleSavedProduct(currentProduct, event.currentTarget));
 return {sync,open,close,isOpen:()=>!view.hidden,recovery:async()=>{recovery=true;await loadAccount();open('palavra-passe');},route:async hash=>{const target=decodeURIComponent(hash.slice('#definicoes/'.length));return open(target,false);},clear:clearSensitive};
}
