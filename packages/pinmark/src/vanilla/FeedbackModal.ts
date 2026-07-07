const MODAL_STYLES = `
  .pinmark-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0);
    backdrop-filter: blur(0px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    pointer-events: all;
    transition: background 0.15s ease-out, backdrop-filter 0.15s ease-out;
  }

  .pinmark-modal-overlay.visible {
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(2px);
  }

  .pinmark-modal {
    background: var(--pmk-bg-2, #111827);
    border: 1px solid var(--pmk-border, rgba(255, 255, 255, 0.08));
    border-radius: 16px;
    padding: 20px;
    width: 460px;
    max-width: 90vw;
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif;
    opacity: 0;
    transform: scale(0.95) translateY(8px);
    transition: opacity 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .pinmark-modal-overlay.visible .pinmark-modal {
    opacity: 1;
    transform: scale(1) translateY(0);
  }

  .pinmark-modal-title {
    color: var(--pmk-text, #f9fafb);
    font-size: 14px;
    font-weight: 500;
    margin: 0 0 12px 0;
    letter-spacing: -0.01em;
  }

  .pinmark-modal-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--pmk-border, rgba(255, 255, 255, 0.08));
    border-radius: 6px;
    background: var(--pmk-bg-3, rgba(255, 255, 255, 0.04));
    color: var(--pmk-text, #f9fafb);
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s ease;
    box-sizing: border-box;
    resize: vertical;
    min-height: 80px;
    font-family: inherit;
    line-height: 1.5;
  }

  .pinmark-modal-input:focus {
    border-color: var(--pmk-accent, #3b82f6);
  }

  .pinmark-modal-input::placeholder {
    color: var(--pmk-text-muted, #6b7280);
  }

  .pinmark-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 14px;
  }

  .pinmark-modal-btn {
    padding: 6.4px 16px;
    border: none;
    border-radius: 14px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.15s ease, background 0.15s ease, transform 0.1s ease;
    font-family: inherit;
  }

  .pinmark-modal-btn:active {
    transform: scale(0.97);
  }

  .pinmark-modal-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .pinmark-modal-btn.cancel {
    background: transparent;
    color: var(--pmk-text-muted, #9ca3af);
    border: 1px solid var(--pmk-border, rgba(255,255,255,0.07));
  }

  .pinmark-modal-btn.cancel:hover:not(:disabled) {
    background: var(--pmk-bg-3, rgba(255, 255, 255, 0.06));
    color: var(--pmk-text, #f9fafb);
  }

  .pinmark-modal-btn.submit {
    background: var(--pmk-accent, #3b82f6);
    color: #ffffff;
  }

  .pinmark-modal-btn.submit:hover:not(:disabled) {
    background: #4f46e5;
  }

  .pinmark-modal-element-info {
    background: var(--pmk-bg-3, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--pmk-border, rgba(255, 255, 255, 0.06));
    border-radius: 6px;
    padding: 7px 10px;
    margin-bottom: 12px;
    font-size: 11px;
    color: var(--pmk-text-muted, #9ca3af);
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pinmark-modal-element-tag { color: var(--pmk-text-muted, #9ca3af); }
  .pinmark-modal-element-class { color: var(--pmk-text-muted, #6b7280); }
  .pinmark-modal-element-id { color: var(--pmk-text-muted, #9ca3af); }
  .pinmark-modal-element-component {
    color: var(--pmk-text-muted, #9ca3af);
    margin-left: 8px;
    font-family: system-ui, sans-serif;
    font-size: 11px;
  }

  /* Selection text */
  .pinmark-modal-selection {
    background: var(--pmk-bg-3, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--pmk-border, rgba(255, 255, 255, 0.08));
    border-left: 2px solid var(--pmk-accent, #3b82f6);
    border-radius: 4px;
    padding: 8px 12px;
    margin-bottom: 12px;
    font-size: 12px;
    color: var(--pmk-text-muted, #9ca3af);
    font-style: italic;
    line-height: 1.5;
  }

  /* Computed Styles Panel */
  .pinmark-modal-styles-toggle {
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    color: var(--pmk-text-muted, #6b7280);
    font-size: 11px;
    padding: 5px 0;
    margin-bottom: 10px;
    user-select: none;
    border: none;
    background: none;
    font-family: system-ui, sans-serif;
    transition: color 0.15s;
  }

  .pinmark-modal-styles-toggle:hover {
    color: var(--pmk-text, #f9fafb);
  }

  .pinmark-modal-styles-toggle-icon {
    width: 11px;
    height: 11px;
    transition: transform 0.15s ease;
    flex-shrink: 0;
  }

  .pinmark-modal-styles-toggle-icon.open {
    transform: rotate(90deg);
  }

  .pinmark-modal-styles-body {
    background: var(--pmk-bg-3, rgba(255,255,255,0.03));
    border: 1px solid var(--pmk-border, rgba(255,255,255,0.06));
    border-radius: 6px;
    padding: 10px;
    margin-bottom: 12px;
    display: none;
    max-height: 160px;
    overflow-y: auto;
  }

  .pinmark-modal-styles-body.visible {
    display: block;
  }

  .pinmark-modal-style-row {
    display: flex;
    gap: 8px;
    font-size: 11px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    line-height: 1.7;
  }

  .pinmark-modal-style-prop {
    color: var(--pmk-text-muted, #6b7280);
    flex-shrink: 0;
    min-width: 130px;
  }

  .pinmark-modal-style-val {
    color: var(--pmk-text, #f9fafb);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Component tree */
  .pinmark-modal-component-tree {
    background: var(--pmk-bg-3, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--pmk-border, rgba(255, 255, 255, 0.06));
    border-radius: 6px;
    padding: 8px 10px;
    margin-bottom: 12px;
    font-size: 11px;
    font-family: 'SF Mono', Monaco, monospace;
    color: var(--pmk-text-muted, #6b7280);
    line-height: 1.8;
  }

  .pinmark-modal-component-name {
    color: var(--pmk-text, #f9fafb);
    font-weight: 500;
  }

  /* Dropdowns */
  .pinmark-modal-select-row {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }
  .pinmark-modal-select-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .pinmark-modal-select-label {
    font-size: 10px;
    color: var(--pmk-text-muted, #9ca3af);
    font-family: system-ui, sans-serif;
  }
  .pinmark-modal-select {
    background: var(--pmk-bg-3, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--pmk-border, rgba(255, 255, 255, 0.1));
    color: var(--pmk-text, #f9fafb);
    border-radius: 6px;
    padding: 6px;
    font-size: 11px;
    font-family: system-ui, sans-serif;
    outline: none;
    width: 100%;
  }
  .pinmark-modal-select option {
    background: var(--pmk-bg-2, #111827);
    color: var(--pmk-text, #f9fafb);
  }
`;

export type ModalResult = { 
  comment: string; 
  screenshot?: string;
  category?: 'bug' | 'improvement' | 'question' | 'design';
  intent?: 'fix' | 'change' | 'question' | 'approve';
  severity?: 'blocking' | 'important' | 'suggestion';
} | null;

export interface ModalShowOptions {
  existingComment?: string;
  screenshotUrl?: string;
  computedStyles?: Record<string, string>;
  selectionText?: string;
  componentInfo?: { framework: string; name: string; hierarchy?: string[] };
  smartName?: string;
  existingCategory?: 'bug' | 'improvement' | 'question' | 'design';
  existingIntent?: 'fix' | 'change' | 'question' | 'approve';
  existingSeverity?: 'blocking' | 'important' | 'suggestion';
}

export class FeedbackModal {
  private shadowRoot: ShadowRoot;
  private modalOverlay: HTMLElement | null = null;
  private resolvePromise: ((result: ModalResult) => void) | null = null;

  constructor(shadowRoot: ShadowRoot) {
    this.shadowRoot = shadowRoot;
    this.injectStyles();
  }

  private injectStyles() {
    let styleElement = this.shadowRoot.querySelector('#pinmark-modal-styles');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'pinmark-modal-styles';
      this.shadowRoot.appendChild(styleElement);
    }
    (styleElement as HTMLStyleElement).textContent = MODAL_STYLES;
  }

  show(element: HTMLElement, existingComment?: string, screenshotUrl?: string): Promise<ModalResult>;
  show(element: HTMLElement, options?: ModalShowOptions): Promise<ModalResult>;
  show(element: HTMLElement, existingCommentOrOptions?: string | ModalShowOptions, screenshotUrl?: string): Promise<ModalResult> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      let opts: ModalShowOptions;
      if (typeof existingCommentOrOptions === 'string' || existingCommentOrOptions === undefined) {
        opts = { existingComment: existingCommentOrOptions, screenshotUrl };
      } else {
        opts = existingCommentOrOptions;
      }
      this.render(element, opts);
    });
  }

  private render(element: HTMLElement, opts: ModalShowOptions) {
    const { existingComment, screenshotUrl, computedStyles, selectionText, componentInfo, smartName } = opts;

    this.modalOverlay = document.createElement('div');
    this.modalOverlay.className = 'pinmark-modal-overlay';
    this.modalOverlay.onclick = (e) => {
      if (e.target === this.modalOverlay) this.close(null);
    };

    const modal = document.createElement('div');
    modal.className = 'pinmark-modal';

    // Title
    const title = document.createElement('h3');
    title.className = 'pinmark-modal-title';
    title.textContent = existingComment ? 'Edit Feedback' : 'Add Feedback';

    // Element info row
    const elementInfo = document.createElement('div');
    elementInfo.className = 'pinmark-modal-element-info';
    elementInfo.innerHTML = this.formatElementInfo(element, smartName, componentInfo);

    // Selection text badge (if text was selected)
    if (selectionText) {
      const selBadge = document.createElement('div');
      selBadge.className = 'pinmark-modal-selection';
      selBadge.textContent = selectionText.length > 100 ? selectionText.slice(0, 100) + '…' : selectionText;
      modal.appendChild(title);
      modal.appendChild(elementInfo);
      modal.appendChild(selBadge);
    } else {
      modal.appendChild(title);
      modal.appendChild(elementInfo);
    }

    // React component hierarchy
    if (componentInfo && componentInfo.hierarchy && componentInfo.hierarchy.length > 1) {
      const treeEl = document.createElement('div');
      treeEl.className = 'pinmark-modal-component-tree';
      const hierarchy = componentInfo.hierarchy.slice(-5); // last 5 in tree
      treeEl.innerHTML = hierarchy.map((name, i) => {
        const indent = '&nbsp;&nbsp;'.repeat(i);
        const isLast = i === hierarchy.length - 1;
        return `<div>${indent}<span class="${isLast ? 'pinmark-modal-component-name' : ''}">${name}</span></div>`;
      }).join('');
      modal.appendChild(treeEl);
    }

    // Input
    const input = document.createElement('textarea');
    input.className = 'pinmark-modal-input';
    input.placeholder = 'Enter your feedback... (Ctrl+Enter to submit)';
    input.value = existingComment || '';
    modal.appendChild(input);

    // Computed styles panel
    if (computedStyles && Object.keys(computedStyles).length > 0) {
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'pinmark-modal-styles-toggle';
      toggleBtn.type = 'button';
      const chevronIcon = `<svg class="pinmark-modal-styles-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>`;
      toggleBtn.innerHTML = `${chevronIcon} Computed Styles (${Object.keys(computedStyles).length})`;

      const stylesBody = document.createElement('div');
      stylesBody.className = 'pinmark-modal-styles-body';

      for (const [prop, val] of Object.entries(computedStyles)) {
        const row = document.createElement('div');
        row.className = 'pinmark-modal-style-row';
        row.innerHTML = `<span class="pinmark-modal-style-prop">${prop}:</span><span class="pinmark-modal-style-val">${val};</span>`;
        stylesBody.appendChild(row);
      }

      toggleBtn.onclick = () => {
        const isOpen = stylesBody.classList.toggle('visible');
        const icon = toggleBtn.querySelector('.pinmark-modal-styles-toggle-icon') as HTMLElement;
        if (icon) icon.classList.toggle('open', isOpen);
      };

      modal.appendChild(toggleBtn);
      modal.appendChild(stylesBody);
    }

    // Screenshot canvas
    let drawnScreenshot: string | undefined = screenshotUrl;
    if (screenshotUrl) {
      const markupContainer = document.createElement('div');
      markupContainer.style.cssText = 'margin-top:14px;position:relative;border:1px solid var(--pmk-border,rgba(255,255,255,0.1));border-radius:8px;overflow:hidden;background:var(--pmk-bg,#000);display:flex;flex-direction:column;';

      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'max-width:100%;max-height:180px;object-fit:contain;display:block;cursor:crosshair;';

      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
      };
      img.src = screenshotUrl;

      let isDrawing = false;
      canvas.onmousedown = (e) => {
        isDrawing = true;
        ctx?.beginPath();
        ctx?.moveTo(e.offsetX * (canvas.width / canvas.offsetWidth), e.offsetY * (canvas.height / canvas.offsetHeight));
      };
      canvas.onmousemove = (e) => {
        if (isDrawing && ctx) {
          ctx.lineTo(e.offsetX * (canvas.width / canvas.offsetWidth), e.offsetY * (canvas.height / canvas.offsetHeight));
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = Math.max(3, canvas.width / 100);
          ctx.stroke();
        }
      };
      const endDrawing = () => {
        if (isDrawing) {
          isDrawing = false;
          drawnScreenshot = canvas.toDataURL('image/jpeg', 0.8);
        }
      };
      canvas.onmouseup = endDrawing;
      canvas.onmouseleave = endDrawing;

      const hint = document.createElement('div');
      hint.textContent = 'Draw to highlight';
      hint.style.cssText = 'font-size:11px;color:var(--pmk-text,#f9fafb);padding:5px 10px;background:var(--pmk-bg-2,rgba(0,0,0,0.6));backdrop-filter:blur(4px);border-radius:20px;border:1px solid var(--pmk-border,rgba(255,255,255,0.1));position:absolute;top:10px;left:50%;transform:translateX(-50%);pointer-events:none;white-space:nowrap;';

      markupContainer.appendChild(canvas);
      markupContainer.appendChild(hint);
      modal.appendChild(markupContainer);
    }

    // Dropdowns
    const selectRow = document.createElement('div');
    selectRow.className = 'pinmark-modal-select-row';

    const createSelect = (label: string, options: {value: string, text: string}[], initialValue?: string) => {
      const col = document.createElement('div');
      col.className = 'pinmark-modal-select-col';
      const lbl = document.createElement('label');
      lbl.className = 'pinmark-modal-select-label';
      lbl.textContent = label;
      const sel = document.createElement('select');
      sel.className = 'pinmark-modal-select';
      
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = `Select ${label}`;
      sel.appendChild(defaultOpt);
      
      options.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.text;
        sel.appendChild(opt);
      });
      if (initialValue) sel.value = initialValue;
      col.appendChild(lbl);
      col.appendChild(sel);
      return { col, sel };
    };

    const categorySelect = createSelect('Category', [
      { value: 'bug', text: 'Bug' },
      { value: 'improvement', text: 'Improvement' },
      { value: 'question', text: 'Question' },
      { value: 'design', text: 'Design' }
    ], opts.existingCategory);

    const intentSelect = createSelect('Intent', [
      { value: 'fix', text: 'Fix' },
      { value: 'change', text: 'Change' },
      { value: 'question', text: 'Question' },
      { value: 'approve', text: 'Approve' }
    ], opts.existingIntent);

    const severitySelect = createSelect('Severity', [
      { value: 'blocking', text: 'Blocking' },
      { value: 'important', text: 'Important' },
      { value: 'suggestion', text: 'Suggestion' }
    ], opts.existingSeverity);

    selectRow.appendChild(categorySelect.col);
    selectRow.appendChild(intentSelect.col);
    selectRow.appendChild(severitySelect.col);
    modal.appendChild(selectRow);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'pinmark-modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'pinmark-modal-btn cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => this.close(null);

    const getResult = (): ModalResult => {
      const comment = input.value.trim();
      if (!comment) return null;
      return {
        comment,
        screenshot: drawnScreenshot,
        category: categorySelect.sel.value as any || undefined,
        intent: intentSelect.sel.value as any || undefined,
        severity: severitySelect.sel.value as any || undefined
      };
    };

    const submitBtn = document.createElement('button');
    submitBtn.className = 'pinmark-modal-btn submit';
    submitBtn.textContent = existingComment ? 'Save' : 'Add';
    submitBtn.onclick = () => {
      const result = getResult();
      if (result) this.close(result);
    };

    input.onkeydown = (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const result = getResult();

        if (result) this.close(result);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close(null);
      }
      e.stopPropagation();
    };

    actions.appendChild(cancelBtn);
    actions.appendChild(submitBtn);
    modal.appendChild(actions);

    this.modalOverlay.appendChild(modal);
    this.shadowRoot.appendChild(this.modalOverlay);

    // Trigger visible class animation
    requestAnimationFrame(() => {
      if (this.modalOverlay) {
        this.modalOverlay.classList.add('visible');
      }
    });

    setTimeout(() => input.focus(), 0);
  }

  private formatElementInfo(element: HTMLElement, smartName?: string, componentInfo?: { framework: string; name: string; hierarchy?: string[] }): string {
    const tag = element.tagName.toLowerCase();
    const id = element.id ? `<span class="pinmark-modal-element-id">#${element.id}</span>` : '';
    const classes = element.className && typeof element.className === 'string'
      ? element.className.split(' ').filter(c => c && !c.startsWith('pinmark')).slice(0, 3).map(c => `<span class="pinmark-modal-element-class">.${c}</span>`).join('')
      : '';

    let componentHTML = '';
    if (componentInfo && componentInfo.name && componentInfo.name !== 'Unknown') {
      componentHTML = `<span class="pinmark-modal-element-component">${componentInfo.name}</span>`;
    }

    if (smartName) {
      return `<span class="pinmark-modal-element-tag">&lt;${tag}&gt;</span> <span style="color:var(--pmk-text-muted,#9ca3af)">"${smartName}"</span>${componentHTML}`;
    }

    return `<span class="pinmark-modal-element-tag">&lt;${tag}&gt;</span>${id}${classes}${componentHTML}`;
  }

  private close(result: ModalResult) {
    if (this.modalOverlay) {
      this.modalOverlay.classList.remove('visible');
      setTimeout(() => {
        if (this.modalOverlay) {
          this.modalOverlay.remove();
          this.modalOverlay = null;
        }
        if (this.resolvePromise) {
          this.resolvePromise(result);
          this.resolvePromise = null;
        }
      }, 150);
    } else {
      if (this.resolvePromise) {
        this.resolvePromise(result);
        this.resolvePromise = null;
      }
    }
  }

  isOpen(): boolean {
    return this.modalOverlay !== null;
  }
}
