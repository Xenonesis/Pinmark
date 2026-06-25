export const LAUNCHER_STYLES = `
  :host {
    all: initial;
    display: block;
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483646;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .pinmark-launcher {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: #000;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: move;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s, background 0.2s;
    border: none;
    outline: none;
    padding: 0;
    position: relative;
    touch-action: none;
  }
  
  .pinmark-launcher:hover {
    transform: scale(1.08);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    background: #1a1a1a;
  }
  
  .pinmark-launcher:active {
    transform: scale(0.93);
  }

  .pinmark-launcher.active {
    background: #1d4ed8;
  }

  .pinmark-launcher.active:hover {
    background: #1e40af;
  }

  .pinmark-launcher-icon {
    display: flex;
    flex-direction: column;
    gap: 4.5px;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
  }

  .pinmark-launcher-line {
    width: 18px;
    height: 2px;
    background: #fff;
    border-radius: 2px;
    transform-origin: center;
    transition: transform 0.3s cubic-bezier(0.77, 0, 0.175, 1), opacity 0.3s ease, width 0.3s ease;
    display: block;
  }

  .pinmark-launcher.active .pinmark-launcher-line:nth-child(1) {
    transform: translateY(6.5px) rotate(45deg);
    width: 18px;
  }
  .pinmark-launcher.active .pinmark-launcher-line:nth-child(2) {
    opacity: 0;
    transform: scaleX(0);
  }
  .pinmark-launcher.active .pinmark-launcher-line:nth-child(3) {
    transform: translateY(-6.5px) rotate(-45deg);
    width: 18px;
  }

  .pinmark-launcher-badge {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 16px;
    height: 16px;
    background: #3b82f6;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    transition: opacity 0.2s;
  }

  .pinmark-launcher-badge svg {
    width: 100%;
    height: 100%;
  }

  .pinmark-tooltip {
    position: absolute;
    right: calc(100% + 10px);
    top: 50%;
    transform: translateY(-50%);
    background: rgba(0, 0, 0, 0.85);
    color: #fff;
    padding: 5px 10px;
    border-radius: 6px;
    font-size: 12px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
    font-family: system-ui, -apple-system, sans-serif;
  }

  .pinmark-launcher:hover .pinmark-tooltip {
    opacity: 1;
  }
`;

export class Launcher {
  private element: HTMLElement;
  private btn: HTMLButtonElement;
  private badgeEl: HTMLElement;
  public onClick?: () => void;

  constructor() {
    this.element = document.createElement('div');
    this.element.id = 'pinmark-launcher-host';
    const shadowRoot = this.element.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = LAUNCHER_STYLES;
    shadowRoot.appendChild(style);

    this.btn = document.createElement('button');
    this.btn.className = 'pinmark-launcher';
    this.btn.setAttribute('aria-label', 'Toggle Pinmark');

    // Hamburger / X icon
    const icon = document.createElement('div');
    icon.className = 'pinmark-launcher-icon';
    icon.innerHTML = `
      <span class="pinmark-launcher-line"></span>
      <span class="pinmark-launcher-line"></span>
      <span class="pinmark-launcher-line"></span>
    `;

    // Sparkle badge replaced by Pinmark logo (top-right of button)
    this.badgeEl = document.createElement('div');
    this.badgeEl.className = 'pinmark-launcher-badge';
    this.badgeEl.innerHTML = `<svg viewBox="0 0 128 128" aria-hidden="true"><path d="M64 118 C64 118 102 82 102 50 C102 26 86 8 64 8 C42 8 26 26 26 50 C26 82 64 118 64 118 Z" fill="#E11D48"/><circle cx="64" cy="48" r="14" fill="#FFFFFF"/><circle cx="64" cy="48" r="6" fill="#4338CA"/></svg>`;

    // Tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'pinmark-tooltip';
    tooltip.textContent = 'Pinmark';

    this.btn.appendChild(icon);
    this.btn.appendChild(this.badgeEl);
    this.btn.appendChild(tooltip);

    let isDragging = false;
    let startMouseX = 0;
    let startMouseY = 0;
    let startElLeft = 0;
    let startElTop = 0;
    let hasDragged = false;

    const dragStart = (e: PointerEvent) => {
      // Ignore right clicks
      if (e.button !== 0) return;
      isDragging = true;
      hasDragged = false;
      startMouseX = e.clientX;
      startMouseY = e.clientY;

      const rect = this.element.getBoundingClientRect();
      startElLeft = rect.left;
      startElTop = rect.top;

      // Switch to absolute positioning from viewport edges
      this.element.style.bottom = 'auto';
      this.element.style.right = 'auto';
      this.element.style.left = `${startElLeft}px`;
      this.element.style.top = `${startElTop}px`;
    };

    const dragEnd = () => {
      isDragging = false;
    };

    const drag = (e: PointerEvent) => {
      if (!isDragging) return;
      
      const dx = e.clientX - startMouseX;
      const dy = e.clientY - startMouseY;
      
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasDragged = true;
      }

      if (hasDragged) {
        e.preventDefault();
        const newLeft = Math.max(0, Math.min(window.innerWidth - this.btn.offsetWidth, startElLeft + dx));
        const newTop = Math.max(0, Math.min(window.innerHeight - this.btn.offsetHeight, startElTop + dy));
        this.element.style.left = `${newLeft}px`;
        this.element.style.top = `${newTop}px`;
      }
    };

    this.btn.addEventListener('pointerdown', dragStart);
    document.addEventListener('pointerup', dragEnd);
    document.addEventListener('pointercancel', dragEnd);
    document.addEventListener('pointermove', drag, { passive: false });

    this.btn.onclick = (e) => {
      e.stopPropagation();
      if (!hasDragged) {
        this.onClick?.();
      }
    };

    // ponytail: store refs so destroy() can clean up
    this._dragEnd = dragEnd;
    this._drag = drag;
    this._dragStart = dragStart;

    shadowRoot.appendChild(this.btn);

    // Append to html root (not body, so it's always present)
    document.documentElement.appendChild(this.element);
  }

  public setActive(active: boolean) {
    if (active) {
      this.btn.classList.add('active');
      this.btn.setAttribute('aria-pressed', 'true');
    } else {
      this.btn.classList.remove('active');
      this.btn.setAttribute('aria-pressed', 'false');
    }
  }

  public setBadgeCount(count: number) {
    this.badgeEl.style.opacity = count > 0 ? '1' : '0';
  }

  private _dragEnd?: (e: PointerEvent) => void;
  private _drag?: (e: PointerEvent) => void;
  private _dragStart?: (e: PointerEvent) => void;

  public destroy() {
    if (this._dragStart) this.btn.removeEventListener('pointerdown', this._dragStart);
    if (this._dragEnd) {
      document.removeEventListener('pointerup', this._dragEnd);
      document.removeEventListener('pointercancel', this._dragEnd);
    }
    if (this._drag) document.removeEventListener('pointermove', this._drag);
    this.element.remove();
  }
}
