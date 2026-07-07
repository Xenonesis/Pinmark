import { FrameworkDetector } from './FrameworkDetector.js';


const HOVER_BOX_STYLES = `
  .pinmark-hover-box {
    position: absolute;
    border: 1.5px solid var(--pmk-accent, #3b82f6);
    background-color: rgba(59, 130, 246, 0.06);
    pointer-events: none;
    transition: top 0.08s ease-out, left 0.08s ease-out, width 0.08s ease-out, height 0.08s ease-out;
    z-index: 2147483644;
    box-sizing: border-box;
  }

  .pinmark-hover-label {
    position: absolute;
    top: -26px;
    left: 0;
    background: var(--pmk-bg-2, #111827);
    border: 1px solid var(--pmk-border, rgba(255,255,255,0.1));
    border-radius: 5px;
    padding: 2px 8px;
    font-size: 11px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Fira Code', monospace;
    color: var(--pmk-text, #f9fafb);
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 5px;
    max-width: 320px;
    overflow: hidden;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    line-height: 1.4;
  }

  .pinmark-hover-label-tag {
    color: var(--pmk-text-muted, #9ca3af);
    font-weight: 500;
    flex-shrink: 0;
  }

  .pinmark-hover-label-id {
    color: var(--pmk-text-muted, #9ca3af);
  }

  .pinmark-hover-label-class {
    color: var(--pmk-text-muted, #6b7280);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pinmark-hover-label-divider {
    width: 1px;
    height: 10px;
    background: var(--pmk-border, rgba(255,255,255,0.12));
    flex-shrink: 0;
  }

  .pinmark-hover-label-component {
    color: var(--pmk-text-muted, #9ca3af);
    font-weight: 400;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 11px;
    flex-shrink: 0;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pinmark-hover-label-dims {
    color: var(--pmk-text-muted, #6b7280);
    font-size: 10px;
    flex-shrink: 0;
    margin-left: auto;
  }
`;

export class HoverBox {
  private element: HTMLElement;
  private label: HTMLElement;
  private currentElement: HTMLElement | null = null;
  private frameworkDetector: FrameworkDetector;

  constructor(shadowRoot: ShadowRoot) {
    this.frameworkDetector = new FrameworkDetector();

    this.element = document.createElement('div');
    this.element.className = 'pinmark-hover-box';
    this.element.style.display = 'none';

    this.label = document.createElement('div');
    this.label.className = 'pinmark-hover-label';
    this.element.appendChild(this.label);

    const style = document.createElement('style');
    style.textContent = HOVER_BOX_STYLES;
    shadowRoot.appendChild(style);
    shadowRoot.appendChild(this.element);
  }

  show(target: HTMLElement) {
    if (this.currentElement === target) return;
    this.currentElement = target;

    const rect = target.getBoundingClientRect();
    this.element.style.top = `${rect.top}px`;
    this.element.style.left = `${rect.left}px`;
    this.element.style.width = `${rect.width}px`;
    this.element.style.height = `${rect.height}px`;
    this.element.style.display = 'block';

    // Build label content
    this.label.innerHTML = this.buildLabelHTML(target, rect);
  }

  private buildLabelHTML(target: HTMLElement, rect: DOMRect): string {
    const tag = target.tagName.toLowerCase();
    // Smart name: for button/a/label, use text content
    const smartName = this.getSmartName(target);
    const id = target.id ? `<span class="pinmark-hover-label-id">#${target.id}</span>` : '';
    const classes = target.classList.length > 0
      ? Array.from(target.classList)
          .filter(c => !c.startsWith('pinmark'))
          .slice(0, 2)
          .map(c => `<span class="pinmark-hover-label-class">.${c}</span>`)
          .join('')
      : '';

    // Try to get React/Vue/etc component
    let componentHTML = '';
    try {
      const component = this.frameworkDetector.detect(target);
      if (component && component.name && component.name !== 'Unknown') {
        const prefix = component.framework === 'react' ? '⚛' : component.framework === 'vue' ? '💚' : '🔷';
        componentHTML = `
          <span class="pinmark-hover-label-divider"></span>
          <span class="pinmark-hover-label-component">${prefix} ${component.name}</span>
        `;
      }
    } catch (e) {
      // Ignore detection errors
    }

    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    const dimsHTML = `<span class="pinmark-hover-label-dims">${w}×${h}</span>`;

    if (smartName) {
      return `
        <span class="pinmark-hover-label-tag">&lt;${tag}&gt;</span>
        <span class="pinmark-hover-label-class">"${smartName}"</span>
        ${componentHTML}
        ${dimsHTML}
      `;
    }

    return `
      <span class="pinmark-hover-label-tag">&lt;${tag}&gt;</span>
      ${id}
      ${classes}
      ${componentHTML}
      ${dimsHTML}
    `;
  }

  private getSmartName(element: HTMLElement): string | null {
    const tag = element.tagName.toLowerCase();
    // For interactive/labelled elements, use text content as name
    if (['button', 'a', 'label', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
      const text = element.textContent?.trim();
      if (text && text.length < 60) return text;
    }
    // For inputs, use placeholder or name attr
    if (tag === 'input' || tag === 'textarea') {
      return (element as HTMLInputElement).placeholder || element.getAttribute('name') || null;
    }
    // For img, use alt
    if (tag === 'img') {
      return (element as HTMLImageElement).alt || null;
    }
    return null;
  }

  hide() {
    this.element.style.display = 'none';
    this.currentElement = null;
    this.label.innerHTML = '';
  }
}
