import puppeteer from 'puppeteer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.resolve(__dirname, '../../store-assets');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function generatePromoTiles() {
    console.log('Generating Promo Tiles for Chrome Web Store...');
    const browser = await puppeteer.launch({ headless: "new", args: ['--force-device-scale-factor=1'] });

    // --- 1. Small Promo Tile (440x280) ---
    const page1 = await browser.newPage();
    await page1.setViewport({ width: 440, height: 280, deviceScaleFactor: 1 });
    
    const smallPromoHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@800&display=swap');
            body { 
                margin: 0; width: 440px; height: 280px; 
                background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                font-family: 'Inter', sans-serif; color: white;
                box-sizing: border-box; border: 2px solid #312e81;
            }
            .logo-container {
                display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
            }
            .icon {
                width: 48px; height: 48px; background: #6366f1; border-radius: 12px;
                display: flex; align-items: center; justify-content: center;
                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
            }
            .icon::before { content: '📍'; font-size: 24px; }
            h1 { font-size: 42px; margin: 0; letter-spacing: -1px; }
            p { font-size: 16px; color: #a5b4fc; margin: 0; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
        </style>
    </head>
    <body>
        <div class="logo-container">
            <div class="icon"></div>
            <h1>Pinmark</h1>
        </div>
        <p>AI-Native Bug Reporting</p>
    </body>
    </html>
    `;
    await page1.setContent(smallPromoHtml);
    await page1.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_small_promo_440x280.png') });
    console.log('Saved: 03_small_promo_440x280.png');


    // --- 2. Marquee Promo Tile (1400x560) ---
    const page2 = await browser.newPage();
    await page2.setViewport({ width: 1400, height: 560, deviceScaleFactor: 1 });
    
    const marqueeHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@600;800&family=JetBrains+Mono:wght@400&display=swap');
            body { 
                margin: 0; width: 1400px; height: 560px; 
                background: radial-gradient(circle at 30% 50%, #1e1b4b 0%, #0f172a 100%);
                display: flex; align-items: center; justify-content: space-between;
                font-family: 'Inter', sans-serif; padding: 0 100px; box-sizing: border-box;
                overflow: hidden;
            }
            .text-content { max-width: 600px; z-index: 10; }
            .badge {
                display: inline-block; background: rgba(99, 102, 241, 0.2); border: 1px solid #6366f1;
                color: #a5b4fc; padding: 6px 12px; border-radius: 20px; font-weight: bold; font-size: 14px;
                margin-bottom: 24px; text-transform: uppercase; letter-spacing: 1px;
            }
            h1 { font-size: 72px; color: #fff; margin: 0 0 24px 0; line-height: 1.1; letter-spacing: -2px; }
            p { font-size: 28px; color: #cbd5e1; margin: 0; line-height: 1.4; }
            .code-window {
                width: 500px; height: 350px; background: #09090b; border-radius: 12px;
                border: 1px solid #27272a; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
                display: flex; flex-direction: column; overflow: hidden;
                transform: perspective(1000px) rotateY(-15deg) rotateX(5deg);
            }
            .code-header {
                height: 40px; background: #18181b; border-bottom: 1px solid #27272a;
                display: flex; align-items: center; padding: 0 16px; gap: 8px;
            }
            .dot { width: 12px; height: 12px; border-radius: 50%; background: #3f3f46; }
            .dot.red { background: #ef4444; }
            .dot.yellow { background: #eab308; }
            .dot.green { background: #22c55e; }
            .code-body {
                padding: 24px; font-family: 'JetBrains Mono', monospace; font-size: 16px;
                color: #a1a1aa; line-height: 1.6;
            }
            .keyword { color: #c678dd; }
            .string { color: #98c379; }
            .func { color: #61afef; }
        </style>
    </head>
    <body>
        <div class="text-content">
            <div class="badge">Built for AI Agents</div>
            <h1>Drop a pin.<br>Let AI fix the bug.</h1>
            <p>Visual bug reporting that captures Redux state, network 500s, and traces for your local MCP server.</p>
        </div>
        <div class="code-window">
            <div class="code-header">
                <div class="dot red"></div><div class="dot yellow"></div><div class="dot green"></div>
            </div>
            <div class="code-body">
                <div><span class="keyword">const</span> <span class="func">diagnostics</span> = {</div>
                <div style="padding-left: 20px;">element: <span class="string">'#checkout-btn'</span>,</div>
                <div style="padding-left: 20px;">network: [<span class="string">'HTTP 500: /api/pay'</span>],</div>
                <div style="padding-left: 20px;">state: {</div>
                <div style="padding-left: 40px;">redux: <span class="string">'cart_empty'</span></div>
                <div style="padding-left: 20px;">},</div>
                <div style="padding-left: 20px;">a11y: [<span class="string">'WCAG 1.4.3'</span>]</div>
                <div>};</div>
                <div style="margin-top: 20px;"><span class="keyword">await</span> <span class="func">mcp.sync</span>(diagnostics);</div>
            </div>
        </div>
    </body>
    </html>
    `;
    await page2.setContent(marqueeHtml);
    await page2.screenshot({ path: path.join(SCREENSHOTS_DIR, '04_marquee_promo_1400x560.png') });
    console.log('Saved: 04_marquee_promo_1400x560.png');

    await browser.close();
}

generatePromoTiles().catch(console.error);
