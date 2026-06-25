# Deep Bug Audit — All Modified Files

## Bugs Found (10)

### BUG-1: Rearrange mode state not reset on panel close [HIGH]
**File:** `packages/pinmark/src/vanilla/Overlay.ts` — `hideLayoutPanel()`  
**Issue:** When the layout panel is closed (via `L` key or `toggleLayoutMode(false)`), `isRearrangeMode` stays `true` inside the closure. If a user reopens the panel, rearrange mode is visually off but the old document-level mousedown/mousemove/mouseup handlers were removed — so the toggle button is out of sync. Worse: if `_cleanup` runs while rearrange mode is active, the handlers are removed but `isRearrangeMode` remains `true`, so clicking the button again won't re-add them (it just toggles the flag).  
**Fix:** Reset `isRearrangeMode = false` inside `_cleanup` and also use a MutationObserver or direct callback to ensure the button state resets.

### BUG-2: Rearrange mousedown fires alongside overlay's `handleClick` → double feedback [HIGH]
**File:** `packages/pinmark/src/vanilla/Overlay.ts` — `onRearrangeMouseDown`  
**Issue:** `onRearrangeMouseDown` does NOT call `e.preventDefault()` or `e.stopPropagation()`. When rearrange mode is ON and the user clicks an element, the overlay's `handleClick` also fires (it calls `promptForFeedback`), creating an unwanted feedback modal *plus* starting a rearrange drag. The two actions conflict.  
**Fix:** Add `e.preventDefault(); e.stopPropagation();` in `onRearrangeMouseDown` when `isRearrangeMode` is active.

### BUG-3: SPA navigation loses `hideUntilRestart` setting [MEDIUM]
**File:** `packages/extension/src/content/index.ts` — `handleUrlChange()`  
**Issue:** On SPA navigation, the overlay is destroyed and recreated. The new `initializeOverlay()` call at the bottom is not made — the code inline-creates a new `Overlay`. The `hideUntilRestart` toggle is only applied in `initializeOverlay()`, not in the inline recreation in `handleUrlChange()`. Markers will reappear on SPA navigation even with `hideUntilRestart: true`.  
**Fix:** Add the same `hideUntilRestart` check after `overlay.activate()` inside `handleUrlChange()`.

### BUG-4: `ThreadReplySchema.author` rejects `'user'` — but store uses `'agent'` for agent messages [MEDIUM]
**File:** `packages/core/src/schema.ts` — `ThreadReplySchema`  
**Issue:** `author` is `z.enum(['human', 'agent'])`. The `Store.addReply()` always sets `author: 'agent'` regardless of who actually called it. If a human asks a question via the HTTP API, the reply is still labeled `author: 'agent'`. There's no way for a human to reply via the API with `author: 'human'` because the MCP tool and HTTP endpoint don't expose an author choice — and human replies would fail Zod validation if they tried to use `'user'`.  
**Fix:** Accept `'human'` in the schema (already does) and add a `role` parameter to the HTTP endpoint so callers can specify human vs agent.

### BUG-5: `handleKeydown` fires `X` → `clearAll()` even when focus is in purpose textarea [MEDIUM]
**File:** `packages/pinmark/src/vanilla/Overlay.ts` — `handleKeydown`  
**Issue:** The `handleKeydown` is registered with `capture: true`. When the user types in the purpose textarea (inside the layout panel), pressing `x` triggers `clearAll()`, wiping all annotations instead of typing the letter. The handler checks `if (this.isModalOpen)` but NOT if focus is in the layout panel's textarea.  
**Fix:** Check if the active element is an input/textarea inside the shadow root before processing single-letter shortcuts.

### BUG-6: Wireframe overlay + opacity slider state lost on panel reopen [LOW]
**File:** `packages/pinmark/src/vanilla/Overlay.ts` — `hideLayoutPanel()`  
**Issue:** `_cleanup` removes `wireframeOverlay` from the DOM. If the user had wireframe active at 40% opacity and toggles layout mode off/on, the wireframe resets to off/70%.  
**Fix:** Persist wireframe state on the `Overlay` instance and restore it when `showLayoutPanel()` is called.

### BUG-7: Reply `id` uses weak randomness [LOW]
**File:** `packages/mcp/src/store.ts` — `addReply()`  
**Reply IDs** use `Math.random().toString(36).substring(2, 15)` — only 13 chars of entropy. Annotation IDs use `crypto.randomUUID()` (122 bits). The inconsistency could cause collision on heavy reply volumes.  
**Fix:** Use the same `crypto.randomUUID()` pattern for reply IDs.

### BUG-8: `addLayoutAnnotation` and `addRearrangeAnnotation` are `async` but don't `await` anything [LOW]
**File:** `packages/pinmark/src/vanilla/Overlay.ts`  
**Issue:** Both methods are declared `async` but contain no `await`. This creates unnecessary promise wrappers and could swallow errors if `this.feedbackManager.add()` ever becomes async.  
**Fix:** Remove `async` keyword.

### BUG-9: `clearAll()` called from `X` shortcut has no empty-check guard [LOW]
**File:** `packages/pinmark/src/vanilla/Overlay.ts` — `clearAll()`  
**Issue:** `clearAll()` calls `this.feedbackManager.clearAll()` and `this.markerManager.clearAll()` even when there are zero annotations. It also doesn't call `persist()` through the manager — the `FeedbackManager.clearAll()` does call `persist()`, so this is fine, but there's no toast or visual confirmation for the user.  
**Fix:** Add a toast after clear.

### BUG-10: Rearrange ghost element appended to `document.body` (outside shadow DOM) [LOW]
**File:** `packages/pinmark/src/vanilla/Overlay.ts` — `onRearrangeMouseMove`  
**Issue:** The ghost div is appended to `document.body`, not the shadow root. This means it's outside the shadow DOM boundary. While it works (the ghost is visible), it leaks into the main DOM and could be accidentally captured by other scripts or screenshot tools.  
**Fix:** Append ghost to `this.shadowRoot` instead.

---

## Files to Modify

| File | Bugs |
|------|------|
| `packages/pinmark/src/vanilla/Overlay.ts` | BUG-1, BUG-2, BUG-5, BUG-6, BUG-8, BUG-9, BUG-10 |
| `packages/extension/src/content/index.ts` | BUG-3 |
| `packages/mcp/src/store.ts` | BUG-7 |
| `packages/core/src/schema.ts` | BUG-4 (optional) |

## Implementation Steps

- [ ] Step 1: Fix BUG-2 — Add `e.preventDefault(); e.stopPropagation();` in `onRearrangeMouseDown`
- [ ] Step 2: Fix BUG-1 — Reset `isRearrangeMode = false` in `_cleanup`
- [ ] Step 3: Fix BUG-5 — Guard keyboard shortcuts when focus is in shadow root inputs
- [ ] Step 4: Fix BUG-3 — Apply `hideUntilRestart` in SPA `handleUrlChange`
- [ ] Step 5: Fix BUG-6 — Persist wireframe/opacity state on Overlay instance
- [ ] Step 6: Fix BUG-10 — Append rearrange ghost to shadow root
- [ ] Step 7: Fix BUG-8 — Remove unnecessary `async` from layout methods
- [ ] Step 8: Fix BUG-9 — Add toast confirmation to `clearAll()`
- [ ] Step 9: Fix BUG-7 — Use `crypto.randomUUID()` for reply IDs
- [ ] Step 10: Build and verify

## Verification

- `npm run build` — all 4 packages compile cleanly
- Manual: open layout panel → rearrange mode ON → click element → confirm no double feedback modal
- Manual: open layout panel → type in purpose field → press `x` → confirm letter types, no clear
- Manual: enable hide-until-restart → SPA navigate → confirm markers stay hidden
- Manual: layout panel → wireframe ON → close panel → reopen → confirm wireframe state restored
