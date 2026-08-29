import { setHTML } from "./domUtils.js";

const MODAL_STYLES = `
  @keyframes pmk-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes pmk-pulse {
    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
    70% { transform: scale(1.08); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
  }
  .pmk-spinner {
    stroke: currentColor;
    stroke-linecap: round;
  }
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
    background: #09090b;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    width: 460px;
    max-width: 90vw;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05);
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif;
    opacity: 0;
    transform: scale(0.95) translateY(8px);
    transition: opacity 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .pinmark-modal-header {
    padding: 20px 20px 0 20px;
    flex-shrink: 0;
  }

  .pinmark-modal-body {
    padding: 12px 20px;
    overflow-y: auto;
    flex: 1;
  }

  .pinmark-modal-body::-webkit-scrollbar {
    width: 6px;
  }
  .pinmark-modal-body::-webkit-scrollbar-track {
    background: transparent;
  }
  .pinmark-modal-body::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 4px;
  }
  .pinmark-modal-body::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  .pinmark-modal-footer {
    padding: 0 20px 20px 20px;
    flex-shrink: 0;
  }

  .pinmark-modal-overlay.visible .pinmark-modal {
    opacity: 1;
    transform: scale(1) translateY(0);
  }

  .pinmark-modal-title {
    color: #ededed;
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 16px 0;
    letter-spacing: -0.02em;
  }

  .pinmark-modal-input {
    width: 100%;
    padding: 12px 14px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
    color: #ededed;
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s ease;
    box-sizing: border-box;
    resize: vertical;
    min-height: 80px;
    font-family: inherit;
    line-height: 1.5;
  }

  .pinmark-input-container {
    position: relative;
    width: 100%;
  }

  .pinmark-modal-voice-btn {
    position: absolute;
    right: 8px;
    bottom: 8px;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #9ca3af;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }

  .pinmark-modal-voice-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #f3f4f6;
  }

  .pinmark-modal-voice-btn.listening {
    background: #ef4444;
    border-color: #f87171;
    color: #ffffff;
    animation: pmk-pulse 1.5s infinite;
  }

  .pinmark-modal-input:focus {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.04);
  }

  .pinmark-modal-input::placeholder {
    color: var(--pmk-text-muted, #6b7280);
  }
  .pinmark-modal-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--pmk-border, rgba(255, 255, 255, 0.08));
  }

  .pinmark-modal-btn {
    appearance: none;
    -webkit-appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 32px;
    padding: 0 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    cursor: pointer;
    outline: none;
    border: none;
    box-sizing: border-box;
    user-select: none;
    white-space: nowrap;
    transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .pinmark-modal-btn:active {
    transform: scale(0.97);
  }

  .pinmark-modal-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }

  .pinmark-modal-btn.cancel {
    background: rgba(255, 255, 255, 0.05);
    color: var(--pmk-text-muted, #9ca3af);
    border: 1px solid var(--pmk-border, rgba(255, 255, 255, 0.1));
  }

  .pinmark-modal-btn.cancel:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: var(--pmk-text, #f9fafb);
    border-color: rgba(255, 255, 255, 0.18);
  }

  .pinmark-modal-btn.submit {
    background: #ef4444;
    color: #ffffff;
    border: 1px solid rgba(239, 68, 68, 0.9);
    box-shadow: 0 1px 3px rgba(239, 68, 68, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .pinmark-modal-btn.submit:hover:not(:disabled) {
    background: #dc2626;
    border-color: #dc2626;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.25);
  }

  .pinmark-modal-btn.submit:active {
    background: #b91c1c;
    transform: scale(0.97);
  }
  .pinmark-modal-element-info {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    padding: 6px 10px;
    margin-bottom: 16px;
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
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    padding: 8px 12px;
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
    margin-bottom: 14px;
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
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #ededed;
    border-radius: 6px;
    padding: 8px;
    font-size: 11px;
    font-family: system-ui, sans-serif;
    outline: none;
    width: 100%;
    cursor: pointer;
    appearance: none;
  }
  .pinmark-modal-select:focus {
    border-color: rgba(255, 255, 255, 0.2);
  }
  .pinmark-modal-select-wrapper {
    position: relative;
  }
  .pinmark-modal-select-wrapper::after {
    content: "▼";
    font-size: 8px;
    color: rgba(255, 255, 255, 0.4);
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
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
  private updateScreenshotCallback: ((url: string) => void) | null = null;
  private _isClosing = false;

  setScreenshot(url: string) {
    if (this.updateScreenshotCallback) {
      this.updateScreenshotCallback(url);
    }
  }

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
      if (e.target === this.modalOverlay) {
        e.preventDefault();
        e.stopPropagation();
        this.close(null);
      }
    };
      
    this.escapeListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close(null);
      }
    };
    document.addEventListener('keydown', this.escapeListener, true);

    const modal = document.createElement('div');
    modal.className = 'pinmark-modal';

    const header = document.createElement('div');
    header.className = 'pinmark-modal-header';

    const body = document.createElement('div');
    body.className = 'pinmark-modal-body';

    const footer = document.createElement('div');
    footer.className = 'pinmark-modal-footer';

    // Title
    const title = document.createElement('h3');
    title.className = 'pinmark-modal-title';
    title.textContent = existingComment ? 'Edit Feedback' : 'Add Feedback';
    header.appendChild(title);

    // Element info row
    const elementInfo = document.createElement('div');
    elementInfo.className = 'pinmark-modal-element-info';
    setHTML(elementInfo, this.formatElementInfo(element, smartName, componentInfo));
    header.appendChild(elementInfo);
    
    modal.appendChild(header);

    // Selection text badge (if text was selected)
    if (selectionText) {
      const selBadge = document.createElement('div');
      selBadge.className = 'pinmark-modal-selection';
      selBadge.textContent = selectionText.length > 100 ? selectionText.slice(0, 100) + '…' : selectionText;
      body.appendChild(selBadge);
    }

    // React component hierarchy
    if (componentInfo && componentInfo.hierarchy && componentInfo.hierarchy.length > 1) {
      const treeEl = document.createElement('div');
      treeEl.className = 'pinmark-modal-component-tree';
      const hierarchy = componentInfo.hierarchy.slice(-5); // last 5 in tree
      setHTML(treeEl, hierarchy.map((name, i) => {
                const isLast = i === hierarchy.length - 1;
                return `<span class="${isLast ? 'pinmark-modal-component-name' : ''}">${name}</span>`;
              }).join(' <span style="opacity:0.3;font-size:10px;margin:0 4px">&gt;</span> '));
      body.appendChild(treeEl);
    }

    // Input Container with Voice-to-Text Button
    const inputContainer = document.createElement('div');
    inputContainer.className = 'pinmark-input-container';

    const input = document.createElement('textarea');
    input.className = 'pinmark-modal-input';
    input.placeholder = 'Enter your feedback... (Ctrl+Enter to submit)';
    input.value = existingComment || '';
    inputContainer.appendChild(input);

    // Voice button
    const voiceBtn = document.createElement('button');
    voiceBtn.type = 'button';
    voiceBtn.className = 'pinmark-modal-voice-btn';
    voiceBtn.title = 'Speak feedback (Voice-to-Text)';
    setHTML(voiceBtn, '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>');

    let recognition: any = null;
    let isListening = false;
    const SpeechRec = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

    voiceBtn.onclick = () => {
      if (!SpeechRec) {
        alert('Speech recognition is not supported in this browser environment.');
        return;
      }
      if (isListening && recognition) {
        recognition.stop();
        return;
      }
      try {
        recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          isListening = true;
          voiceBtn.classList.add('listening');
        };
        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            input.value = (input.value ? input.value + ' ' : '') + finalTranscript.trim();
          }
        };
        recognition.onerror = () => {
          isListening = false;
          voiceBtn.classList.remove('listening');
        };
        recognition.onend = () => {
          isListening = false;
          voiceBtn.classList.remove('listening');
        };
        recognition.start();
      } catch (err) {
        isListening = false;
        voiceBtn.classList.remove('listening');
      }
    };

    inputContainer.appendChild(voiceBtn);
    body.appendChild(inputContainer);
    if (computedStyles && Object.keys(computedStyles).length > 0) {
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'pinmark-modal-styles-toggle';
      toggleBtn.type = 'button';
      const chevronIcon = `<svg class="pinmark-modal-styles-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>`;
      setHTML(toggleBtn, `${chevronIcon} Computed Styles (${Object.keys(computedStyles).length})`);

      const stylesBody = document.createElement('div');
      stylesBody.className = 'pinmark-modal-styles-body';

      for (const [prop, val] of Object.entries(computedStyles)) {
        const row = document.createElement('div');
        row.className = 'pinmark-modal-style-row';
        setHTML(row, `<span class="pinmark-modal-style-prop">${prop}:</span><span class="pinmark-modal-style-val">${val};</span>`);
        stylesBody.appendChild(row);
      }

      toggleBtn.onclick = () => {
        const isOpen = stylesBody.classList.toggle('visible');
        const icon = toggleBtn.querySelector('.pinmark-modal-styles-toggle-icon') as HTMLElement;
        if (icon) icon.classList.toggle('open', isOpen);
      };

      body.appendChild(toggleBtn);
      body.appendChild(stylesBody);
    }

    // Screenshot canvas
    let drawnScreenshot: string | undefined = screenshotUrl;
    const markupContainer = document.createElement('div');
    markupContainer.style.cssText = 'margin-top:14px;position:relative;border:1px solid var(--pmk-border,rgba(255,255,255,0.1));border-radius:8px;overflow:hidden;background:var(--pmk-bg,#000);display:flex;flex-direction:column;min-height:100px;justify-content:center;align-items:center;';

    const loadAndSetupCanvas = (url: string) => {
      setHTML(markupContainer, '');
      markupContainer.style.minHeight = 'unset';
      markupContainer.style.display = 'block';

      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'max-width:100%;max-height:180px;object-fit:contain;display:block;cursor:crosshair;margin:0 auto;touch-action:none;';

      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
      };
      img.src = url;

      let isDrawing = false;

      const getCoords = (e: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY
        };
      };

      canvas.onpointerdown = (e) => {
        canvas.setPointerCapture(e.pointerId);
        isDrawing = true;
        const coords = getCoords(e);
        ctx?.beginPath();
        ctx?.moveTo(coords.x, coords.y);
      };
      canvas.onpointermove = (e) => {
        if (isDrawing && ctx) {
          const coords = getCoords(e);
          ctx.lineTo(coords.x, coords.y);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = Math.max(3, canvas.width / 80);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
        }
      };
      const endDrawing = (e: PointerEvent) => {
        if (isDrawing) {
          isDrawing = false;
          try { canvas.releasePointerCapture(e.pointerId); } catch {}
          drawnScreenshot = canvas.toDataURL('image/jpeg', 0.8);
        }
      };
      canvas.onpointerup = endDrawing;
      canvas.onpointercancel = endDrawing;
      const hint = document.createElement('div');
      hint.textContent = 'Draw to highlight';
      hint.style.cssText = 'font-size:10px;font-weight:500;color:#ededed;padding:4px 8px;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);border-radius:4px;border:1px solid rgba(255,255,255,0.15);position:absolute;top:12px;left:50%;transform:translateX(-50%);pointer-events:none;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.3);';

      markupContainer.appendChild(canvas);
      markupContainer.appendChild(hint);
    };

    if (screenshotUrl) {
      loadAndSetupCanvas(screenshotUrl);
    } else {
      const loadingSpinner = document.createElement('div');
      loadingSpinner.className = 'pinmark-screenshot-loading';
      loadingSpinner.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#a1a1aa;font-size:11px;padding:32px 0;width:100%;height:100px;';
      setHTML(loadingSpinner, `
        <svg class="pmk-spinner" style="width:20px;height:20px;animation:pmk-spin 1s linear infinite;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
        </svg>
        <span>Capturing screenshot...</span>
      `);
      markupContainer.appendChild(loadingSpinner);
    }

    body.appendChild(markupContainer);

    this.updateScreenshotCallback = (url: string) => {
      drawnScreenshot = url;
      loadAndSetupCanvas(url);
    };

    modal.appendChild(body);

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
      
      const wrapper = document.createElement('div');
      wrapper.className = 'pinmark-modal-select-wrapper';
      wrapper.appendChild(sel);
      col.appendChild(wrapper);

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
    footer.appendChild(selectRow);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'pinmark-modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'pinmark-modal-btn cancel';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.close(null);
    };

    const getResult = (): ModalResult => {
      let comment = input.value.trim();
      if (!comment) {
        if (drawnScreenshot !== screenshotUrl || categorySelect.sel.value || intentSelect.sel.value || severitySelect.sel.value) {
          const tag = element.tagName.toLowerCase();
          comment = smartName ? `Feedback on "${smartName}"` : `Feedback on <${tag}>`;
        } else {
          input.focus();
          input.style.borderColor = '#ef4444';
          input.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.2)';
          setTimeout(() => {
            input.style.borderColor = '';
            input.style.boxShadow = '';
          }, 1500);
          return null;
        }
      }
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
    submitBtn.type = 'button';
    submitBtn.textContent = existingComment ? 'Save' : 'Add';
    submitBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
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
    footer.appendChild(actions);
    
    modal.appendChild(footer);

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

  private escapeListener: ((e: KeyboardEvent) => void) | null = null;

  private close(result: ModalResult) {
    if (this._isClosing) return; // prevent double-close
    this._isClosing = true;

    if (this.escapeListener) {
      document.removeEventListener('keydown', this.escapeListener, true);
      this.escapeListener = null;
    }

    // Resolve the promise immediately so Overlay.ts gets the result ASAP,
    // but keep isModalOpen guard alive via _isClosing until animation ends.
    if (this.resolvePromise) {
      const resolve = this.resolvePromise;
      this.resolvePromise = null;
      // Schedule resolve on next microtask so any synchronous event handlers finish first
      Promise.resolve().then(() => resolve(result));
    }

    if (this.modalOverlay) {
      this.modalOverlay.style.pointerEvents = 'none'; // stop receiving any mouse events immediately
      this.modalOverlay.classList.remove('visible');
      const overlay = this.modalOverlay;
      this.modalOverlay = null; // null immediately so isOpen() returns false
      setTimeout(() => {
        overlay.remove();
        this._isClosing = false;
      }, 200);
    } else {
      this._isClosing = false;
    }
  }

  isOpen(): boolean {
    return this.modalOverlay !== null || this._isClosing;
  }
}
