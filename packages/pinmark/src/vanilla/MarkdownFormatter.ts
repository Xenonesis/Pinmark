import type { PinmarkSettings as ExtensionSettings } from '../core/types.js';
import type { PinmarkAnnotation as FeedbackItem } from '@pinmark/core';

type DetailLevel = 'minimal' | 'compact' | 'standard' | 'detailed' | 'comprehensive' | 'forensic';

/**
 * Pinmark MarkdownFormatter — produces AI-agent-friendly Markdown output
 * that meets or exceeds the Agentation output format.
 *
 * Detail levels (mapped from settings):
 *   minimal/compact  → Compact (element + feedback only)
 *   standard         → Standard (adds location, classes, source, component)
 *   detailed         → Detailed (adds position, selection, data attrs, bounding box)
 *   comprehensive    → Detailed+ (adds animations, props, accessibility, screenshot)
 *   forensic         → Forensic (adds computed styles, console, network, state)
 */
export class MarkdownFormatter {
  format(url: string, feedback: FeedbackItem[], settings?: ExtensionSettings): string {
    const rawLevel = settings?.outputDetail || 'standard';
    const detail = this.normalizeDetailLevel(rawLevel);

    // Earliest captured timestamp
    const ts = feedback.length > 0
      ? feedback.reduce((earliest, item) => item.timestamp < earliest ? item.timestamp : earliest, feedback[0].timestamp)
      : Date.now();

    // Viewport — captured at format time (best approximation)
    let viewportW = 1512;
    let viewportH = 738;
    try {
      viewportW = window.innerWidth;
      viewportH = window.innerHeight;
    } catch {
      // Not in browser context; keep defaults
    }

    const pathname = (() => {
      try { return new URL(url).pathname; } catch { return url; }
    })();

    let markdown = `## Page Feedback: ${pathname}\n`;

    if (detail === 'compact') {
      markdown += `**Viewport:** ${viewportW}×${viewportH}\n`;
    } else {
      markdown += `**Captured:** ${new Date(ts).toISOString().replace('T', ' ').substring(0, 19)}\n`;
      markdown += `**Viewport:** ${viewportW}×${viewportH}\n`;
      markdown += `**Items:** ${feedback.length}\n`;
    }

    markdown += '\n';

    for (const item of feedback) {
      markdown += this.formatFeedback(item, detail);
      markdown += '\n---\n\n';
    }

    return markdown;
  }

  /** Format a single feedback item (no report wrapper) for per-marker copy. */
  formatItem(item: FeedbackItem, settings?: ExtensionSettings): string {
    const rawLevel = settings?.outputDetail || 'standard';
    const detail = this.normalizeDetailLevel(rawLevel);
    let md = this.formatFeedback(item, detail);
    md = md.replace(/\n---\n\n$/, '');
    return md.trim() + '\n';
  }

  /** Normalize legacy/aliased detail levels to the 5-point scale. */
  private normalizeDetailLevel(level: string): DetailLevel {
    switch (level) {
      case 'minimal':
      case 'compact':
        return 'compact';
      case 'standard':
        return 'standard';
      case 'detailed':
        return 'detailed';
      case 'comprehensive':
        return 'comprehensive';
      case 'forensic':
        return 'forensic';
      default:
        return 'standard';
    }
  }

  private formatFeedback(item: FeedbackItem, detail: DetailLevel): string {
    const elem = item.element;
    const tag = elem.tagName || 'div';

    // ── Smart element name ──────────────────────────────────────
    const smartName = this.getSmartName(item);
    const headingClass = elem.classes.length > 0 ? `.${elem.classes[0]}` : '';
    const heading = smartName
      ? `### ${item.index}. "${smartName}" (${tag}${headingClass})`
      : `### ${item.index}. ${tag}${headingClass}`;

    let md = `${heading}\n`;

    // Comment always shown
    if (item.comment) {
      md += `**Feedback:** ${item.comment}\n`;
    }

    if (detail === 'compact') {
      return md;
    }

    // ── Location (selector) ─────────────────────────────────────
    if (elem.selector) {
      md += `**Location:** \`${elem.selector}\`\n`;
    }

    // ── Source file (from component detection) ─────────────────
    if (elem.component?.filePath) {
      let source = `\`${elem.component.filePath}`;
      if (elem.component.lineNumber) {
        source += `:${elem.component.lineNumber}`;
      }
      source += '`';
      md += `**Source:** ${source}\n`;
    }

    // ── Classes ─────────────────────────────────────────────────
    if (elem.classes.length > 0) {
      md += `**Classes:** \`${elem.classes.join(' ')}\`\n`;
    }

    // ── ID ───────────────────────────────────────────────────────
    if (elem.id) {
      md += `**ID:** \`${elem.id}\`\n`;
    }

    // ── Component / Framework ────────────────────────────────────
    if (elem.component) {
      const hierarchy = elem.component.hierarchy;
      if (hierarchy && hierarchy.length > 0) {
        const frameworkLabel = elem.component.framework.charAt(0).toUpperCase() + elem.component.framework.slice(1);
        md += `**${frameworkLabel}:** \`${hierarchy.map(h => `<${h}>`).join(' ')}\`\n`;
      } else if (elem.component.name && elem.component.name !== 'Unknown') {
        md += `**Component:** \`${elem.component.name}\`\n`;
      }
    }

    if (detail === 'standard') {
      return md;
    }

    // ── Position ─────────────────────────────────────────────────
    const rect = elem.boundingRect;
    if (rect) {
      md += `**Position:** ${Math.round(rect.x)}, ${Math.round(rect.y)} (${Math.round(rect.width)}×${Math.round(rect.height)})\n`;
    }

    // ── Selected Text ────────────────────────────────────────────
    if (elem.selectionText) {
      const sel = elem.selectionText.length > 80
        ? elem.selectionText.substring(0, 80) + '…'
        : elem.selectionText;
      md += `**Selected:** "${sel}"\n`;
    }

    // ── Area Rect ────────────────────────────────────────────────
    if (item.areaRect) {
      md += `**Area:** x=${Math.round(item.areaRect.x)}, y=${Math.round(item.areaRect.y)}, w=${Math.round(item.areaRect.width)}, h=${Math.round(item.areaRect.height)}\n`;
    }

    if (detail === 'detailed') {
      return md;
    }

    // ── Text Content ─────────────────────────────────────────────
    if (elem.textContent) {
      const text = elem.textContent.length > 100
        ? elem.textContent.substring(0, 100) + '…'
        : elem.textContent;
      md += `**Text:** "${text}"\n`;
    }

    // ── Data Attributes ──────────────────────────────────────────
    if (Object.keys(elem.dataAttributes).length > 0) {
      const attrs = Object.entries(elem.dataAttributes)
        .map(([k, v]) => `\`${k}="${v}"\``)
        .join(', ');
      md += `**Data Attributes:** ${attrs}\n`;
    }

    // ── Animations ───────────────────────────────────────────────
    if ((elem as any).animations?.length > 0) {
      md += `\n#### Animations\n`;
      for (const anim of (elem as any).animations) {
        if (anim.type === 'css-animation') {
          md += `- **Animation**: \`${anim.name}\` (${anim.duration}, ${anim.timingFunction})\n`;
        } else {
          md += `- **Transition**: \`${anim.property}\` (${anim.duration}, ${anim.timingFunction})\n`;
        }
      }
    }

    // ── Component Props (comprehensive+) ────────────────────────
    if (elem.component?.props && Object.keys(elem.component.props).length > 0) {
      md += `\n#### Component Props\n`;
      for (const [key, value] of Object.entries(elem.component.props)) {
        const str = JSON.stringify(value);
        md += `- \`${key}\`: ${str.length > 60 ? str.substring(0, 60) + '…' : str}\n`;
      }
    }

    // ── Accessibility (comprehensive+) ──────────────────────────
    if (elem.accessibility && Object.keys(elem.accessibility).length > 0) {
      md += `\n#### Accessibility\n`;
      for (const [key, value] of Object.entries(elem.accessibility)) {
        md += `- \`${key}\`: "${value}"\n`;
      }
    }

    // ── Screenshot (comprehensive+, collapsible) ────────────────
    if (elem.screenshot) {
      md += `\n<details><summary>Element Screenshot</summary>\n\n<img src="${elem.screenshot}" alt="Element Screenshot" width="400" />\n\n</details>\n`;
    }

    if (detail === 'comprehensive') {
      return md;
    }

    // ═══════════════════════════════════════════════════════════════
    // FORENSIC — maximum detail, unique to Pinmark
    // ═══════════════════════════════════════════════════════════════

    // ── Computed Styles ──────────────────────────────────────────
    if (elem.computedStyles && Object.keys(elem.computedStyles).length > 0) {
      md += `\n#### Computed Styles\n\`\`\`json\n${JSON.stringify(elem.computedStyles, null, 2)}\n\`\`\`\n`;
    }

    // ── Bounding Box (always in forensic even if position shown) ─
    if (rect) {
      md += `\n#### Bounding Box\n`;
      md += `- **x:** ${Math.round(rect.x)}\n`;
      md += `- **y:** ${Math.round(rect.y)}\n`;
      md += `- **width:** ${Math.round(rect.width)}\n`;
      md += `- **height:** ${Math.round(rect.height)}\n`;
      md += `- **top:** ${Math.round(rect.top)}\n`;
      md += `- **right:** ${Math.round(rect.right)}\n`;
      md += `- **bottom:** ${Math.round(rect.bottom)}\n`;
      md += `- **left:** ${Math.round(rect.left)}\n`;
    }

    // ── Console Logs ─────────────────────────────────────────────
    if (item.consoleLogs && item.consoleLogs.length > 0) {
      const logs = item.consoleLogs.slice(-10); // last 10
      md += `\n#### Console Logs (${item.consoleLogs.length})\n`;
      md += '```\n';
      for (const log of logs) {
        const method = log.method || 'log';
        const args = log.args || [];
        const line = args.map((a: any) => {
          try { return typeof a === 'string' ? a : JSON.stringify(a); } catch { return String(a); }
        }).join(' ');
        md += `[${method.toUpperCase()}] ${line}\n`;
      }
      md += '```\n';
    }

    // ── Network Requests ─────────────────────────────────────────
    if (item.networkRequests && item.networkRequests.length > 0) {
      const reqs = item.networkRequests.slice(-10); // last 10
      md += `\n#### Network Requests (${item.networkRequests.length})\n`;
      for (const req of reqs) {
        const method = (req.method || 'GET').toUpperCase();
        const urlStr = req.url || req.path || '?';
        const status = req.status || '…';
        const duration = req.duration ? `${(req.duration / 1000).toFixed(1)}s` : '…';
        md += `- \`${method} ${urlStr}\` → ${status} (${duration})\n`;
      }
    }

    // ── Browser State ────────────────────────────────────────────
    if (item.state) {
      md += `\n#### Browser State\n`;
      if (item.state.cookies) {
        const cookieStr = item.state.cookies.length > 120
          ? item.state.cookies.substring(0, 120) + '…'
          : item.state.cookies;
        md += `- **Cookies:** \`${cookieStr}\`\n`;
      }
      if (item.state.localStorage && Object.keys(item.state.localStorage).length > 0) {
        const keys = Object.keys(item.state.localStorage).slice(0, 10);
        md += `- **localStorage:** \`${keys.join('`, `')}\`${Object.keys(item.state.localStorage).length > 10 ? ` … and ${Object.keys(item.state.localStorage).length - 10} more` : ''}\n`;
      }
      if (item.state.sessionStorage && Object.keys(item.state.sessionStorage).length > 0) {
        const keys = Object.keys(item.state.sessionStorage).slice(0, 10);
        md += `- **sessionStorage:** \`${keys.join('`, `')}\`${Object.keys(item.state.sessionStorage).length > 10 ? ` … and ${Object.keys(item.state.sessionStorage).length - 10} more` : ''}\n`;
      }
    }

    // ── Session Recording (rrweb) ────────────────────────────────
    if (item.sessionRecording && item.sessionRecording.length > 0) {
      md += `\n#### Session Recording\n`;
      md += `- **Events captured:** ${item.sessionRecording.length}\n`;
      md += `- *Replay available via MCP server*\n`;
    }

    return md;
  }

  /**
   * Generate a smart human-readable name for the element.
   * Priority:
   *   1. Selection text (if present and short)
   *   2. Text content of interactive elements (button, a, label, h1-h6)
   *   3. Input placeholder / name
   *   4. Image alt text
   *   5. Component name
   *   6. First class name
   *   7. Tag name
   */
  private getSmartName(item: FeedbackItem): string | undefined {
    const elem = item.element;

    // 1. Selection text
    if (elem.selectionText && elem.selectionText.length < 60) {
      return elem.selectionText;
    }

    // 2. Interactive element text content
    const interactiveTags = ['button', 'a', 'label', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'strong', 'em'];
    if (interactiveTags.includes(elem.tagName) && elem.textContent) {
      const text = elem.textContent.trim();
      if (text && text.length < 60) return text;
    }

    // 3. Input/textarea placeholder or name
    if (elem.tagName === 'input' || elem.tagName === 'textarea') {
      // dataAttributes might have placeholder
      if (elem.dataAttributes) {
        const placeholder = elem.dataAttributes['placeholder'] || elem.dataAttributes['name'];
        if (placeholder) return placeholder;
      }
    }

    // 4. Image alt text
    if (elem.tagName === 'img' && elem.dataAttributes) {
      const alt = elem.dataAttributes['alt'];
      if (alt) return alt;
    }

    // 5. Component name
    if (elem.component?.name && elem.component.name !== 'Unknown') {
      return elem.component.name;
    }

    // 6. First class name
    if (elem.classes.length > 0) {
      const cls = elem.classes[0];
      // Convert kebab-case to Title Case
      return cls
        .split(/[-_]/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }

    return undefined;
  }
}
