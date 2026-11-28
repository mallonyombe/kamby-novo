import { trackAnalytics } from './analytics.js';

const invite = document.querySelector('#kambyInstallInvite');
const accept = document.querySelector('#kambyInstallAccept');
const dismiss = document.querySelector('#kambyInstallDismiss');
const guide = document.querySelector('#installGuide');
const guideClose = document.querySelector('#closeInstallGuide');
const ios = /iPhone|iPad|iPod/.test(navigator.userAgent || '') ||
  (/Macintosh/.test(navigator.userAgent || '') && navigator.maxTouchPoints > 1);
guideClose?.addEventListener('click', () => guide.close());
const standalone = matchMedia('(display-mode: standalone)');
const dismissedKey = 'kamby:install-invite-dismissed';
let installPrompt;
let installed = false;
let dismissed = false;

try {
  dismissed = localStorage.getItem(dismissedKey) === '1';
} catch {}

function reflectInstallation() {
  const hasApp = installed || standalone.matches || navigator.standalone === true;
  invite.hidden = hasApp || (!installPrompt && !ios) || dismissed;
}

function dismissInvite() {
  dismissed = true;
  try { localStorage.setItem(dismissedKey, '1'); } catch {}
  reflectInstallation();
  document.querySelector('#floatingNavbar a')?.focus({ preventScroll: true });
}

async function requestInstallation() {
  if (invite.hidden) return;
  if (!installPrompt && ios) { guide.showModal(); return; }
  const prompt = installPrompt;
  installPrompt = undefined;
  reflectInstallation();
  try {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      installed = true;
    } else {
      dismissInvite();
    }
  } catch {
    installPrompt = prompt;
    window.dispatchEvent(new CustomEvent('kamby:feedback', {detail:{
      copy:'Não foi possível abrir a instalação. Tenta novamente.', tone:'error'
    }}));
  }
  reflectInstallation();
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  reflectInstallation();
});
window.addEventListener('storage', event => {
  if (event.key === dismissedKey && event.newValue === '1') {
    dismissed = true;
    reflectInstallation();
  }
});
standalone.addEventListener('change', reflectInstallation);
accept.addEventListener('click', requestInstallation);
dismiss.addEventListener('click', dismissInvite);
window.addEventListener('appinstalled', () => {
  installed = true;
  installPrompt = undefined;
  reflectInstallation();
  trackAnalytics('pwa_install');
});
reflectInstallation();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(error => {
    console.warn('Kamby: não foi possível preparar o acesso offline.', error);
  });
}
