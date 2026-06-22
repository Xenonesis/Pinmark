# Plan: Refactor + Interactive Architecture/Settings/Lineage

## Phase 1 — Refactor (no functionality loss)

1. Add clear section comment headers in the main `<script>` IIFE
   (theme, hero, tryit, starfield, repo-stars already grouped)
2. Verify no dead CSS rules — scan for selectors with no HTML usage
3. Tidy the repoStars IIFE — currently nests fetch + cache cleanly,
   add section comment
4. Confirm every interactive feature still works after each phase

## Phase 2 — Architecture: visually interactive

Current: 4 static cards (background, content, ui, shared)

New: SVG data-flow diagram at top showing how a click flows through
the components, with the 4 cards below. Hover/click on a node highlights
the matching card and draws a glowing path from the user's click to
that node.

Components:
- `.arch-diagram` (SVG with 4 nodes + animated arrows)
- 4 cards stay, gain `.is-active` state when matching node hovered
- Pure CSS animations for the click→message→response flow (looping
  pulse along the path)
- `prefers-reduced-motion` disables the pulse

## Phase 3 — Settings: interactive previews

Current: 6 static description cards

New: each card becomes a mini live widget showing the setting in
action. Clicking changes something visible in the card.

| Setting | Interactive behavior |
|---|---|
| Marker color | Click swatch: cycles preset colors, shows a real numbered marker preview |
| Detail level | Click 3 chips (min/std/comp), shows sample markdown line count changing |
| Theme | Click 3 chips (light/dark/auto), previews the card itself in that theme |
| Clear after copy | Click toggle, shows toolbar "after copy" state (with/without markers) |
| Block interactions | Click toggle, the card dims as if frozen |
| Keyboard map | Hover the row, highlights the matching key visual |

## Phase 4 — Lineage (comparison): interactive + cleanup

Per feedback #1: remove the landing-page feature rows from the table.
The remaining comparison focuses on the EXTENSION (what users get when
they install). Remaining rows:

Shared (kept):
- Visual markers + hover outline
- Markdown feedback export
- Shadow DOM isolation
- Framework detection (React / Angular)
- Keyboard shortcuts
- Per-page feedback persistence
- Chrome MV3 · TypeScript 5.6

Removed (landing-page features):
- Interactive landing page (auto-play hero)
- Live two-pane "try it" demo
- Live GitHub stars badge
- GitHub Pages site
- Custom pin logo + favicon

Pinmark extensions (kept, rewritten as extension features):
- 3-mode theme in popup (auto/light/dark)        — Areshkew: popup only
- Unified ThemeProvider (storage-agnostic)       — Areshkew: —
- Active maintenance & releases                  — Areshkew: static
- Markdown captures framework component name     — Areshkew: —

Interactive layer (per feedback #1 "isko aur interactive bnao"):
- Click any row → expands an inline detail block below with a short
  explanation of why that row matters
- Hover → row glows accent color, plus a small "i" appears on the
  right
- "Show only differences" toggle at the top filters out shared rows

## Phase 5 — Verify

Open file in browser, walk through every section, ensure no
regressions in:
- Theme toggle (3-mode cycle)
- Starfield canvas
- Hero auto-cycle + hover + click
- Try-it auto-click + manual + copy + reset
- New: architecture diagram pulses
- New: settings cards react to clicks
- New: comparison table click-to-expand + diff toggle
- Repo badge live stars
- All anchor links work

Push.