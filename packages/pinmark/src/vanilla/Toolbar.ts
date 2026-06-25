

const TOOLBAR_STYLES = `
  .pinmark-toolbar {
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 5px 6px;
    background: var(--pmk-bg-2, #111827);
    border-radius: 999px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25), 0 0 0 1px var(--pmk-border, rgba(255, 255, 255, 0.07));
    z-index: 2147483646;
    pointer-events: all;
    cursor: move;
    user-select: none;
  }

  .pinmark-toolbar-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--pmk-text-muted, #9ca3af);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .pinmark-toolbar-btn:hover {
    background: var(--pmk-bg-3, #374151);
    color: var(--pmk-text, #f9fafb);
  }

  .pinmark-toolbar-btn:active {
    opacity: 0.7;
  }

  .pinmark-toolbar-btn.active {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
    box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.3);
  }

  .pinmark-toolbar-btn svg {
    width: 15px;
    height: 15px;
  }

  .pinmark-toolbar-divider {
    width: 1px;
    height: 14px;
    background: var(--pmk-bg-3, #374151);
    margin: 0 3px;
  }

  .pinmark-tooltip {
    position: absolute;
    top: -30px;
    background: var(--pmk-bg-2, #111827);
    border: 1px solid var(--pmk-border, rgba(255,255,255,0.1));
    color: var(--pmk-text, #f9fafb);
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 5px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transform: translateY(4px);
    transition: opacity 0.15s ease, transform 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    letter-spacing: 0;
  }

  .pinmark-toolbar-btn:hover .pinmark-tooltip {
    opacity: 1;
    transform: translateY(0);
  }

  .pinmark-toolbar-btn.exit-btn {
    color: var(--pmk-text-muted, #6b7280);
  }
  .pinmark-toolbar-btn.exit-btn:hover {
    background: var(--pmk-bg-3, #374151);
    color: var(--pmk-text, #f9fafb);
  }
`;

const ICONS = {
  pause: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  areaSelect: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke-dasharray="3 3"/></svg>`,
  multiSelect: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><rect x="8" y="10" width="14" height="14" rx="2"/></svg>`,
  eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
  eyeOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  copyJson: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2-2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  github: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>`,
  exit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  layout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="9" x2="9" y2="21"/></svg>`
};

export class Toolbar {
  private element: HTMLElement;
  private isPaused = false;
  private markersVisible = true;
  private isLayoutMode = false;
  private sendBtn: HTMLButtonElement | null = null;
  private areaSelectBtn: HTMLButtonElement | null = null;
  private multiSelectBtn: HTMLButtonElement | null = null;
  private layoutBtn: HTMLButtonElement | null = null;
  private isAreaSelectActive = false;
  private isMultiSelectActive = false;

  onPauseToggle?: () => void;
  onMarkersToggle?: () => void;
  onAreaSelectToggle?: () => void;
  onMultiSelectToggle?: () => void;
  onLayoutModeToggle?: () => void;
  onCopy?: () => void;
  onDownloadJson?: () => void;
  onGithubCreate?: () => void;
  onClear?: () => void;
  onWebhookSend?: () => void;
  onSettingsClick?: () => void;
  onExitClick?: () => void;

  constructor(shadowRoot: ShadowRoot) {
    const style = document.createElement('style');
    style.textContent = TOOLBAR_STYLES;
    shadowRoot.appendChild(style);

    this.element = this.createToolbar();
    shadowRoot.appendChild(this.element);

    this.setupDragListeners();
  }

  private setupDragListeners() {
    let isDragging = false;
    let startMouseX = 0;
    let startMouseY = 0;
    let startElLeft = 0;
    let startElTop = 0;

    let dragMoveHandler: (e: MouseEvent) => void;
    let dragEndHandler: () => void;

    const dragStart = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      if (e.target !== this.element) return;

      isDragging = true;
      startMouseX = e.clientX;
      startMouseY = e.clientY;

      const rect = this.element.getBoundingClientRect();
      startElLeft = rect.left;
      startElTop = rect.top;

      this.element.style.transform = 'none';
      this.element.style.left = `${startElLeft}px`;
      this.element.style.top = `${startElTop}px`;

      document.addEventListener('mouseup', dragEndHandler);
      document.addEventListener('mousemove', dragMoveHandler);
    };

    dragEndHandler = () => {
      if (!isDragging) return;
      isDragging = false;
      document.removeEventListener('mouseup', dragEndHandler);
      document.removeEventListener('mousemove', dragMoveHandler);
    };

    dragMoveHandler = (e: MouseEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      const dx = e.clientX - startMouseX;
      const dy = e.clientY - startMouseY;
      const newLeft = Math.max(0, Math.min(window.innerWidth - this.element.offsetWidth, startElLeft + dx));
      const newTop = Math.max(0, Math.min(window.innerHeight - this.element.offsetHeight, startElTop + dy));
      this.element.style.left = `${newLeft}px`;
      this.element.style.top = `${newTop}px`;
    };

    this.element.addEventListener('mousedown', dragStart);
  }

  private createToolbar(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'pinmark-toolbar';

    const pauseBtn = this.createButton('pause', 'Pause', 'pause');
    pauseBtn.onclick = (e) => {
      e.stopPropagation();
      this.togglePause();
      this.onPauseToggle?.();
    };

    const eyeBtn = this.createButton('eye', 'Toggle Markers', 'markers');
    eyeBtn.classList.add('active');
    eyeBtn.onclick = (e) => {
      e.stopPropagation();
      this.toggleMarkers();
      this.onMarkersToggle?.();
    };

    this.layoutBtn = this.createButton('layout', 'Layout Mode', 'layout') as HTMLButtonElement;
    this.layoutBtn.onclick = (e) => {
      e.stopPropagation();
      this.setLayoutMode(!this.isLayoutMode);
      this.onLayoutModeToggle?.();
    };

    const divider1 = document.createElement('div');
    divider1.className = 'pinmark-toolbar-divider';

    this.areaSelectBtn = this.createButton('areaSelect', 'Toggle Area Select Mode', 'area-select');
    this.areaSelectBtn.onclick = (e) => {
      e.stopPropagation();
      this.toggleAreaSelect();
      this.onAreaSelectToggle?.();
    };

    this.multiSelectBtn = this.createButton('multiSelect', 'Toggle Multi-Select Mode', 'multi-select');
    this.multiSelectBtn.onclick = (e) => {
      e.stopPropagation();
      this.toggleMultiSelect();
      this.onMultiSelectToggle?.();
    };

    const copyBtn = this.createButton('copy', 'Copy Annotations', 'copy');
    copyBtn.onclick = (e) => {
      e.stopPropagation();
      copyBtn.innerHTML = ICONS.check;
      copyBtn.style.background = 'var(--pmk-success, #22c55e)';
      this.onCopy?.();
      setTimeout(() => {
        copyBtn.innerHTML = ICONS.copy;
        copyBtn.style.background = '';
      }, 1500);
    };

    const downloadJsonBtn = this.createButton('copyJson', 'Download JSON Data', 'download-json');
    downloadJsonBtn.onclick = (e) => {
      e.stopPropagation();
      downloadJsonBtn.innerHTML = ICONS.check;
      downloadJsonBtn.style.background = 'var(--pmk-success, #22c55e)';
      this.onDownloadJson?.();
      setTimeout(() => {
        downloadJsonBtn.innerHTML = ICONS.copyJson;
        downloadJsonBtn.style.background = '';
      }, 1500);
    };

    const githubBtn = this.createButton('github', 'Create GitHub Issue', 'github');
    githubBtn.onclick = (e) => {
      e.stopPropagation();
      githubBtn.innerHTML = ICONS.check;
      githubBtn.style.background = 'var(--pmk-success, #22c55e)';
      this.onGithubCreate?.();
      setTimeout(() => {
        githubBtn.innerHTML = ICONS.github;
        githubBtn.style.background = '';
      }, 1500);
    };

    const clearBtn = this.createButton('trash', 'Clear Annotations', 'clear');
    clearBtn.onclick = (e) => {
      e.stopPropagation();
      this.onClear?.();
    };

    const divider2 = document.createElement('div');
    divider2.className = 'pinmark-toolbar-divider';

    const settingsBtn = this.createButton('settings', 'Settings', 'settings');
    settingsBtn.onclick = (e) => {
      e.stopPropagation();
      this.onSettingsClick?.();
    };

    const divider3 = document.createElement('div');
    divider3.className = 'pinmark-toolbar-divider';

    const exitBtn = this.createButton('exit', 'Exit', 'exit');
    exitBtn.onclick = (e) => {
      e.stopPropagation();
      this.onExitClick?.();
    };

    this.sendBtn = this.createButton('send', 'Send to Webhook', 'send');
    this.sendBtn.style.display = 'none'; // Hidden by default
    this.sendBtn.onclick = (e) => {
      e.stopPropagation();
      this.onWebhookSend?.();
    };

    toolbar.appendChild(pauseBtn);
    toolbar.appendChild(this.areaSelectBtn);
    toolbar.appendChild(this.multiSelectBtn);
    toolbar.appendChild(eyeBtn);
    toolbar.appendChild(this.layoutBtn!);
    toolbar.appendChild(divider1);
    toolbar.appendChild(copyBtn);
    toolbar.appendChild(downloadJsonBtn);
    toolbar.appendChild(githubBtn);
    toolbar.appendChild(clearBtn);
    toolbar.appendChild(settingsBtn);
    
    // We'll hide divider2 by default since sendBtn is hidden by default
    divider2.style.display = 'none';
    toolbar.appendChild(divider2);
    toolbar.appendChild(this.sendBtn);
    toolbar.appendChild(divider3);
    toolbar.appendChild(exitBtn);

    return toolbar;
  }

  setWebhookEnabled(enabled: boolean) {
    if (this.sendBtn) {
      this.sendBtn.style.display = enabled ? 'flex' : 'none';
      const divider2 = this.element.querySelectorAll('.pinmark-toolbar-divider')[1] as HTMLElement;
      if (divider2) divider2.style.display = enabled ? 'block' : 'none';
    }
  }

  showSendSuccess() {
    if (this.sendBtn) {
      const originalIcon = this.sendBtn.innerHTML;
      this.sendBtn.innerHTML = ICONS.check;
      this.sendBtn.style.background = 'var(--pmk-success, #22c55e)';
      setTimeout(() => {
        if (this.sendBtn) {
          this.sendBtn.innerHTML = originalIcon;
          this.sendBtn.style.background = '';
        }
      }, 1500);
    }
  }

  private createButton(iconKey: keyof typeof ICONS, title: string, action: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'pinmark-toolbar-btn';
    if (action === 'exit') {
      btn.classList.add('exit-btn');
    }
    btn.dataset.action = action;
    const svgContent = ICONS[iconKey];
    if (svgContent) {
      btn.innerHTML = svgContent;
    } else if (iconKey === 'github') {
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>`;
    } else {
      btn.innerHTML = '';
    }

    btn.title = title;
    
    const tooltip = document.createElement('div');
    tooltip.className = 'pinmark-tooltip';
    if (title.includes('[')) {
      const parts = title.split('[');
      tooltip.innerHTML = `${parts[0].trim()} <span style="opacity:0.6;font-size:10px;margin-left:4px">${parts[1].replace(']', '')}</span>`;
    } else {
      tooltip.textContent = title;
    }
    btn.appendChild(tooltip);

    return btn;
  }

  setPaused(paused: boolean) {
    this.isPaused = paused;
    const pauseBtn = this.element.querySelector('[data-action="pause"]') as HTMLButtonElement;
    if (pauseBtn) {
      pauseBtn.innerHTML = paused ? ICONS.play : ICONS.pause;
      pauseBtn.title = paused ? 'Resume' : 'Pause';
    }
  }

  setMarkersVisible(visible: boolean) {
    this.markersVisible = visible;
    const eyeBtn = this.element.querySelector('[data-action="markers"]') as HTMLButtonElement;
    if (eyeBtn) {
      eyeBtn.innerHTML = visible ? ICONS.eye : ICONS.eyeOff;
      if (visible) {
        eyeBtn.classList.add('active');
      } else {
        eyeBtn.classList.remove('active');
      }
    }
  }

  private togglePause() {
    this.setPaused(!this.isPaused);
  }

  private toggleMarkers() {
    this.setMarkersVisible(!this.markersVisible);
  }

  showCopySuccess() {
    const copyBtn = this.element.querySelector('[data-action="copy"]') as HTMLButtonElement;
    if (copyBtn) {
      const originalIcon = copyBtn.innerHTML;
      copyBtn.innerHTML = ICONS.check;
      copyBtn.style.background = 'var(--pmk-success, #22c55e)';
      setTimeout(() => {
        copyBtn.innerHTML = originalIcon;
        copyBtn.style.background = '';
      }, 1500);
    }
  }

  toggleAreaSelect(active?: boolean) {
    this.isAreaSelectActive = active !== undefined ? active : !this.isAreaSelectActive;
    if (this.isAreaSelectActive && this.isMultiSelectActive) {
      this.toggleMultiSelect(false); // mutually exclusive
    }
    if (this.areaSelectBtn) {
      if (this.isAreaSelectActive) {
        this.areaSelectBtn.classList.add('active');
        this.areaSelectBtn.style.color = '#fff';
      } else {
        this.areaSelectBtn.classList.remove('active');
        this.areaSelectBtn.style.color = '';
      }
    }
  }

  toggleMultiSelect(active?: boolean) {
    this.isMultiSelectActive = active !== undefined ? active : !this.isMultiSelectActive;
    if (this.isMultiSelectActive && this.isAreaSelectActive) {
      this.toggleAreaSelect(false); // mutually exclusive
    }
    if (this.multiSelectBtn) {
      if (this.isMultiSelectActive) {
        this.multiSelectBtn.classList.add('active');
        this.multiSelectBtn.style.color = 'var(--pmk-success, #22c55e)';
      } else {
        this.multiSelectBtn.classList.remove('active');
        this.multiSelectBtn.style.color = '';
      }
    }
  }

  setLayoutMode(isActive: boolean) {
    this.isLayoutMode = isActive;
    if (this.layoutBtn) {
      if (isActive) {
        this.layoutBtn.classList.add('active');
        this.layoutBtn.style.color = 'var(--pmk-accent, #3b82f6)';
      } else {
        this.layoutBtn.classList.remove('active');
        this.layoutBtn.style.color = '';
      }
    }
  }
}

