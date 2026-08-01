// Best-effort micro accessibility audit of the pinned element (and its
// interactive/text descendants) against WCAG 2.1 AA checks. Runs at pin time;
// results are attached to the pin so the AI can fix accessibility along with
// the reported bug. All checks are defensive and never throw.

export interface A11yIssue {
  type: 'contrast' | 'image-alt' | 'button-name' | 'label' | 'tabindex';
  severity: 'error' | 'warning';
  message: string;
  wcag: string;
  detail?: string;
}

const MAX_AUDITED = 30;

interface RGB { r: number; g: number; b: number; a: number }

function parseColor(value: string): RGB | null {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(',').map((p) => parseFloat(p.trim()));
  if (parts.length < 3) return null;
  return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
}

function relativeLuminance(c: RGB): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

function contrastRatio(fg: RGB, bg: RGB): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Walk up from the element to find the first non-transparent background. */
function effectiveBackground(el: HTMLElement): RGB {
  let node: HTMLElement | null = el;
  while (node) {
    const bg = parseColor(getComputedStyle(node).backgroundColor);
    if (bg && bg.a > 0.05) return bg;
    node = node.parentElement;
  }
  return { r: 255, g: 255, b: 255, a: 1 };
}

function isLargeText(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  const size = parseFloat(style.fontSize) || 16;
  const weight = parseInt(style.fontWeight, 10) || 400;
  return size >= 24 || (size >= 18.66 && weight >= 700);
}

function hasVisibleText(el: HTMLElement): boolean {
  if (el.getAttribute('aria-hidden') === 'true') return false;
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const text = (el.textContent || '').trim();
  if (text.length === 0) return false;
  // Skip elements whose only text is whitespace/emoji-only icon glyphs.
  return /\w|\p{L}/u.test(text);
}

function accessibleName(el: HTMLElement): string {
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const refs = labelledBy.split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
    if (refs.length) return refs.join(' ');
  }
  const title = el.getAttribute('title');
  if (title && title.trim()) return title.trim();
  const alt = el.getAttribute('alt');
  if (alt && alt.trim()) return alt.trim();
  const text = (el.textContent || '').trim();
  if (text) return text;
  const input = el as HTMLInputElement;
  if (input.value && ['submit', 'button', 'reset'].includes(input.type)) return input.value.trim();
  return '';
}

function isInteractive(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === 'button' || tag === 'select' || tag === 'textarea') return true;
  if (tag === 'a') return el.hasAttribute('href');
  if (tag === 'input') {
    const type = (el as HTMLInputElement).type;
    return type !== 'hidden';
  }
  return false;
}

/** True for form controls; they are reported via the dedicated label check. */
function isFormControl(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'select' || tag === 'textarea';
}

function needsExplicitLabel(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag !== 'input' && tag !== 'select' && tag !== 'textarea') return false;
  const type = (el as HTMLInputElement).type;
  if (tag === 'input' && ['button', 'submit', 'reset', 'hidden'].includes(type)) return false;
  const name = accessibleName(el);
  if (name) return false;
  if (el.getAttribute('placeholder')) return false; // placeholder is a weak label; not flagged
  if (tag === 'input' && ['checkbox', 'radio'].includes(type)) return false;
  return true;
}

function auditContrast(el: HTMLElement, issues: A11yIssue[]) {
  if (!hasVisibleText(el)) return;
  const style = getComputedStyle(el);
  const fg = parseColor(style.color);
  if (!fg || fg.a < 0.5) return;
  const bg = effectiveBackground(el);
  const ratio = contrastRatio(fg, bg);
  const required = isLargeText(el) ? 3 : 4.5;
  if (ratio < required) {
    issues.push({
      type: 'contrast',
      severity: 'error',
      message: `Text contrast ${ratio.toFixed(2)}:1 is below WCAG AA ${required.toFixed(1)}:1${isLargeText(el) ? ' (large text)' : ''}.`,
      wcag: '1.4.3',
      detail: `foreground ${style.color}, background rgb(${bg.r}, ${bg.g}, ${bg.b})`,
    });
  }
}

function auditImgAlt(el: HTMLElement, issues: A11yIssue[]) {
  if (el.tagName.toLowerCase() !== 'img') return;
  if (!el.hasAttribute('alt')) {
    issues.push({
      type: 'image-alt',
      severity: 'error',
      message: `<img> has no alt attribute; screen readers will announce the filename.`,
      wcag: '1.1.1',
    });
  }
}

function auditInteractiveName(el: HTMLElement, issues: A11yIssue[]) {
  if (!isInteractive(el)) return;
  if (isFormControl(el)) return; // label check reports form controls
  if (!accessibleName(el)) {
    issues.push({
      type: 'button-name',
      severity: 'error',
      message: `<${el.tagName.toLowerCase()}> has no accessible name (add aria-label, title, or text content).`,
      wcag: '4.1.2',
    });
  }
}

function auditLabel(el: HTMLElement, issues: A11yIssue[]) {
  if (needsExplicitLabel(el)) {
    issues.push({
      type: 'label',
      severity: 'error',
      message: `<${el.tagName.toLowerCase()}> has no associated <label> (use label[for="${el.id}"] or aria-label).`,
      wcag: '4.1.2',
    });
  }
}

function auditTabindex(el: HTMLElement, issues: A11yIssue[]) {
  const ti = el.getAttribute('tabindex');
  if (ti !== null) {
    const value = parseInt(ti, 10);
    if (!isNaN(value) && value > 0) {
      issues.push({
        type: 'tabindex',
        severity: 'warning',
        message: `Positive tabindex="${value}" disrupts natural focus order; use tabindex="0" or DOM order.`,
        wcag: '2.4.3',
      });
    }
  }
}

/** Audit the pinned element plus a bounded set of text/interactive descendants. */
export function auditA11y(element: HTMLElement): A11yIssue[] | undefined {
  if (!element || element.nodeType !== 1) return undefined;
  try {
    const candidates: HTMLElement[] = [element];
    const selector = 'button, img, input, select, textarea, a[href], [tabindex], h1, h2, h3, h4, h5, h6, p, label, li';
    if (!element.matches(selector)) {
      const found = element.querySelectorAll(selector);
      for (let i = 0; i < found.length && candidates.length < MAX_AUDITED; i++) {
        candidates.push(found[i] as HTMLElement);
      }
    }
    const issues: A11yIssue[] = [];
    for (const el of candidates) {
      auditContrast(el, issues);
      auditImgAlt(el, issues);
      auditInteractiveName(el, issues);
      auditLabel(el, issues);
      auditTabindex(el, issues);
    }
    return issues.length ? issues : undefined;
  } catch {
    return undefined;
  }
}
