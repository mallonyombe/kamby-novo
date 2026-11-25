import { trackAnalytics } from './analytics.js';

const panel = document.querySelector('#kambyInstall');
const button = panel.querySelector('button');
const status = panel.querySelector('[role="status"]');
const invite = document.querySelector('#kambyInstallInvite');
const accept = document.querySelector('#kambyInstallAccept');
const dismiss = document.querySelector('#kambyInstallDismiss');
const standalone = matchMedia('(display-mode: standalone)');
const dismissedKey = 'kamby:install-invite-after';
const revisitAfter = 7 * 24 * 60 * 60 * 1000;
let installPrompt;
let installed = false;
let readyToInvite = false;
let dismissed = false;
let installing = false;

function reflectInstallation() {
  const hasApp = installed || standalone.matches || navigator.standalone === true;
  panel.hidden = hasApp;
  invite.hidden = hasApp || !readyToInvite || !installPrompt || dismissed || installing;
}

function postponeInvite() {
  dismissed = true;
  try { localStorage.setItem(dismissedKey, String(Date.now() + revisitAfter)); } catch {}
  reflectInstallation();
}

function showInstructions() {
  const appleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  status.textContent = appleMobile
    ? 'Abre no Safari. Toca em Partilhar e escolhe Adicionar ao ecrã principal.'
    : 'Abre o Kamby no Chrome e, no menu ⋮, procura Instalar app ou Adicionar ao ecrã principal.';
  status.hidden = false;
}

async function requestInstallation(fromInvite) {
  if (installing) return;
  if (!installPrompt) {
    showInstructions();
    return;
  }

  const prompt = installPrompt;
  installPrompt = undefined;
  installing = true;
  button.disabled = true;
  status.hidden = true;
  reflectInstallation();
  try {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      installed = true;
    } else {
      postponeInvite();
    }
  } catch {
    postponeInvite();
    if (!fromInvite) showInstructions();
  } finally {
    installing = false;
    button.disabled = false;
    reflectInstallation();
  }
  if (fromInvite && !installed) document.querySelector('#floatingNavbar a')?.focus({ preventScroll: true });
}

try { dismissed = Number(localStorage.getItem(dismissedKey)) > Date.now(); } catch {}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  reflectInstallation();
});
window.setTimeout(() => {
  readyToInvite = true;
  reflectInstallation();
}, 8000);
standalone.addEventListener('change', reflectInstallation);
button.addEventListener('click', () => requestInstallation(false));
accept.addEventListener('click', () => requestInstallation(true));
dismiss.addEventListener('click', () => {
  postponeInvite();
  document.querySelector('#floatingNavbar a')?.focus({ preventScroll: true });
});

window.addEventListener('appinstalled', () => {
  trackAnalytics('pwa_install');
  installed = true;
  installPrompt = undefined;
  reflectInstallation();
});
reflectInstallation();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(error => {
    console.warn('Kamby: não foi possível preparar o acesso offline.', error);
  });
}
