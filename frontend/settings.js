import {loadAccountTerms, showAccountTerms} from './account-terms.js';
import {showFeedback} from './merchant-ui.js';
import { addPasswordVisibility, describeNewPassword } from './password-visibility.js';
import { analyticsAllowed, setAnalyticsAllowed } from './analytics.js';
import { privacyPolicyVersion, registrationCredentials, registrationError, registrationEvidence } from './account-registration.js';
import {setButtonBusy,showSpinner,showSkeleton} from "./loading.js";
import {platform} from './platform.js';
import {canShowAdminEntry} from './account-access.js';
import {initials} from './merchant-domain.js';
import {profileValues,passwordError,readTheme} from './settings-domain.js';
import {savedPrefix, readSavedEntries, toggleGuestEntry, removeFromDevice, claimGuestEntries, sendClaimedEntries} from './guardados-locais.js';
import {applyTheme} from './theme.js';
import {preparePhoto, previewPhoto} from './prepare-photo.js';
const paths={gear:'M10 2h4l.5 3 2 .9 2.7-1.4 2 3.5-2.3 2v2.3l2.3 2-2 3.5-2.7-1.4-2 .9-.5 3h-4l-.5-3-2-.9-2.7 1.4-2-3.5 2.3-2V10L2.8 8l2-3.5 2.7 1.4 2-.9Z M12 8.5a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z',user:'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',bookmark:'M5 3h14v18l-7-5-7 5Z',shield:'M12 3 20 6.5v5.2c0 4-3.3 7-8 9.3-4.7-2.3-8-5.3-8-9.3V6.5L12 3Z M8.5 12l2.3 2.4 4.7-5',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',help:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3v1',info:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M12 10v7m0-11v1',key:'M9 15a6 6 0 1 0-6-6 6 6 0 0 0 6 6 M13 13l8 8m-3-3 3-3',device:'M4 3h16v13H4Z M8 21h8m-4-5v5',chevron:'m9 6 6 6-6 6'};
paths.moon = 'M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z';
paths.check = 'm5 12 4 4L19 6';
const themeOptions = [
 ['auto', 'Automático', 'device'],
 ['light', 'Claro', 'sun'],
 ['dark', 'Escuro', 'moon'],
];
function currentTheme() {
 try { return readTheme(localStorage); } catch { return 'auto'; }
}
function privacyToggle(label, description, enabled, save) {
 const control = node('label', undefined, 'settings-choice settings-switch');
 const copy = node('span', label);
 if (description) copy.append(node('small', description));
 const input = node('input');
 input.type = 'checkbox';
 input.setAttribute('role', 'switch');
 input.checked = enabled;
 input.addEventListener('change', () => save(input));
 control.append(copy, input);
 return control;
}

function icon(name){const n=document.createElementNS('http://www.w3.org/2000/svg','svg');n.setAttribute('viewBox','0 0 24 24');n.setAttribute('fill','none');n.setAttribute('stroke','currentColor');n.setAttribute('aria-hidden','true');n.classList.add('settings-menu-icon');const p=document.createElementNS(n.namespaceURI,'path');p.setAttribute('d',paths[name]||paths.info);n.append(p);return n;}
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function button(copy,cls,action){const b=node('button',copy,cls);b.type='button';if(action)b.addEventListener('click',action);return b;}
export function setupSettings({openSellerSetup,savedProducts,renderProductCard,getAccount,loadAccount,openSubscreen,closeSubscreen,navigate}){
 const $=id=>document.getElementById(id),view=$('viewSettingsSubscreen'),body=$('settingsSubscreenContent');
 let screen='',generation=0,busy=false,dirty=false,accountId=null,returnFocus='',returnScroll=0,recovery=false,currentProduct=null;
 let savedState = new Map();
 let currentProductPreview = null;
 let migration = null;
 let pendingReads = new Set();
 let pendingWrites = new Set();
 let savedFrame = 0;
 let afterSignIn = '';
 const profilesBucket = platform.storage.from('kg-profile-photos');
 const allowedPhotos = ['image/jpeg', 'image/png', 'image/webp'];
 let photoState = null;
 function paintPhoto(target, url, fallback) {
  target.replaceChildren();
  target.textContent = fallback;
  if (!url) return;
  const image = node('img');
  image.alt = '';
  image.addEventListener('error', () => { target.textContent = fallback; }, { once: true });
  target.replaceChildren(image);
  image.src = url;
 }
 async function profilePhoto(id, refresh = false) {
  if (!refresh && photoState?.id === id && photoState.expires > Date.now()) return photoState.pending;
  const pending = profilesBucket.createSignedUrl(id + '/avatar', 3600)
   .then(({ data }) => data?.signedUrl || '', () => '');
  photoState = { id, pending, expires: Date.now() + 50 * 60 * 1000 };
  return pending;
 }
 async function refreshProfilePhoto(user) {
  if (!user) { photoState = null; return; }
  const url = await profilePhoto(user.id);
  if (getAccount().user?.id !== user.id || !url) return;
  const account = getAccount();
  paintPhoto($('profileAvatar'), url, initials(account.profile?.display_name || user.user_metadata?.display_name || user.user_metadata?.full_name || 'Kamby'));
 }
 function createPhotoEditor(user) {
  const panel = node('div', undefined, 'settings-photo-editor');
  const avatar = node('span', undefined, 'profile-avatar');
  avatar.setAttribute('aria-hidden', 'true');
  const fallback = initials(getAccount().profile?.display_name || user.user_metadata?.display_name || user.user_metadata?.full_name || $('profileName').textContent || 'Kamby');
  paintPhoto(avatar, '', fallback);
  const edit = button('', 'settings-photo-edit', () => menu.showModal());
  edit.setAttribute('aria-haspopup', 'dialog');
  edit.append(avatar, node('span', 'Editar foto'));
  const menu = node('dialog', undefined, 'local-data-dialog settings-photo-menu');
  menu.setAttribute('aria-label', 'Foto do perfil');
  const input = node('input');
  input.type = 'file';
  input.accept = allowedPhotos.join(',');
  input.hidden = true;
  function pickPhoto(camera) {
   if (camera) input.setAttribute('capture', 'user');
   else input.removeAttribute('capture');
   menu.close();
   input.click();
  }
  const camera = button('Câmara', 'settings-text-action', () => pickPhoto(true));
  const gallery = button('Galeria', 'settings-text-action', () => pickPhoto(false));
  const remove = button('Remover foto do perfil', 'settings-text-action', () => {
   menu.close();
   confirm('Remover foto?', 'O teu perfil voltará a mostrar as tuas iniciais.', 'Remover', () => changePhoto(null));
  });
  remove.hidden = true;
  const cancel = button('Cancelar', 'settings-text-action', () => menu.close());
  cancel.autofocus = true;
  menu.append(node('h2', 'Foto do perfil'), camera, gallery, remove, cancel);
  panel.append(edit, input, menu);
  function renderPhoto(url) {
   paintPhoto(avatar, url, fallback);
   remove.hidden = !url;
  }
  let changed = false;
  profilePhoto(user.id).then(url => { if (!changed && panel.isConnected) renderPhoto(url); });
  input.addEventListener('change', async () => {
   const file = input.files[0];
   input.value = '';
   if (!file) return;
   if (!allowedPhotos.includes(file.type) || file.size > 2097152) {
    notice('Escolhe uma foto JPG, PNG ou WebP até 2 MB.');
    return;
   }
   if (await previewPhoto(file, 'Foto do perfil') && panel.isConnected) await changePhoto(file);
  });
  async function changePhoto(file) {
   if (edit.disabled || getAccount().user?.id !== user.id) return;
   changed = true;
   edit.disabled = true;
   setButtonBusy(edit, true);
   const path = user.id + '/avatar';
   try {
    const image = file ? await preparePhoto(file, 768) : null;
    if (getAccount().user?.id !== user.id) return;
    if (image?.size > 2097152) throw new Error('Fotografia demasiado grande.');
    const result = image
     ? await profilesBucket.upload(path, image, { upsert: true, contentType: image.type, cacheControl: '0' })
     : await profilesBucket.remove([path]);
    if (result.error) throw result.error;
    if (getAccount().user?.id !== user.id) return;
    const url = file ? await profilePhoto(user.id, true) : '';
    if (!file) photoState = null;
    if (getAccount().user?.id !== user.id) return;
    paintPhoto($('profileAvatar'), url, fallback);
    if (panel.isConnected) {
     renderPhoto(url);
     notice('');
    }
   } catch {
    if (panel.isConnected) notice('Não foi possível actualizar a foto. Tenta novamente.');
   } finally {
    edit.disabled = false;
    setButtonBusy(edit, false);
   }
  }
  return panel;
 }
 const privateScreens=['pessoais','seguranca','palavra-passe','sessoes','notificacoes','encerramento'];
 const titles={preferencias:'Definições',entrar:'Iniciar sessão',registo:'Criar conta',pessoais:'Dados pessoais',actividade:'Guardados',guardados:'Guardados',seguranca:'Segurança e acesso','palavra-passe':'Palavra-passe',sessoes:'Outras sessões',notificacoes:'Notificações',encerramento:'Encerramento da conta',aparencia:'Aparência',ajuda:'Ajuda e suporte',sobre:'Sobre o Kamby',privacidade:'Privacidade',termos:'Termos',recuperacao:'Recuperar acesso'};
 function notice(copy){$('settingsScreenNotice').textContent=copy;$('settingsScreenNotice').hidden=!copy;}
 function row(name,sub,kind,target,disabled=false){const b=button('','profile-menu-item',()=>{returnFocus=target;open(target);});b.dataset.settingsTarget=target;b.append(icon(kind));const c=node('span',undefined,'profile-menu-copy');c.append(node('span',name,'profile-menu-label'));if(sub)c.append(node('span',sub,'profile-menu-sub'));b.append(c,icon('chevron'));b.disabled=disabled;return b;}
 function confirm(title,copy,accept,action){const dialog=$('settingsConfirmDialog');$('settingsConfirmTitle').textContent=title;$('settingsConfirmCopy').textContent=copy;$('settingsConfirmAccept').textContent=accept;$('settingsConfirmAccept').onclick=()=>{dialog.close();action();};dialog.showModal();}
 $('settingsConfirmCancel').addEventListener('click',()=>$('settingsConfirmDialog').close());
 function clearSensitive(){generation++;busy=false;dirty=false;accountId=null;recovery=false;resetSavedState();body.replaceChildren();$('accountPassword').value='';$('accountLoginError').hidden=true;}
 function sync(){const a=getAccount();const id=a.user?.id||null;
  const identityChanged = accountId !== id;
  if(accountId&&accountId!==id){clearSensitive();if(!view.hidden&&privateScreens.includes(screen))close(true);}
  if (accountId !== id) resetSavedState();
  accountId=id;
  if (id && a.phase === 'ready') void mergeGuestSaved(id);
  if (identityChanged && !view.hidden && ['actividade','guardados'].includes(screen)) void openSavedAgain();
  $('settingsGuestIntro').hidden=Boolean(a.user)||a.phase==='loading';$('settingsAccountCard').hidden=!a.user&&a.phase!=='loading';
  $('settingsAccountMenu').hidden=a.phase==='loading';$('btnRetryAccount').hidden=!['error','offline'].includes(a.phase);
  const menu=$('settingsAccountMenu');menu.replaceChildren();
  const activities = node('div', undefined, 'profile-menu-list');
  const unavailable = Boolean(a.user) && (!navigator.onLine || a.phase !== 'ready');
  $('btnProfilePersonal').hidden = !a.user || unavailable;
  activities.append(row('Guardados', null, 'heart', 'guardados', unavailable));

  if (a.user) activities.append(row('Notificações', null, 'bell', 'notificacoes', unavailable));
  menu.append(activities);
  const work = $('profileWorkMenu');
  work.replaceChildren();
  work.hidden = !canShowAdminEntry(a, navigator.onLine);
  if (!work.hidden) {
   const link=node('a',undefined,'profile-menu-item');
   link.href='admin.html';
   link.dataset.accountAdmin='true';
   const copy=node('span',undefined,'profile-menu-copy');
   copy.append(node('span','Gestor do Kamby','profile-menu-label'));
   if(a.access.adminMfaRequired){
    copy.append(node('span','Confirma o acesso em dois passos','profile-menu-sub'));
   }
   link.append(icon('shield'),copy,icon('chevron'));
   work.append(link);
  }
  const publicMenu = $('settingsPublicMenu');
  const appearance = row('Aparência', null, 'sun', 'aparencia');
  const value = node('span', themeOptions.find(([key]) => key === currentTheme())[1], 'profile-menu-value');
  value.id = 'profileThemeValue';
  appearance.insertBefore(value, appearance.lastChild);
  publicMenu.replaceChildren(appearance);
  if (a.user) publicMenu.append(row('Segurança e acesso', null, 'shield', 'seguranca', unavailable));
  publicMenu.append(row('Privacidade', null, 'shield', 'privacidade'));
  publicMenu.append(row('Ajuda e informações', null, 'help', 'ajuda'));
  if (a.user && !view.hidden && ['entrar', 'registo'].includes(screen)) {
   const destination = afterSignIn;
   afterSignIn = '';
   close(true);
   navigate('perfil');
   if (destination) open(destination);
  }
  scheduleSavedRefresh();
  refreshProfilePhoto(a.user);
 }
 function formError(form,copy){let p=form.querySelector('[role="alert"]');if(!p){p=node('p',undefined,'field-error');p.setAttribute('role','alert');form.append(p);}p.textContent=copy;p.hidden=!copy;}
 function field(form,name,label,value='',type='text',required=false){const l=node('label',label,'settings-field'),i=node('input');i.type=type;i.name=name;i.value=value;i.required=required;i.autocomplete='off';l.append(i);form.append(l);return i;}
 function saveDownload(file, filename) {
  const url = URL.createObjectURL(file);
  const link = node('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
 }
 function lead(title,copy){if(title)body.append(node('h2',title,'settings-lead'));if(copy)body.append(node('p',copy,'settings-copy'));}
 function empty(title,copy){const box=node('div',undefined,'search-zero-box');box.append(node('h2',title,'settings-lead'),node('p',copy));body.append(box);}
 async function ownedWrite(table,id,values){const update=()=>platform.from(table).update(values).eq(table==='kg_profiles'?'id':'user_id',id).select().maybeSingle();let r=await update();if(r.error)throw r.error;if(r.data)return r.data;r=await platform.from(table).insert({[table==='kg_profiles'?'id':'user_id']:id,...values}).select().single();if(r.error?.code==='23505')r=await update();if(r.error)throw r.error;return r.data;}
 function saveForm(form,copy,action){const submit=button(copy,'merchant-primary-button');submit.type='submit';form.append(submit);form.addEventListener('submit',async event=>{event.preventDefault();if(busy)return;busy=true;submit.disabled=true;setButtonBusy(submit,true);const request=generation;formError(form,'');try{await action();if(request!==generation)return;}catch(error){if(request===generation)formError(form,error.safeMessage||'Não foi possível guardar. Verifica a ligação e tenta novamente.');}finally{if(request===generation){busy=false;setButtonBusy(submit,false);submit.disabled=false;}}});return submit;}
 async function renderScreen(){const request=++generation;body.replaceChildren();notice('');$('settingsLoginPanel').hidden=screen!=='entrar';$('settingsSubscreenTitle').textContent=titles[screen];document.title=titles[screen]+' · Kamby';const a=getAccount();
  const accountScreen=['entrar','registo','recuperacao'].includes(screen)||recovery&&screen==='palavra-passe';
  view.classList.toggle('account-screen',accountScreen);
  $('accountScreenBrand').hidden=!accountScreen;
  $('settingsDeviceActions').hidden = screen !== 'privacidade';
  if (screen === 'preferencias') {
   const group = node('div', undefined, 'profile-menu-list');
   group.append(row('Aparência', null, 'sun', 'aparencia'), row('Privacidade', null, 'shield', 'privacidade'));
   body.append(group);
   return;
  }
  if (screen === 'privacidade') {
   let saveSearches = false;
   try { saveSearches = localStorage.getItem('kamby:search-history') === 'on'; } catch {}
   const search = privacyToggle('Guardar pesquisas recentes', null, saveSearches, input => {
    try {
     if (!input.checked) localStorage.removeItem('kamby:recent-searches');
     localStorage.setItem('kamby:search-history', input.checked ? 'on' : 'off');
     window.dispatchEvent(new Event('kamby:search-history'));
    } catch {
     input.checked = !input.checked;
     notice('Não foi possível guardar a preferência.');
    }
   });
   lead('Dados da conta', 'O Kamby usa o teu nome, contacto e dados de conta para autenticar a sessão, guardar preferências e disponibilizar as funcionalidades do teu perfil. Podes actualizar os dados em Perfil e solicitar o encerramento em Segurança e acesso.');
   lead('Dados neste dispositivo', 'O dispositivo guarda a sessão, o carrinho, os guardados de visitante e as preferências. Podes limpar os dados locais nesta página.');
   const measurement = privacyToggle('Medição opcional', 'Controla a medição pelo Kamby e pelo Google Analytics. Se iniciares sessão, os contactos com lojas podem aparecer na tua actividade. Os cookies de medição têm duração configurada de até 30 dias.', analyticsAllowed(), input => {
    try { setAnalyticsAllowed(input.checked); }
    catch {
     input.checked = analyticsAllowed();
     notice('Não foi possível guardar a preferência.');
    }
   });
   const group = node('div', undefined, 'settings-group');
   group.append(search, measurement);
   body.append(group);
   if (!a.user) return;
   const controls = node('div', undefined, 'settings-group privacy-actions');
   const download = button('Descarregar os meus dados', 'settings-text-action', async () => {
    if (download.disabled || getAccount().user?.id !== a.user.id) return;
    download.disabled = true;
    setButtonBusy(download, true);
    try {
     const {data, error} = await platform.rpc('kg_download_account_data', {p_user_id: a.user.id});
     if (error || data?.account?.id !== a.user.id) throw error || new Error();
     if (request !== generation || getAccount().user?.id !== a.user.id) return;
     saveDownload(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}), 'kamby-dados.json');
    } catch {
     if (request === generation) notice('Não foi possível descarregar. Verifica a ligação e tenta novamente.');
    } finally {
     setButtonBusy(download, false);
     download.disabled = false;
    }
   });
   controls.append(download, row('Pedir eliminação dos meus dados', null, 'user', 'encerramento'));
   body.append(controls);
   const avatar = await profilePhoto(a.user.id);
   if (request !== generation || getAccount().user?.id !== a.user.id) return;
   if (avatar) {
    const exportPhoto = button('Descarregar foto do perfil', 'settings-text-action', async () => {
     if (exportPhoto.disabled || getAccount().user?.id !== a.user.id) return;
     exportPhoto.disabled = true;
     try {
      const {data, error} = await profilesBucket.download(a.user.id + '/avatar');
      if (error || !data) throw error || new Error();
      if (request !== generation || getAccount().user?.id !== a.user.id) return;
      const extension = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'}[data.type];
      saveDownload(data, extension ? 'kamby-foto.' + extension : 'kamby-foto');
     } catch {
      if (request === generation) notice('Não foi possível descarregar a fotografia.');
     } finally {
      exportPhoto.disabled = false;
     }
    });
    controls.insertBefore(exportPhoto, controls.lastChild);
   }
   const {data: subscribed, error} = await platform.rpc('kg_email_marketing_choice', {p_user_id: a.user.id});
   if (request !== generation || getAccount().user?.id !== a.user.id) return;
   if (error) {
    controls.append(node('p', 'A preferência de marketing está indisponível.', 'settings-copy'));
    return;
   }
   group.append(privacyToggle('Marketing por e-mail', 'Novidades e ofertas do Kamby.', subscribed, async input => {
    const allowed = input.checked;
    input.disabled = true;
    try {
     const result = await platform.rpc('kg_email_marketing_choice', {p_user_id: a.user.id, p_allowed: allowed});
     if (result.error || result.data !== allowed) throw result.error || new Error();
    } catch {
     input.checked = !allowed;
     if (request === generation) notice('Não foi possível guardar a preferência de marketing.');
    } finally {
     input.disabled = false;
    }
   }));
   return;
  }
  if (screen === 'termos') {
   const pending=node('div');
   body.append(pending);
   showSpinner(pending, 'A carregar os termos');
   const terms=await loadAccountTerms(platform);
   if(request!==generation)return;
   pending.remove();
   showAccountTerms(body,terms);
   return;
  }
  if(privateScreens.includes(screen)&&!a.user){open('entrar',false);return;}
  if(screen==='entrar')return;
  if (screen === 'registo') {
   const form = node('form', undefined, 'settings-form');
   const ageLabel = node('label', 'Tens 18 anos ou mais?', 'settings-field');
   const age = node('select');
   age.required = true;
   for (const [value, label] of [['', 'Selecciona'], ['yes', 'Sim'], ['no', 'Não']]) {
    const option = node('option', label);
    option.value = value;
    age.append(option);
   }
   ageLabel.append(age);
   const fields = node('fieldset', undefined, 'registration-fields');
   fields.disabled = fields.hidden = true;
   form.append(ageLabel, fields);
   const name = field(fields, 'name', 'Nome completo', '', 'text', true);
   const email = field(fields, 'email', 'E-mail', '', 'email', true);
   const password = field(fields, 'password', 'Palavra-passe', '', 'password', true);
   const confirmation = field(fields, 'confirmation', 'Confirmar palavra-passe', '', 'password', true);
   name.autocomplete = 'name';
   name.maxLength = 80;
   email.autocomplete = 'email';
   email.maxLength = 254;
   for (const input of [password, confirmation]) {
    input.autocomplete = 'new-password';
    input.minLength = 8;
    input.maxLength = 128;
   }
   addPasswordVisibility(password);
   addPasswordVisibility(confirmation);
   describeNewPassword(password);
   const acceptance = node('input');
   acceptance.type = 'checkbox';
   acceptance.required = true;
   const agreement = node('label', undefined, 'registration-choice');
   const termsLink = node('a', 'Termos de utilização');
   termsLink.href = './legal.html#termos';
   const privacyLink = node('a', 'Política de privacidade');
   privacyLink.href = './legal.html#privacidade';
   for (const link of [termsLink, privacyLink]) {
    link.target = '_blank';
    link.rel = 'noopener';
   }
   const versionCopy = node('small');
   const agreementCopy = node('span');
   agreementCopy.append('Li e aceito os ', termsLink, ' e a ', privacyLink, '.', versionCopy);
   agreement.append(acceptance, agreementCopy);
   const marketing = node('input');
   marketing.type = 'checkbox';
   const marketingChoice = node('label', undefined, 'registration-choice');
   marketingChoice.append(marketing, node('span', 'Quero receber novidades e ofertas do Kamby por e-mail.'));
   fields.append(agreement, marketingChoice);
   let documents;
   let documentRequest;
   age.addEventListener('change', async () => {
    acceptance.checked = marketing.checked = false;
    formError(form, '');
    fields.disabled = fields.hidden = true;
    if (age.value !== 'yes') {
     for (const input of [name, email, password, confirmation]) input.value = '';
     if (age.value === 'no') {
      // A resposta sobre a idade não precisa de ser armazenada nem enviada.
      try { setAnalyticsAllowed(false); } catch { /* A medição fica bloqueada nesta página. */ }
      formError(form, 'O cadastro só está disponível para pessoas com 18 anos ou mais. Podes consultar o catálogo como visitante.');
     }
     return;
    }
    try {
     documentRequest ||= platform.rpc('kg_registration_documents');
     const {data, error} = await documentRequest;
     if (request !== generation || age.value !== 'yes') return;
     if (error || data?.privacy_version !== privacyPolicyVersion || !data.terms_version) throw error || new Error();
     documents = data;
     termsLink.href = './legal.html?versao=' + encodeURIComponent(data.terms_version) + '#termos';
     versionCopy.textContent = 'Termos ' + data.terms_version + ' · Privacidade ' + data.privacy_version;
     fields.disabled = fields.hidden = false;
    } catch {
     documentRequest = null;
     if (request === generation && age.value === 'yes') formError(form, 'Os documentos estão indisponíveis. Reabre o cadastro e tenta novamente.');
    }
   });
   const instructions = node('div');
   instructions.tabIndex = -1;
   instructions.hidden = true;
   instructions.append(
    node('h2', 'Confirma o teu e-mail', 'settings-lead'),
    node('p', 'Abre o teu e-mail e toca no link de confirmação. Usa o mesmo dispositivo e navegador em que criaste a conta.', 'settings-copy'),
    node('p', 'Se a mensagem não aparecer, verifica o spam.', 'settings-copy')
   );
   const resend = node('form', undefined, 'settings-form');
   const resendEmail = field(resend, 'email', 'E-mail', '', 'email', true);
   resendEmail.readOnly = true;
   saveForm(resend, 'Reenviar link', async () => {
    if (!navigator.onLine) throw { safeMessage: 'Sem ligação à internet. Liga-te e tenta novamente.' };
    const { error } = await platform.auth.resend({
     type: 'signup',
     email: resendEmail.value,
     options: { emailRedirectTo: new URL('/', window.location.origin).href }
    });
    if (error) throw { safeMessage: registrationError(error) };
    if (request === generation) notice('Pedido de reenvio concluído. Verifica o teu e-mail.');
   });
   instructions.append(resend, button('Voltar para entrar', 'settings-text-action', async () => {
    $('accountIdentity').value = resendEmail.value;
    if (await open('entrar', false)) history.replaceState(null, '', '#definicoes/entrar');
   }));
   body.append(form, instructions);
   const submit = saveForm(form, 'Criar conta', async () => {
    if (!navigator.onLine) throw { safeMessage: 'Sem ligação à internet. Liga-te e tenta novamente.' };
    let credentials;
    try {
     credentials = registrationCredentials({
      name: name.value, email: email.value, password: password.value, confirmation: confirmation.value
     }, window.location.origin);
     Object.assign(credentials.options.data, registrationEvidence({
      adult: age.value, accepted: acceptance.checked, marketing: marketing.checked
     }, documents));
    } catch (error) {
     throw { safeMessage: error.message };
    }
    const { data, error } = await platform.auth.signUp(credentials);
    if (error) throw { safeMessage: registrationError(error) };
    password.value = confirmation.value = '';
    if (request !== generation || data.session) return;
    resendEmail.value = credentials.email;
    form.hidden = true;
    instructions.hidden = false;
    instructions.focus();
   });
   fields.append(submit);
   return;
  }
  if (screen === 'aparencia') {
   const group = node('fieldset', undefined, 'settings-group appearance-options');
   group.setAttribute('aria-label', 'Tema');
   let selected = currentTheme();
   for (const [value, label, symbol] of themeOptions) {
    const option = node('label', undefined, 'settings-choice appearance-option');
    const copy = node('span', label);
    if (value === 'auto') copy.append(node('small', 'Segue o tema do dispositivo'));
    const input = node('input');
    input.type = 'radio';
    input.name = 'appearance';
    input.value = value;
    input.checked = value === selected;
    input.addEventListener('change', () => {
     try {
      applyTheme(value);
      selected = value;
      const profileValue = $('profileThemeValue');
      if (profileValue) profileValue.textContent = label;
      notice('');
     } catch {
      group.querySelector('input[value="' + selected + '"]').checked = true;
      notice('Não foi possível guardar a preferência.');
     }
    });
    const check = icon('check');
    check.classList.add('appearance-check');
    option.append(icon(symbol), copy, input, check);
    group.append(option);
   }
   body.append(group);
   return;
  }
  if(screen==='pessoais'){
   body.append(createPhotoEditor(a.user));
   const form=node('form',undefined,'settings-form');
   const name=field(form,'name','Nome completo',a.profile?.display_name||a.user.user_metadata?.display_name||a.user.user_metadata?.full_name||'','text',true);
   name.maxLength=80;
   name.autocomplete='name';
   const contacts=node('dl',undefined,'settings-account-contact');
   const email=/@kamby\.invalid$/i.test(a.user.email||'')?'':a.user.email;
   const phone=a.user.phone?'+'+a.user.phone.replace(/^\+/, ''):'';
   for(const [label,value] of [['Telefone',phone],['Email',email]]){
    const row=node('div');
    row.append(node('dt',label),node('dd',value||'Não associado'));
    contacts.append(row);
   }
   form.append(contacts);
   body.append(form);
   let originalName=name.value;
   const submit=saveForm(form,'Guardar alterações',async()=>{
    let values;
    try{const {display_name}=profileValues(name.value,'');values={display_name};}catch(error){throw{safeMessage:error.message};}
    const id=a.user.id;
    await ownedWrite('kg_profiles',id,values);
    if(id!==getAccount().user?.id)return;
    originalName=name.value;
    dirty=false;
    submit.hidden=true;
    await loadAccount();
    showFeedback('Dados guardados.');
   });
   submit.hidden=true;
   form.addEventListener('input',()=>{
    dirty=name.value!==originalName;
    submit.hidden=!dirty;
   });
   return;
  }
  if(screen==='seguranca'){const g=node('div',undefined,'settings-group');g.append(row('Alterar palavra-passe',null,'key','palavra-passe'),row('Outras sessões',null,'device','sessoes'),row('Recuperar acesso',null,'help','recuperacao'),row('Encerramento da conta','Pedir análise à equipa Kamby','user','encerramento'));body.append(g);return;}
  if(screen==='palavra-passe'){lead(null,recovery?'Define uma nova palavra-passe para concluir a recuperação.':'Confirma o acesso à conta antes de alterar a palavra-passe.');const form=node('form',undefined,'settings-form');let current=null;if(!recovery){current=field(form,'current','Palavra-passe actual','','password',true);current.autocomplete='current-password';}const next=field(form,'new','Nova palavra-passe','','password',true),repeat=field(form,'confirmation','Confirmar nova palavra-passe','','password',true);next.autocomplete=repeat.autocomplete='new-password';next.maxLength=repeat.maxLength=128;next.minLength=repeat.minLength=8;addPasswordVisibility(next);addPasswordVisibility(repeat);describeNewPassword(next);body.append(form);saveForm(form,'Actualizar palavra-passe',async()=>{const err=passwordError(next.value,repeat.value);if(err)throw{safeMessage:err};try{if(current){const identity=a.user.email?{email:a.user.email}:{phone:a.user.phone};const {error}=await platform.auth.signInWithPassword({...identity,password:current.value});if(error)throw{safeMessage:'Não foi possível confirmar a palavra-passe actual.'};}const {error}=await platform.auth.updateUser({password:next.value});if(error)throw{safeMessage:error.code==='same_password'?'Escolhe uma palavra-passe diferente.':error.code==='reauthentication_needed'?'É necessária uma nova confirmação de acesso. Volta a entrar e tenta novamente.':'Não foi possível actualizar a palavra-passe. Volta a entrar ou recupera o acesso.'};recovery=false;showFeedback('Palavra-passe actualizada.');}finally{[current,next,repeat].filter(Boolean).forEach(i=>i.value='');}});return;}
  if(screen==='sessoes'){const g=node('div',undefined,'settings-group');g.append(row('Terminar outras sessões','Mantém a sessão deste dispositivo','device','sessoes'));g.replaceChild(g.firstChild.cloneNode(true),g.firstChild);g.firstChild.onclick=()=>confirm('Terminar outras sessões?','Os outros dispositivos terão de voltar a entrar. O acesso já emitido pode manter-se até expirar.','Terminar',async()=>{if(busy)return;busy=true;const action=g.firstChild;action.disabled=true;setButtonBusy(action,true);try{const {error}=await platform.auth.signOut({scope:'others'});notice(error?'Não foi possível terminar as outras sessões.':'As outras sessões já não podem ser renovadas.');}finally{setButtonBusy(action,false);action.disabled=false;busy=false;}});body.append(g);return;}
  if(screen==='recuperacao'){lead(null,'Indica o email associado à conta para pedir uma ligação de recuperação.');const form=node('form',undefined,'settings-form'),email=field(form,'email','Email da conta',a.user?.email||'','email',true);email.autocomplete='email';body.append(form);saveForm(form,'Pedir ligação',async()=>{const {error}=await platform.auth.resetPasswordForEmail(email.value.trim(),{redirectTo:new URL('/?account=recovery',window.location.origin).href});if(error)throw{safeMessage:'Não foi possível pedir a ligação. Tenta novamente mais tarde.'};notice('Se existir uma conta com este email, receberás uma ligação de recuperação. Verifica também o spam.');});body.append(node('p','Para contas apenas com telefone, a recuperação precisa de assistência da equipa Kamby.','settings-copy'));return;}
  if (screen === 'actividade' || screen === 'guardados') {
   const pending = node('div');
   body.append(pending);
   showSkeleton(pending, 'rows', 3);
   const owner = a.user?.id || '';
   if (owner) await mergeGuestSaved(owner);
   const local = deviceEntries(owner).map(entry => entry.product);
   let ids = local.map(product => product.id);
   if (owner) {
    const remote = [];
    for (let start = 0; ; start += 100) {
     const { data, error } = await platform.from('kg_saved_products').select('product_id')
      .eq('user_id', owner).order('created_at', { ascending: false }).order('product_id').range(start, start + 99);
     if (error) throw error;
     remote.push(...data.map(row => row.product_id));
     if (data.length < 100 || request !== generation) break;
    }
    ids = [...new Set([...ids, ...remote])];
   }
   const products = [];
   let cached = false;
   try {
    for (let start = 0; start < ids.length; start += 50) {
     products.push(...await savedProducts(ids.slice(start, start + 50)));
    }
   } catch (error) {
    if (owner) throw error;
    products.splice(0, products.length, ...local);
    cached = true;
   }
   if (request !== generation || owner !== (getAccount().user?.id || '')) return;
   if (cached) notice('A mostrar os últimos dados guardados neste dispositivo.');
   pending.remove();
   const byId = new Map(products.map(product => [product.id, product]));
   const grid = node('div', undefined, 'products-grid saved-products-grid');
   ids.forEach((id, index) => {
    const product = byId.get(id);
    if (!product) return;
    savedState.set(id, true);
    grid.append(renderProductCard(product, index));
   });
   if (!grid.childElementCount) {
    empty('Ainda não tens produtos guardados disponíveis', 'Toca no coração de um produto para o guardar.');
    return;
   }
   body.append(grid);
   scheduleSavedRefresh();
   return;
  }
  if(screen==='notificacoes'){lead('Preferências de avisos','Os avisos são apresentados aqui, dentro do Kamby.');const pending=node('div');body.append(pending);showSkeleton(pending,'rows',3);const [pref,notes]=await Promise.all([platform.from('kg_user_preferences').select('catalogue_alerts,account_alerts').eq('user_id',a.user.id).maybeSingle(),platform.from('kg_notifications').select('id,title,body,read_at,created_at,action').eq('user_id',a.user.id).order('created_at',{ascending:false}).limit(50)]);if(request!==generation)return;pending.remove();if(pref.error||notes.error){empty('Não foi possível carregar','Verifica a ligação e tenta novamente.');body.append(button('Tentar novamente','settings-text-action',renderScreen));return;}let values=pref.data||{catalogue_alerts:true,account_alerts:true};const g=node('div',undefined,'settings-group');for(const [key,label,sub]of[['catalogue_alerts','Produtos guardados','Alterações de preço e disponibilidade'],['account_alerts','Pedidos da conta','Actualizações do pedido de encerramento']]){const l=node('label',undefined,'settings-choice'),copy=node('span',label),input=node('input');copy.append(node('small',sub));input.type='checkbox';input.checked=values[key];input.addEventListener('change',async()=>{const value=input.checked;input.disabled=true;const pending=node('span');l.append(pending);showSpinner(pending);try{await ownedWrite('kg_user_preferences',a.user.id,{...values,[key]:value});if(request!==generation)return;values[key]=value;showFeedback('Preferência guardada.');}catch{if(request!==generation)return;input.checked=!value;notice('Não foi possível guardar a preferência.');}finally{pending.remove();input.disabled=false;}});l.append(copy,input);g.append(l);}body.append(g);if(!notes.data.length)empty('Sem avisos','Os novos avisos aparecem aqui.');for(const n of notes.data){const article=node('article',undefined,'settings-item'+(!n.read_at?' settings-notification-unread':'')),meta=node('div');meta.append(node('strong',n.title),node('p',n.body));article.append(meta);if(n.action==='seller_setup'&&openSellerSetup&&a.access?.sellerOnboarding){article.append(button('Configurar loja','settings-text-action',()=>{close(true);navigate('perfil');openSellerSetup();}));}if(!n.read_at){const read=button('Lido','settings-text-action',async()=>{read.disabled=true;setButtonBusy(read,true);const {error}=await platform.from('kg_notifications').update({read_at:new Date().toISOString()}).eq('id',n.id).eq('user_id',a.user.id);if(request!==generation)return;if(error){setButtonBusy(read,false);read.disabled=false;notice('Não foi possível marcar como lido.');}else{article.classList.remove('settings-notification-unread');read.remove();}});article.append(read);}body.append(article);}return;}
  if(screen==='encerramento'){const pending=node('div');body.append(pending);showSkeleton(pending,'rows',2);const {data,error}=await platform.from('kg_account_requests').select('status,created_at').eq('user_id',a.user.id).maybeSingle();if(request!==generation)return;pending.remove();if(error){empty('Não foi possível carregar','Tenta novamente mais tarde.');return;}if(data){const statuses={pending:'Pedido em análise',processing:'Pedido em tratamento',completed:'Pedido concluído pela gestão',declined:'Pedido revisto pela gestão'};empty(statuses[data.status]||'Pedido registado','O pedido não elimina a conta automaticamente.');return;}lead('Encerramento da conta','Pede gratuitamente a eliminação dos teus dados à equipa Kamby. A conta mantém-se activa enquanto o pedido é analisado.');body.append(button('Pedir eliminação','settings-text-action profile-sign-out',()=>confirm('Registar pedido de encerramento?','O pedido será enviado à gestão da plataforma. Esta acção não apaga os teus dados imediatamente.','Registar pedido',async()=>{if(busy)return;busy=true;const action=body.querySelector('button');action.disabled=true;setButtonBusy(action,true);try{const {error}=await platform.from('kg_account_requests').insert({user_id:a.user.id});if(error&&error.code!=='23505')notice('Não foi possível registar o pedido.');else renderScreen();}finally{setButtonBusy(action,false);action.disabled=false;busy=false;}})));return;}
  if(screen==='ajuda'){for(const [q,copy]of[['Como contactar uma loja?','Na página da loja, toca em Perguntar à loja. Para enviar um pedido com os teus artigos, abre o carrinho dessa loja e toca em Enviar pedido pelo WhatsApp.'],['O contacto confirma a compra?','Não. Confirma o preço, a disponibilidade, o pagamento e a entrega com a loja.'],['Como recuperar o acesso?','Usa Esqueci a palavra-passe na entrada da conta. A recuperação por email depende de um email associado.'],['Onde ficam os meus produtos?','Os produtos adicionados ficam no Carrinho deste dispositivo. Encontra os favoritos em Perfil → Guardados. Sem conta, ficam neste dispositivo.']]){const d=node('details',undefined,'settings-group'),s=node('summary',q);s.style.padding='16px';const p=node('p',copy,'settings-copy');p.style.padding='0 16px';d.append(s,p);body.append(d);}const links=node('div',undefined,'profile-menu-list');links.append(row('Sobre o Kamby',null,'info','sobre'));
for (const [label, href] of [['Termos de utilização','./legal.html#termos'],['Política de privacidade','./legal.html#privacidade'],['Contacto e denúncias','mailto:kambyoficial@gmail.com']]) {
 const link=node('a',undefined,'profile-menu-item');link.href=href;
 link.append(node('span',label,'profile-menu-label'),icon('chevron'));links.append(link);
}body.append(links);return;}
  if(screen==='sobre'){lead('Kamby · Orbion');body.append(node('p','Descobre produtos e lojas e contacta cada vendedor pelo WhatsApp.','settings-copy'));}
 }
 async function open(target,updateHistory=true){if(!titles[target])return false;if(!view.hidden&&screen===target&&!dirty)return true;if(busy)return false;if(dirty){confirm('Descartar alterações?','Há dados que ainda não foram guardados.','Descartar',()=>{dirty=false;open(target,updateHistory);});return false;}
  afterSignIn = '';
  if(privateScreens.includes(target)&&!getAccount().user){await loadAccount();if(!getAccount().user){afterSignIn=target;target='entrar';}}
  if(view.hidden){returnScroll=window.scrollY;openSubscreen();}
  screen=target;view.hidden=false;view.classList.add('active');view.scrollTop=0;document.getElementById('viewProfile').inert=true;
  if(updateHistory)history.pushState({kambySettings:true},'','#definicoes/'+target);
  try {
   const rendering = renderScreen();
   $('settingsSubscreenTitle').focus({preventScroll:true});
   await rendering;
  }catch{if(screen===target){body.replaceChildren();empty('Não foi possível carregar','Verifica a ligação e tenta novamente.');body.append(button('Tentar novamente','settings-text-action',()=>renderScreen()));}}
  return true;
 }
 function close(force=false){if(view.hidden)return true;if(!force&&(busy||dirty)){if(dirty)confirm('Descartar alterações?','Há dados que ainda não foram guardados.','Descartar',()=>{dirty=false;close(true);history.replaceState(null,'','#perfil');});return false;}generation++;busy=false;dirty=false;body.replaceChildren();$('accountPassword').value='';view.hidden=true;view.classList.remove('active');closeSubscreen();window.scrollTo({top:returnScroll,behavior:'auto'});const trigger = returnFocus === 'entrar' ? $('btnOpenAccountSignIn') : document.querySelector('[data-settings-target="'+returnFocus+'"]');
  (trigger?.getClientRects().length ? trigger : $('viewProfile').querySelector('.page-title'))?.focus({preventScroll:true});document.title='Perfil · Kamby';return true;}
 $('btnProfilePersonal').addEventListener('click', () => { returnFocus = 'pessoais'; open('pessoais'); });
 $('btnBackSettings').addEventListener('click', async () => {
  const parent = screen === 'registo' ? 'entrar' : ['palavra-passe', 'sessoes', 'encerramento'].includes(screen) ? 'seguranca'
   : screen === 'sobre' ? 'ajuda' : '';
  if (parent) {
   if (await open(parent, false)) history.replaceState(null, '', '#definicoes/' + parent);
   return;
  }
  if (close()) history.replaceState(null, '', '#perfil');
 });
 $('btnOpenRegistration').addEventListener('click', () => open('registo'));
 $('btnOpenAccountSignIn').addEventListener('click',()=>{returnFocus='entrar';open('entrar');});$('btnForgotPassword').addEventListener('click',()=>open('recuperacao'));$('btnRetryAccount').addEventListener('click',async()=>{const b=$('btnRetryAccount');if(b.disabled)return;b.disabled=true;setButtonBusy(b,true);try{await loadAccount();}finally{setButtonBusy(b,false);b.disabled=false;}});
 window.addEventListener('online',()=>{loadAccount();if(!view.hidden&&!dirty&&!busy&&screen!=='registo')renderScreen();});window.addEventListener('offline',()=>{sync();if(!view.hidden)notice('Sem ligação. A aparência continua disponível; as alterações da conta precisam de ligação.');});
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 function deviceEntries(owner = '') {
  try { return readSavedEntries(localStorage, owner); } catch { return []; }
 }
 function mergeGuestSaved(owner) {
  if (migration?.owner === owner) return migration.work;
  const state = savedState;
  const active = () => getAccount().user?.id === owner && state === savedState;
  const migrate = async () => {
   if (!active()) return;
   claimGuestEntries(localStorage, owner);
   const sent = await sendClaimedEntries(localStorage, owner, active, product_id =>
    platform.from('kg_saved_products').insert({user_id:owner, product_id}));
   if (active()) {
    sent.forEach(id => state.set(id, true));
    scheduleSavedRefresh();
   }
  };
  const work = Promise.resolve().then(() =>
   navigator.locks ? navigator.locks.request('kamby:guardados:sincronizar', migrate) : migrate()
  ).catch(() => { /* A próxima ligação retoma os artigos desta conta. */ })
   .finally(() => { if (migration?.work === work) migration = null; });
  migration = {owner, work};
  return work;
 }
 function resetSavedState() {
  migration = null;
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
  const owner = getAccount().user?.id;
  const local = new Set(deviceEntries(owner).map(entry => entry.product.id));
  for (const [id, button] of entries) {
   const pressed = local.has(id) || Boolean(owner && savedState.get(id));
   const title = button.dataset.productTitle;
   button.setAttribute('aria-pressed', String(pressed));
   button.setAttribute('aria-label', pressed ? 'Remover dos guardados: ' + (title || 'produto') : 'Guardar ' + (title || 'produto'));
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
  const state = savedState;
  const writes = pendingWrites;
  writes.add(id);
  paintSavedButtons();
  const stillCurrent = () => state === savedState && userId === getAccount().user?.id;
  const feedback = showFeedback;
  try {
   let saved;
   if (!userId) {
    const product = trigger?.kambyPreview || currentProductPreview;
    if (!product || product.id !== id) throw new Error('Produto indisponível.');
    saved = !toggleGuestEntry(localStorage, product);
   } else {
    await mergeGuestSaved(userId);
    if (!stillCurrent()) return;
    const existing = await platform.from('kg_saved_products').select('product_id').eq('user_id', userId).eq('product_id', id).maybeSingle();
    if (!stillCurrent()) return;
    if (existing.error) throw existing.error;
    saved = Boolean(existing.data) || deviceEntries(userId).some(entry => entry.product.id === id);
    const result = saved
     ? await platform.from('kg_saved_products').delete().eq('user_id', userId).eq('product_id', id)
     : await platform.from('kg_saved_products').insert({ user_id: userId, product_id: id });
    if (!stillCurrent()) return;
    if (result.error && (saved || result.error.code !== '23505')) throw result.error;
    if (saved) removeFromDevice(localStorage, userId, id);
   }
   state.set(id, !saved);
   if (saved && (screen === 'guardados' || screen === 'actividade') && !view.hidden) {
    const grid = body.querySelector('.saved-products-grid');
    const card = [...(grid?.children || [])].find(item => item.dataset.id === id);
    card?.remove();
    if (grid && !grid.childElementCount) {
     grid.remove();
     empty('Ainda não tens produtos guardados disponíveis', 'Toca no coração de um produto para o guardar.');
    }
   }
   const icon = trigger?.querySelector('svg');
   if (!saved && icon && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    icon.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.16)' }, { transform: 'scale(1)' }],
      { duration: 220, easing: 'ease-out' });
   }
   feedback(saved ? 'Produto removido dos guardados.' : 'Produto guardado.');
  } catch {
   if (stillCurrent()) feedback('Não foi possível actualizar os guardados. Tenta novamente.',{tone:'error'});
  } finally {
   writes.delete(id);
   if (stillCurrent()) paintSavedButtons();
  }
 }
 window.addEventListener('storage', event => {
  if (event.key && !event.key.startsWith(savedPrefix)) return;
  scheduleSavedRefresh();
  if (!view.hidden && (screen === 'guardados' || screen === 'actividade')) void openSavedAgain();
 });
 async function openSavedAgain() {
  try { await renderScreen(); } catch { notice('Não foi possível actualizar os guardados.'); }
 }
 window.addEventListener('kamby:catalogue-card', scheduleSavedRefresh);
 window.addEventListener('kamby:product-loading', () => { currentProduct = null; currentProductPreview = null; });
 window.addEventListener('kamby:product-ready', event => {
  currentProduct = event.detail.id;
  currentProductPreview = event.detail.preview;
  paintSavedButtons([[currentProduct, $('btnPdpSaveProduct')]]);
  scheduleSavedRefresh();
 });
 document.addEventListener('click', event => {
  const button = event.target.closest('[data-save-product]');
  if (button) toggleSavedProduct(button.dataset.saveProduct, button);
 });
 $('btnPdpSaveProduct').addEventListener('click', event => toggleSavedProduct(currentProduct, event.currentTarget));
 const preview = $('btnPdpSaveProduct').kambyPreview;
 if (preview) {
  currentProduct = preview.id;
  currentProductPreview = preview;
 }
 window.dispatchEvent(new Event('kamby:guardados-prontos'));
 scheduleSavedRefresh();
 return {sync,open,close,isOpen:()=>!view.hidden,recovery:async()=>{recovery=true;await loadAccount();open('palavra-passe');},route:async hash=>{const target=decodeURIComponent(hash.slice('#definicoes/'.length));return open(target,false);},clear:clearSensitive};
}
