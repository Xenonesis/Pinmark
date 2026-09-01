import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { ZipArchive } = require('archiver');

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const extensionDir = resolve(rootDir, 'packages', 'extension');
const chromeDist = [
  resolve(extensionDir, '.output', 'chrome-mv3'),
  resolve(extensionDir, 'dist'),
].find((d) => existsSync(d)) || resolve(extensionDir, '.output', 'chrome-mv3');

const firefoxDist = [
  resolve(extensionDir, '.output', 'firefox-mv2'),
  resolve(extensionDir, '.output', 'firefox-mv3'),
  resolve(extensionDir, 'dist-firefox'),
].find((d) => existsSync(d)) || resolve(extensionDir, '.output', 'firefox-mv2');
const releaseDir = resolve(rootDir, 'release');

if (!existsSync(releaseDir)) {
  mkdirSync(releaseDir, { recursive: true });
}

function createZip(sourceDir, outPath) {
  return new Promise((resolvePromise, rejectPromise) => {
    const output = createWriteStream(outPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on('close', () => {
      resolvePromise(archive.pointer());
    });

    archive.on('error', (err) => {
      rejectPromise(err);
    });

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

function auditDirectory(dirName, dirPath) {
  console.log(`\n── Auditing ${dirName} (${dirPath}) ──`);
  const manifestPath = join(dirPath, 'manifest.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing manifest.json in ${dirPath}`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  console.log(`  Name:        ${manifest.name}`);
  console.log(`  Version:     ${manifest.version}`);
  console.log(`  Permissions: ${JSON.stringify(manifest.permissions)}`);

  // Assert version
  if (manifest.version !== '1.7.0') {
    throw new Error(`Manifest version is ${manifest.version}, expected 1.7.0`);
  }

  // Scan all files for banned extensions/patterns
  const allFiles = [];
  function scan(current) {
    for (const item of readdirSync(current)) {
      const full = join(current, item);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        scan(full);
      } else {
        const rel = relative(dirPath, full).replace(/\\/g, '/');
        allFiles.push({ rel, size: stat.size });
        if (rel.endsWith('.mp4') || rel.endsWith('.map') || rel.includes('.env')) {
          throw new Error(`Banned file found in extension build: ${rel}`);
        }
      }
    }
  }
  scan(dirPath);
  console.log(`  Total files: ${allFiles.length}`);
  return { manifest, allFiles };
}

async function packageAll() {
  console.log('📦 Packaging Pinmark Browser Extensions...');

  auditDirectory('Chrome (dist)', chromeDist);
  const chromeZipPath = join(releaseDir, 'pinmark-chrome-v1.7.0.zip');
  const chromeBytes = await createZip(chromeDist, chromeZipPath);
  console.log(`  ✓ Created: release/pinmark-chrome-v1.7.0.zip (${(chromeBytes / 1024).toFixed(1)} KB)`);

  auditDirectory('Firefox (dist-firefox)', firefoxDist);
  const firefoxZipPath = join(releaseDir, 'pinmark-firefox-v1.7.0.zip');
  const firefoxBytes = await createZip(firefoxDist, firefoxZipPath);
  console.log(`  ✓ Created: release/pinmark-firefox-v1.7.0.zip (${(firefoxBytes / 1024).toFixed(1)} KB)`);

  console.log('\n🎉 Extension packaging complete and verified!');
}

packageAll().catch((err) => {
  console.error('Packaging failed:', err);
  process.exit(1);
});
