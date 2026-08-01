// Smoke test: Pinmark extension popup Review panel (real built dist + chrome stub)
import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_CANDIDATES = [
  path.resolve(__dirname, '../extension/dist'),
  path.resolve(process.cwd(), '../extension/dist'),
  path.resolve(process.cwd(), 'packages/extension/dist'),
];
const DIST = DIST_CANDIDATES.find((d) => fs.existsSync(d)) || DIST_CANDIDATES[0];

const PORT = 8188;
console.log('SMOKE DIST:', DIST, 'exists:', fs.existsSync(DIST));
const server = http.createServer((req, res) => {
  const rel = (req.url === '/' ? '/src/popup/index.html' : req.url || '').replace(/^\/+/, '');
  const file = path.join(DIST, decodeURIComponent(rel));
  if (!file.startsWith(DIST) || !fs.existsSync(file)) {
    console.log('SMOKE 404:', req.url, '->', file, 'startsWith:', file.startsWith(DIST), 'exists:', fs.existsSync(file));
    res.statusCode = 404; res.end('nf'); return;
  }
  const ext = path.extname(file);
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
  res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
await new Promise<void>((r) => server.listen(PORT, '127.0.0.1', r));

let browser;
try {
  browser = await puppeteer.launch({ headless: true });
} catch {
  browser = await puppeteer.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
}
const page = await browser.newPage();
await page.setViewport({ width: 400, height: 700 });

// Chrome API stub with seeded feedback containing full diagnostics (pure JS —
// puppeteer serializes this via Function#toString, TS syntax would throw)
const STUB_SOURCE = fs.readFileSync(new URL('./test-popup-stub.js', import.meta.url), 'utf8');
await page.evaluateOnNewDocument(STUB_SOURCE);

const pageErrors: string[] = [];
const consoleMsgs: string[] = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('console', (m) => consoleMsgs.push(`[${m.type()}] ${m.text().slice(0, 200)}`));
await page.goto(`http://127.0.0.1:${PORT}/src/popup/index.html`, { waitUntil: 'networkidle2', timeout: 15000 });
await new Promise((r) => setTimeout(r, 800));

const bodySnippet = await page.evaluate(() => document.body.innerHTML.slice(0, 300));
const chromeProbe = await page.evaluate(() => ({
  stubRan: window.__stubRan === true,
  stubError: window.__stubError || 'none',
  chromeType: typeof window.chrome,
  storageType: (window.chrome && window.chrome.storage) ? typeof window.chrome.storage : 'missing',
  localType: (window.chrome && window.chrome.storage && window.chrome.storage.local) ? typeof window.chrome.storage.local : 'missing',
}));
console.log('CHROME PROBE:', JSON.stringify(chromeProbe));
page.on('pageerror', (e) => console.log('LATE PAGEERROR:', String(e).slice(0, 200)));
if (!(await page.evaluate(() => !!document.getElementById('openReview')))) {
  console.log('DEBUG BODY:', bodySnippet);
  console.log('DEBUG CONSOLE:');
  consoleMsgs.slice(0, 12).forEach((l) => console.log('  ', l));
  console.log('DEBUG PAGEERRORS:');
  pageErrors.slice(0, 5).forEach((l) => console.log('  ', l));
  throw new Error('openReview button missing');
}

const out: Record<string, unknown> = {};
out.hasReviewBtn = await page.evaluate(() => !!document.getElementById('openReview'));
out.brand = await page.evaluate(() => document.querySelector('.brand-name')?.textContent);

// Open Review panel
await page.click('#openReview');
await new Promise((r) => setTimeout(r, 400));
out.panelVisible = await page.evaluate(() => document.getElementById('reviewPanel')?.style.display !== 'none');
out.meta = await page.evaluate(() => document.getElementById('reviewMeta')?.textContent);
out.itemCount = await page.evaluate(() => document.querySelectorAll('.review-item').length);
out.comment = await page.evaluate(() => document.querySelector('.review-comment')?.textContent?.trim());
out.triageChip = await page.evaluate(() => document.querySelector('.triage-chip')?.textContent?.trim());
out.badges = await page.evaluate(() => Array.from(document.querySelectorAll('.diag-badge')).map((b) => b.textContent));
out.detailHidden = await page.evaluate(() => document.querySelector('.review-detail')?.getAttribute('style'));

const itemCountNow = await page.evaluate(() => document.querySelectorAll('.review-item').length);
if (itemCountNow === 0) {
  console.log('DEBUG after-open errors:');
  pageErrors.slice(-6).forEach((l) => console.log('  [pageerror]', l.slice(0, 250)));
  consoleMsgs.slice(-8).forEach((l) => console.log('  [console]', l));
  console.log('DEBUG reviewList:', (await page.evaluate(() => document.getElementById('reviewList')?.innerHTML || 'EMPTY')).slice(0, 300));
  throw new Error('no review items rendered');
}

// Expand detail
await page.click('.review-item-head');
await new Promise((r) => setTimeout(r, 250));
out.detailVisible = await page.evaluate(() => document.querySelector('.review-detail')?.getAttribute('style') !== 'display:none');
out.detailSections = await page.evaluate(() => Array.from(document.querySelectorAll('.detail-sec-title')).map((s) => s.textContent));
out.copyBtn = await page.evaluate(() => !!document.querySelector('.review-copy'));
out.copyHasMd = await page.evaluate(() => (document.querySelector('.review-copy')?.getAttribute('data-md') || '').includes('Login'));

// Empty state check (different URL)
await page.evaluateOnNewDocument("window.chrome.tabs.query = async () => [{ id: 1, url: 'https://empty.example.com/' }];");
await page.reload({ waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 800));
await page.click('#openReview');
await new Promise((r) => setTimeout(r, 300));
out.emptyState = await page.evaluate(() => !!document.querySelector('.review-empty'));

console.log('── POPUP REVIEW SMOKE ──');
console.log('review btn     :', out.hasReviewBtn ? 'YES' : 'NO');
console.log('panel opens    :', out.panelVisible ? 'YES' : 'NO');
console.log('meta           :', out.meta);
console.log('items          :', out.itemCount);
console.log('comment        :', out.comment);
console.log('triage chip    :', out.triageChip);
console.log('badges         :', JSON.stringify(out.badges));
console.log('detail expand  :', out.detailVisible ? 'YES' : 'NO');
console.log('detail sections:', JSON.stringify(out.detailSections));
console.log('copy btn + md  :', out.copyBtn && out.copyHasMd ? 'YES' : 'NO');
console.log('empty state    :', out.emptyState ? 'YES' : 'NO');
console.log('PAGE ERRORS    :', pageErrors.length ? pageErrors.join(' | ') : '(none)');

server.close();
await browser.close();
