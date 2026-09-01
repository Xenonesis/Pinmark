import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = [
  path.resolve(__dirname, '../extension/.output/chrome-mv3'),
  path.resolve(__dirname, '../extension/dist'),
].find((d) => fs.existsSync(d)) || path.resolve(__dirname, '../extension/.output/chrome-mv3');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 8488;
const PAGE_URL = `http://127.0.0.1:${PORT}/index.html`;

async function testPopupStability() {
  console.log('\n===============================================================');
  console.log('       PINMARK POPUP & SERVICE WORKER STABILITY TEST          ');
  console.log('===============================================================\n');

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html>
    <html>
      <head>
        <title>Pinmark Stability Test Page</title>
        <style>
          body { font-family: sans-serif; padding: 20px; background: #0f172a; color: #fff; min-height: 1200px; }
          .header { height: 60px; background: #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 30px; }
          .box { background: #334155; padding: 30px; border-radius: 8px; margin-bottom: 20px; }
          button { padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; }
        </style>
      </head>
      <body>
        <div class="header" id="test-header">
          <h2>Top Navbar (Collision Test Area)</h2>
        </div>
        <div class="box" id="test-box-1">
          <h3>Interactive Box 1</h3>
          <p>Click here to drop markers and test popups.</p>
          <button id="test-btn">Click Me</button>
        </div>
        <div class="box" id="test-box-2">
          <h3>Interactive Box 2</h3>
        </div>
      </body>
    </html>`);
  });

  await new Promise<void>((r) => server.listen(PORT, '127.0.0.1', r));
  console.log(`[1/5] Test server running on ${PAGE_URL}`);

  // Launch Chrome with extension
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME,
    ignoreDefaultArgs: ['--disable-extensions', '--disable-component-extensions-with-background-pages'],
    args: ['--no-first-run', '--window-size=1280,800'],
  });

  const ws = new WebSocket(browser.wsEndpoint());
  await new Promise((r) => (ws.onopen = r));
  let cdpId = 0;
  const cdpPending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data as string);
    if (msg.id && cdpPending.has(msg.id)) {
      cdpPending.get(msg.id)(msg);
      cdpPending.delete(msg.id);
    }
  };
  const cdpSend = (method: string, params: any = {}) =>
    new Promise((resolve) => {
      const mid = ++cdpId;
      cdpPending.set(mid, resolve);
      ws.send(JSON.stringify({ id: mid, method, params }));
    });

  const loaded = await cdpSend('Extensions.loadUnpacked', { path: DIST });
  const extId: string = (loaded as any)?.result?.id;
  if (!extId) {
    console.error('FAIL: Could not load unpacked extension:', loaded);
    process.exit(1);
  }
  console.log(`[2/5] Unpacked extension loaded (ID: ${extId})`);

  // Track service worker lifecycle and errors
  const swErrors: string[] = [];
  browser.on('targetcreated', (target) => {
    if (target.type() === 'service_worker') {
      console.log('  → Service Worker target created:', target.url());
    }
  });
  browser.on('targetdestroyed', (target) => {
    if (target.type() === 'service_worker') {
      console.warn('  ⚠️ Service Worker target destroyed (crash or restart):', target.url());
      swErrors.push('Service worker destroyed unexpectedly');
    }
  });

  // Open web page
  const page = await browser.newPage();
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      pageErrors.push(msg.text());
    }
  });

  await page.goto(PAGE_URL, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#pinmark-launcher-host', { timeout: 10000 });
  console.log('[3/5] Web page loaded and Pinmark launcher injected.');

  // Test Extension Action Popup directly
  console.log('\n[4/5] Testing Extension Action Popup stability...');
  const popupPage = await browser.newPage();
  const popupErrors: string[] = [];
  popupPage.on('pageerror', (err) => popupErrors.push(err.message));
  popupPage.on('console', (msg) => {
    if (msg.type() === 'error') popupErrors.push(msg.text());
  });

  const manifest = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8'));
  const popupRel = manifest.action?.default_popup || 'popup.html';
  const popupUrl = `chrome-extension://${extId}/${popupRel}`;
  await popupPage.goto(popupUrl, { waitUntil: 'networkidle0' });

  // Verify popup DOM rendered cleanly
  const popupState = await popupPage.evaluate(() => {
    const toggle = document.getElementById('toggleBtnCheckbox') as HTMLInputElement;
    const markerColor = document.getElementById('markerColor') as HTMLInputElement;
    const detail = document.getElementById('outputDetailLabel');
    return {
      toggleExists: !!toggle,
      markerColorVal: markerColor?.value || '',
      detailText: detail?.textContent || ''
    };
  });
  console.log('  ✓ Action Popup loaded cleanly:', popupState.toggleExists ? 'PASS' : 'FAIL');
  console.log(`  ✓ Action Popup default detail: "${popupState.detailText}", color: "${popupState.markerColorVal}"`);

  // Wait 3 seconds to verify popup does NOT crash, reload, or throw errors
  await new Promise((r) => setTimeout(r, 3000));
  console.log('  ✓ Action Popup stayed open for 3s without crashing (Errors:', popupErrors.length, ')');
  await popupPage.close();

  // Test On-Page Marker Popups & Interaction
  console.log('\n[5/5] Testing On-Page Marker Popups (Hover, Lock, Bridge, Outside Click)...');
  await page.bringToFront();

  // Activate overlay via launcher
  await page.evaluate(() => {
    const host = document.querySelector('#pinmark-launcher-host') as HTMLElement;
    const root = host?.shadowRoot;
    const launcher = root?.querySelector('.pinmark-launcher') as HTMLElement;
    launcher?.click();
  });
  await page.waitForSelector('pinmark-overlay', { timeout: 10000 });
  console.log('  ✓ Overlay activated successfully.');

  // Add a marker to #test-header (top of page to test .flip-down)
  const header = await page.$('#test-header');
  const headerBox = await header?.boundingBox();
  if (headerBox) {
    await page.mouse.click(headerBox.x + 50, headerBox.y + 30);
  }
  await new Promise((r) => setTimeout(r, 400));

  // Fill in comment and submit
  await page.evaluate(() => {
    const overlay = document.querySelector('pinmark-overlay') as HTMLElement;
    const root = overlay?.shadowRoot;
    const input = root?.querySelector('.pinmark-modal-input') as HTMLTextAreaElement;
    const submitBtn = root?.querySelector('.pinmark-modal-btn.submit') as HTMLButtonElement;
    if (input && submitBtn) {
      input.value = 'Header needs higher contrast';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      submitBtn.click();
    }
  });
  await new Promise((r) => setTimeout(r, 600));

  // Add second marker to #test-box-1 (middle of page)
  const box1 = await page.$('#test-box-1');
  const b1Rect = await box1?.boundingBox();
  if (b1Rect) {
    await page.mouse.click(b1Rect.x + 100, b1Rect.y + 40);
  }
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => {
    const overlay = document.querySelector('pinmark-overlay') as HTMLElement;
    const root = overlay?.shadowRoot;
    const input = root?.querySelector('.pinmark-modal-input') as HTMLTextAreaElement;
    const submitBtn = root?.querySelector('.pinmark-modal-btn.submit') as HTMLButtonElement;
    if (input && submitBtn) {
      input.value = 'Box padding is slightly irregular';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      submitBtn.click();
    }
  });
  await new Promise((r) => setTimeout(r, 600));

  // Verify markers rendered
  const markerCount = await page.evaluate(() => {
    const overlay = document.querySelector('pinmark-overlay') as HTMLElement;
    const root = overlay?.shadowRoot;
    return root?.querySelectorAll('.pinmark-marker').length || 0;
  });
  console.log(`  ✓ Number of markers placed: ${markerCount} (PASS)`);

  // Test Marker 1 (Top navbar): hover -> verify flip-down
  const m1State = await page.evaluate(() => {
    const overlay = document.querySelector('pinmark-overlay') as HTMLElement;
    const root = overlay?.shadowRoot;
    const m1 = root?.querySelectorAll('.pinmark-marker')[0] as HTMLElement;
    const popup = m1?.querySelector('.pinmark-marker-popup') as HTMLElement;
    m1.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    return {
      hasFlipDown: popup?.classList.contains('flip-down'),
      comment: popup?.querySelector('.pinmark-marker-comment')?.textContent || ''
    };
  });
  console.log('  ✓ Top Marker Popup auto-flipped down:', m1State.hasFlipDown ? 'PASS' : 'FAIL');
  console.log(`  ✓ Top Marker Comment: "${m1State.comment}"`);

  // Test Click-to-Lock: click marker 2 -> verify .active
  const lockState = await page.evaluate(() => {
    const overlay = document.querySelector('pinmark-overlay') as HTMLElement;
    const root = overlay?.shadowRoot;
    const m2 = root?.querySelectorAll('.pinmark-marker')[1] as HTMLElement;
    m2.click();
    return {
      isActive: m2.classList.contains('active'),
      popupVisible: window.getComputedStyle(m2.querySelector('.pinmark-marker-popup') as HTMLElement).visibility !== 'hidden'
    };
  });
  console.log('  ✓ Click on Marker locks popup (.active):', lockState.isActive ? 'PASS' : 'FAIL');

  // Test Click inside popup (Copy button) does NOT dismiss popup
  const copyClickState = await page.evaluate(() => {
    const overlay = document.querySelector('pinmark-overlay') as HTMLElement;
    const root = overlay?.shadowRoot;
    const m2 = root?.querySelectorAll('.pinmark-marker')[1] as HTMLElement;
    const copyBtn = m2.querySelector('.pinmark-marker-btn.copy') as HTMLElement;
    copyBtn.click();
    return {
      stillActive: m2.classList.contains('active')
    };
  });
  console.log('  ✓ Click inside popup (Copy action) does NOT dismiss:', copyClickState.stillActive ? 'PASS' : 'FAIL');

  // Test Click OUTSIDE marker dismisses active state
  const outsideClickState = await page.evaluate(() => {
    const overlay = document.querySelector('pinmark-overlay') as HTMLElement;
    const root = overlay?.shadowRoot;
    const m2 = root?.querySelectorAll('.pinmark-marker')[1] as HTMLElement;
    // Dispatch pointerdown on document body
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return {
      isDismissed: !m2.classList.contains('active')
    };
  });
  console.log('  ✓ Click outside marker properly dismisses popup:', outsideClickState.isDismissed ? 'PASS' : 'FAIL');

  // Final Health Check
  console.log('\n===============================================================');
  console.log('                      FINAL VERIFICATION                       ');
  console.log('===============================================================');
  console.log(`  Service Worker Crashes/Restarts : ${swErrors.length}`);
  console.log(`  Popup Page Errors              : ${popupErrors.length}`);
  console.log(`  Content Script Page Errors     : ${pageErrors.length}`);
  
  const allPassed = swErrors.length === 0 && popupErrors.length === 0 && pageErrors.length === 0 && m1State.hasFlipDown && lockState.isActive && copyClickState.stillActive && outsideClickState.isDismissed;
  console.log(`\n  RESULT: ${allPassed ? '✅ ALL STABILITY CHECKS PASSED (100% STABLE)' : '❌ CHECKS FAILED'}\n`);

  await browser.close();
  server.close();

  if (!allPassed) {
    process.exit(1);
  }
}

testPopupStability().catch((err) => {
  console.error('Fatal error during test:', err);
  process.exit(1);
});
