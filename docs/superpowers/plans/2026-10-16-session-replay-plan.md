# Full Session DOM Replay & Network Diagnostic Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full session DOM replay (20s throttled rolling buffer with PII masking), an embedded interactive Replay Player modal in the extension popup, 1-click standalone offline HTML export, and AI agent MCP tools for reproduction trail distillation and automated test generation.

**Architecture:** Extended rolling buffer in `Overlay.ts` records DOM mutations via `rrweb` (50ms throttled) alongside `NetworkInterceptor` and `ConsoleInterceptor`. Stored in `chrome.storage.local` with `unlimitedStorage` and LRU eviction (max 15 replays). Consumed visually by humans via an embedded `rrweb.Replayer` modal in the extension popup with a timeline scrubber and synchronized network/console rail, or exported as a zero-dependency HTML file (`pinmark-replay-*.html`). Consumed by AI agents via MCP tools (`pinmark_get_replay_trail`, `pinmark_export_replay_html`, enhanced `pinmark_generate_test`).

**Tech Stack:** TypeScript, `rrweb` 2.1.1 (`record`, `Replayer`), Zod schemas, WXT 0.21.4 (Chrome MV3 + Firefox Gecko), Model Context Protocol SDK, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-16-session-replay-design.md`

## Global Constraints

- Retain 100% local, self-hosted execution; zero cloud transmission or third-party telemetry.
- Automatically mask sensitive elements (`input[type="password"]`, `.credit-card`, `[data-private]`).
- Mouse movement sampling throttled to 50ms intervals; rolling window capped at 20,000ms (20s).
- Maximum 15 session replays retained concurrently in local storage; auto-evict oldest on overflow.
- Zero TypeScript compiler errors across all monorepo workspaces (`pnpm -r run build`).
- All existing stability and unit tests must pass (`vitest run`, `pnpm package`).

---

### Task 1: Replay Action Step & Trail Schemas (`packages/core`)

**Files:**
- Modify: `packages/core/src/schema.ts`
- Test: `packages/core/src/__tests__/schema.test.ts`

**Interfaces:**
- Produces:
  - `ReplayActionStepSchema`: Zod schema for individual action steps (`timeMs`, `timeOffset`, `type`, `selector`, `targetText`, `value`, `method`, `url`, `status`, `errorMessage`).
  - `ReplayActionStep`: TypeScript type inferred from `ReplayActionStepSchema`.
  - `ReplayTrailSummarySchema`: Zod schema for distilled replay summary (`annotationId`, `url`, `totalDurationMs`, `eventCount`, `steps`, `networkFailuresCount`, `runtimeErrorsCount`).
  - `ReplayTrailSummary`: TypeScript type inferred from `ReplayTrailSummarySchema`.

- [ ] **Step 1: Write the failing test for replay trail schemas**

Create or update `packages/core/src/__tests__/schema.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { ReplayActionStepSchema, ReplayTrailSummarySchema } from '../schema.js';

describe('ReplayActionStepSchema & ReplayTrailSummarySchema', () => {
  it('validates a correct replay action step', () => {
    const step = {
      timeMs: 1400,
      timeOffset: '1.4s',
      type: 'click',
      selector: 'button#checkout',
      targetText: 'Pay Now'
    };
    const parsed = ReplayActionStepSchema.safeParse(step);
    expect(parsed.success).toBe(true);
  });

  it('validates a full replay trail summary', () => {
    const trail = {
      annotationId: 'ann-123',
      url: 'http://localhost:3000/cart',
      totalDurationMs: 15000,
      eventCount: 42,
      steps: [
        { timeMs: 1200, timeOffset: '1.2s', type: 'click', selector: 'button#pay' },
        { timeMs: 2400, timeOffset: '2.4s', type: 'network_error', method: 'POST', url: '/api/charge', status: 500 }
      ],
      networkFailuresCount: 1,
      runtimeErrorsCount: 0
    };
    const parsed = ReplayTrailSummarySchema.safeParse(trail);
    expect(parsed.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pinmark/core test`
Expected: FAIL with "ReplayActionStepSchema is not exported"

- [ ] **Step 3: Implement ReplayActionStepSchema & ReplayTrailSummarySchema in `schema.ts`**

In `packages/core/src/schema.ts`, export:
```typescript
export const ReplayActionStepSchema = z.object({
  timeMs: z.number(),
  timeOffset: z.string(),
  type: z.enum(['click', 'input', 'scroll', 'navigation', 'network_call', 'network_error', 'runtime_error', 'pin_dropped']),
  selector: z.string().optional(),
  targetText: z.string().optional(),
  value: z.string().optional(),
  method: z.string().optional(),
  url: z.string().optional(),
  status: z.number().optional(),
  errorMessage: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ReplayActionStep = z.infer<typeof ReplayActionStepSchema>;

export const ReplayTrailSummarySchema = z.object({
  annotationId: z.string(),
  url: z.string(),
  totalDurationMs: z.number(),
  eventCount: z.number(),
  steps: z.array(ReplayActionStepSchema),
  networkFailuresCount: z.number(),
  runtimeErrorsCount: z.number(),
});
export type ReplayTrailSummary = z.infer<typeof ReplayTrailSummarySchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @pinmark/core test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/schema.ts packages/core/src/__tests__/schema.test.ts
git commit -m "feat(core): add ReplayActionStep and ReplayTrailSummary schemas"
```

---

### Task 2: Throttled Recording, PII Masking & LRU Retention (`packages/pinmark`)

**Files:**
- Modify: `packages/pinmark/src/vanilla/Overlay.ts:1540-1555`
- Modify: `packages/pinmark/src/vanilla/FeedbackManager.ts` (storage pruning)

**Interfaces:**
- Consumes: `rrweb.record`, `NetworkInterceptor`
- Produces: 20-second rolling buffer with 50ms mousemove throttling, auto PII masking, max 15 replays retention pruning.

- [ ] **Step 1: Write unit test for event retention & pruning in FeedbackManager**

Create or modify `packages/pinmark/src/__tests__/retention.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { pruneReplayStorage } from '../vanilla/FeedbackManager.js';

describe('pruneReplayStorage', () => {
  it('keeps maximum 15 items with sessionReplayEvents, trimming older ones', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      id: `pin-${i}`,
      timestamp: 1000 + i * 100,
      sessionReplayEvents: [{ type: 1, timestamp: 1000 + i * 100 }]
    }));

    const pruned = pruneReplayStorage(items as any, 15);
    const withReplay = pruned.filter(item => item.sessionReplayEvents && item.sessionReplayEvents.length > 0);
    expect(withReplay.length).toBe(15);
    // Oldest 5 items should have sessionReplayEvents cleared to save memory
    expect(pruned[0].sessionReplayEvents).toBeUndefined();
    expect(pruned[4].sessionReplayEvents).toBeUndefined();
    expect(pruned[19].sessionReplayEvents?.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pinmark/pinmark test`
Expected: FAIL with "pruneReplayStorage is not exported"

- [ ] **Step 3: Implement `pruneReplayStorage` and update `Overlay.ts` recording parameters**

1. In `packages/pinmark/src/vanilla/FeedbackManager.ts`:
```typescript
export function pruneReplayStorage<T extends { timestamp?: number; sessionReplayEvents?: any[] }>(items: T[], maxReplays: number = 15): T[] {
  const withReplay = items
    .filter(i => i.sessionReplayEvents && i.sessionReplayEvents.length > 0)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  if (withReplay.length <= maxReplays) return items;

  const allowedIds = new Set(withReplay.slice(0, maxReplays));
  return items.map(item => {
    if (item.sessionReplayEvents && !allowedIds.has(item)) {
      const { sessionReplayEvents, ...rest } = item;
      return rest as T;
    }
    return item;
  });
}
```

2. In `packages/pinmark/src/vanilla/Overlay.ts`:
Update `startDiagnostics()` to configure `rrweb.record` with:
- 20s window: `const cutoff = Date.now() - 20000;`
- Throttle mousemove to 50ms: `sampling: { mousemove: 50 }`
- Mask inputs: `maskAllInputs: true`, `maskInputOptions: { password: true }`
- Mask classes: `blockClass: 'pinmark-mask-private'`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @pinmark/pinmark test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/pinmark/src/vanilla/Overlay.ts packages/pinmark/src/vanilla/FeedbackManager.ts packages/pinmark/src/__tests__/retention.test.ts
git commit -m "feat(pinmark): add 20s throttled recording with PII masking and LRU retention"
```

---

### Task 3: Standalone Offline Replay Exporter (`packages/pinmark`)

**Files:**
- Create: `packages/pinmark/src/vanilla/ReplayExporter.ts`
- Modify: `packages/pinmark/src/vanilla/index.ts`
- Test: `packages/pinmark/src/__tests__/ReplayExporter.test.ts`

**Interfaces:**
- Produces: `generateStandaloneReplayHtml(annotation: PinmarkAnnotation): string`
  - Returns complete, standalone single-file HTML document containing inlined `rrweb` Replayer, custom player controls, timeline scrubber, synchronized network rail, and embedded JSON payload.

- [ ] **Step 1: Write unit test for `ReplayExporter`**

Create `packages/pinmark/src/__tests__/ReplayExporter.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { generateStandaloneReplayHtml } from '../vanilla/ReplayExporter.js';

describe('generateStandaloneReplayHtml', () => {
  it('generates a self-contained HTML file containing embedded events and player controls', () => {
    const mockAnnotation: any = {
      id: 'ann-test-1',
      index: 1,
      comment: 'Button click triggers error',
      url: 'http://localhost:3000/app',
      timestamp: Date.now(),
      element: { selector: 'button.submit', tagName: 'BUTTON', classes: ['submit'] },
      sessionReplayEvents: [
        { type: 4, data: { href: 'http://localhost:3000/app', width: 1280, height: 720 }, timestamp: 1000 },
        { type: 2, data: { node: { id: 1, type: 0 } }, timestamp: 1050 }
      ],
      networkRequests: [
        { method: 'POST', url: '/api/submit', status: 500, timestamp: 1200 }
      ],
      consoleLogs: [
        { type: 'error', message: 'Network request failed', timestamp: 1210 }
      ]
    };

    const html = generateStandaloneReplayHtml(mockAnnotation);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('pinmark-player-viewport');
    expect(html).toContain('ann-test-1');
    expect(html).toContain('Button click triggers error');
    expect(html).toContain('rrweb.Replayer');
    expect(html).toContain('/api/submit');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pinmark/pinmark test`
Expected: FAIL with "generateStandaloneReplayHtml is not defined"

- [ ] **Step 3: Implement `generateStandaloneReplayHtml` in `ReplayExporter.ts`**

Create `packages/pinmark/src/vanilla/ReplayExporter.ts` with clean HTML template:
- Embedded minified CSS with dark theme (`#09090b` zinc, `#18181b` card, `#6366f1` accent).
- Top header with Annotation ID, target URL, and comment badge.
- Viewport canvas for `rrweb.Replayer`.
- Playback controls: Play/Pause button, scrubber progress input, time indicator (`00:00 / 00:20`), speed buttons (`1x`, `1.5x`, `2x`).
- Synchronized activity rail: listing network requests and console errors, highlighting entries whose timestamp matches current playback time.
- Embedded `<script>` with `rrweb` UMD bundle and initialization logic.
- Export `generateStandaloneReplayHtml` in `packages/pinmark/src/vanilla/index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @pinmark/pinmark test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/pinmark/src/vanilla/ReplayExporter.ts packages/pinmark/src/vanilla/index.ts packages/pinmark/src/__tests__/ReplayExporter.test.ts
git commit -m "feat(pinmark): implement standalone offline replay HTML generator"
```

---

### Task 4: AI Agent MCP Tools (`packages/mcp`)

**Files:**
- Modify: `packages/mcp/src/mcp-tools.ts`
- Test: `packages/mcp/src/__tests__/replay-tools.test.ts`

**Interfaces:**
- Produces:
  - `pinmark_get_replay_trail`: Returns structured `ReplayTrailSummary` with ordered action steps.
  - `pinmark_export_replay_html`: Saves standalone replay HTML to specified path or `./replays/pinmark-replay-<id>.html`.
  - Enhanced `pinmark_generate_test`: Injects action steps into Playwright / Cypress test output.

- [ ] **Step 1: Write test for `distillReplayTrail` helper**

Create `packages/mcp/src/__tests__/replay-tools.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { distillReplayTrail } from '../mcp-tools.js';

describe('distillReplayTrail', () => {
  it('distills raw mutations, network calls, and errors into ordered action steps', () => {
    const mockAnnotation: any = {
      id: 'ann-456',
      url: 'http://localhost:3000/checkout',
      timestamp: 10000,
      element: { selector: 'button#pay' },
      comment: 'Payment hangs',
      sessionReplayEvents: [
        { type: 4, data: { href: 'http://localhost:3000/checkout' }, timestamp: 1000 },
        { type: 3, data: { source: 2, type: 2, id: 10 }, timestamp: 2500 } // Mouse interaction / click
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
    expect(trail.steps.length).toBeGreaterThanOrEqual(3);
    expect(trail.networkFailuresCount).toBe(1);
    expect(trail.steps.some(s => s.type === 'network_error')).toBe(true);
    expect(trail.steps.some(s => s.type === 'runtime_error')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pinmark/mcp test`
Expected: FAIL with "distillReplayTrail is not defined"

- [ ] **Step 3: Implement `distillReplayTrail` and register MCP tools in `mcp-tools.ts`**

1. Implement `distillReplayTrail(annotation: any): ReplayTrailSummary`:
   - Extracts base timestamp from earliest event.
   - Converts `rrweb` navigation, mouse click, and input events into clean action items with human-readable selectors and relative seconds offset (`(t - base) / 1000`s).
   - Merges `networkRequests` (highlighting 4xx/5xx failures).
   - Merges `errorTrace` and console errors.
   - Appends final `pin_dropped` step matching `annotation.element.selector` and `annotation.comment`.
   - Sorts all steps chronologically by `timeMs`.
2. Register `pinmark_get_replay_trail` tool in `registerMcpTools()`.
3. Register `pinmark_export_replay_html` tool in `registerMcpTools()` using `generateStandaloneReplayHtml`.
4. Update `pinmark_generate_test` tool to map `trail.steps` into Playwright steps:
   - `await page.click('${step.selector}');`
   - `await page.fill('${step.selector}', '${step.value}');`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @pinmark/mcp test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src/mcp-tools.ts packages/mcp/src/__tests__/replay-tools.test.ts
git commit -m "feat(mcp): add pinmark_get_replay_trail and pinmark_export_replay_html tools"
```

---

### Task 5: Extension Popup Replayer Modal & WXT Unlimited Storage (`packages/extension`)

**Files:**
- Modify: `packages/extension/wxt.config.ts`
- Modify: `packages/extension/entrypoints/popup/popup.html`
- Modify: `packages/extension/entrypoints/popup/popup.css`
- Modify: `packages/extension/entrypoints/popup/popup.ts`

**Interfaces:**
- Consumes: `rrweb.Replayer`, `generateStandaloneReplayHtml`
- Produces: Embedded popup modal with interactive replay player, timeline scrubber, event markers, speed toggles, and 1-click HTML download.

- [ ] **Step 1: Add `unlimitedStorage` permission to `wxt.config.ts`**

In `packages/extension/wxt.config.ts`:
```typescript
manifest: {
  permissions: ['storage', 'activeTab', 'unlimitedStorage'],
  ...
}
```

- [ ] **Step 2: Add Replay Modal DOM markup and styles**

In `packages/extension/entrypoints/popup/popup.html`:
Add hidden `<div id="replay-modal" class="replay-modal" style="display:none">` containing:
- Header with title, close button (`✕`), and "Export HTML" button.
- Video container `<div id="replay-canvas" class="replay-canvas"></div>`.
- Controls bar: Play/Pause button, scrubber `<input type="range" id="replay-scrubber">`, time display `<span id="replay-time">00:00 / 00:00</span>`, speed selector buttons (`1x`, `1.5x`, `2x`).
- Activity rail `<div id="replay-activity-rail" class="replay-activity-rail"></div>` showing network calls and errors in sync.

In `packages/extension/entrypoints/popup/popup.css`:
Add styles for `.replay-modal`, `.replay-canvas`, `.replay-scrubber`, event marker badges, and dark backdrop overlay.

- [ ] **Step 3: Implement Replay Modal Controller in `popup.ts`**

In `packages/extension/entrypoints/popup/popup.ts`:
1. In `detailSections(item)`:
   If `item.sessionReplayEvents?.length > 0`:
   Render:
   ```html
   <div class="replay-actions">
     <button class="btn-watch-replay" data-id="${item.id}">▶ Watch Session Replay</button>
     <button class="btn-export-replay" data-id="${item.id}">⬇ Export HTML</button>
   </div>
   ```
2. Wire up `btn-watch-replay`:
   - Instantiate `new rrweb.Replayer(item.sessionReplayEvents, { root: canvasEl, mouseTail: true })`.
   - Sync scrubber slider with `replayer.play()` / `replayer.pause()` and timer events.
   - Sync activity rail to highlight network requests matching current playback timestamp.
3. Wire up `btn-export-replay`:
   - Call `generateStandaloneReplayHtml(item)`.
   - Trigger browser download with `URL.createObjectURL(blob)` named `pinmark-replay-${item.id}.html`.

- [ ] **Step 4: Verify build succeeds for Chrome and Firefox**

Run: `pnpm --filter @pinmark/extension build && pnpm --filter @pinmark/extension build:firefox`
Expected: Both Chrome MV3 and Firefox builds finish with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add packages/extension/wxt.config.ts packages/extension/entrypoints/popup/
git commit -m "feat(extension): add interactive Replay Player modal and unlimitedStorage permission"
```

---

### Task 6: End-to-End Test Suite & Verification

**Files:**
- Create: `packages/mcp/test-replay-e2e.ts`
- Run: Full monorepo validation pipeline

**Interfaces:**
- Validates the complete pipeline:
  1. Capture 20s simulated session replay with clicks, inputs, network failure, and annotation pin.
  2. Verify storage pruning cap handles 15+ items safely.
  3. Query `pinmark_get_replay_trail` and verify chronological step ordering.
  4. Query `pinmark_export_replay_html` and verify generated HTML file exists, loads, and contains player scripts.
  5. Query `pinmark_generate_test` and verify Playwright script includes replay click and assertion.

- [ ] **Step 1: Write `test-replay-e2e.ts`**

Create `packages/mcp/test-replay-e2e.ts` validating:
- `distillReplayTrail` output contract.
- `generateStandaloneReplayHtml` document integrity.
- Storage eviction retention logic.

- [ ] **Step 2: Run all tests and build artifacts**

Run:
```bash
pnpm test
npx tsx packages/mcp/test-replay-e2e.ts
pnpm build
pnpm build:firefox
pnpm package
```
Expected: All tests pass, packages compile cleanly, and zip archives build in `/release`.

- [ ] **Step 3: Commit**

```bash
git add packages/mcp/test-replay-e2e.ts
git commit -m "test: add comprehensive session replay E2E validation test"
```
