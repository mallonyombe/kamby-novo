// Run after npm run build, in a disposable checkout used only for browser QA.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
const output = new URL('../dist/roadmap/',import.meta.url);
await mkdir(output,{recursive:true});
const original = await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const fixture = await readFile(new URL('roadmap/catalogue-fixture.js',import.meta.url),'utf8');
await writeFile(new URL('app.html',output),original.replace('<head>','<head><base href="/"><script>'+fixture+'</script>'));
await copyFile(new URL('roadmap/compra.html',import.meta.url),new URL('index.html',output));
