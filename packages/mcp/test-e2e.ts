// Real-browser E2E for Pinmark performance profiling + network interception.
// Run: pnpm exec tsx packages/mcp/test-e2e.ts
import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import { registerMcpTools } from './src/mcp-tools.js';
import { store } from './src/store.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const API_PORT = 9099;
const APP_URL = 'http://localhost:8081/test.html';

// ── 1. Fake API server: JSON error bodies, slow response, XHR 404 ──
const api = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  res.setHeader('Content-Type', 'application/json');
  if (req.url?.includes('/api/fail')) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'db timeout', code: 'DB_TIMEOUT' }));
  } else if (req.url?.includes('/api/slow')) {
    setTimeout(() => { res.statusCode = 200; res.end(JSON.stringify({ ok: true, data: [1, 2, 3] })); }, 800);
  } else if (req.url?.includes('/api/xhr')) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'not found', code: 'NF' }));
  } else {
    res.statusCode = 200;
    res.end('{}');
  }
});
await new Promise<void>((resolve) => api.listen(API_PORT, '127.0.0.1', resolve));
console.log('[e2e] Fake API listening on', API_PORT);

// ── 2. Launch browser ──
let browser;
try {
  browser = await puppeteer.launch({ headless: true });
} catch (e) {
  console.error('[e2e] Default launch failed:', String(e));
  browser = await puppeteer.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
}
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

const pageErrors: string[] = [];
const consoleErrors: string[] = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

const ua = await page.browser().userAgent();
console.log('[e2e] UA:', ua);

await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 20000 });
await page.waitForFunction(() => (window as any).pinmarkOverlay, { timeout: 10000 });
console.log('[e2e] Overlay initialized');

// ── 3. Trigger a 500ms main-thread busy loop via the REAL button listener ──
// (DevTools evaluate-injected busy loops are not attributed as longtasks in Chrome;
//  a real task with a user-gesture-like dispatch is. Overlay won't intercept since
//  nothing is hovered and blockInteractions is off.)
await page.evaluate(() => {
  document.getElementById('btn-lag').dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await new Promise((r) => setTimeout(r, 600));

// Native probe: did the browser itself record the busy loop as a longtask?
const nativeLongTasks = await page.evaluate(() =>
  performance.getEntriesByType('longtask').map((l: any) => ({ d: Math.round(l.duration), s: Math.round(l.startTime) }))
);
console.log('[e2e] Native longtask buffer:', JSON.stringify(nativeLongTasks));
const overlayLongTasks = await page.evaluate(() => {
  const o: any = (window as any).pinmarkOverlay;
  return o.perfMetrics.filter((p: any) => p.entryType === 'longtask').map((l: any) => ({ d: Math.round(l.duration), s: Math.round(l.startTime) }));
});
console.log('[e2e] Overlay longtasks after real button click:', JSON.stringify(overlayLongTasks));

// ── 4. Trigger network traffic: failing fetch, slow fetch, failing XHR ──
await page.evaluate(async () => {
  try {
    await fetch('http://localhost:9099/api/fail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: 'abc', pin: 1 }),
    });
  } catch (e) { /* expected 500 */ }
  try {
    await fetch('http://localhost:9099/api/slow');
  } catch (e) { /* ignore */ }
  await new Promise<void>((resolve) => {
    const x = new XMLHttpRequest();
    x.open('GET', 'http://localhost:9099/api/xhr');
    x.send();
    x.onloadend = () => resolve();
  });
});
console.log('[e2e] Network traffic fired');

// ── 5. Trigger a layout shift ──
await page.evaluate(() => {
  const d = document.createElement('div');
  d.id = 'shift-inject';
  d.style.cssText = 'height: 120px; background: red;';
  d.textContent = 'SHIFT';
  document.body.insertBefore(d, document.body.firstChild);
});
await new Promise((r) => setTimeout(r, 600));

// ── 6. Assert CLS highlight appeared in shadowRoot ──
const clsHighlight = await page.evaluate(() => {
  const o = (window as any).pinmarkOverlay;
  return { hasShift: o.shadowRoot.innerHTML.includes('Shift:'), shadowText: o.shadowRoot.textContent?.slice(0, 100) };
});
console.log('[e2e] CLS highlight in shadowRoot:', clsHighlight.hasShift ? 'YES' : 'NO');

// ── 7. Wait for an FPS tick ──
await new Promise((r) => setTimeout(r, 1400));

// ── 8. Pin via real UI: hover → click → modal → comment → submit ──
async function dropPin(selector: string, comment: string): Promise<any> {
  await page.hover(selector);
  await new Promise((r) => setTimeout(r, 150));
  await page.click(selector);
  await new Promise((r) => setTimeout(r, 400));
  return await page.evaluate(async (c) => {
    const o = (window as any).pinmarkOverlay;
    const sr = o.shadowRoot;
    const input = sr.querySelector('textarea.pinmark-modal-input');
    if (!input) return { error: 'modal input not found', html: sr.innerHTML.slice(0, 400) };
    input.value = c;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const submit = sr.querySelector('.pinmark-modal-btn.submit') as HTMLButtonElement;
    submit.click();
    await new Promise((r) => setTimeout(r, 1200));
    const items = o.feedbackManager.getAll();
    if (!items || items.length === 0) return { error: 'no feedback item after submit', count: items.length };
    return { count: items.length, item: JSON.parse(JSON.stringify(items[items.length - 1])) };
  }, comment);
}

// Pin 1: plain window.store redux path (circular-ref state included)
const pin1 = await dropPin('#card-1', 'E2E pin 1 - state sniff');
if (pin1.error) {
  console.error('[e2e] PIN 1 FAILED:', pin1.error, pin1.html || '');
} else {
  const item = pin1.item;
  const perfTypes = (item.performanceMetrics || []).map((p: any) => p.entryType);
  const longTasks = (item.performanceMetrics || []).filter((p: any) => p.entryType === 'longtask');
  const shifts = (item.performanceMetrics || []).filter((p: any) => p.entryType === 'layout-shift');
  const reqs: any[] = item.networkRequests || [];
  const failReq = reqs.find((r: any) => r.url?.includes('/api/fail'));
  const xhrReq = reqs.find((r: any) => r.url?.includes('/api/xhr'));
  const slowReq = reqs.find((r: any) => r.url?.includes('/api/slow'));
  const fpsValues = (item.fpsMetrics || []).map((f: any) => f.fps);
  const ss = item.stateSnapshot;

  console.log('── E2E RESULTS (pin 1) ──');
  console.log('perf entry types:', perfTypes.join(', '));
  console.log('longtasks:', JSON.stringify(longTasks.map((l: any) => ({ d: Math.round(l.duration) }))));
  console.log('layout shifts:', shifts.length, 'entries');
  console.log('fps samples:', fpsValues.length ? fpsValues.join(', ') : '(none)');
  console.log('fps < 30 dips:', fpsValues.filter((v: number) => v < 30).length);
  console.log('domMetrics:', JSON.stringify(item.domMetrics));
  console.log('memoryMetrics:', item.memoryMetrics ? `used ${Math.round(item.memoryMetrics.usedJSHeapSize / 1048576)}MB` : '(perf.memory unavailable in this Chrome)');
  console.log('network requests:', reqs.length);
  console.log('  fail fetch :', failReq ? `${failReq.status} isError=${failReq.isError} req=${JSON.stringify(failReq.requestBody)} res=${failReq.responseBody}` : 'MISSING');
  console.log('  xhr 404    :', xhrReq ? `${xhrReq.status} isError=${xhrReq.isError} res=${xhrReq.responseBody}` : 'MISSING');
  console.log('  slow fetch :', slowReq ? `${slowReq.status} isError=${slowReq.isError} dur=${slowReq.duration}ms` : 'MISSING');
  console.log('state detected:', ss ? ss.detected.join(', ') : 'NONE');
  console.log('  redux.user :', ss?.snapshot?.redux?.user ? JSON.stringify(ss.snapshot.redux.user) : 'MISSING');
  console.log('  redux circ :', ss?.snapshot?.redux?.circular ? JSON.stringify(ss.snapshot.redux.circular) : 'MISSING');
  console.log('  vuex.auth  :', ss?.snapshot?.vuex?.auth ? JSON.stringify(ss.snapshot.vuex.auth) : 'MISSING');
  console.log('  zustand    :', ss?.snapshot?.zustand ? JSON.stringify(ss.snapshot.zustand) : 'MISSING');

  // Save the REAL annotation for MCP verification
  fs.writeFileSync(new URL('./e2e-annotation.json', import.meta.url), JSON.stringify(item, null, 2));

  const pin1Issues: any[] = item.a11yIssues || [];
  console.log('a11y (card-1)  :', pin1Issues.length ? pin1Issues.map((i) => `${i.type}:${i.severity}`).join(', ') : 'no issues');
  const triage1 = item.triage;
  console.log('triage (card-1) :', triage1 ? `${triage1.category}/${triage1.intent}/${triage1.severity} — ${triage1.reasons.length} reason(s)` : 'MISSING');
}

// ── 9. MCP harness (hoisted: used by pin 1 and pin 3) ──
let toolsHandler: any = null;
const server = {
  setRequestHandler: (schema: any, handler: any) => {
    if (schema === CallToolRequestSchema) toolsHandler = handler;
  },
} as any;
registerMcpTools(server);
const session = store.getSession('http://localhost:8081/test.html') || store.createSession('http://localhost:8081/test.html', 'e2e-session');
session.annotations = [];

const call = async (name: string, annotationId: string) => {
  const r = await toolsHandler({ method: 'tools/call', params: { name, arguments: { annotationId } } }, {});
  return r?.content?.[0]?.text || '';
};

session.annotations.push({ ...pin1.item, id: 'e2e-real-1' });

const report = await call('pinmark_analyze_performance', 'e2e-real-1');
console.log('── MCP ANALYZE (real data) ──');
  console.log(report.split('\n').slice(0, 22).join('\n'));
  console.log('── CHECKS ──');
  console.log('TBT present     :', report.includes('Total Blocking Time') ? 'YES' : 'NO');
  console.log('Failing section :', report.includes('Failing Network Requests') ? 'YES' : 'NO');
  console.log('real err body   :', report.includes('db timeout') ? 'YES' : 'NO');
  console.log('real req body   :', report.includes('"user":"abc"') ? 'YES' : 'NO');
  console.log('fps dips noted  :', report.includes('Severe drops') ? 'YES' : 'NO');

  const fixReport = await call('pinmark_suggest_perf_fix', 'e2e-real-1');
  console.log('── MCP FIX SUGGESTION (all diagnostics) ──');
  console.log('── FIX CHECKS ──');
  console.log('network section  :', fixReport.includes('Network Failures') ? 'YES' : 'NO');
  console.log('state section    :', fixReport.includes('State Snapshot') ? 'YES' : 'NO');
  console.log('a11y section     :', fixReport.includes('Accessibility Issues') ? 'YES' : 'NO');
  console.log('real err body    :', fixReport.includes('db timeout') ? 'YES' : 'NO');

  const stateReport = await call('pinmark_get_state_snapshot', 'e2e-real-1');
  console.log('── MCP STATE SNAPSHOT (real data) ──');
  console.log(stateReport.split('\n').slice(0, 14).join('\n'));
  console.log('── STATE CHECKS ──');
  console.log('detected redux :', stateReport.includes('redux') ? 'YES' : 'NO');
  console.log('real user name :', stateReport.includes('Acer Dev') ? 'YES' : 'NO');
  console.log('vuex present   :', stateReport.includes('vuex') ? 'YES' : 'NO');
  console.log('zustand present:', stateReport.includes('zustand') ? 'YES' : 'NO');
  console.log('circular-safe  :', stateReport.includes('[circular]') ? 'YES' : 'NO');

// Pin 2: window.store removed → StateSniffer falls back to the React Provider fiber walk
await page.evaluate(() => { delete (window as any).store; });
const pin2 = await dropPin('#card-2', 'E2E pin 2 - fiber walk');
if (pin2.error) {
  console.error('[e2e] PIN 2 FAILED:', pin2.error, pin2.html || '');
} else {
  const ss2 = pin2.item.stateSnapshot;
  console.log('── E2E RESULTS (pin 2, no window.store) ──');
  console.log('state detected:', ss2 ? ss2.detected.join(', ') : 'NONE');
  console.log('  redux via provider:', ss2?.snapshot?.redux ? JSON.stringify(ss2.snapshot.redux) : 'MISSING');
}

// Pin 3: WCAG 2.1 micro-a11y audit on a card with known violations
const pin3 = await dropPin('#card-a11y', 'E2E pin 3 - a11y audit');
if (pin3.error) {
  console.error('[e2e] PIN 3 FAILED:', pin3.error, pin3.html || '');
} else {
  const issues: any[] = pin3.item.a11yIssues || [];
  const types = issues.map((i: any) => i.type);
  console.log('── E2E RESULTS (pin 3, a11y audit) ──');
  console.log('issue count:', issues.length);
  issues.forEach((i: any) => console.log(`  [${i.severity}] ${i.type} (${i.wcag}): ${i.message}`));
  console.log('── A11Y CHECKS ──');
  console.log('contrast fail  :', types.includes('contrast') ? 'YES' : 'NO');
  console.log('img alt missing:', types.includes('image-alt') ? 'YES' : 'NO');
  console.log('unnamed button :', types.includes('button-name') ? 'YES' : 'NO');
  console.log('unlabeled input:', types.includes('label') ? 'YES' : 'NO');
  console.log('tabindex >0    :', types.includes('tabindex') ? 'YES' : 'NO');

  session.annotations.push({ ...pin3.item, id: 'e2e-real-3' });
  const a11yReport = await call('pinmark_audit_a11y', 'e2e-real-3');
  console.log('── MCP A11Y AUDIT (real data) ──');
  console.log(a11yReport.split('\n').slice(0, 22).join('\n'));
  console.log('── A11Y MCP CHECKS ──');
  console.log('5 issues listed :', a11yReport.includes('5 issue(s)') ? 'YES' : 'NO');
  console.log('contrast wcag   :', a11yReport.includes('1.4.3') ? 'YES' : 'NO');
  console.log('tabindex wcag   :', a11yReport.includes('2.4.3') ? 'YES' : 'NO');
  console.log('fix hints       :', a11yReport.includes('Fix:') ? 'YES' : 'NO');
}

// Pin 4: contextual error stack-tracing — real TypeError + unhandled rejection
// (synthetic dispatch: the listener still throws and window.onerror fires, but the
//  overlay's hover-driven annotation modal is not triggered by button clicks)
await page.evaluate(() => {
  document.getElementById('btn-throw').dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await new Promise((r) => setTimeout(r, 200));
await page.evaluate(() => {
  document.getElementById('btn-reject').dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await new Promise((r) => setTimeout(r, 300));
const pin4 = await dropPin('#card-errors', 'E2E pin 4 - error trace');
if (pin4.error) {
  console.error('[e2e] PIN 4 FAILED:', pin4.error, pin4.html || '');
} else {
  const trace: any[] = pin4.item.errorTrace || [];
  const types = trace.map((e: any) => e.type);
  const throwErr = trace.find((e: any) => e.name === 'TypeError');
  const rejectErr = trace.find((e: any) => e.name === 'RangeError');
  const frames = throwErr?.stack || [];
  console.log('── E2E RESULTS (pin 4, error trace) ──');
  console.log('captured errors:', trace.length);
  trace.forEach((e: any) => console.log(`  [${e.type}] ${e.name}: ${e.message}`));
  console.log('  throw frame   :', frames.find((f: any) => f.fn === 'innermost') ? `${frames.find((f: any) => f.fn === 'innermost').file}:${frames.find((f: any) => f.fn === 'innermost').line}` : 'MISSING');
  console.log('── ERROR TRACE CHECKS ──');
  console.log('type=error        :', types.includes('error') ? 'YES' : 'NO');
  console.log('type=rejection    :', types.includes('unhandledrejection') ? 'YES' : 'NO');
  console.log('throw msg captured:', throwErr?.message?.includes('cannot read') ? 'YES' : 'NO');
  console.log('reject msg captured:', rejectErr?.message?.includes('out of range') ? 'YES' : 'NO');
  console.log('stack frames parsed:', frames.length > 0 ? `${frames.length} frames` : 'NO');

  session.annotations.push({ ...pin4.item, id: 'e2e-real-4' });
  const traceReport = await call('pinmark_trace_errors', 'e2e-real-4');
  console.log('── MCP ERROR TRACE (real data) ──');
  console.log(traceReport.split('\n').slice(0, 16).join('\n'));
  console.log('── TRACE MCP CHECKS ──');
  console.log('2 errors listed :', traceReport.includes('2 error(s)') ? 'YES' : 'NO');
  console.log('typeError named :', traceReport.includes('TypeError') ? 'YES' : 'NO');
  console.log('rejection named :', traceReport.includes('RangeError') ? 'YES' : 'NO');
  console.log('age correlation :', traceReport.includes('before pin') ? 'YES' : 'NO');
  console.log('trace hint      :', traceReport.includes('Trace hint') ? 'YES' : 'NO');

  const fixReport4 = await call('pinmark_suggest_perf_fix', 'e2e-real-4');
  console.log('── FIX SUGGESTION (pin 4, error trace) ──');
  console.log('── FIX4 CHECKS ──');
  console.log('errors section  :', fixReport4.includes('Runtime Errors') ? 'YES' : 'NO');
  console.log('stack frame loc :', fixReport4.includes('first frame') ? 'YES' : 'NO');
  console.log('root-cause fmt  :', fixReport4.includes('Root cause') ? 'YES' : 'NO');

  const triage4 = pin4.item.triage;
  console.log('── TRIAGE (pin 4) ──');
  console.log('classification :', triage4 ? `${triage4.category}/${triage4.intent}/${triage4.severity}` : 'MISSING');
  console.log('error evidence :', triage4?.reasons?.some((r: string) => r.includes('runtime error')) ? 'YES' : 'NO');
  const triageReport = await call('pinmark_triage', 'e2e-real-4');
  console.log('── MCP TRIAGE (real data) ──');
  console.log(triageReport.split('\n').slice(0, 10).join('\n'));
  console.log('── TRIAGE MCP CHECKS ──');
  console.log('classification :', triageReport.includes('bug / fix /') ? 'YES' : 'NO');
  console.log('evidence listed:', triageReport.includes('Evidence:') ? 'YES' : 'NO');
  console.log('action line    :', triageReport.includes('Action:') ? 'YES' : 'NO');
}

console.log('── PAGE ERRORS (2 intentional from pin 4 expected) ──');
console.log(pageErrors.length ? pageErrors.join('\n') : '(none)');
console.log('── CONSOLE ERRORS ──');
console.log(consoleErrors.length ? consoleErrors.join('\n') : '(none)');

api.close();
await browser.close();
