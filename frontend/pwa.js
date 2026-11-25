import { trackAnalytics } from './analytics.js';

const panel = document.querySelector('#kambyInstall');
const button = panel.querySelector('button');
const status = panel.querySelector('[role="status"]');
const standalone = matchMedia('(display-mode: standalone)');
let installPrompt;

function reflectInstallation() {
  panel.hidden = standalone.matches || navigator.standalone === true;
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  reflectInstallation();
});

button.addEventListener('click', async () => {
  status.hidden = false;
  if (!installPrompt) {
    status.textContent = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      ? 'No Safari, toca em Partilhar e escolhe Adicionar ao ecrã principal.'
      : 'Abre o Kamby num navegador. No menu, procura Instalar app ou Adicionar ao ecrã principal.';
    return;
  }
  const prompt = installPrompt;
  installPrompt = undefined;
  status.hidden = true;
  button.disabled = true;
  try {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') panel.hidden = true;
  } catch {
    status.textContent = 'Abre o menu do navegador e procura a opção de instalação.';
    status.hidden = false;
  } finally {
    button.disabled = false;
  }
});

window.addEventListener('appinstalled', () => {
  trackAnalytics('pwa_install');
  installPrompt = undefined;
  panel.hidden = true;
});
standalone.addEventListener('change', reflectInstallation);
reflectInstallation();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(error => {
    console.warn('Kamby: não foi possível preparar o acesso offline.', error);
  });
}
