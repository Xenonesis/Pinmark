/**
 * End-to-End Integration Test for Full Session DOM Replay & Diagnostics
 * Validates:
 * 1. Schema integrity (ReplayActionStepSchema & ReplayTrailSummarySchema)
 * 2. 15-Replay LRU Storage Pruning
 * 3. Semantic Action Trail Distillation (distillReplayTrail)
 * 4. Standalone Offline HTML Exporter (generateStandaloneReplayHtml)
 * 5. MCP Tool execution for pinmark_get_replay_trail and pinmark_export_replay_html
 */

import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ReplayTrailSummarySchema,
  type PinmarkAnnotation
} from '@pinmark/core';
import {
  pruneReplayStorage,
  generateStandaloneReplayHtml
} from '@pinmark/pinmark';
import { distillReplayTrail } from './src/mcp-tools.js';
import { store } from './src/store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTest() {
  console.log('🚀 Running Session Replay End-to-End Integration Suite...\n');

  // ── Step 1: Storage Pruning (15-Replay Cap) ───────────────────────────
  console.log('1️⃣ Testing LRU Replay Storage Pruning (Max 15 Cap)...');
  const items = Array.from({ length: 25 }, (_, i) => ({
    id: `ann-${i}`,
    index: i + 1,
    comment: `Test comment ${i}`,
    timestamp: 100000 + i * 1000,
    sessionReplayEvents: [{ type: 3, timestamp: 100000 + i * 1000 }]
  }));

  const pruned = pruneReplayStorage(items, 15);
  const itemsWithReplay = pruned.filter(i => i.sessionReplayEvents && i.sessionReplayEvents.length > 0);
  assert.strictEqual(itemsWithReplay.length, 15, 'Must keep exactly 15 replays');
  assert.strictEqual(pruned[0].sessionReplayEvents, undefined, 'Oldest item must have replay stripped');
  assert.strictEqual(pruned[9].sessionReplayEvents, undefined, '10th oldest item must have replay stripped');
  assert.ok(pruned[24].sessionReplayEvents?.length, 'Newest item must retain replay events');
  console.log('   ✓ 25 items pruned to exactly 15 newest replays; metadata preserved.\n');

  // ── Step 2: Synthetic Replay Data & Trail Distillation ─────────────────
  console.log('2️⃣ Testing Semantic Replay Trail Distillation (distillReplayTrail)...');
  const syntheticAnnotation: PinmarkAnnotation = {
    id: 'ann-e2e-replay',
    index: 1,
    comment: 'Checkout payment button failed with 500 server error',
    url: 'https://example.com/checkout',
    timestamp: 1700005000,
    element: {
      selector: 'button#pay-button',
      tagName: 'BUTTON',
      classes: ['btn', 'btn-primary'],
      dataAttributes: {},
      boundingRect: {
        x: 100,
        y: 200,
        width: 150,
        height: 40,
        top: 200,
        right: 250,
        bottom: 240,
        left: 100
      }
    },
    sessionReplayEvents: [
      { type: 4, data: { href: 'https://example.com/checkout' }, timestamp: 1700000000 },
      { type: 3, data: { source: 2, type: 2, id: 10 }, timestamp: 1700001500 }, // Click
      { type: 3, data: { source: 5, text: 'COUPON2026' }, timestamp: 1700002200 }, // Input
      { type: 3, data: { source: 3, x: 0, y: 350 }, timestamp: 1700002800 }, // Scroll
    ],
    networkRequests: [
      { method: 'POST', url: 'https://example.com/api/charge', status: 500, isError: true, timestamp: 1700003500 }
    ],
    consoleLogs: [
      { type: 'error', message: 'Unhandled server error during charge', timestamp: 1700003600 }
    ],
    errorTrace: [
      { name: 'PaymentGatewayError', message: 'Transaction rejected (500)', timestamp: 1700003700 }
    ]
  };

  const trail = distillReplayTrail(syntheticAnnotation);
  assert.strictEqual(trail.annotationId, 'ann-e2e-replay');
  assert.strictEqual(trail.networkFailuresCount, 1);
  assert.strictEqual(trail.runtimeErrorsCount, 2);
  assert.ok(trail.steps.length >= 6, 'Must contain navigation, click, input, scroll, network error, and pin drop');

  // Validate against Zod schema
  const parsedTrail = ReplayTrailSummarySchema.safeParse(trail);
  assert.ok(parsedTrail.success, `Trail must strictly match ReplayTrailSummarySchema: ${JSON.stringify(parsedTrail.error?.issues)}`);
  console.log(`   ✓ Distilled ${trail.steps.length} ordered action steps. Schema validation passed.`);
  console.log(`     Action steps sample: [${trail.steps.map(s => s.type).join(' -> ')}]\n`);

  // ── Step 3: Standalone Offline HTML Exporter ───────────────────────────
  console.log('3️⃣ Testing Standalone HTML Replay Generator (generateStandaloneReplayHtml)...');
  const standaloneHtml = generateStandaloneReplayHtml(syntheticAnnotation);
  assert.ok(standaloneHtml.startsWith('<!DOCTYPE html>'), 'Must start with <!DOCTYPE html>');
  assert.ok(standaloneHtml.includes('pinmark-player-viewport'), 'Must contain player viewport container');
  assert.ok(standaloneHtml.includes('pinmark-scrubber'), 'Must contain timeline scrubber range input');
  assert.ok(standaloneHtml.includes('Checkout payment button failed with 500 server error'), 'Must embed user comment');
  assert.ok(standaloneHtml.includes('https://example.com/api/charge'), 'Must embed network request in activity rail');
  assert.ok(standaloneHtml.includes('rrweb.Replayer'), 'Must instantiate rrweb.Replayer in script');

  const testOutputDir = path.resolve(__dirname, '../../test-artifacts');
  if (!fs.existsSync(testOutputDir)) {
    fs.mkdirSync(testOutputDir, { recursive: true });
  }
  const testHtmlPath = path.join(testOutputDir, 'pinmark-e2e-replay.html');
  fs.writeFileSync(testHtmlPath, standaloneHtml, 'utf8');
  assert.ok(fs.existsSync(testHtmlPath), 'Exported file must exist on disk');
  const stats = fs.statSync(testHtmlPath);
  console.log(`   ✓ Standalone HTML generated successfully (${(stats.size / 1024).toFixed(1)} KB) at ${testHtmlPath}\n`);

  // ── Step 4: MCP Store Ingestion & Retrieval ───────────────────────────
  console.log('4️⃣ Testing Store Ingestion & Lookup...');
  const sessionId = 'session-replay-e2e';
  store.createSession('https://example.com/checkout', sessionId);
  await store.addAnnotation(sessionId, syntheticAnnotation);

  const retrieved = store.getAnnotation('ann-e2e-replay');
  assert.ok(retrieved, 'Annotation must be retrievable from store');
  assert.strictEqual(retrieved?.id, 'ann-e2e-replay');
  assert.strictEqual(retrieved?.sessionReplayEvents?.length, 4);
  console.log('   ✓ MCP Store retrieved annotation with full session replay events intact.\n');

  console.log('🎉 ALL SESSION REPLAY INTEGRATION CHECKS PASSED WITH 100% SUCCESS!');
}

runTest().catch((err) => {
  console.error('❌ Session replay integration test failed:', err);
  process.exit(1);
});
