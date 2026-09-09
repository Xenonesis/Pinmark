import puppeteer from 'puppeteer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import serveHandler from 'serve-handler';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT_DIST = path.resolve(__dirname, '../extension/.output/chrome-mv3');

const sleep = (ms: number) => {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
};

async function testKeyboard() {
  console.log('E2E Keyboard Test: Start');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--disable-extensions-except=' + EXT_DIST,
      '--load-extension=' + EXT_DIST,
    ],
    ignoreDefaultArgs: ['--disable-extensions', '--disable-component-extensions-with-background-pages']
  });

  const page = await browser.newPage();
  
  const server = http.createServer((req, res) => {
    if (req.url === '/test.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <body>
          <button id="btn" style="padding: 20px; font-size: 20px; margin: 100px;">Click Me</button>
          <script>
            // Host page aggressively blocks typing in capture phase UNLESS target is an input or contentEditable
            window.addEventListener('keydown', (e) => {
              const target = e.target;
              const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
              if (!isInput) {
                e.preventDefault();
                e.stopPropagation();
              }
            }, true);
          </script>
        </body>
        </html>
      `);
      return;
    }
    return serveHandler(req, res, { public: EXT_DIST });
  });
  
  const { promise: serverReady, resolve: resolveServer } = Promise.withResolvers<void>();
  server.listen(8199, () => resolveServer());
  await serverReady;

  await page.goto('http://localhost:8199/test.html', { waitUntil: 'load' });
  await sleep(1000); // Wait for extension injection

  // Activate extension
  await page.evaluate(() => {
    if (typeof window !== 'undefined' && 'postMessage' in window) {
      window.postMessage({ type: 'PINMARK_SET_STATE', payload: { active: true } }, '*');
    }
  });

  await sleep(1000);

  // Click launcher
  const launcherHandle = await page.evaluateHandle(() => {
    const host = document.querySelector('#pinmark-launcher-host');
    if (host && host.shadowRoot) {
      return host.shadowRoot.querySelector('.pinmark-launcher');
    }
    return null;
  });
  
  if (launcherHandle) {
    const launcherEl = launcherHandle.asElement();
    if (launcherEl) await launcherEl.click();
  } else {
    console.log('No launcher found!');
  }
  
  await sleep(500);
  
  // Click target button to drop the pin
  const btn = await page.$('#btn');
  await btn?.click();

  await sleep(500);

  // Focus textarea directly via JS inside the page
  await page.evaluate(() => {
    const o = document.querySelector('pinmark-overlay');
    if (o && o.shadowRoot) {
      const input = o.shadowRoot.querySelector('textarea.pinmark-modal-input');
      (input as HTMLElement)?.focus();
    }
  });
  
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  console.log('Typing:', alphabet);
  await page.keyboard.type(alphabet, { delay: 10 });

  await sleep(500);

  // Verify result
  const resultText = await page.evaluate(() => {
    const o = document.querySelector('pinmark-overlay');
    if (!o || !o.shadowRoot) return '';
    const input = o.shadowRoot.querySelector('textarea.pinmark-modal-input') as HTMLTextAreaElement | null;
    return input ? input.value : '';
  });

  console.log('Text in textarea:', resultText);
  
  if (resultText === alphabet) {
    console.log('✅ ALL ALPHABETS TYPED SUCCESSFULLY (Bypassed aggressive host page listener)');
  } else {
    console.log('❌ TEST FAILED. Missing letters!');
    console.log('Expected:', alphabet);
    console.log('Actual:  ', resultText);
  }

  await browser.close();
  server.close();
}

testKeyboard().catch(e => {
  console.error(e);
  process.exit(1);
});
