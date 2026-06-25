export class AreaSelectionBox {
  private element: HTMLElement;
  private startX = 0;
  private startY = 0;
  private isActive = false;

  constructor(shadowRoot: ShadowRoot) {
    const style = document.createElement('style');
    style.textContent = `
      .pinmark-area-selection {
        position: fixed;
        border: 2px dashed var(--pmk-accent, #3b82f6);
        background: rgba(59, 130, 246, 0.1);
        pointer-events: none;
        z-index: 2147483645;
        display: none;
      }
    `;
    shadowRoot.appendChild(style);

    this.element = document.createElement('div');
    this.element.className = 'pinmark-area-selection';
    shadowRoot.appendChild(this.element);
  }

  start(x: number, y: number) {
    this.startX = x;
    this.startY = y;
    this.isActive = true;
    this.element.style.display = 'block';
    this.update(x, y);
  }

  update(x: number, y: number) {
    if (!this.isActive) return;

    const width = Math.abs(x - this.startX);
    const height = Math.abs(y - this.startY);
    const left = Math.min(x, this.startX);
    const top = Math.min(y, this.startY);

    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
    this.element.style.width = `${width}px`;
    this.element.style.height = `${height}px`;
  }

  end(): DOMRect | null {
    if (!this.isActive) return null;
    this.isActive = false;

    // Read rect BEFORE hiding — getBoundingClientRect returns zeros after display:none
    const width = parseInt(this.element.style.width || '0', 10);
    const height = parseInt(this.element.style.height || '0', 10);
    
    let rect: DOMRect | null = null;
    if (width > 10 && height > 10) {
      rect = this.element.getBoundingClientRect();
    }

    this.element.style.display = 'none';
    return rect;
  }
}
