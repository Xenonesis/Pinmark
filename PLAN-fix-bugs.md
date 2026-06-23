# Plan: Fix 5 Real Extension Bugs

## Bug 1 — MarkdownFormatter shows wrong capture time
**File:** `src/content/feedback/MarkdownFormatter.ts` · `format()`

`new Date().toISOString()` returns current time, not when markers were placed.
**Fix:** Use earliest `feedback[0].timestamp` (or `reduce` for min), format it.

## Bug 2 — Keyboard `C` prevents normal text selection copy
**File:** `src/content/index.ts` · `keydown` handler

```ts
if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
```

If user has text selected on the page, pressing C to copy text is blocked. Interceptor shouldn't fire when `window.getSelection().toString()` is non-empty.

## Bug 3 — `clearAfterCopy` doesn't reach active overlay
**File:** `src/content/overlay/Overlay.ts` + `src/content/index.ts`

User changes `clearAfterCopy` in popup while overlay is active → overlay never learns.
**Fix:** Popup sends `UPDATE_SETTINGS` message to content script after saving; content script forwards to `Overlay.updateSettings()`.

Also affects `blockInteractions` and `markerColor` — fix them all with the same message.

## Bug 4 — `reindexMarkers().save()` not awaited
**File:** `src/content/overlay/Overlay.ts`

`handleDeleteFeedback()` calls `reindexMarkers()` which calls `save()` without `await`.
**Fix:** Await save, catch errors. Update `MarkerCallbacks.onDelete` type.

## Bug 5 — Overlay ignores the theme setting (always dark)
**Files:** `src/content/overlay/Toolbar.ts`, `FeedbackModal.ts`, `MarkerManager.ts`, `Overlay.ts`

Hardcoded `#1f2937` bg colors everywhere. Theme setting has no effect on the overlay UI.
**Fix:** Inject CSS custom properties into the shadow root based on resolved theme. All three components reference these vars.

---

## Files to modify

| # | File | Change |
|---|---|---|
| 1 | `src/content/feedback/MarkdownFormatter.ts` | Use `feedback[0].timestamp` |
| 2 | `src/content/index.ts` | Add selection check before C · add UPDATE_SETTINGS case |
| 3 | `src/popup/popup.ts` | Send `UPDATE_SETTINGS` to content after save |
| 4 | `src/shared/types.ts` | Add `UPDATE_SETTINGS` message type |
| 5 | `src/content/overlay/Overlay.ts` | Inject theme CSS vars · await save · pass settings to reindex |
| 6 | `src/content/overlay/Toolbar.ts` | Use CSS vars |
| 7 | `src/content/overlay/FeedbackModal.ts` | Use CSS vars |
| 8 | `src/content/overlay/MarkerManager.ts` | Use CSS vars |

## Verification

```bash
npm run build  # must compile clean (21 modules)
# Load dist/ in Chrome, test:
# 1. Place markers → copy → report has real timestamp
# 2. Select text on page → press C → text copies as normal
# 3. Change clearAfterCopy in popup → copy from overlay → respect new setting
# 4. Delete a marker → reindex fires → save succeeds
# 5. Set theme to light in popup → overlay toolbar/modal/markers are light
```
