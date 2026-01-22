const MODAL_STYLES = `
  .agentecho-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    pointer-events: all;
  }

  .agentecho-modal {
    background: #1f2937;
    border-radius: 12px;
    padding: 24px;
    width: 400px;
    max-width: 90vw;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .agentecho-modal-title {
    color: #f9fafb;
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 16px 0;
  }

  .agentecho-modal-input {
    width: 100%;
    padding: 12px 14px;
    border: 1px solid #374151;
    border-radius: 8px;
    background: #111827;
    color: #f9fafb;
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s ease;
    box-sizing: border-box;
    resize: vertical;
    min-height: 80px;
    font-family: inherit;
  }

  .agentecho-modal-input:focus {
    border-color: #3b82f6;
  }

  .agentecho-modal-input::placeholder {
    color: #6b7280;
  }

  .agentecho-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 16px;
  }

  .agentecho-modal-btn {
    padding: 10px 18px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease, opacity 0.15s ease;
  }

  .agentecho-modal-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .agentecho-modal-btn.cancel {
    background: #374151;
    color: #f9fafb;
  }

  .agentecho-modal-btn.cancel:hover:not(:disabled) {
    background: #4b5563;
  }

  .agentecho-modal-btn.submit {
    background: #3b82f6;
    color: white;
  }

  .agentecho-modal-btn.submit:hover:not(:disabled) {
    background: #2563eb;
  }

  .agentecho-modal-element-info {
    background: #111827;
    border-radius: 6px;
    padding: 10px 12px;
    margin-bottom: 16px;
    font-size: 12px;
    color: #9ca3af;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .agentecho-modal-element-tag {
    color: #f472b6;
  }

  .agentecho-modal-element-class {
    color: #60a5fa;
  }

  .agentecho-modal-element-id {
    color: #fbbf24;
  }
`;

export type ModalResult = { comment: string } | null;

export class FeedbackModal {
  private shadowRoot: ShadowRoot;
  private modalOverlay: HTMLElement | null = null;
  private resolvePromise: ((result: ModalResult) => void) | null = null;

  constructor(shadowRoot: ShadowRoot) {
    this.shadowRoot = shadowRoot;
    this.injectStyles();
  }

  private injectStyles() {
    let styleElement = this.shadowRoot.querySelector('#agentecho-modal-styles');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'agentecho-modal-styles';
      this.shadowRoot.appendChild(styleElement);
    }
    (styleElement as HTMLStyleElement).textContent = MODAL_STYLES;
  }

  show(element: HTMLElement, existingComment?: string): Promise<ModalResult> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.render(element, existingComment);
    });
  }

  private render(element: HTMLElement, existingComment?: string) {
    // Create overlay
    this.modalOverlay = document.createElement('div');
    this.modalOverlay.className = 'agentecho-modal-overlay';
    this.modalOverlay.onclick = (e) => {
      if (e.target === this.modalOverlay) {
        this.close(null);
      }
    };

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'agentecho-modal';

    // Title
    const title = document.createElement('h3');
    title.className = 'agentecho-modal-title';
    title.textContent = existingComment ? 'Edit Feedback' : 'Add Feedback';

    // Element info
    const elementInfo = document.createElement('div');
    elementInfo.className = 'agentecho-modal-element-info';
    elementInfo.innerHTML = this.formatElementInfo(element);

    // Input
    const input = document.createElement('textarea');
    input.className = 'agentecho-modal-input';
    input.placeholder = 'Enter your feedback...';
    input.value = existingComment || '';

    // Actions
    const actions = document.createElement('div');
    actions.className = 'agentecho-modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'agentecho-modal-btn cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => this.close(null);

    const submitBtn = document.createElement('button');
    submitBtn.className = 'agentecho-modal-btn submit';
    submitBtn.textContent = existingComment ? 'Save' : 'Add';
    submitBtn.onclick = () => {
      const comment = input.value.trim();
      if (comment) {
        this.close({ comment });
      }
    };

    // Handle keyboard
    input.onkeydown = (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const comment = input.value.trim();
        if (comment) {
          this.close({ comment });
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close(null);
      }
      e.stopPropagation();
    };

    actions.appendChild(cancelBtn);
    actions.appendChild(submitBtn);

    modal.appendChild(title);
    modal.appendChild(elementInfo);
    modal.appendChild(input);
    modal.appendChild(actions);

    this.modalOverlay.appendChild(modal);
    this.shadowRoot.appendChild(this.modalOverlay);

    // Focus input
    setTimeout(() => input.focus(), 0);
  }

  private formatElementInfo(element: HTMLElement): string {
    const tag = element.tagName.toLowerCase();
    const id = element.id ? `<span class="agentecho-modal-element-id">#${element.id}</span>` : '';
    const classes = element.className && typeof element.className === 'string'
      ? element.className.split(' ').filter(c => c && !c.startsWith('agentecho')).slice(0, 3).map(c => `<span class="agentecho-modal-element-class">.${c}</span>`).join('')
      : '';
    
    return `<span class="agentecho-modal-element-tag">&lt;${tag}&gt;</span>${id}${classes}`;
  }

  private close(result: ModalResult) {
    if (this.modalOverlay) {
      this.modalOverlay.remove();
      this.modalOverlay = null;
    }
    if (this.resolvePromise) {
      this.resolvePromise(result);
      this.resolvePromise = null;
    }
  }

  isOpen(): boolean {
    return this.modalOverlay !== null;
  }
}
