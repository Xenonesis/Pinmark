import { readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '..', 'packages', 'extension', 'dist');
const outDir = resolve(__dirname, '..', 'packages', 'extension', 'dist-firefox');

// Clean previous build
rmSync(outDir, { recursive: true, force: true });

// Copy dist → dist-firefox
cpSync(distDir, outDir, { recursive: true });

// Transform manifest
const manifestPath = resolve(outDir, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

// Firefox does not support "use_dynamic_url" in web_accessible_resources
if (Array.isArray(manifest.web_accessible_resources)) {
  for (const entry of manifest.web_accessible_resources) {
    if ('use_dynamic_url' in entry) {
      delete entry.use_dynamic_url;
    }
  }
}

// Firefox uses background.scripts instead of background.service_worker
if (manifest.background && manifest.background.service_worker) {
  manifest.background.scripts = [manifest.background.service_worker];
  delete manifest.background.service_worker;
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log('[build-firefox] dist-firefox/ created — manifest cleaned for Firefox');
