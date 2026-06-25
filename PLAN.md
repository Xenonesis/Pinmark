# Plan: Better Output than Agentation

## Context

The user wants Pinmark's Markdown output to be **better than Agentation** (`https://www.agentation.com/output`). Currently, Pinmark has a basic Markdown formatter (`MarkdownFormatter.ts`) with three output detail levels (minimal, standard, comprehensive). Agentation offers a cleaner, more scannable format with four levels (Compact, Standard, Detailed, Forensic) and includes viewport info, smarter element naming, and better AI-agent-friendly structure.

Pinmark already has **more data** than Agentation (console logs, network requests, browser state, session recording, screenshots, component props, computed styles, accessibility info, animations, etc.) — but the current formatter doesn't present it well.

## Approach

Revamp `MarkdownFormatter.ts` to:
1. **Match Agentation's clean, scannable format** — and then exceed it with richer data
2. **Add a 4th output detail level** (`'forensic'`) matching Agentation's Forensic mode
3. **Improve the header** with viewport info and better metadata
4. **Restructure per-item output** to use Agentation-style concise format with smart element naming
5. **Include all of Pinmark's unique data** (console logs, network requests, state, screenshots, etc.) in the appropriate detail levels
6. **Update UI** in the popup to reflect the new level naming and add forensic option

## Output Format Comparison

### Agentation (target to match then exceed)
```
## Page Feedback: /dashboard
**Viewport:** 1512x738

### 1. button.submit-btn
**Location:** `.form-container > .actions > button.submit-btn`
**Source:** src/components/FormActions.tsx:42:5
**Classes:** `submit-btn primary`
**React:** `<App> <Dashboard> <FormActions> <SubmitButton>`
**Position:** 450, 320 (120x40)
**Feedback:** Button text should say "Save" not "Submit"
```

### New Pinmark Format (better than Agentation)
```
## Page Feedback: /dashboard
**Captured:** 2024-01-01 12:00:00
**Viewport:** 1512x738
**Items:** 2

### 1. button.submit-btn
**Location:** `.form-container > .actions > button.submit-btn`
**Source:** `src/components/FormActions.tsx:42:5`
**Classes:** `submit-btn primary`
**React:** `<App> <Dashboard> <FormActions> <SubmitButton>`
**Position:** 450, 320 (120×40)
**Feedback:** Button text should say "Save" not "Submit"

### 2. "Settings" (span.nav-label)
**Location:** `.sidebar > nav > .nav-item > span`
**Source:** `src/components/Sidebar.tsx:28:12`
**React:** `<App> <Sidebar> <NavItem>`
**Selected:** "Settigns"
**Feedback:** Typo — should be "Settings"

---

### Forensic / Comprehensive extras (below separator, per-level):
- **Computed Styles** (forensic)
- **Animations & Transitions** (comprehensive+)
- **Component Props** (comprehensive+)
- **Accessibility** (comprehensive+)
- **Data Attributes** (comprehensive+)
- **Bounding Box** (detailed+)
- **Console Logs** (forensic)
- **Network Requests** (forensic)
- **Browser State** (forensic)
- **Screenshot** (comprehensive+, as collapsible detail)
```

## Files to Modify

| File | Changes |
|------|---------|
| `packages/pinmark/src/vanilla/MarkdownFormatter.ts` | Core rewrite — new format, forensic level, all improvements |
| `packages/pinmark/src/core/types.ts` | Add `'forensic'` to `outputDetail` type |
| `packages/extension/src/shared/types.ts` | Add `'forensic'` to `ExtensionSettings.outputDetail` |
| `packages/extension/src/shared/storage.ts` | Update default settings to include forensic |
| `packages/extension/src/popup/popup.ts` | Add forensic option in dropdown, update labels |
| `packages/extension/src/popup/index.html` | Update dropdown options |
| `packages/pinmark/src/vanilla/Overlay.ts` | Minor — pass settings type updates |

## Reuse

- **Existing schema types** (`@pinmark/core`): `PinmarkAnnotation`, `ElementInfo`, `ComponentInfo` — all data already captured
- **Existing `ElementAnalyzer`**: Already extracts computed styles, animations, accessibility, data attributes
- **Existing `FrameworkDetector`**: Already detects component hierarchy and source files
- **Existing settings pipeline**: Settings flow from popup → storage → content script → Overlay → MarkdownFormatter
- **Existing detail levels**: `minimal`, `standard`, `comprehensive` — just adding `'forensic'`

## Steps

### Step 1: Add `'forensic'` to type definitions
- `packages/pinmark/src/core/types.ts`: Add `'forensic'` to `outputDetail` union
- `packages/extension/src/shared/types.ts`: Add `'forensic'` to `ExtensionSettings.outputDetail`

### Step 2: Rewrite `MarkdownFormatter.ts`
- **New header format**: Include viewport (`window.innerWidth × window.innerHeight`), captured timestamp, item count
- **New per-item format**: `### N. SmartName (tag.selector)` with Agentation-style fields
- **Detail levels**:
  - **compact** = `Feedback #`, comment, element tag + selector only
  - **standard** = Adds classes, ID, text content, component info, source file
  - **detailed** = Adds position, data attributes, bounding box, hierarchy, selected text, area rect
  - **forensic** = Adds computed styles, all component props, accessibility, animations/transitions, console logs, network requests, browser state, screenshot (collapsible)
- **Smart element naming**: Use text content, placeholder, alt text, or `tag.class` as the element name in heading
- **Better section labels**: `**Location:**`, `**Source:**`, `**React:**` (matching Agentation) — plus Pinmark-unique labels
- **Better markdown structure**: Use consistent separator, compact key-value format

### Step 3: Update popup UI
- `packages/extension/src/popup/index.html`: Add "Forensic" as 4th option in the output detail select
- `packages/extension/src/popup/popup.ts`: Update the option mapping for labels, add forensic to dropdown options

### Step 4: Update storage defaults
- `packages/extension/src/shared/storage.ts`: Already includes all levels since it's dynamically read from settings

### Step 5: Verify and test
- Build the project: `npm run build`
- Test the output format manually by checking the generated markdown
- Verify settings flow from popup → overlay → formatter

## Verification

1. **Build check**: `npm run build` succeeds
2. **Manual test**: Load extension in Chrome, create annotations, copy markdown at each detail level
3. **Format verification**: Check that:
   - Compact output matches Agentation's compact format
   - Standard output matches Agentation's standard format
   - Detailed output exceeds Agentation's detailed format
   - Forensic output includes computed styles, console logs, network requests, state
4. **Edge cases**: No annotations, single annotation, annotations with all fields populated

## Detailed Output Format Specification

### Compact (matches Agentation Compact)
```markdown
## Page Feedback: /dashboard
**Viewport:** 1512×738

### 1. button.submit-btn
**Feedback:** Make the button blue
```

### Standard (matches/exceeds Agentation Standard)
```markdown
## Page Feedback: /dashboard
**Captured:** 2024-01-01 12:00:00
**Viewport:** 1512×738
**Items:** 1

### 1. button.submit-btn
**Location:** `.form-container > .actions > button.submit-btn`
**Source:** `src/components/FormActions.tsx:42:5`
**Classes:** `submit-btn primary`
**React:** `<App> <Dashboard> <FormActions> <SubmitButton>`
**Feedback:** Make the button blue
```

### Detailed (exceeds Agentation Detailed)
```markdown
## Page Feedback: /dashboard
**Captured:** 2024-01-01 12:00:00
**Viewport:** 1512×738
**Items:** 1

### 1. "Submit" (button.submit-btn)
**Location:** `.form-container > .actions > button.submit-btn`
**Source:** `src/components/FormActions.tsx:42:5`
**Classes:** `submit-btn primary`
**ID:** `submit-btn`
**React:** `<App> <Dashboard> <FormActions> <SubmitButton>`
**Position:** 450, 320 (120×40)
**Selected:** "Submit form now"
**Feedback:** Make the button blue
```

### Forensic (beyond Agentation — Pinmark exclusive)
```markdown
## Page Feedback: /dashboard
**Captured:** 2024-01-01 12:00:00
**Viewport:** 1512×738
**Items:** 1

### 1. "Submit" (button.submit-btn)
**Location:** `.form-container > .actions > button.submit-btn`
**Source:** `src/components/FormActions.tsx:42:5`
**Classes:** `submit-btn primary`
**ID:** `submit-btn`
**React:** `<App> <Dashboard> <FormActions> <SubmitButton>`
**Position:** 450, 320 (120×40)
**Selected:** "Submit form now"
**Feedback:** Make the button blue

#### Computed Styles
```css
{
  "display": "inline-flex",
  "align-items": "center",
  "color": "#ffffff",
  "background-color": "#3b82f6",
  ...
}
```

#### Animations
- **Animation**: `pulse` (1.2s, ease-in-out)

#### Console Logs (3)
```
[LOG] Form submitted successfully
[WARN] Deprecated API used
[ERROR] Failed to load resource
```

#### Network Requests (2)
- `POST /api/submit` → 200 (1.2s)
- `GET /api/config` → 304 (0.3s)

#### Browser State
- **Cookies:** session=abc123; theme=dark
- **localStorage:** `user_prefs`, `session_data`
- **sessionStorage:** `temp_token`

<details><summary>Element Screenshot</summary>
<img src="data:image/jpeg;base64,..." alt="Element" width="400" />
</details>
```
