import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const assets = ['index.html', 'app.js', 'song-engine.js', 'petite-vue.js', 'styles/style.css', 'assets/hoop-worship-logo.jpg'];
for (const file of assets) {
    const target = resolve(root, 'dist', file);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(resolve(root, file), target);
}
// Preserve the existing release's two examples without deleting legacy browser data.
await copyFile(resolve(root, 'sample-data.js'), resolve(root, 'dist/data.js'));
console.log('dist listo: interfaz y dos canciones de muestra. El servicio se publica con wrangler.jsonc o vercel.json.');
