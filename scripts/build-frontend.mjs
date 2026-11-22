import { build } from 'esbuild';
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';

const sourceDirectory = new URL('../frontend/', import.meta.url);
const outputDirectory = new URL('../dist/', import.meta.url);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const entry of await readdir(sourceDirectory, { withFileTypes: true })) {
  if (!entry.isFile() || !['.html', '.svg', '.js', '.css', '.jpg', '.webp', '.png'].some(extension => entry.name.endsWith(extension))) continue;
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
console.log('Interfaces Kamby e módulos autenticados preparados.');
