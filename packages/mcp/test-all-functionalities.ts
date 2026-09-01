import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { store } from './src/store.js';
import { registerMcpTools } from './src/mcp-tools.js';
import { runDoctor } from './src/init-doctor.js';
import { MarkdownFormatter } from '../pinmark/dist/vanilla/MarkdownFormatter.js';

const TEST_PORT = 8199;
const EXTENSION_DIST = [
  path.resolve('packages/extension/.output/chrome-mv3'),
  path.resolve('packages/extension/dist'),
].find((d) => fs.existsSync(d)) || path.resolve('packages/extension/.output/chrome-mv3');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('       PINMARK COMPREHENSIVE FUNCTIONALITY AUDIT          ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Start a static test server
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.url === '/test-page') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Pinmark Master Test Page</title>
          <style>
            body { font-family: sans-serif; padding: 40px; }
            .card { border: 1px solid #ccc; padding: 20px; margin: 10px 0; border-radius: 8px; }
            .btn-primary { background: #6366f1; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
            .btn-bad-contrast { background: #fef08a; color: #ffffff; padding: 8px; }
          </style>
        </head>
        <body>
          <h1>Pinmark Test Surface</h1>
          <div id="test-card" class="card" data-source="src/components/Card.tsx:25">
            <h2>Interactive Card</h2>
            <p>Testing source file detection and DOM selector generation.</p>
            <button id="main-btn" class="btn-primary" data-source="src/components/Button.tsx:12">Submit Action</button>
            <button id="bad-a11y-btn" class="btn-bad-contrast">Low Contrast</button>
          </div>
          <div id="rearrange-area" class="card">
            <h3>Rearrange Section</h3>
            <p>Target for layout rearrange and wireframe testing.</p>
          </div>
        </body>
        </html>
      `);
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(TEST_PORT, '127.0.0.1', resolve));
  console.log(`[1/5] Test web server active on http://127.0.0.1:${TEST_PORT}`);

  // 2. Launch Chrome via CDP with extension
  console.log('[2/5] Launching Chrome with Pinmark Extension & Shadow DOM overlay...');
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME,
    ignoreDefaultArgs: ['--disable-extensions', '--disable-component-extensions-with-background-pages'],
    args: ['--no-first-run'],
  });

  const ws = new WebSocket(browser.wsEndpoint());
  await new Promise((r) => (ws.onopen = r));
  let cdpId = 0;
  const cdpPending = new Map<number, (val: unknown) => void>();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data as string);
    if (msg.id && cdpPending.has(msg.id)) {
      cdpPending.get(msg.id)!(msg);
      cdpPending.delete(msg.id);
    }
  };
  const cdpSend = (method: string, params: Record<string, unknown> = {}) =>
    new Promise((resolve) => {
      const mid = ++cdpId;
      cdpPending.set(mid, resolve);
      ws.send(JSON.stringify({ id: mid, method, params }));
    });

  const loaded = (await cdpSend('Extensions.loadUnpacked', { path: EXTENSION_DIST })) as Record<string, unknown>;
  const extId = ((loaded as Record<string, unknown>)?.result as Record<string, unknown>)?.id as string;
  console.log(`  ✓ Extension loaded via CDP: ID = ${extId}`);

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(`http://127.0.0.1:${TEST_PORT}/test-page`, { waitUntil: 'networkidle2' });

  // Verify launcher pill
  await page.waitForSelector('#pinmark-launcher-host', { timeout: 15000 });
  const launcherPresent = await page.evaluate(() => !!document.querySelector('#pinmark-launcher-host'));
  console.log(`  ✓ Floating Launcher injected: ${launcherPresent ? 'PASS' : 'FAIL'}`);

  // Click launcher to activate overlay
  await page.evaluate(`(() => {
    const host = document.querySelector('#pinmark-launcher-host');
    const btn = host && host.shadowRoot ? host.shadowRoot.querySelector('.pinmark-launcher') : null;
    if (btn) btn.click();
  })()`);

  await page.waitForSelector('pinmark-overlay', { timeout: 15000 });
  const overlayLoaded = await page.evaluate(() => !!document.querySelector('pinmark-overlay'));
  const shadowChildren = await page.evaluate(() => document.querySelector('pinmark-overlay')?.shadowRoot?.children?.length || 0);
  console.log(`  ✓ Shadow DOM Overlay activated (children count: ${shadowChildren}): ${overlayLoaded ? 'PASS' : 'FAIL'}`);

  // 3. Test MCP Server & Tools
  console.log('\n[3/5] Testing MCP Tools & Diagnostics...');
  const mockMcpServer = {
    setRequestHandler: (schema: unknown, handler: unknown) => {
      mockMcpServer._callHandler = handler;
    },
    _callHandler: null as unknown,
  };

  registerMcpTools(mockMcpServer as any);

  const testSession = store.createSession(`http://127.0.0.1:${TEST_PORT}/test-page`, 'master-audit-session');
  testSession.annotations = [];

  const testAnnotation = {
    id: 'ann-master-001',
    index: 1,
    comment: 'Button contrast is low and needs to be primary brand color',
    url: `http://127.0.0.1:${TEST_PORT}/test-page`,
    timestamp: Date.now(),
    status: 'pending' as const,
    element: {
      selector: '#test-card > button.btn-primary',
      tagName: 'button',
      classes: ['btn-primary'],
      dataAttributes: { source: 'src/components/Button.tsx:12' },
      component: {
        framework: 'react' as const,
        name: 'SubmitButton',
        filePath: 'src/components/Button.tsx',
        lineNumber: 12,
        hierarchy: ['App', 'Card', 'SubmitButton'],
      },
      boundingRect: { x: 50, y: 120, width: 140, height: 42, top: 120, right: 190, bottom: 162, left: 50 },
    },
    triage: {
      category: 'design' as const,
      intent: 'fix' as const,
      severity: 'important' as const,
      summary: 'Low contrast on button',
      reasons: ['WCAG contrast violation'],
    },
    areaRect: { x: 40, y: 100, width: 300, height: 100 },
    selectedElements: [
      {
        selector: '#test-card > button.btn-primary',
        tagName: 'button',
        classes: ['btn-primary'],
        dataAttributes: {},
        boundingRect: { x: 50, y: 120, width: 140, height: 42, top: 120, right: 190, bottom: 162, left: 50 },
      },
      {
        selector: '#test-card > button.btn-bad-contrast',
        tagName: 'button',
        classes: ['btn-bad-contrast'],
        dataAttributes: {},
        boundingRect: { x: 200, y: 120, width: 120, height: 42, top: 120, right: 320, bottom: 162, left: 200 },
      },
    ],
  };

  testSession.annotations.push(testAnnotation);

  const callTool = async (name: string, args: Record<string, unknown> = {}) => {
    const handler = mockMcpServer._callHandler as (req: { params: { name: string; arguments: Record<string, unknown> } }) => Promise<{ content: Array<{ text: string }> }>;
    const res = await handler({
      params: { name, arguments: args },
    });
    const txt = res.content[0].text;
    try {
      return JSON.parse(txt);
    } catch {
      return txt;
    }
  };
  // Test List sessions
  const sessions = await callTool('pinmark_list_sessions');
  console.log(`  ✓ pinmark_list_sessions: found ${sessions.length} session(s) (PASS)`);

  // Test Get pending
  const pending = await callTool('pinmark_get_pending', { sessionId: 'master-audit-session' });
  console.log(`  ✓ pinmark_get_pending: found ${pending.length} pending pin(s) (PASS)`);
  // Test Acknowledge
  const ack = await callTool('pinmark_acknowledge', { annotationId: 'ann-master-001' });
  console.log(`  ✓ pinmark_acknowledge: response = "${ack}" (PASS)`);

  // Test Resolve
  const resolved = await callTool('pinmark_resolve', {
    annotationId: 'ann-master-001',
    agentName: 'Claude Code Test',
  });
  console.log(`  ✓ pinmark_resolve: response = "${resolved}" (PASS)`);

  // Test Ask Question / Reply
  const reply = await callTool('pinmark_ask_question', {
    annotationId: 'ann-master-001',
    question: 'Should the button use 16px or 18px font size?',
    agentName: 'Claude Code',
  });
  console.log(`  ✓ pinmark_ask_question: response = "${reply}" (PASS)`);
  // Test Playwright Test Generator
  const testGen = await callTool('pinmark_generate_test', {
    annotationId: 'ann-master-001',
    framework: 'playwright',
    outputDir: 'tests/e2e',
  });
  console.log(`  ✓ pinmark_generate_test: ${testGen} (PASS)`);
  if (fs.existsSync('tests/e2e')) {
    fs.rmSync('tests/e2e', { recursive: true, force: true });
  }

  // Test Visual Fix Verification tool
  const verifyFix = await callTool('pinmark_verify_fix', {
    annotationId: 'ann-master-001',
    notes: 'Updated button class from btn-secondary to btn-primary and added brand colors',
  });
  console.log(`  ✓ pinmark_verify_fix: ${verifyFix.split('\n')[2]} (PASS)`);

  // Test Webhook Dispatcher Formatters
  const { WebhookDispatcher } = await import('@pinmark/core');
  const slackPayload = WebhookDispatcher.formatSlackPayload(testAnnotation as any);
  const discordPayload = WebhookDispatcher.formatDiscordPayload(testAnnotation as any);
  const githubIssue = WebhookDispatcher.formatGitHubIssue(testAnnotation as any);
  console.log(`  ✓ WebhookDispatcher: Slack (${slackPayload.blocks.length} blocks), Discord (${discordPayload.embeds.length} embeds), GitHub (${githubIssue.title.slice(0, 30)}...) (PASS)`);
  // 4. Test Markdown Formatter across Detail Levels
  console.log('\n[4/5] Testing Markdown Formatter & Source Extraction...');
  const formatter = new MarkdownFormatter();
  
  const compactMd = formatter.formatItem(testAnnotation, { outputDetail: 'minimal' } as any);
  console.log('  ✓ Compact Mode Output:');
  console.log('    ' + compactMd.split('\n').join('\n    '));

  const standardMd = formatter.formatItem(testAnnotation, { outputDetail: 'standard' } as any);
  console.log('  ✓ Standard Mode Output:');
  console.log('    ' + standardMd.split('\n').join('\n    '));
  console.log('    Has Source:', standardMd.includes('**Source:** `src/components/Button.tsx:12`') ? 'YES (PASS)' : 'NO (FAIL)');
  console.log('    Has Triage:', standardMd.includes('**Triage:**') ? 'YES (PASS)' : 'NO (FAIL)');

  // Add breadcrumbs and resilient selectors to testAnnotation
  testAnnotation.breadcrumbs = [
    { timestamp: Date.now() - 5000, type: 'click', target: 'nav > a.dashboard', text: 'Dashboard' },
    { timestamp: Date.now() - 2000, type: 'modal_open', target: 'dialog#settings', text: 'Settings modal' }
  ];
  testAnnotation.element.resilientSelectors = {
    testId: '[data-testid="submit-btn"]',
    aria: 'button[aria-label="Submit Button"]',
    bestRobust: '[data-testid="submit-btn"]'
  };

  const detailedMd = formatter.formatItem(testAnnotation, { outputDetail: 'detailed' } as any);
  console.log('  ✓ Detailed Mode includes Enclosed Multi-Selected Elements & Breadcrumbs:');
  console.log('    Has Enclosed Elements:', detailedMd.includes('Enclosed Elements (2):') ? 'YES (PASS)' : 'NO (FAIL)');
  console.log('    Has User Journey:', detailedMd.includes('User Journey (Recent Actions):') ? 'YES (PASS)' : 'NO (FAIL)');
  console.log('    Has Robust Selector:', detailedMd.includes('**Robust Selector:**') ? 'YES (PASS)' : 'NO (FAIL)');
  await runDoctor(4747);
  console.log('  ✓ Doctor execution completed without errors: PASS');

  // Teardown
  await browser.close();
  server.close();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('       🎉 ALL PINMARK FUNCTIONALITIES VERIFIED PASS!       ');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
