import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {listenForNavigation} from '../frontend/navigation.js';

test('Voltar por histórico e alteração manual de fragmento tratam cada destino uma vez', () => {
  const browser = new EventTarget();
  browser.location = new URL('https://kamby.test/#carrinho/loja/1');
  const destinations = [];
  listenForNavigation(browser, () => destinations.push(browser.location.hash));
  function emit(type, url) {
    browser.location = new URL(url);
    const event = new Event(type);
    if (type === 'hashchange') event.newURL = browser.location.href;
    browser.dispatchEvent(event);
  }
  emit('popstate','https://kamby.test/app.html?partilha=1#produto/1');
  assert.deepEqual(destinations,['#produto/1']);
  emit('popstate','https://kamby.test/#lojas');
  emit('hashchange','https://kamby.test/#lojas');
  emit('hashchange','https://kamby.test/#perfil');
  assert.deepEqual(destinations,['#produto/1','#lojas','#perfil']);
});

test('O link legado abre a ficha actual e conserva a pasta de instalação', () => {
  const page = readFileSync(new URL('../frontend/product.html', import.meta.url), 'utf8');
  const script = page.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const [search, hash] of [['?id=abc%2Fdef','#produto/abc%2Fdef'],['','#inicio']]) {
    let target;
    const location = {href:'https://kamby.test/piloto/product.html'+search,search,replace:url=>{target=url;}};
    runInNewContext(script, {URL,URLSearchParams,location});
    assert.equal(target,'https://kamby.test/piloto/'+hash);
  }
});
