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
  entryPoints: [new URL('../frontend/admin.js', import.meta.url).pathname, new URL('../frontend/catalogue-contract.js', import.meta.url).pathname, new URL('../frontend/merchant.js', import.meta.url).pathname, new URL('../frontend/platform.js', import.meta.url).pathname, new URL('../frontend/theme.js', import.meta.url).pathname],
  bundle: true, splitting: true, format: 'esm', target: ['es2022'], platform: 'browser',
  outdir: outputDirectory.pathname, chunkNames: 'shared/[name]-[hash]', minify: true, legalComments: 'eof'
});
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
