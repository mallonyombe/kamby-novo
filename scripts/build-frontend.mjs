import { build } from 'esbuild';
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const sourceDirectory = new URL('../frontend/', import.meta.url);
const outputDirectory = new URL('../dist/', import.meta.url);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const entry of await readdir(sourceDirectory, { withFileTypes: true })) {
  if (!entry.isFile() || !['.html', '.svg', '.js', '.css', '.jpg', '.webp', '.png', '.webmanifest'].some(extension => entry.name.endsWith(extension))) continue;
  await copyFile(
    new URL(entry.name, sourceDirectory),
    new URL(entry.name, outputDirectory),
  );
}

await build({
  entryPoints: [new URL('../frontend/analytics.js', import.meta.url).pathname, new URL('../frontend/admin.js', import.meta.url).pathname, new URL('../frontend/catalogue-contract.js', import.meta.url).pathname, new URL('../frontend/merchant.js', import.meta.url).pathname, new URL('../frontend/platform.js', import.meta.url).pathname, new URL('../frontend/theme.js', import.meta.url).pathname],
  bundle: true, splitting: true, format: 'esm', target: ['es2022'], platform: 'browser',
  outdir: outputDirectory.pathname, chunkNames: 'shared/[name]-[hash]', minify: true, legalComments: 'eof'
});
const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
const notices = await Promise.all(Object.entries(lock.packages)
  .filter(([path, info]) => path && !info.dev && !info.optional)
  .map(async ([path, info]) => {
    const directory = new URL('../' + path + '/', import.meta.url);
    const files = (await readdir(directory)).filter(name => /^(?:licen[cs]e|copying|notice|copyrightnotice)(?:\.[a-z]+)?$/i.test(name)).sort();
    if (files.length === 0) throw new Error('Falta o aviso de licença de ' + path);
    const texts = await Promise.all(files.map(file => readFile(new URL(file, directory), 'utf8')));
    return path.slice('node_modules/'.length) + ' ' + info.version + ' · ' + info.license + '\n\n' + texts.join('\n\n');
  }));
await writeFile(new URL('licencas.txt', outputDirectory), notices.join('\n\n' + '='.repeat(72) + '\n\n'));

if (process.argv.includes('--pilot')) {
  const page = new URL('index.html', outputDirectory);
  const html = await readFile(page, 'utf8');
  const pilot = html.replace('<html lang="pt-MZ">', '<html lang="pt-MZ" data-pilot="true">')
    .replace('<head>', '<head><meta name="robots" content="noindex,nofollow">')
    .replace('<script type="module" src="pwa.js"></script>', '')
    .replace(/<link[^>]+rel="manifest"[^>]*>/, '')
    .replace(/<footer class="legal-footer kamby-legal-footer"[\s\S]*?<\/footer>/,
      '<footer class="legal-footer kamby-legal-footer"><a href="./pilot-info.html">Sobre o piloto e privacidade</a></footer>')
    .replace('O contacto desta loja ainda não está disponível. Podes copiar o resumo do pedido.', 'Pedido simulado. Nenhuma mensagem foi enviada à loja.')
    .replace('Continuar no WhatsApp</button>', 'Simular pedido</button>')
    .replace('A tua conta mantém a sessão iniciada.', '');
  if (!pilot.includes('data-pilot="true"')) throw new Error('O modo de demonstração não foi activado.');
  await writeFile(page, pilot);
  const seed = JSON.parse(await readFile(new URL('fixtures/test-stores.json', import.meta.url), 'utf8'));
  const catalogue = seed.map(({name, location, description, products}) => ({
    name, location, description, products: products.filter(item => !['oleo','acucar'].includes(item.code))
  }));
  await writeFile(new URL('pilot-catalogue.json', outputDirectory), JSON.stringify(catalogue));
  await Promise.all(['admin.html','legal.html'].map(path => rm(new URL(path, outputDirectory))));
}

const shellFiles = (await readdir(outputDirectory, {recursive: true})).filter(path =>
  !path.startsWith('admin') && path !== 'sw.js' &&
  /\.(?:js|css|png|jpg|svg|webmanifest)$/.test(path) || path === 'index.html'
).sort();
const workerPath = new URL('sw.js', outputDirectory);
const worker = await readFile(workerPath, 'utf8');
const version = createHash('sha256').update(worker);
for (const file of shellFiles) {
  version.update(file).update(await readFile(new URL(file, outputDirectory)));
}
await writeFile(workerPath,
  'const BUILD_VERSION = ' + JSON.stringify(version.digest('hex').slice(0, 16)) + ';\n' +
  'const BUILD_ASSETS = ' + JSON.stringify(shellFiles) + ';\n' + worker
);
console.log('Interfaces Kamby e módulos autenticados preparados.');
