// Run after npm run build, with Playwright and Chromium installed.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {cp, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const {chromium} = createRequire(import.meta.url)('playwright');
const dist = new URL('../dist/', import.meta.url);
const temporary = await mkdtemp(join(tmpdir(), 'kamby-pwa-'));
let browser;
let server;
const secondVersion = 'qa-offline-v2';
try {
  await cp(dist, temporary, {recursive:true});
  const htmlPath = join(temporary, 'index.html');
  const workerPath = join(temporary, 'sw.js');
  const html = await readFile(htmlPath, 'utf8');
  const worker = await readFile(workerPath, 'utf8');
  const initialVersion = worker.match(/const BUILD_VERSION = "([^"]+)";/)?.[1];
  assert.ok(initialVersion, 'O service worker deve vir do build.');
  const releaseHtml = release => html.replace('<head>', '<head><meta name="qa-release" content="' + release + '">');
  await writeFile(htmlPath, releaseHtml('primeira'));
  server = spawn('python3', ['-u', '-c', [
    'from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler',
    'class Handler(SimpleHTTPRequestHandler):',
    '    def end_headers(self):',
    '        self.send_header("Cache-Control", "no-store" if self.path.startswith("/admin") else "no-cache")',
    '        super().end_headers()',
    'server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)',
    'print(server.server_port)',
    'server.serve_forever()',
  ].join('\n')], {cwd:temporary, stdio:['ignore','pipe','ignore']});
  const [port] = await Promise.race([
    once(server.stdout, 'data'),
    once(server, 'exit').then(([code]) => { throw new Error('Servidor de teste terminou: ' + code); }),
  ]);
  const address = 'http://127.0.0.1:' + port.toString().trim();
  browser = await chromium.launch({executablePath:process.env.KAMBY_QA_CHROMIUM});
  const context = await browser.newContext();
  await context.route('**/*', route => new URL(route.request().url()).origin === address ? route.continue() : route.abort());
  const page = await context.newPage();
  const expectRelease = async release => {
    await page.getByRole('heading', {name:'Perfil', exact:true}).waitFor();
    assert.equal(await page.locator('meta[name="qa-release"]').getAttribute('content'), release);
  };
  await page.goto(address + '/#perfil');
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload();
  await expectRelease('primeira');
  console.log('PASSOU: o Perfil reabre offline.');
  const adminPage = await context.newPage();
  await assert.rejects(adminPage.goto(address + '/admin.html'), /ERR_INTERNET_DISCONNECTED/);
  await adminPage.close();
  console.log('PASSOU: o painel de Administração exige ligação à rede.');

  await context.setOffline(false);
  await writeFile(htmlPath, releaseHtml('segunda'));
  await writeFile(workerPath, worker.replace(initialVersion, secondVersion));
  await page.evaluate(async () => {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      document.documentElement.dataset.qaControllerChanged = 'true';
    }, {once:true});
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
  await page.waitForFunction(() => document.documentElement.dataset.qaControllerChanged === 'true'
    && navigator.serviceWorker.controller?.state === 'activated');
  await page.waitForFunction(async version => {
    const keys = (await caches.keys()).filter(key => key.startsWith('kamby-shell-'));
    return keys.length === 1 && keys[0] === 'kamby-shell-' + version;
  }, secondVersion);
  await page.reload();
  await expectRelease('segunda');

  await context.setOffline(true);
  await page.reload();
  await expectRelease('segunda');
  console.log('PASSOU: a versão nova substitui a anterior e reabre offline.');
} finally {
  try { await browser?.close(); } finally {
    server?.kill();
    await rm(temporary, {recursive:true, force:true});
  }
}
