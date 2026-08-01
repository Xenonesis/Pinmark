// Load-validation: boots the REAL built unpacked extension in Chrome and verifies
// content-script overlay injection, real chrome.storage persistence, lazy MV3
// service worker (woken by a real pin sync), and the popup rendering REAL data.
import puppeteer from 'puppeteer';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../extension/dist');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 8199;
const PAGE_URL = `http://127.0.0.1:${PORT}/page.html`;
const STORAGE_KEY = `pinmark_feedback_http://127.0.0.1:${PORT}/page.html`;
const out: Record<string, unknown> = {};

if (!fs.existsSync(path.join(DIST, 'manifest.json'))) {
  console.error('dist missing:', DIST);
  process.exit(1);
}

// Clean page WITHOUT the pinmark page-bundle (unlike test.html) so the only
// overlay present is the extension's own content script.
const PAGE_HTML = `<!DOCTYPE html><html><head><title>load test</title></head><body>
<div id="card-1" style="width:300px;height:120px;margin:20px;background:#eef;border:1px solid #99c">Load test card</div>
</body></html>`;
const server = http.createServer((req, res) => {
  if (req.url === '/page.html') { res.end(PAGE_HTML); return; }
  res.statusCode = 404; res.end('nf');
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await puppeteer.launch({
  headless: false,
  executablePath: CHROME,
  // puppeteer's default args include --disable-extensions; branded Chrome 151 also
  // ignores --load-extension entirely — load the unpacked extension via CDP instead.
  ignoreDefaultArgs: ['--disable-extensions', '--disable-component-extensions-with-background-pages'],
  args: ['--no-first-run'],
});

// Load the unpacked extension through the modern CDP API
const ws = new WebSocket(browser.wsEndpoint());
await new Promise((r) => (ws.onopen = r));
let cdpId = 0;
const cdpPending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data as string);
  if (msg.id && cdpPending.has(msg.id)) { cdpPending.get(msg.id)(msg); cdpPending.delete(msg.id); }
};
const cdpSend = (method: string, params: any = {}) => new Promise((resolve) => {
  const mid = ++cdpId;
  cdpPending.set(mid, resolve);
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const loaded = await cdpSend('Extensions.loadUnpacked', { path: DIST });
const extId: string = (loaded as any)?.result?.id;
if (!extId) { console.error('loadUnpacked failed:', JSON.stringify(loaded).slice(0, 300)); process.exit(1); }
out.extensionId = extId;
console.log('EXT ID:', extId);

const targetEvents: string[] = [];
let swWorker: any = null;
browser.on('targetcreated', (t) => {
  targetEvents.push('+ ' + t.type() + ' ' + t.url().slice(0, 110));
  if (t.type() === 'service_worker') {
    t.worker().then((w) => {
      swWorker = w;
      (w as any).on?.('console', (m: any) => targetEvents.push('SW CONSOLE: ' + String(m.text?.() || m).slice(0, 160)));
      (w as any).on?.('error', (e: any) => targetEvents.push('SW ERROR: ' + String(e).slice(0, 160)));
      targetEvents.push('SW ATTACHED');
    }).catch(() => targetEvents.push('SW ATTACH FAIL'));
  }
});
browser.on('targetdestroyed', (t) => targetEvents.push('- ' + t.type() + ' ' + t.url().slice(0, 110)));

// 1) Content script + overlay on a clean page
const page = await browser.newPage();
const pageErrors: string[] = [];
const pinmarkLogs: string[] = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('console', (m) => {
  const t = m.text();
  if (t.includes('Pinmark') || t.includes('pinmark')) pinmarkLogs.push(`[${m.type()}] ${t.slice(0, 160)}`);
});
await page.goto(PAGE_URL, { waitUntil: 'networkidle2', timeout: 20000 });
// Extension starts inactive: only the launcher button shows until activated
await page.waitForSelector('#pinmark-launcher-host', { timeout: 15000 }).catch(() => null);
out.launcherShown = await page.evaluate(() => !!document.querySelector('#pinmark-launcher-host'));
console.log('LAUNCHER:', out.launcherShown);
// Activate: click the launcher (initializes overlay + SET_STATE active)
await page.evaluate(`(() => {
  const host = document.querySelector('#pinmark-launcher-host');
  const btn = host && host.shadowRoot ? host.shadowRoot.querySelector('.pinmark-launcher') : null;
  if (!btn) return 'no-launcher-btn';
  btn.click();
  return 'clicked';
})()`);
await page.waitForSelector('pinmark-overlay', { timeout: 15000 }).catch(() => null);
out.overlayInjected = await page.evaluate(() => !!document.querySelector('pinmark-overlay'));
out.overlayShadowKids = await page.evaluate(() => document.querySelector('pinmark-overlay')?.shadowRoot?.children.length || 0);
out.contentPageErrors = pageErrors.length;
console.log('OVERLAY el:', out.overlayInjected, '| shadow kids:', out.overlayShadowKids, '| pageerrors:', pageErrors.length);
console.log('PINMARK LOGS:', JSON.stringify(pinmarkLogs));
out.contentLoaded = pinmarkLogs.some((l) => l.includes('Content script loaded'));
out.overlayInit = pinmarkLogs.some((l) => l.includes('Initializing overlay'));
out.overlayActivated = pinmarkLogs.some((l) => l.includes('Overlay activated'));

// 2) Drop a REAL pin through the overlay UI (real mouse + open shadow root)
await page.evaluate(`document.getElementById('card-1').scrollIntoView({block:'center'})`);
await new Promise((r) => setTimeout(r, 300));
await page.hover('#card-1');
await new Promise((r) => setTimeout(r, 200));
await page.click('#card-1');
await new Promise((r) => setTimeout(r, 500));
const submitResult = await page.evaluate(`(() => {
  const o = document.querySelector('pinmark-overlay');
  if (!o || !o.shadowRoot) return 'no-overlay';
  const sr = o.shadowRoot;
  const input = sr.querySelector('textarea.pinmark-modal-input');
  if (!input) return 'no-modal-input: ' + sr.innerHTML.slice(0, 200);
  input.value = 'extension load test pin';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const submit = sr.querySelector('.pinmark-modal-btn.submit');
  if (!submit) return 'no-submit-btn';
  submit.click();
  return 'submitted';
})()`);
out.pinDropped = submitResult === 'submitted';
console.log('PIN DROP:', submitResult);

await new Promise((r) => setTimeout(r, 1500));
out.markerRendered = await page.evaluate(`(() => {
  const o = document.querySelector('pinmark-overlay');
  const txt = o && o.shadowRoot ? o.shadowRoot.textContent || '' : '';
  return txt.includes('extension load test pin') || txt.includes('load test pin');
})()`);
console.log('MARKER RENDERED:', out.markerRendered);

// 3) SW should wake from the pin's SYNC_MCP message
const swTarget = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://' + extId), { timeout: 20000 }).catch(() => null);
if (!swTarget) {
  console.log('SW NEVER APPEARED. target events (last 14):');
  targetEvents.slice(-14).forEach((e) => console.log('  ', e));
  throw new Error('service worker never woke after pin sync');
}
console.log('EXT ID:', extId, '| SW:', swTarget.url());
const sw = swTarget.worker ? await swTarget.worker() : null;

// 4) Real chrome.storage read-back of the pin (same key the popup reads)
const stored = await sw!.evaluate(async (key) => {
  try {
    const all = await chrome.storage.local.get(null);
    const items = all[key] || [];
    return { count: items.length, firstId: items[0]?.id, firstComment: items[0]?.comment, runtimeId: chrome.runtime.id };
  } catch (e) {
    return { error: String(e) };
  }
}, STORAGE_KEY);
out.storageReadback = stored;
console.log('STORAGE READBACK:', JSON.stringify(stored));

// 5) Real popup rendering REAL data: the popup reads the active tab's URL at
//    init — inject a tab stub so it targets the clean page (real storage stays).
const popup = await browser.newPage();
const popupErrors: string[] = [];
popup.on('pageerror', (e) => popupErrors.push(String(e)));
await popup.evaluateOnNewDocument(`chrome.tabs.query = async () => [{ id: 1, url: '${PAGE_URL}' }];`);
await popup.goto(`chrome-extension://${extId}/src/popup/index.html`, { waitUntil: 'networkidle2', timeout: 15000 });
await new Promise((r) => setTimeout(r, 1200));
out.popupBrand = await popup.evaluate(() => document.querySelector('.brand-name')?.textContent || '');
out.popupErrors = popupErrors.length;
await popup.click('#openReview').catch(() => null);
await new Promise((r) => setTimeout(r, 700));
out.popupItemCount = await popup.evaluate(() => document.querySelectorAll('.review-item').length);
out.popupComment = await popup.evaluate(() => document.querySelector('.review-comment')?.textContent?.trim() || '');
out.popupTriage = await popup.evaluate(() => document.querySelector('.triage-chip')?.textContent?.trim() || '');
out.popupBadges = await popup.evaluate(() => Array.from(document.querySelectorAll('.diag-badge')).map((b) => b.textContent));
out.popupMeta = await popup.evaluate(() => document.getElementById('reviewMeta')?.textContent || '');
console.log('POPUP brand:', out.popupBrand, '| errors:', popupErrors.length, '| items:', out.popupItemCount, '| comment:', out.popupComment);

console.log('── EXTENSION LOAD CHECKS ──');
console.log('extension id    :', String(out.extensionId).slice(0, 32) + '…');
console.log('overlay boots   :', out.overlayInjected && (out.overlayShadowKids as number) >= 8 ? 'YES' : 'NO');
console.log('content script  :', out.contentLoaded && out.overlayInit ? 'YES' : 'NO');
console.log('pin persisted   :', (stored as any).count >= 1 && (stored as any).firstComment === 'extension load test pin' ? 'YES' : 'NO', JSON.stringify(stored));
console.log('sw woke on pin  :', out.pinDropped && !!swTarget ? 'YES' : 'NO');
console.log('popup real data :', out.popupItemCount === 1 && out.popupComment === 'extension load test pin' ? 'YES' : 'NO');
console.log('popup no errors :', out.popupErrors === 0 ? 'YES' : 'NO');
console.log('page errors     :', out.contentPageErrors === 0 ? 'NONE' : String(out.contentPageErrors));
await browser.close();
server.close();
