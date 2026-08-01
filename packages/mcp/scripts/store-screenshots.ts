import puppeteer from 'puppeteer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import serveHandler from 'serve-handler';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT_DIST = path.resolve(__dirname, '../../extension/dist');
const SCREENSHOTS_DIR = path.resolve(__dirname, '../../store-assets');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Ensure the extension is built
if (!fs.existsSync(path.join(EXT_DIST, 'manifest.json'))) {
    console.error('Error: Extension not built. Run pnpm build first.');
    process.exit(1);
}

const sleep = (ms: number) => {
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, ms);
    return promise;
};

async function generateScreenshots() {
    console.log('Launching browser for Store Screenshots...');
    
    // We launch a clean browser for screenshots
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--window-size=1280,800',
            '--disable-extensions-except=' + EXT_DIST,
            '--load-extension=' + EXT_DIST,
            '--hide-scrollbars',
            '--force-device-scale-factor=1'
        ]
    });

    // ── SHOT 1: The Overlay Action ──
    const page1 = await browser.newPage();
    await page1.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    
    const dashboardHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            body { margin: 0; font-family: -apple-system, system-ui, sans-serif; background: #0f1115; color: #fff; }
            .header { height: 60px; border-bottom: 1px solid #222; display: flex; align-items: center; padding: 0 24px; font-weight: bold; font-size: 18px; }
            .content { padding: 40px; display: grid; grid-template-columns: 250px 1fr; gap: 40px; }
            .sidebar .item { height: 32px; background: #1a1d24; border-radius: 4px; margin-bottom: 12px; }
            .main { background: #1a1d24; border-radius: 8px; border: 1px solid #333; padding: 40px; min-height: 400px; }
            .chart { height: 200px; background: linear-gradient(to right, #2a2d34, #1a1d24); border-radius: 4px; margin-bottom: 24px; border: 1px solid #333; }
            .btn { background: #3b82f6; color: #fff; padding: 8px 16px; border-radius: 4px; border: none; font-weight: bold; display: inline-block; }
            .btn-broken { background: #ef4444; }
        </style>
    </head>
    <body>
        <div class="header">Dashboard Pro</div>
        <div class="content">
            <div class="sidebar">
                <div class="item" style="width: 80%;"></div>
                <div class="item" style="width: 60%;"></div>
                <div class="item" style="width: 90%;"></div>
            </div>
            <div class="main">
                <h1 style="margin-top: 0;">Analytics Overview</h1>
                <div class="chart"></div>
                <button class="btn btn-broken" id="target-btn" style="cursor: pointer;">Export Data (Fails)</button>
                <button class="btn" style="margin-left: 12px; background: #333;">Settings</button>
            </div>
        </div>
    </body>
    </html>
    `;

    const targetPath = path.join(EXT_DIST, 'screenshot-target.html');
    fs.writeFileSync(targetPath, dashboardHtml);

    // To load extension scripts in dummy page, we need a small inline server serving EXT_DIST
    const server = http.createServer((req, res) => {
        // serve the dist folder
        return serveHandler(req, res, { public: EXT_DIST });
    });
    server.listen(8199);
    
    console.log('Rendering Shot 1: The Visual Pin...');
    await page1.goto('http://localhost:8199/screenshot-target.html', { waitUntil: 'networkidle0' });
    await sleep(500); // let it boot
    
    // Force active state
    await page1.evaluate(() => {
        if (typeof window !== 'undefined' && 'postMessage' in window) {
            window.postMessage({ type: 'PINMARK_SET_STATE', payload: { active: true } }, '*');
        }
    });
    
    await sleep(500);
    
    // Simulate dropping a pin
    await page1.hover('#target-btn');
    await sleep(300);
    await page1.click('#target-btn');
    await page1.evaluate(() => {
        const o = document.querySelector('pinmark-overlay');
        if (o && o.shadowRoot) {
            const input = o.shadowRoot.querySelector('textarea.pinmark-modal-input') as HTMLTextAreaElement;
            if (input) {
                input.value = 'This button throws a 500 error when clicked. Need a fix!';
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    });
    await sleep(300);
    
    // Capture Shot 1
    const shot1Path = path.join(SCREENSHOTS_DIR, '01_visual_pin.png');
    await page1.screenshot({ path: shot1Path });
    console.log(`Saved: ${shot1Path}`);


    // ── SHOT 2: The Diagnostic Popup in a Promo Frame ──
    console.log('Rendering Shot 2: Deep Diagnostics Popup...');
    const page2 = await browser.newPage();
    await page2.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    
    // Read popup HTML to inline it in a beautiful frame
    let popupHtml = fs.readFileSync(path.join(EXT_DIST, 'src/popup/index.html'), 'utf-8');
    // Fix paths so it loads correctly from our local server
    popupHtml = popupHtml.replace(/src="\//g, 'src="http://localhost:8199/');
    popupHtml = popupHtml.replace(/href="\//g, 'href="http://localhost:8199/');

    const promoHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
            body { 
                margin: 0; 
                width: 1280px; 
                height: 800px; 
                background: linear-gradient(135deg, #111827 0%, #1f2937 100%);
                font-family: 'Inter', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            }
            .container {
                display: flex;
                align-items: center;
                justify-content: space-between;
                width: 1100px;
            }
            .text-content {
                color: #fff;
                max-width: 500px;
            }
            h1 {
                font-size: 56px;
                line-height: 1.1;
                margin: 0 0 24px 0;
                background: linear-gradient(to right, #60a5fa, #a78bfa);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            p {
                font-size: 24px;
                color: #9ca3af;
                line-height: 1.5;
                margin: 0;
            }
            .extension-window {
                width: 420px;
                height: 600px;
                background: #0f1115; /* Same as popup bg */
                border-radius: 12px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.1);
                overflow: hidden;
                position: relative;
            }
            .extension-header {
                height: 32px;
                background: #1f2937;
                display: flex;
                align-items: center;
                padding: 0 12px;
                gap: 6px;
                border-bottom: 1px solid #374151;
            }
            .dot { width: 10px; height: 10px; border-radius: 50%; background: #4b5563; }
            .extension-content {
                width: 100%;
                height: calc(100% - 32px);
                border: none;
            }
            .feature-list {
                margin-top: 40px;
                list-style: none;
                padding: 0;
            }
            .feature-list li {
                font-size: 20px;
                color: #d1d5db;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                gap: 12px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="text-content">
                <h1>Deep Context for AI Agents</h1>
                <p>Pinmark automatically captures the hidden context behind every bug.</p>
                <ul class="feature-list">
                    <li>✅ Redux & Vuex State Snapshots</li>
                    <li>✅ Failed Network Requests (HTTP 500s)</li>
                    <li>✅ Runtime Error Stack Traces</li>
                    <li>✅ Local MCP Sync</li>
                </ul>
            </div>
            <div class="extension-window">
                <div class="extension-header">
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>
                </div>
                <iframe class="extension-content" src="http://localhost:8199/src/popup/index.html"></iframe>
            </div>
        </div>
    </body>
    </html>
    `;

    // Stub the chrome API inside the popup iframe so it renders rich data
    await page2.evaluateOnNewDocument(`
        window.chrome = {
            tabs: { query: async () => [{ id: 1, url: 'https://example.com' }] },
            storage: {
                local: {
                    get: async () => ({
                        'annotations_https://example.com': [{
                            id: 'fake-1',
                            index: 1,
                            comment: 'Export fails on large datasets',
                            element: { selector: '#target-btn', tagName: 'button' },
                            performanceMetrics: [{ entryType: 'longtask', duration: 350 }],
                            networkRequests: [{ url: '/api/export', method: 'POST', status: 500, isError: true }],
                            errorTrace: [{ type: 'error', name: 'TypeError', message: 'data is undefined', location: 'app.js' }],
                            a11yIssues: [{ type: 'contrast', message: 'Low contrast' }],
                            triage: { category: 'bug', severity: 'blocking', summary: 'Export button triggers 500 error and long task.' }
                        }]
                    })
                }
            }
        };
    `);

    await page2.setContent(promoHtml, { waitUntil: 'networkidle0' });
    await sleep(1000); // Wait for iframe to load and render React
    
    // Expand the details in the popup (the popup is inside an iframe)
    const frame = page2.frames().find(f => f.url().includes('src/popup/index.html'));
    if (frame) {
        // Ensure data is loaded
        await sleep(500);
        try {
            await frame.evaluate(() => {
                document.querySelectorAll('details').forEach(d => d.open = true);
            });
            await sleep(500);
        } catch(e) {}
    }

    const shot2Path = path.join(SCREENSHOTS_DIR, '02_deep_diagnostics.png');
    await page2.screenshot({ path: shot2Path });
    console.log(`Saved: ${shot2Path}`);

    // Cleanup
    if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
    server.close();
    await browser.close();
    console.log('✅ Store screenshots generated successfully in /store-assets');
}

generateScreenshots().catch(e => {
    console.error('Failed to generate screenshots:', e);
    process.exit(1);
});
