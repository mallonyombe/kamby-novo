import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../frontend/sw.js', import.meta.url), 'utf8');
const scope = 'https://example.test/kamby/';

function worker({ buildAssets, cacheControl = 'no-cache' }) {
  const callbacks = new Map();
  const download = [];
  const cached = [];
  const runtime = {
    BUILD_VERSION: 'test',
    BUILD_ASSETS: buildAssets,
    Request,
    Response,
    URL,
    fetch: async request => {
      download.push(request);
      return new Response('build asset', { headers: {'Cache-Control': cacheControl} });
    },
    caches: {
      open: async () => ({
        put: async request => { cached.push(request.url); },
        match: async () => undefined
      })
    },
    self: {
      registration: { scope },
      addEventListener: (type, callback) => { callbacks.set(type, callback); },
      skipWaiting: async () => undefined
    }
  };
  runInNewContext(source, runtime);
  return {
    cached,
    download,
    install() {
      let pending;
      callbacks.get('install')({waitUntil: promise => { pending = promise; }});
      return pending;
    },
    fetch(path, overrides = {}) {
      let pending;
      const request = {
        url: new URL(path, scope).href, mode: 'navigate', method: 'GET',
        cache: 'default', headers: new Headers(), ...overrides
      };
      callbacks.get('fetch')({request, respondWith: promise => { pending = promise; }});
      return pending;
    }
  };
}

test('a pré-cache admite apenas o shell e ficheiros estáticos da origem e do âmbito do PWA', async () => {
  const simulation = worker({
    buildAssets: [
      'index.html', 'shared/chunk-1.js', 'tema.css',
      'admin.html', 'admin-domain.js', 'api/perfil.js',
      '/outro/ficheiro.css', 'https://another.test/foto.png', 'foto.png?assinatura=1'
    ]
  });
  await simulation.install();
  assert.deepEqual(simulation.cached, [scope + 'index.html', scope + 'shared/chunk-1.js', scope + 'tema.css']);
  for (const request of simulation.download) {
    assert.equal(request.credentials, 'omit');
    assert.equal(request.redirect, 'error');
  }
});

test('uma resposta privada impede a preparação de um novo shell offline', async () => {
  const simulation = worker({buildAssets: ['index.html'], cacheControl: 'private, no-store'});
  await assert.rejects(simulation.install(), /não pode integrar o acesso offline/);
  assert.deepEqual(simulation.cached, []);
});

test('gestão, callbacks de sessão e ficheiros autenticados passam directamente pela rede', async () => {
  const simulation = worker({buildAssets: ['index.html', 'shared/tema.css']});
  for (const path of ['admin', 'admin.html', 'api/conta', '?code=autorizacao', '?token_hash=recuperacao']) {
    assert.equal(simulation.fetch(path), undefined, path);
  }
  assert.equal(simulation.fetch('shared/tema.css', {headers: new Headers({Authorization: 'Bearer teste'})}), undefined);
  assert.equal(simulation.fetch('shared/tema.css', {cache: 'no-store'}), undefined);
  assert.ok(simulation.fetch(''));
  await simulation.fetch('');
});
