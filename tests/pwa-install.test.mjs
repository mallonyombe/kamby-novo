import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source = readFileSync(new URL('../frontend/pwa.js', import.meta.url), 'utf8')
  .replace("import { trackAnalytics } from './analytics.js';", '');
const dismissedKey = 'kamby:install-invite-dismissed';

function loadInvite({storage = new Map(), installed = false} = {}) {
  const listeners = new Map();
  const buttons = new Map();
  const invite = {hidden: true};
  const nodes = new Map([['#kambyInstallInvite', invite]]);
  for (const id of ['#kambyInstallAccept', '#kambyInstallDismiss']) {
    nodes.set(id, {addEventListener: (_, handler) => buttons.set(id, handler)});
  }
  const analytics = [];
  runInNewContext(source, {
    document: {querySelector: selector => nodes.get(selector)},
    navigator: {},
    localStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)},
    matchMedia: () => ({matches: installed, addEventListener() {}}),
    window: {addEventListener: (event, handler) => listeners.set(event, handler)},
    trackAnalytics: event => analytics.push(event),
  });
  let promptCalls = 0;
  return {
    invite, analytics, storage,
    browserReady(outcome = 'accepted') {
      listeners.get('beforeinstallprompt')({
        preventDefault() {},
        async prompt() { promptCalls++; },
        userChoice: Promise.resolve({outcome}),
      });
    },
    dismiss: () => buttons.get('#kambyInstallDismiss')(),
    accept: () => buttons.get('#kambyInstallAccept')(),
    installed: () => listeners.get('appinstalled')(),
    get promptCalls() { return promptCalls; },
  };
}

test('PWA shows the invite on the first visit when the browser is ready', async () => {
  const page = loadInvite();
  assert.equal(page.invite.hidden, true);
  page.browserReady();
  assert.equal(page.invite.hidden, false);
  await page.accept();
  assert.equal(page.promptCalls, 1);
  assert.equal(page.invite.hidden, true);
  page.installed();
  assert.deepEqual(page.analytics, ['pwa_install']);
});

test('PWA keeps a dismissal across visits, including cancellation of the browser prompt', async () => {
  const page = loadInvite();
  page.browserReady('dismissed');
  await page.accept();
  assert.equal(page.storage.get(dismissedKey), '1');
  const next = loadInvite({storage: page.storage});
  next.browserReady();
  assert.equal(next.invite.hidden, true);
  const closed = loadInvite();
  closed.browserReady();
  closed.dismiss();
  assert.equal(closed.invite.hidden, true);
  assert.equal(closed.storage.get(dismissedKey), '1');
});

test('PWA never offers installation to the already installed app', () => {
  const page = loadInvite({installed: true});
  page.browserReady();
  assert.equal(page.invite.hidden, true);
});
