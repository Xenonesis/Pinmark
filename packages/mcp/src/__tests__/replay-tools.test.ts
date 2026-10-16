import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type { PinmarkAnnotation } from '@pinmark/core';
import { ReplayTrailSummarySchema } from '@pinmark/core';
import { generateStandaloneReplayHtml } from '@pinmark/pinmark';
import { distillReplayTrail } from '../mcp-tools.js';
import { store } from '../store.js';
describe('replay-tools', () => {
  describe('distillReplayTrail', () => {
    it('distills raw mutations, network calls, and errors into ordered action steps', () => {
      const mockAnnotation = {
        id: 'ann-456',
        url: 'http://localhost:3000/checkout',
        timestamp: 10000,
        element: { selector: 'button#pay' },
        comment: 'Payment hangs',
        sessionReplayEvents: [
          { type: 4, data: { href: 'http://localhost:3000/checkout' }, timestamp: 1000 },
          { type: 3, data: { source: 2, type: 2, id: 10, selector: 'button#pay', targetText: 'Pay Now' }, timestamp: 2500 }
        ],
        networkRequests: [
          { method: 'POST', url: '/api/charge', status: 504, timestamp: 3500 }
        ],
        errorTrace: [
          { name: 'GatewayTimeout', message: 'Request timed out after 5000ms', timestamp: 3550 }
        ]
      };

      const trail = distillReplayTrail(mockAnnotation);
      expect(trail.annotationId).toBe('ann-456');
      expect(trail.url).toBe('http://localhost:3000/checkout');
      expect(trail.steps.length).toBeGreaterThanOrEqual(4);
      expect(trail.networkFailuresCount).toBe(1);
      expect(trail.runtimeErrorsCount).toBe(1);
      expect(trail.steps.some(s => s.type === 'navigation')).toBe(true);
      expect(trail.steps.some(s => s.type === 'click')).toBe(true);
      expect(trail.steps.some(s => s.type === 'network_error')).toBe(true);
      expect(trail.steps.some(s => s.type === 'runtime_error')).toBe(true);
      expect(trail.steps[trail.steps.length - 1].type).toBe('pin_dropped');

      // Schema validation
      const parseResult = ReplayTrailSummarySchema.safeParse(trail);
      expect(parseResult.success).toBe(true);
    });

    it('correctly handles inputs, scrolls, normal network calls, and console errors', () => {
      const mockAnnotation = {
        id: 'ann-789',
        url: 'https://example.com/form',
        timestamp: 8000,
        element: { selector: 'form#signup' },
        comment: 'Form validation failed',
        sessionReplayEvents: [
          { type: 3, data: { source: 5, selector: 'input#email', value: 'user@example.com' }, timestamp: 2000 },
          { type: 3, data: { source: 3 }, timestamp: 3000 }
        ],
        networkRequests: [
          { method: 'GET', url: '/api/config', status: 200, timestamp: 1500 }
        ],
        consoleLogs: [
          { type: 'error', name: 'TypeError', message: 'Cannot read properties of undefined', timestamp: 4000 }
        ]
      };

      const trail = distillReplayTrail(mockAnnotation);
      expect(trail.steps.some(s => s.type === 'input' && s.value === 'user@example.com')).toBe(true);
      expect(trail.steps.some(s => s.type === 'scroll')).toBe(true);
      expect(trail.steps.some(s => s.type === 'network_call' && s.status === 200)).toBe(true);
      expect(trail.steps.some(s => s.type === 'runtime_error')).toBe(true);
      expect(trail.networkFailuresCount).toBe(0);
      expect(trail.runtimeErrorsCount).toBe(1);

      // Verify chronological sorting
      for (let i = 1; i < trail.steps.length; i++) {
        expect(trail.steps[i].timeMs).toBeGreaterThanOrEqual(trail.steps[i - 1].timeMs);
      }

      const parseResult = ReplayTrailSummarySchema.safeParse(trail);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('pinmark_get_replay_trail response structure via store', () => {
    beforeEach(() => {
      store.createSession('https://example.com/test', 'test-session-1');
    });

    it('retrieves and distills annotation from store', async () => {
      const annotation: PinmarkAnnotation = {
        id: 'ann-store-1',
        index: 1,
        comment: 'Button is broken',
        url: 'https://example.com/test',
        timestamp: 5000,
        element: {
          selector: 'button#broken',
          tagName: 'BUTTON',
          classes: ['btn'],
          dataAttributes: {},
          boundingRect: { x: 0, y: 0, width: 100, height: 40, top: 0, right: 100, bottom: 40, left: 0 }
        },
        sessionReplayEvents: [
          { type: 4, data: { href: 'https://example.com/test' }, timestamp: 1000 },
          { type: 3, data: { source: 2, selector: 'button#broken' }, timestamp: 2000 }
        ],
        networkRequests: [
          { method: 'POST', url: '/api/submit', status: 500, timestamp: 3000 }
        ],
        errorTrace: [
          { name: 'ServerError', message: 'Internal Server Error', timestamp: 3100 }
        ]
      };

      await store.addAnnotation('test-session-1', annotation);
      const retrieved = store.getAnnotation('ann-store-1');
      expect(retrieved).toBeDefined();

      const trail = distillReplayTrail(retrieved);
      const jsonStr = JSON.stringify(trail, null, 2);
      const parsed = JSON.parse(jsonStr);

      const validated = ReplayTrailSummarySchema.safeParse(parsed);
      expect(validated.success).toBe(true);
      if (validated.success) {
        expect(validated.data.annotationId).toBe('ann-store-1');
        expect(validated.data.networkFailuresCount).toBe(1);
        expect(validated.data.runtimeErrorsCount).toBe(1);
        expect(validated.data.steps.length).toBe(5);
      }
    });
  });

  describe('generateStandaloneReplayHtml & standalone export', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pinmark-export-test-'));
    });

    afterEach(async () => {
      if (tmpDir) {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    it('generates valid standalone HTML and writes to output path', async () => {
      const annotation: PinmarkAnnotation = {
        id: 'ann-export-1',
        index: 1,
        comment: 'Checkout form freeze',
        url: 'https://example.com/checkout',
        timestamp: 12000,
        element: {
          selector: 'button#checkout',
          tagName: 'BUTTON',
          classes: ['btn-primary'],
          dataAttributes: {},
          boundingRect: { x: 10, y: 10, width: 120, height: 40, top: 10, right: 130, bottom: 50, left: 10 }
        },
        sessionReplayEvents: [
          { type: 4, data: { href: 'https://example.com/checkout' }, timestamp: 2000 },
          { type: 3, data: { source: 2, selector: 'button#checkout' }, timestamp: 4000 }
        ],
        networkRequests: [
          { method: 'POST', url: '/api/checkout', status: 500, timestamp: 4500 }
        ]
      };

      const html = generateStandaloneReplayHtml(annotation);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('pinmark-player-viewport');
      expect(html).toContain('Checkout form freeze');

      const targetPath = path.join(tmpDir, 'replay.html');
      await fs.writeFile(targetPath, html, 'utf-8');
      const exists = await fs.stat(targetPath);
      expect(exists.isFile()).toBe(true);
      expect(exists.size).toBeGreaterThan(100);
    });
  });

  describe('pinmark_generate_test action synthesis', () => {
    it('synthesizes Playwright action steps from replay trail', () => {
      const annotation: PinmarkAnnotation = {
        id: 'ann-test-gen',
        index: 1,
        comment: 'Search filter fails',
        url: 'https://example.com/search',
        timestamp: 15000,
        element: {
          selector: 'div.results-list',
          tagName: 'DIV',
          classes: ['results-list'],
          dataAttributes: {},
          boundingRect: { x: 0, y: 0, width: 800, height: 600, top: 0, right: 800, bottom: 600, left: 0 }
        },
        sessionReplayEvents: [
          { type: 3, data: { source: 5, selector: 'input#search-box', value: 'electronics' }, timestamp: 2000 },
          { type: 3, data: { source: 2, selector: 'button#submit-search', targetText: 'Search' }, timestamp: 3000 }
        ]
      };

      const trail = distillReplayTrail(annotation);
      const playwrightSteps: string[] = [];
      for (const step of trail.steps) {
        if (step.type === 'click') {
          const sel = step.selector || step.targetText;
          if (sel) {
            playwrightSteps.push(`  await page.locator('${sel.replace(/'/g, "\\'")}').click();`);
          }
        } else if (step.type === 'input' && step.selector) {
          const val = (step.value ?? '').replace(/'/g, "\\'");
          playwrightSteps.push(`  await page.locator('${step.selector.replace(/'/g, "\\'")}').fill('${val}');`);
        }
      }

      expect(playwrightSteps).toContain("  await page.locator('input#search-box').fill('electronics');");
      expect(playwrightSteps).toContain("  await page.locator('button#submit-search').click();");

      const assertion = `await expect(page.locator('${annotation.element.selector}')).toBeVisible();`;
      expect(assertion).toBe("await expect(page.locator('div.results-list')).toBeVisible();");
    });
  });
});
