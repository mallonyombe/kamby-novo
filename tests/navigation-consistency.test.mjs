import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const admin=readFileSync(new URL('../frontend/admin.js',import.meta.url),'utf8');
const merchant=readFileSync(new URL('../frontend/merchant-workspace.js',import.meta.url),'utf8');
const summary=readFileSync(new URL('../frontend/merchant-summary.js',import.meta.url),'utf8');

test('todas as áreas administrativas principais usam o cabeçalho com menu',()=>{
  assert.match(admin,/const subpage=Boolean\(id\)/);
  assert.match(admin,/id="adminPrimaryTitle"/);
  assert.match(admin,/id="adminPrimaryActions"/);
  assert.doesNotMatch(admin,/main\.replaceChildren\(heading\('Visão geral'\)\)/);
});

test('o vendedor troca título, navegação e acções no mesmo cabeçalho',()=>{
  assert.match(merchant,/resumo:'Resumo',produtos:'Produtos',loja:'Loja',actividade:'Actividade'/);
  assert.match(merchant,/backToProfile\.hidden=nested;historyBack\.hidden=!nested/);
  assert.doesNotMatch(merchant,/merchantNavigationDrawer/);
  assert.match(merchant,/productActions\.hidden=next!=='produtos'/);
});

test('resumo, produtos e actividade não repetem o título no corpo',()=>{
  assert.doesNotMatch(summary,/<h2>Resumo<\/h2>/);
  assert.doesNotMatch(merchant,/<h2>Produtos<\/h2>/);
  assert.doesNotMatch(merchant,/<h2>Actividade<\/h2>/);
});
