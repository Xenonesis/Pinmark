# Pinmark Extension — Deep Bug Audit

## Files checked (20 total)
- 1 background
- 1 popup (html/css/ts)
- 4 content analyzers
- 2 content feedback
- 5 content overlay
- 4 shared
- 1 content entry

---

## Critical bugs

### 1. `MarkdownFormatter` shows wrong capture time (misleading)
**File:** `src/content/feedback/MarkdownFormatter.ts` · Line 11

```ts
**Captured:** ${new Date().toISOString()...
```

Uses **current system time** instead of the feedback item's stored timestamp. The report always says "captured just now" even if markers were placed hours ago.

**Fix:** Replace with the timestamp from the first (or the item's own) `FeedbackItem.timestamp`.

### 2. Keyboard `C` shortcut breaks normal copy when text is selected
**File:** `src/content/index.ts` · `keydown` handler

```ts
if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
```

Pressing `C` (no modifier) while text is selected on the page will prevent the browser's default copy action. Users expect select + C to copy text. The extension should only intercept `C` when the overlay is in annotation mode and no text is selected (or use a modifier like `Shift+C`).

### 3. Keyboard `C` uses `alert()` — terrible UX
**Same handler:**
```ts
alert('Feedback copied to clipboard!');
```

Native `alert()` blocks the page, looks unprofessional, and doesn't respect the `clearAfterCopy` setting. The toolbar already has a `showCopySuccess()` method that briefly shows a green checkmark — use that pattern instead.

### 4. `clearAfterCopy` setting never reaches the overlay at runtime
**Files:** `src/content/overlay/Overlay.ts` + `src/popup/popup.ts`

If the user has the overlay active, opens the popup, and changes `clearAfterCopy`, the overlay still holds the old value. The `updateSettings()` method exists but **nobody calls it** when settings change. Only `clearAfterCopy` and `blockInteractions` are affected (they're read at overlay init only).

### 5. Hardcoded dark theme in all overlay UI — ignores the theme setting
**Files:** `FeedbackModal.ts`, `Toolbar.ts`, `MarkerManager.ts`

All three use hardcoded dark-mode colors (`#1f2937` bg, `#374151` input, `#f9fafb` text). If the user picks **light** theme in the popup settings, the overlay stays dark. These should read theme tokens or at minimum respond to a `data-theme` attribute.

### 6. `Toolbar` CSS selectors are fragile
**Files:** `src/content/overlay/Toolbar.ts` · Lines 242, 251, 260

```ts
.pinmark-toolbar-btn:first-child        // pause/play
.pinmark-toolbar-btn:nth-child(2)       // eye/eyeOff
.pinmark-toolbar-btn:nth-child(4)       // copy success
```

These break silently if buttons are added/removed or reordered. Should use `data-action` attributes instead of `:nth-child`.

---

## Medium bugs

### 7. `reindexMarkers()` → `save()` is fire-and-forget
**File:** `src/content/overlay/Overlay.ts` · Line 183

```ts
this.feedbackManager.save();  // async — no await
```

`save()` returns a Promise but isn't awaited. If the save fails (e.g., quota exceeded), the error is silently swallowed.

### 8. Exit button commented out but `onExit` still wired
**File:** `src/content/overlay/Toolbar.ts` · Lines 191-193

The exit `<button>` is commented out, but `this.toolbar.onExit = () => this.deactivate();` in `Overlay.ts` still sets the callback. Dead code path.

### 9. `handleUrlChange()` can race on SPA navigation
**File:** `src/content/index.ts`

`setupUrlMonitoring()` uses both:
- `requestAnimationFrame` loop checking `window.location.href`
- `popstate`/`hashchange` event listeners

Both paths call `handleUrlChange()`, which is **not** debounced. If an SPA fires both a popstate AND the rAF detects a URL change simultaneously, `handleUrlChange()` can run twice and create duplicate markers / feedback managers.

### 10. No protected members pattern — `isActive` etc. are public
**File:** `src/content/overlay/Overlay.ts`

```ts
public isActive = false;
```

The `isActive`, `isPaused`, `markersVisible`, `targetElement`, `isModalOpen` fields are all `public`. Nothing prevents external code from setting them incorrectly, which could desync the overlay state.

---

## Minor issues

### 11. `Toolbar` constructor ignores the `_settings` parameter
**Line 144:** `constructor(shadowRoot, _settings)` — underscore-prefixed but never used. If we wanted theme-aware toolbar styling, this would be the injection point.

### 12. `click` handler on toolbar buttons doesn't stop propagation
Toolbar buttons call `onclick` which fires, but the document-level `mousedown`/`click` listeners in the Overlay also fire. The click event propagates up from the shadow DOM host (`.container`), and the overlay's `handleClick` ignores clicks inside its shadow DOM — but only *after* checking `this.shadowRoot.contains(target)`. The `target` is retargeted for shadow DOM, so the check may or may not work depending on the browser's retargeting behavior.

### 13. `element.className` check for SVG elements
**File:** `src/content/overlay/FeedbackModal.ts` · `formatElementInfo()`

```ts
typeof element.className === 'string'
```

SVG elements have `SVGAnimatedString` className, which would slip past this check silently. Not a practical issue (you'd never annotate an SVG), but a bomb waiting for the wrong element.

### 14. `document.querySelector(feedback.element.selector)` can fail silently
**File:** `src/content/overlay/Overlay.ts` · `handleEditFeedback()`

If the original element's selector no longer exists (DOM changed), the fallback `placeholder` creates a fake `div` with `textContent = 'Element not found'` and shows it in the modal. The user can edit their comment but the element reference is lost — the marker update won't re-attach to anything.

---

## Summary

| Severity | Count | Key ones |
|---|---|---|
| Critical | 6 | Wrong timestamps, C breaks text selection, alert(), clearAfterCopy not live, hardcoded dark theme, fragile CSS selectors |
| Medium | 4 | fire-and-forget save, dead exit code, SPA race, public fields |
| Minor | 4 | unused param, shadow DOM retargeting, SVG className, lost element fallback |

## Plan to fix:

1. MarkdownFormatter — use item.timestamp
2. Keyboard C — add selected-text guard, replace alert() with in-overlay toast, respect clearAfterCopy
3. Reindex save — await it + catch handler
4. clearAfterCopy live update — send settings change to content script
5. Overlay theme — inject theme tokens into overlay shadow DOM based on settings.theme
6. Toolbar selectors — switch to data-action attributes
7. handleUrlChange — debounce
8. Remove dead exit code path
9. SPA navigation race — fix
