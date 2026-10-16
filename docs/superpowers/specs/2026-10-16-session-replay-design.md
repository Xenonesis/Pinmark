# Design Specification: Full Session DOM Replay & Network Diagnostic Engine

- **Author**: Pinmark Core Engineering
- **Status**: Approved by User
- **Date**: 2026-10-16
- **Version**: 1.0.0
- **Target Release**: Pinmark v1.8.0

---

## 1. Problem Statement & Motivation

AI coding agents (such as Claude Code, Cursor, Windsurf, Cline) excel at modifying codebase files when given precise reproduction context. However, static DOM snapshots and single-frame screenshots capture only the *final broken state*, omitting the preceding user actions, timing, and asynchronous failures that caused the bug.

Competitor **Jam.dev** provides session recording via heavyweight cloud-hosted video streaming, but introduces significant enterprise security/privacy risks, incurs steep SaaS pricing ($10+/user/mo), and produces raw `.mp4` video files that local AI coding agents cannot parse or grep directly.

### Objectives
1. **Interactive Session Replay**: Enable human developers to visually replay the last 20 seconds of user interactions (clicks, scrolls, route changes, DOM mutations) with an embedded player (play/pause, scrubber, speed controls) directly in the extension popup.
2. **Standalone Shareable Export**: Provide a 1-click self-contained HTML export (`pinmark-replay-<id>.html`) embedding the replay engine and event data with zero runtime dependencies.
3. **AI Semantic Distillation**: Provide dedicated MCP tools (`pinmark_get_replay_trail` and enhanced `pinmark_generate_test`) that distill thousands of raw DOM mutation records into an ordered, token-efficient action recipe for AI agents.
4. **Synchronized Diagnostics**: Correlate DOM interactions with network requests (XHR/Fetch) and console error events along the timeline.
5. **Zero Cloud Lock-In & Privacy**: 100% local operation, automatic PII masking (passwords, credit cards), and zero third-party telemetry.

---

## 2. Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BROWSER CONTENT SCRIPT                          │
│                                                                        │
│  [rrweb.record] ──────► 20s Throttled DOM Mutation Buffer (50ms) ──┐   │
│  [NetworkInterceptor] ─► 20s Fetch/XHR Buffer (Status/Bodies) ─────┼─► │
│  [ConsoleInterceptor] ─► 20s Warnings & Runtime Errors Buffer ─────┘   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Annotation Saved (Pin Dropped)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   STORAGE & NORMALIZATION LAYER                        │
│                                                                        │
│  • Sanitizes sensitive data (input[type="password"], [data-private])   │
│  • Attaches sessionReplayEvents, networkRequests, consoleLogs          │
│  • Prunes retention cap (Max 15 stored replays) in chrome.storage      │
│  • Dispatches SYNC_MCP event to local bridge (localhost:4747)          │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│           HUMAN DEVELOPER            │  │           AI CODING AGENT    │
│                                      │  │                              │
│ 1. Extension Popup:                  │  │ 1. pinmark_get_replay_trail  │
│    "Watch Replay" Embedded Modal     │  │    (compact reproduction     │
│    (rrweb.Replayer + Scrubber +      │  │     action recipe)           │
│     Event Markers + Network Rail)    │  │ 2. pinmark_generate_test     │
│ 2. "Export Standalone HTML"          │  │    (Playwright/Cypress spec) │
│    (Self-contained single-file)      │  │ 3. pinmark_export_replay_html│
└──────────────────────────────────────┘  └──────────────────────────────┘
```

---

## 3. Detailed Component Specifications

### 3.1 Package: `@pinmark/core`

#### File: `packages/core/src/schema.ts`
Extend existing schemas to formalize replay breadcrumbs and action trail:

```typescript
export const ReplayActionStepSchema = z.object({
  timeMs: z.number(),
  timeOffset: z.string(), // "1.4s"
  type: z.enum(['click', 'input', 'scroll', 'navigation', 'network_call', 'network_error', 'runtime_error', 'pin_dropped']),
  selector: z.string().optional(),
  targetText: z.string().optional(),
  value: z.string().optional(), // Masked if sensitive
  method: z.string().optional(),
  url: z.string().optional(),
  status: z.number().optional(),
  errorMessage: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ReplayTrailSummarySchema = z.object({
  annotationId: z.string(),
  url: z.string(),
  totalDurationMs: z.number(),
  eventCount: z.number(),
  steps: z.array(ReplayActionStepSchema),
  networkFailuresCount: z.number(),
  runtimeErrorsCount: z.number(),
});
```

### 3.2 Package: `@pinmark/pinmark`

#### File: `packages/pinmark/src/vanilla/Overlay.ts`
1. **Configurable Rolling Buffer**:
   - Buffer duration: `20,000ms` (20 seconds).
   - Sampling throttle: Throttle `mousemove` events to 50ms to eliminate redundant coordinates.
   - PII Masking: Pass `maskAllInputs: true`, `maskInputOptions: { password: true }`, `blockClass: 'pinmark-mask-private'`.
2. **Breadcrumb Event Tagging**:
   - When user clicks, types, or navigates while overlay is recording, tag events with custom marker payloads (`rrweb.addCustomEvent`) for instant scrubber indexing.

#### File: `packages/pinmark/src/vanilla/ReplayExporter.ts` (New Module)
Responsible for generating a standalone, self-contained HTML document containing:
- Inlined minified `rrweb` Replayer runtime.
- Embedded JSON payload of `sessionReplayEvents`, `networkRequests`, `consoleLogs`, and annotation metadata.
- Pre-styled responsive player interface with dark theme and interactive timeline scrubber.

### 3.3 Package: `@pinmark/extension`

#### File: `packages/extension/wxt.config.ts`
- Add `"unlimitedStorage"` to the `permissions` array to prevent quota crashes on Chrome and Firefox when storing multiple diagnostic replays.

#### File: `packages/extension/entrypoints/popup/popup.ts` & `popup.html`
1. **Review Item "Watch Replay" Action**:
   - For any annotation containing `sessionReplayEvents && sessionReplayEvents.length > 0`, display a prominent button:
     `▶ Watch Replay (${duration}s)` and `⬇ Export HTML`.
2. **Replayer Modal Dialog**:
   - Modal container with backdrop blur and close button.
   - Viewport sandbox rendering `new rrweb.Replayer(events, { root, liveMode: false, mouseTail: true })`.
   - Custom playback control bar:
     - Play / Pause button (`Space` shortcut).
     - Timeline track with draggable scrubber thumb and time label (`00:04 / 00:20`).
     - Colored event markers:
       - 🔵 Click / Form Input
       - 🔴 Network 4xx/5xx or Error
       - 🟣 Page navigation
       - 🎯 Annotation pin point
     - Speed multiplier selector: `1x`, `1.5x`, `2x`.
   - **Synchronized Activity Rail**:
     - Real-time ticker below the replayer syncing with the current playback time offset, highlighting network requests and console errors as they occur in the video.

### 3.4 Package: `@pinmark/mcp`

#### File: `packages/mcp/src/mcp-tools.ts`
1. **Tool `pinmark_get_replay_trail`**:
   - Input: `{ annotationId: string }`
   - Output: `ReplayTrailSummary` containing token-optimized reproduction steps.
   - Logic: Extracts user interaction events and network failures from `sessionReplayEvents` and `networkRequests`, filtering out non-essential DOM mutation noise.
2. **Enhanced Tool `pinmark_generate_test`**:
   - Translates `ReplayTrailSummary.steps` directly into executable Playwright or Cypress test code:
     - `page.goto(url)`
     - `page.locator(selector).click()`
     - `page.locator(selector).fill(val)`
     - `expect(...)`
3. **Tool `pinmark_export_replay_html`**:
   - Input: `{ annotationId: string, outputPath?: string }`
   - Output: Path to generated standalone `.html` file written to the project workspace.

---

## 4. Performance, Storage & Security Safeguards

1. **Storage Retention Cap**:
   - Max `15` session replays stored concurrently in `chrome.storage.local`.
   - LRU eviction: When creating the 16th replay, the oldest replay's `sessionReplayEvents` is pruned while preserving its text metadata and screenshot.
2. **CPU & Main Thread Safety**:
   - Mousemove sampling interval clamped to 50ms.
   - Exclude canvas mutations and WebGL heavy streams.
   - Buffer trimming operates in a lightweight 1000ms interval.
3. **Privacy Invariant (Zero PII Leak)**:
   - Sensitive elements matching `input[type="password"]`, `[autocomplete="cc-number"]`, `.credit-card`, and `[data-private]` masked to `••••••`.
   - No data transmitted over public networks; all communication restricted to local loopback (`127.0.0.1:4747`).

---

## 5. Verification & Testing Strategy

1. **Unit Tests (`packages/core`, `packages/pinmark`)**:
   - Verify `ReplayActionStepSchema` parsing and validation.
   - Test `ReplayExporter` standalone HTML string generation.
   - Test trail distillation logic (raw mutations -> clean steps).
2. **E2E Stability & Functional Tests**:
   - Extend `packages/mcp/test-all-functionalities.ts` and `test-deep-e2e.ts`.
   - Verify `pinmark_get_replay_trail` returns valid steps for a test session.
   - Verify `pinmark_export_replay_html` writes valid self-contained HTML file.
   - Verify popup replayer renders without iframe escape or memory leaks.
3. **Build & Package Verification**:
   - `pnpm -r run build`
   - `pnpm -r run build:firefox`
   - `pnpm package`
