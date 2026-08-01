import { HoverBox } from './HoverBox.js';
import { AreaSelectionBox } from './AreaSelectionBox.js';
import { MarkerManager } from './MarkerManager.js';
import { Toolbar } from './Toolbar.js';
import { FeedbackModal } from './FeedbackModal.js';
import { ElementAnalyzer } from './ElementAnalyzer.js';
import { FrameworkDetector } from './FrameworkDetector.js';
import { MarkdownFormatter } from './MarkdownFormatter.js';
import { NetworkInterceptor } from './NetworkInterceptor.js';
import { getGlobalStateSnapshot } from './StateSniffer.js';
import { auditA11y } from './A11yAuditor.js';
import { ErrorStackTracer } from './ErrorStackTracer.js';
import { autoTriage, type TriageResult } from './AutoTriage.js';
import { FeedbackManager } from '../core/FeedbackManager.js';
import type { PinmarkSettings, PinmarkConfig } from '../core/types.js';
import type { PinmarkAnnotation as FeedbackItem } from '@pinmark/core';
import html2canvas from 'html2canvas';
import * as rrweb from 'rrweb';
import { setHTML } from "./domUtils.js";

const OVERLAY_STYLES = `
  :host {
    all: initial;
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2147483647;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

    --pmk-bg: #1f2937;
    --pmk-bg-2: #111827;
    --pmk-bg-3: #374151;
    --pmk-text: #f9fafb;
    --pmk-text-muted: #9ca3af;
    --pmk-border: #374151;
    --pmk-accent: #3b82f6;
    --pmk-danger: #ef4444;
    --pmk-success: #22c55e;
  }

  :host(.blocking) {
    pointer-events: all;
    cursor: crosshair;
  }

  .pinmark-block-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    pointer-events: all;
    z-index: 2147483640;
  }
`;

export class Overlay {
  private container: HTMLElement;
  private shadowRoot: ShadowRoot;
  private blockOverlay: HTMLElement | null = null;
  private hoverBox: HoverBox;
  private areaSelectionBox: AreaSelectionBox;
  private markerManager: MarkerManager;
  private toolbar: Toolbar;
  private feedbackModal: FeedbackModal;
  private elementAnalyzer: ElementAnalyzer;
  private frameworkDetector: FrameworkDetector;
  private feedbackManager: FeedbackManager;
  getFeedbackManager() { return this.feedbackManager; }
  private settings: PinmarkSettings;
  private config: PinmarkConfig;
  private _isActive = false;
  get isActive() { return this._isActive; }
  private isPaused = false;
  private markersVisible = true;
  private isLayoutMode = false;
  private targetElement: HTMLElement | null = null;
  private isModalOpen = false;
  private isAreaSelectActive = false;
  private isMultiSelectActive = false;
  
  private isFrozen = false;
  private frozenStyleEl: HTMLStyleElement | null = null;

  // Text selection floating button
  private selectionBtn: HTMLElement | null = null;
  private selectionTarget: HTMLElement | null = null;
  private selectionText: string = '';
  private selectionRect: DOMRect | null = null;

  // Cooldown timestamp to prevent the click that closed the modal from reopening it
  private _modalClosedAt = 0;

  // Track drag state for area selection
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;

  // Layout mode state
  private isRearrangeMode = false;
  private rearrangeTarget: HTMLElement | null = null;
  private isWireframeActive = false;
  private wireframeOpacity = 70;
  private rearrangeGhost: HTMLElement | null = null;
  private rearrangeStartX = 0;
  private rearrangeStartY = 0;

  private consoleLogs: any[] = [];
  
  private rrwebEvents: any[] = [];
  private stopRecording: (() => void) | null = null;
  private perfMetrics: any[] = [];
  private perfObservers: PerformanceObserver[] = [];
  private fpsHistory: { timestamp: number, fps: number }[] = [];
  private fpsRafId: number | null = null;
  private framesCount = 0;
  private lastFpsTime = 0;


  private networkInterceptor = new NetworkInterceptor();
  private errorTracer = new ErrorStackTracer();
  constructor(settings: PinmarkSettings, config: PinmarkConfig, initialFeedback: FeedbackItem[] = []) {
    this.settings = settings;
    this.config = config;
    this.isPaused = config.isPaused ?? false;
    this.feedbackManager = new FeedbackManager(config, initialFeedback);

    this.container = document.createElement('pinmark-overlay');
    this.container.className = 'pinmark-overlay-container';
    this.shadowRoot = this.container.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.id = 'pinmark-overlay-styles';
    style.textContent = OVERLAY_STYLES;
    this.shadowRoot.appendChild(style);
    this.applyTheme(settings);

    this.hoverBox = new HoverBox(this.shadowRoot);
    this.areaSelectionBox = new AreaSelectionBox(this.shadowRoot);
    this.markerManager = new MarkerManager(this.shadowRoot, settings as any, {
      onEdit: (id) => this.handleEditFeedback(id),
      onDelete: (id) => this.handleDeleteFeedback(id),
      onCopy: (id) => this.handleCopyFeedback(id),
    });
    this.elementAnalyzer = new ElementAnalyzer();
    this.frameworkDetector = new FrameworkDetector();
    this.toolbar = new Toolbar(this.shadowRoot);
    this.toolbar.setPaused(this.isPaused);
    this.feedbackModal = new FeedbackModal(this.shadowRoot);

    this.setupToolbarListeners();
    this.loadExistingMarkers();

    // Apply block interactions setting
    if (this.settings.blockInteractions) {
      this.enableBlockingMode();
    }
  }

  private setupEventListeners() {
    window.addEventListener('message', this.handleWindowMessage);
    document.addEventListener('pointerdown', this.handlePointerDown as EventListener);
    document.addEventListener('pointermove', this.handlePointerMove as EventListener);
    document.addEventListener('pointerup', this.handlePointerUp as EventListener);
    document.addEventListener('pointercancel', this.handlePointerUp as EventListener);
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('keydown', this.handleKeydown, true);
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('scroll', this.handleScroll, { passive: true, capture: true });
  }

  private removeEventListeners() {
    window.removeEventListener('message', this.handleWindowMessage);
    document.removeEventListener('pointerdown', this.handlePointerDown as EventListener);
    document.removeEventListener('pointermove', this.handlePointerMove as EventListener);
    document.removeEventListener('pointerup', this.handlePointerUp as EventListener);
    document.removeEventListener('pointercancel', this.handlePointerUp as EventListener);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('keydown', this.handleKeydown, true);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('scroll', this.handleScroll, { capture: true });
  }

  private handleScroll = () => {
    if (!this.isActive || this.isPaused) return;
    this.markerManager.updatePositions(this.feedbackManager.getAll());
    if (this.isAreaSelectActive) return;
    this.hoverBox.hide();
    this.hideSelectionButton();
  };

  private handleKeydown = (e: KeyboardEvent) => {
    // Don't intercept if user is typing in our modal
    if (this.isModalOpen) {
      if (e.key === 'Escape') {
        // We let the modal handle Escape, but we don't want to close the whole overlay
      }
      return;
    }

    // Don't intercept if user is typing in an input or textarea — check both the
    // page's active element and the one inside our shadow root (e.g. the layout
    // panel's purpose textarea), since document.activeElement only reports the host.
    const activeElement = this.shadowRoot.activeElement || document.activeElement;
    if (activeElement) {
      const tag = activeElement.tagName.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || (activeElement as HTMLElement).isContentEditable;
      if (isInput) return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.isLayoutMode) {
        this.toggleLayoutMode(false);
      } else {
        this.deactivate();
      }
    } else if (e.key.toLowerCase() === 'p') {
      e.preventDefault();
      this.togglePause();
    } else if (e.key.toLowerCase() === 'h') {
      e.preventDefault();
      this.toggleMarkers();
    } else if (e.key.toLowerCase() === 'l') {
      e.preventDefault();
      this.toggleLayoutMode();
    } else if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      this.toggleFreeze();
      this.showToast(this.isFrozen ? '❄️ Animations Frozen (Press F to resume)' : '▶️ Animations Resumed');
    } else if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      this.copyFeedback();
    } else if (e.key.toLowerCase() === 'x' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      this.clearAll();
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      const all = this.feedbackManager.getAll();
      if (all.length > 0) {
        this.handleDeleteFeedback(all[all.length - 1].id);
      }
    }
  };

  private handleWindowMessage = (e: MessageEvent) => {
    if (e.data?.source === 'pinmark-logger') {
      if (e.data.type === 'console') {
        this.consoleLogs.push({ time: Date.now(), ...e.data.data });
        if (this.consoleLogs.length > 50) this.consoleLogs.shift();
      } else if (e.data.type === 'network') {
        // Ignore legacy postMessage network events, we intercept directly now.
      }
    }
  };
  private handlePointerDown = (e: PointerEvent) => {
    if (!this.isActive || this.isPaused || this.isModalOpen || this.feedbackModal.isOpen()) return;
    if (Date.now() - this._modalClosedAt < 500) return;

    // Only initiate drag selection if area select mode is active
    if (!this.isAreaSelectActive) return;

    const target = e.target as HTMLElement;
    if (this.shadowRoot.contains(target) || target === this.container || target.id.startsWith('pinmark-')) return;

    // We'll initiate dragging if they click and move.
    this.isDragging = false;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;

    // Prevent default to disable native text selection while dragging for area selection
    e.preventDefault();
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.isActive || this.isPaused || this.isModalOpen || this.feedbackModal.isOpen()) return;
    // Also block hover tracking during post-close cooldown to prevent instant re-trigger
    if (Date.now() - this._modalClosedAt < 500) return;

    if (this.isAreaSelectActive && e.buttons === 1) { // Left mouse button is held down
      const distance = Math.sqrt(Math.pow(e.clientX - this.dragStartX, 2) + Math.pow(e.clientY - this.dragStartY, 2));
      if (distance > 5) {
        if (!this.isDragging) {
          this.isDragging = true;
          this.areaSelectionBox.start(this.dragStartX, this.dragStartY);
          this.hoverBox.hide();
        }
        
        // Clear any native text selection that might occur despite preventDefault
        window.getSelection()?.removeAllRanges();
        
        this.areaSelectionBox.update(e.clientX, e.clientY);
        return;
      }
    }

    if (this.isDragging) return;

    // If area select mode is active, we don't hover elements
    if (this.isAreaSelectActive) {
      this.hoverBox.hide();
      this.targetElement = null;
      return;
    }

    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || target === this.container || target === this.blockOverlay || target.id.startsWith('pinmark-')) {
      this.hoverBox.hide();
      this.targetElement = null;
      return;
    }

    if (this.shadowRoot.contains(target)) {
      return;
    }

    if (target instanceof HTMLElement) {
      this.hoverBox.show(target);
      this.targetElement = target;
    }
  };




  private handleResize = () => {
    if (this.isActive && !this.isPaused) {
      this.markerManager.updatePositions(this.feedbackManager.getAll());
    }
  };

  private handleClick = (e: MouseEvent) => {
    if (!this.isActive || this.isPaused || this.isModalOpen || this.feedbackModal.isOpen()) return;

    // Cooldown: ignore clicks for 500ms after modal closes to prevent the same
    // click event (or any rapid follow-up click) from reopening the modal
    if (Date.now() - this._modalClosedAt < 500) return;

    // Ignore clicks if we're in rearrange mode, avoiding interference with layout interactions
    if (this.isRearrangeMode) return;

    const target = e.target as HTMLElement;

    // When clicking an element inside Shadow DOM, the event target is retargeted to the host (this.container)
    if (this.shadowRoot.contains(target) || target === this.container || target.id.startsWith('pinmark-')) {
      return;
    }

    // Check if clicking on the block overlay or if blocking is enabled
    // We prioritize feedback selection over blocking
    if (this.targetElement && !this.isAreaSelectActive) {
      e.preventDefault();
      e.stopPropagation();
      this.promptForFeedback(this.targetElement);
      return;
    }

    if (this.settings.blockInteractions || target === this.blockOverlay || this.isAreaSelectActive) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return;
    }

    // Default behavior for non-target clicks when blocking is disabled
    // (do nothing, let event propagate)
  };
  /** Assemble the current diagnostics bundle and classify the pin (never throws). */
  private buildTriage(element?: HTMLElement): TriageResult {
    try {
      const mem = (performance as any).memory;
      return autoTriage({
        performanceMetrics: [...this.perfMetrics],
        networkRequests: this.networkInterceptor.getRequests(),
        a11yIssues: element ? auditA11y(element) : undefined,
        errorTrace: this.errorTracer.getErrors(),
        fpsMetrics: [...this.fpsHistory],
        memoryMetrics: mem ? { usedJSHeapSize: mem.usedJSHeapSize, totalJSHeapSize: mem.totalJSHeapSize } : undefined,
        domMetrics: this.getDomAndMemoryMetrics().domMetrics
      });
    } catch (e) {
      return { category: 'question', intent: 'approve', severity: 'suggestion', summary: 'Triage failed to run.', reasons: [] };
    }
  }

  private getDomAndMemoryMetrics(element?: HTMLElement) {
    let elementDepth = 0;
    if (element) {
      let curr: HTMLElement | null = element;
      while (curr) { elementDepth++; curr = curr.parentElement; }
    }
    const totalNodes = document.getElementsByTagName('*').length;
    
    let memoryMetrics = undefined;
    const perf = performance as any;
    if (perf && perf.memory) {
      memoryMetrics = {
        jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
        totalJSHeapSize: perf.memory.totalJSHeapSize,
        usedJSHeapSize: perf.memory.usedJSHeapSize
      };
    }
    
    return {
      domMetrics: { totalNodes, elementDepth },
      ...(memoryMetrics ? { memoryMetrics } : {})
    };
  }

  private highlightLayoutShift(el: HTMLElement, score: number) {
    if (this.isPaused) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    
    const box = document.createElement('div');
    box.style.cssText = `
      position: fixed;
      top: ${rect.top}px; left: ${rect.left}px;
      width: ${rect.width}px; height: ${rect.height}px;
      border: 2px solid #f59e0b;
      background: rgba(245, 158, 11, 0.1);
      box-shadow: 0 0 20px rgba(245, 158, 11, 0.4), inset 0 0 10px rgba(245, 158, 11, 0.15);
      pointer-events: none;
      z-index: 2147483647;
      border-radius: 4px;
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
      transition: opacity 1.2s cubic-bezier(0.4, 0, 1, 1);
      overflow: hidden;
    `;

    const badge = document.createElement('div');
    badge.textContent = `Shift: ${score.toFixed(3)}`;
    badge.style.cssText = `
      background: #f59e0b;
      color: #fff;
      font-size: 10px;
      font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      padding: 3px 6px;
      border-bottom-left-radius: 4px;
      font-weight: 700;
      letter-spacing: 0.5px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;

    box.appendChild(badge);
    this.shadowRoot.appendChild(box);

    // Pulse animation
    if (typeof box.animate === 'function') {
      box.animate([
        { transform: 'scale(0.98)', opacity: 0.5 },
        { transform: 'scale(1.01)', opacity: 1, boxShadow: '0 0 30px rgba(245, 158, 11, 0.6), inset 0 0 15px rgba(245, 158, 11, 0.3)' },
        { transform: 'scale(1)', opacity: 1 }
      ], { duration: 400, easing: 'ease-out' });
    }

    setTimeout(() => {
      box.style.opacity = '0';
      setTimeout(() => box.remove(), 1200);
    }, 1800);
  }

  private async promptForFeedback(element: HTMLElement, overrideRect?: DOMRect) {
    const selection = window.getSelection();
    let selectionText: string | undefined;
    let selectionRect: DOMRect | undefined = overrideRect;

    if (!overrideRect && selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const text = selection.toString().trim();
      if (text) {
        selectionText = text;
        selectionRect = selection.getRangeAt(0).getBoundingClientRect();
      }
    }

    this.isModalOpen = true;
    this.targetElement = null; // clear so stale element doesn't re-trigger after close
    this.hoverBox.hide();

    // Start screenshot capture in the background
    const screenshotPromise = (async () => {
      try {
        if (this.config.captureScreenshot) {
          return await this.config.captureScreenshot(element);
        }
        this.container.style.display = 'none';
        const canvas = await html2canvas(element, {
          useCORS: true,
          logging: false,
          scale: window.devicePixelRatio || 1,
          ignoreElements: (node) => node.tagName === 'SCRIPT' || node.tagName === 'NOSCRIPT' || node.tagName === 'IFRAME' || node.tagName === 'LINK'
        });
        return canvas.toDataURL('image/jpeg', 0.8);
      } catch (e) {
        console.warn('[Pinmark] Failed to capture screenshot:', e);
        return undefined;
      } finally {
        this.container.style.display = 'block';
      }
    })();

    // Gather component info and computed styles for the modal
    const componentInfo = (() => {
      try { return this.frameworkDetector.detect(element); } catch { return undefined; }
    })();
    const computedStylesData = (() => {
      try {
        const styles = window.getComputedStyle(element);
        const keys = ['display','flex-direction','align-items','justify-content','gap','color','background-color','font-size','font-weight','font-family','padding','margin','border-radius','width','height','position'];
        const result: Record<string,string> = {};
        for (const k of keys) {
          const v = styles.getPropertyValue(k);
          if (v && v !== 'none' && v !== 'normal' && v !== '0px' && v !== 'rgba(0, 0, 0, 0)' && v !== 'auto') result[k] = v;
        }
        return result;
      } catch { return {}; }
    })();

    // Smart name for the element
    const smartName = (() => {
      const tag = element.tagName.toLowerCase();
      if (['button','a','label','h1','h2','h3','h4','h5','h6'].includes(tag)) {
        const text = element.textContent?.trim();
        if (text && text.length < 60) return text;
      }
      if (tag === 'input' || tag === 'textarea') return (element as HTMLInputElement).placeholder || element.getAttribute('name') || undefined;
      if (tag === 'img') return (element as HTMLImageElement).alt || undefined;
      return undefined;
    })();

    // Show the modal immediately (passing undefined for screenshot initially)
    const triage = this.buildTriage(element);
    const modalPromise = this.feedbackModal.show(element, {
      screenshotUrl: undefined,
      computedStyles: computedStylesData,
      selectionText,
      componentInfo: componentInfo ? { framework: componentInfo.framework, name: componentInfo.name, hierarchy: componentInfo.hierarchy } : undefined,
      smartName,
      existingCategory: triage.category,
      existingIntent: triage.intent,
      existingSeverity: triage.severity
    });

    // Update the screenshot in the modal once it resolves
    screenshotPromise.then((url) => {
      if (url && this.isModalOpen) {
        this.feedbackModal.setScreenshot(url);
      }
    });

    const result = await modalPromise;
    this.isModalOpen = false;
    this._modalClosedAt = Date.now(); // set cooldown timestamp

    if (!result) return;
    
    // Get the screenshot that was actually drawn/used (either local or from prompt)
    let screenshot = result.screenshot || await screenshotPromise;

    const elementInfo = this.elementAnalyzer.analyze(element);
    
    // If there is an active text selection, overwrite the element's bounding rect and text
    // to match exactly what the user highlighted.
    if (selectionText && selectionRect) {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

      elementInfo.selectionText = selectionText;
      elementInfo.boundingRect = {
        x: selectionRect.x + scrollLeft,
        y: selectionRect.y + scrollTop,
        width: selectionRect.width,
        height: selectionRect.height,
        top: selectionRect.top + scrollTop,
        right: selectionRect.right + scrollLeft,
        bottom: selectionRect.bottom + scrollTop,
        left: selectionRect.left + scrollLeft
      };
    }

    if (screenshot) {
      elementInfo.screenshot = screenshot;
    }

    const state: any = {};
    try {
      state.localStorage = { ...window.localStorage };
      state.sessionStorage = { ...window.sessionStorage };
      state.cookies = document.cookie;
    } catch (e) {
      console.warn('[Pinmark] Could not capture state:', e);
    }

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    const feedback: FeedbackItem = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
      index: this.feedbackManager.getAll().length + 1,
      comment: result.comment,
      category: result.category,
      intent: result.intent,
      severity: result.severity,
      timestamp: Date.now(),
      url: this.config.url || window.location.href,
      element: elementInfo,
      state,
      consoleLogs: [...this.consoleLogs],
      networkRequests: this.networkInterceptor.getRequests(),
      sessionReplayEvents: [...this.rrwebEvents],
      performanceMetrics: [...this.perfMetrics],
      stateSnapshot: getGlobalStateSnapshot(),
      a11yIssues: auditA11y(element),
      errorTrace: this.errorTracer.getErrors(),
      triage: this.buildTriage(element),
      fpsMetrics: [...this.fpsHistory],
      ...this.getDomAndMemoryMetrics(element),
      ...(overrideRect ? { areaRect: { x: overrideRect.x + scrollLeft, y: overrideRect.y + scrollTop, width: overrideRect.width, height: overrideRect.height } } : {})
    };

    this.feedbackManager.add(feedback);
    this.markerManager.addMarker(feedback);
  }

  private async handleEditFeedback(id: string) {
    const feedback = this.feedbackManager.getAll().find(f => f.id === id);
    if (!feedback) return;

    // Find the element again using the selector
    const element = document.querySelector(feedback.element.selector) as HTMLElement;
    if (!element) {
      // Element no longer exists, use a placeholder
      const placeholder = document.createElement('div');
      placeholder.textContent = 'Element not found';
      this.isModalOpen = true;
      const result = await this.feedbackModal.show(placeholder, {
        existingComment: feedback.comment,
        existingCategory: feedback.category,
        existingIntent: feedback.intent,
        existingSeverity: feedback.severity,
        screenshotUrl: feedback.element?.screenshot
      });
      this.isModalOpen = false;
      this._modalClosedAt = Date.now();

      if (result) {
        const updates: Partial<FeedbackItem> = { 
          comment: result.comment,
          category: result.category,
          intent: result.intent,
          severity: result.severity,
          timestamp: Date.now()
        };

        if (result.screenshot && feedback.element) {
          updates.element = { ...feedback.element, screenshot: result.screenshot };
        }

        this.feedbackManager.update(id, updates);
        this.markerManager.updateMarkerTooltip(id, result.comment);
        if (this.config.onSync) this.config.onSync({ ...feedback, ...updates });
      }
      return;
    }

    this.isModalOpen = true;
    const result = await this.feedbackModal.show(element, {
      existingComment: feedback.comment,
      existingCategory: feedback.category,
      existingIntent: feedback.intent,
      existingSeverity: feedback.severity,
      screenshotUrl: feedback.element?.screenshot
    });
    this.isModalOpen = false;
    this._modalClosedAt = Date.now();

    if (result) {
      const updates: Partial<FeedbackItem> = { 
        comment: result.comment,
        category: result.category,
        intent: result.intent,
        severity: result.severity,
        timestamp: Date.now()
      };
      
      // If the user drew on the screenshot during edit, we need to update the nested element info
      if (result.screenshot && feedback.element) {
        updates.element = { ...feedback.element, screenshot: result.screenshot };
      }

      this.feedbackManager.update(id, updates);
      this.markerManager.updateMarkerTooltip(id, result.comment);
      if (this.config.onSync) this.config.onSync({ ...feedback, ...updates });
    }
  }

  private async handleDeleteFeedback(id: string) {
    this.feedbackManager.remove(id);
    this.markerManager.removeMarker(id);
    // Re-index remaining markers
    await this.reindexMarkers();
  }

  private async handleCopyFeedback(id: string) {
    const item = this.feedbackManager.getAll().find(f => f.id === id);
    if (!item) return;
    try {
      const fmt = new MarkdownFormatter();
      const markdown = fmt.formatItem(item, this.settings as any);
      await this.copyToClipboard(markdown);
    } catch (e) {
      console.error('Failed to copy feedback item:', e);
    }
  }

  private async reindexMarkers() {
    const allFeedback = this.feedbackManager.getAll();
    allFeedback.forEach((feedback, index) => {
      feedback.index = index + 1;
    });
    // Update storage
    try {
      await this.feedbackManager.save();
    } catch (e) {
      console.error('Failed to save reindexed markers:', e);
    }
    // Refresh markers
    this.markerManager.clearAll();
    allFeedback.forEach((item) => {
      this.markerManager.addMarker(item);
    });
  }

  private setAreaSelectActive(active: boolean) {
    this.isAreaSelectActive = active;
    if (active) {
      document.body.classList.add('pinmark-area-select-active');
      let style = document.getElementById('pinmark-host-styles');
      if (!style) {
        style = document.createElement('style');
        style.id = 'pinmark-host-styles';
        style.textContent = `
          body.pinmark-area-select-active * {
            user-select: none !important;
            -webkit-user-select: none !important;
          }
        `;
        document.head.appendChild(style);
      }
    } else {
      document.body.classList.remove('pinmark-area-select-active');
    }
  }

  private setupToolbarListeners() {
    this.toolbar.onPauseToggle = () => this.togglePause();
    this.toolbar.onMarkersToggle = () => this.toggleMarkers();
    this.toolbar.onAreaSelectToggle = () => {
      this.setAreaSelectActive(!this.isAreaSelectActive);
      if (this.isAreaSelectActive) {
        this.hoverBox.hide();
        this.targetElement = null;
        if (this.isLayoutMode) this.toggleLayoutMode(false);
        if (this.isMultiSelectActive) {
          this.isMultiSelectActive = false;
        }
      }
    };
    this.toolbar.onMultiSelectToggle = () => {
      this.isMultiSelectActive = !this.isMultiSelectActive;
      if (this.isMultiSelectActive) {
        if (this.isAreaSelectActive) {
          this.setAreaSelectActive(false);
        }
        if (this.isLayoutMode) this.toggleLayoutMode(false);
      }
    };
    this.toolbar.onLayoutModeToggle = () => this.toggleLayoutMode();
    this.toolbar.onCopy = () => this.copyFeedback();
    this.toolbar.onDownloadJson = () => this.downloadJson();
    this.toolbar.onGithubCreate = () => this.createGithubIssue();
    this.toolbar.onClear = () => this.clearAll();
    this.toolbar.onWebhookSend = () => this.sendToWebhook();
    this.toolbar.onSettingsClick = () => {
      try {
        if (typeof (window as any).chrome !== 'undefined' && (window as any).chrome.runtime) {
          (window as any).chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS' });
        } else {
          console.warn('[Pinmark] Cannot open settings: not running as an extension');
        }
      } catch (e) {
        console.warn('[Pinmark] Cannot open settings:', e);
      }
    };
    this.toolbar.onExitClick = () => this.deactivate();

    if (this.settings.webhookUrl) {
      this.toolbar.setWebhookEnabled(true);
    }
  }

  // ── Text-selection floating button ──────────────────────────────────────
  private handlePointerUp = () => {
    if (this.isDragging) {
      const areaRect = this.areaSelectionBox.end();
      this.isDragging = false;
      
      if (areaRect) {
        const target = document.elementFromPoint(areaRect.x + areaRect.width / 2, areaRect.y + areaRect.height / 2) as HTMLElement;
        this.promptForFeedback(target || document.body, areaRect);
      }
      return;
    }

    // Check for text selection
    if (!this.isActive || this.isPaused || this.isModalOpen || this.feedbackModal.isOpen() || this.isAreaSelectActive) return;
    if (Date.now() - this._modalClosedAt < 500) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const text = sel.toString().trim();
      if (text.length > 0) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        this.selectionText = text;
        this.selectionRect = rect;
        this.selectionTarget = (range.commonAncestorContainer.nodeType === Node.TEXT_NODE
          ? range.commonAncestorContainer.parentElement
          : range.commonAncestorContainer) as HTMLElement;
        this.showSelectionButton(rect);
        return;
      }
    }
    this.hideSelectionButton();
  };

  private showSelectionButton(rect: DOMRect) {
    this.hideSelectionButton();

    const btn = document.createElement('div');
    btn.className = 'pinmark-selection-btn';
    setHTML(btn, `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Add Annotation`);
    
    btn.style.cssText = `
      position: fixed;
      top: ${rect.top - 36}px;
      left: ${rect.left + rect.width / 2}px;
      transform: translateX(-50%);
      background: var(--pmk-bg-2, #111827);
      color: var(--pmk-text, #f9fafb);
      border: 1px solid var(--pmk-border, rgba(255,255,255,0.15));
      border-radius: 20px;
      padding: 5px 12px;
      font-size: 12px;
      font-weight: 500;
      font-family: system-ui, -apple-system, sans-serif;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      z-index: 2147483646;
      pointer-events: all;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      white-space: nowrap;
      animation: pmkFadeIn 0.12s ease;
    `;

    // Add animation keyframe if missing
    if (!this.shadowRoot.querySelector('#pmk-selection-anim')) {
      const animStyle = document.createElement('style');
      animStyle.id = 'pmk-selection-anim';
      animStyle.textContent = '@keyframes pmkFadeIn { from { opacity: 0; transform: translateX(-50%) translateY(4px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }';
      this.shadowRoot.appendChild(animStyle);
    }

    btn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      const target = this.selectionTarget || document.body;
      const savedText = this.selectionText;
      const savedRect = this.selectionRect;
      this.hideSelectionButton();
      window.getSelection()?.removeAllRanges();
      this.promptForFeedbackWithSelection(target, savedText, savedRect!);
    };

    this.shadowRoot.appendChild(btn);
    this.selectionBtn = btn;
  }

  private hideSelectionButton() {
    if (this.selectionBtn) {
      this.selectionBtn.remove();
      this.selectionBtn = null;
    }
    this.selectionText = '';
    this.selectionRect = null;
    this.selectionTarget = null;
  }

  private async promptForFeedbackWithSelection(element: HTMLElement, selText: string, selRect: DOMRect) {
    this.isModalOpen = true;
    this.targetElement = null; // clear so stale element doesn't re-trigger after close
    this.hoverBox.hide();

    // Start screenshot capture in the background
    const screenshotPromise = (async () => {
      try {
        if (this.config.captureScreenshot) {
          return await this.config.captureScreenshot(element);
        }
        this.container.style.display = 'none';
        const canvas = await html2canvas(element, {
          useCORS: true,
          logging: false,
          scale: window.devicePixelRatio || 1,
          ignoreElements: (node) => node.tagName === 'SCRIPT' || node.tagName === 'NOSCRIPT' || node.tagName === 'IFRAME' || node.tagName === 'LINK'
        });
        return canvas.toDataURL('image/jpeg', 0.8);
      } catch (e) {
        console.warn('[Pinmark] Screenshot failed:', e);
        return undefined;
      } finally {
        this.container.style.display = 'block';
      }
    })();

    const componentInfo = (() => { try { return this.frameworkDetector.detect(element); } catch { return undefined; } })();

    // Show the modal immediately (passing undefined for screenshot initially)
    const modalPromise = this.feedbackModal.show(element, {
      screenshotUrl: undefined,
      selectionText: selText,
      componentInfo: componentInfo ? { framework: componentInfo.framework, name: componentInfo.name, hierarchy: componentInfo.hierarchy } : undefined
    });

    // Update the screenshot in the modal once it resolves
    screenshotPromise.then((url) => {
      if (url && this.isModalOpen) {
        this.feedbackModal.setScreenshot(url);
      }
    });

    const result = await modalPromise;
    this.isModalOpen = false;
    this._modalClosedAt = Date.now();
    if (!result) return;

    // Get the screenshot that was actually drawn/used (either local or from prompt)
    let screenshot = result.screenshot || await screenshotPromise;

    const elementInfo = this.elementAnalyzer.analyze(element);
    elementInfo.selectionText = selText;
    elementInfo.boundingRect = { x: selRect.x, y: selRect.y, width: selRect.width, height: selRect.height, top: selRect.top, right: selRect.right, bottom: selRect.bottom, left: selRect.left };
    if (screenshot) elementInfo.screenshot = screenshot;

    const state: any = {};
    try { state.localStorage = { ...window.localStorage }; state.sessionStorage = { ...window.sessionStorage }; state.cookies = document.cookie; } catch {}

    const feedback: FeedbackItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      index: this.feedbackManager.getAll().length + 1,
      comment: result.comment,
      timestamp: Date.now(),
      url: this.config.url || window.location.href,
      element: elementInfo,
      state,
      consoleLogs: [...this.consoleLogs],
      networkRequests: this.networkInterceptor.getRequests(),
      sessionReplayEvents: [...this.rrwebEvents],
      performanceMetrics: [...this.perfMetrics],
      stateSnapshot: getGlobalStateSnapshot(),
      a11yIssues: auditA11y(element),
      errorTrace: this.errorTracer.getErrors(),
      triage: this.buildTriage(element),
      fpsMetrics: [...this.fpsHistory],
      ...this.getDomAndMemoryMetrics(element),
    };

    this.feedbackManager.add(feedback);
    this.markerManager.addMarker(feedback);
  }

  // ── Layout Mode ─────────────────────────────────────────────────────────
  toggleLayoutMode(force?: boolean) {
    this.isLayoutMode = force !== undefined ? force : !this.isLayoutMode;
    this.toolbar.setLayoutMode(this.isLayoutMode);
    if (this.isLayoutMode) {
      this.showLayoutPanel();
    } else {
      this.hideLayoutPanel();
    }
  }

  private layoutPanel: HTMLElement | null = null;

  private showLayoutPanel() {
    if (this.layoutPanel) return;

    const COMPONENTS = [
      // Navigation & Structure
      { icon: '🧭', name: 'Navbar', kind: 'navbar' },
      { icon: '☰', name: 'Sidebar', kind: 'sidebar' },
      { icon: '📌', name: 'Breadcrumb', kind: 'breadcrumb' },
      { icon: '🗂️', name: 'Tabs', kind: 'tabs' },
      { icon: '🦶', name: 'Footer', kind: 'footer' },
      { icon: '📍', name: 'Anchor Nav', kind: 'anchor-nav' },
      { icon: '🔄', name: 'Pagination', kind: 'pagination' },

      // Hero & Sections
      { icon: '📄', name: 'Hero Section', kind: 'hero' },
      { icon: '🎯', name: 'CTA Section', kind: 'cta' },
      { icon: '💬', name: 'Testimonial', kind: 'testimonial' },
      { icon: '🏷️', name: 'Pricing Card', kind: 'pricing' },
      { icon: '📊', name: 'Stats Section', kind: 'stats' },
      { icon: '❓', name: 'FAQ Section', kind: 'faq' },
      { icon: '👥', name: 'Team Section', kind: 'team' },
      { icon: '📰', name: 'Newsletter', kind: 'newsletter' },
      { icon: '🗺️', name: 'Contact Section', kind: 'contact' },
      { icon: '🚀', name: 'Feature Section', kind: 'feature' },
      { icon: '📱', name: 'App Download', kind: 'app-download' },
      { icon: '🏷️', name: 'Brands Logos', kind: 'brands' },
      { icon: '📅', name: 'Timeline', kind: 'timeline' },
      { icon: '🪜', name: 'Stepper', kind: 'stepper' },
      { icon: '📑', name: 'Steps Section', kind: 'steps' },

      // Content Blocks
      { icon: '🃏', name: 'Card', kind: 'card' },
      { icon: '🌐', name: 'Grid', kind: 'grid' },
      { icon: '📄', name: 'Text Block', kind: 'text' },
      { icon: '↔️', name: 'Divider', kind: 'divider' },
      { icon: '🖼️', name: 'Image', kind: 'image' },
      { icon: '📷', name: 'Gallery', kind: 'gallery' },
      { icon: '🎬', name: 'Video', kind: 'video' },
      { icon: '🗺️', name: 'Map', kind: 'map' },
      { icon: '📋', name: 'Table', kind: 'table' },
      { icon: '📊', name: 'Chart', kind: 'chart' },
      { icon: '📝', name: 'Code Block', kind: 'code-block' },
      { icon: '📑', name: 'Card Grid', kind: 'card-grid' },
      { icon: '📰', name: 'Blog Post', kind: 'blog-post' },
      { icon: '🎠', name: 'Carousel', kind: 'carousel' },
      { icon: '🪗', name: 'Accordion', kind: 'accordion' },
      { icon: '📑', name: 'List', kind: 'list' },
      { icon: '💬', name: 'Quote', kind: 'quote' },
      { icon: '🔔', name: 'Notification', kind: 'notification' },

      // Interactive Elements
      { icon: '🔘', name: 'Button', kind: 'button' },
      { icon: '🔗', name: 'Link', kind: 'link' },
      { icon: '🖊️', name: 'Input', kind: 'input' },
      { icon: '📝', name: 'Form', kind: 'form' },
      { icon: '🔽', name: 'Dropdown', kind: 'dropdown' },
      { icon: '🔀', name: 'Toggle Switch', kind: 'toggle' },
      { icon: '📻', name: 'Radio Group', kind: 'radio' },
      { icon: '☑️', name: 'Checkbox Group', kind: 'checkbox' },
      { icon: '📎', name: 'File Upload', kind: 'file-upload' },
      { icon: '🎨', name: 'Color Picker', kind: 'color-picker' },
      { icon: '📅', name: 'Date Picker', kind: 'date-picker' },
      { icon: '🔢', name: 'Number Input', kind: 'number-input' },
      { icon: '🔍', name: 'Search Bar', kind: 'search' },
      { icon: '🔎', name: 'Search Results', kind: 'search-results' },
      { icon: '🏷️', name: 'Tag Input', kind: 'tag-input' },

      // Feedback & Overlay
      { icon: '📦', name: 'Modal', kind: 'modal' },
      { icon: '💡', name: 'Tooltip', kind: 'tooltip' },
      { icon: '🔔', name: 'Alert', kind: 'alert' },
      { icon: '⭐', name: 'Badge', kind: 'badge' },
      { icon: '⏳', name: 'Progress Bar', kind: 'progress' },
      { icon: '⏳', name: 'Skeleton Loader', kind: 'skeleton' },
      { icon: '💬', name: 'Toast', kind: 'toast' },
      { icon: '📋', name: 'Popover', kind: 'popover' },
      { icon: '🪟', name: 'Drawer', kind: 'drawer' },

      // Layout & Container
      { icon: '👤', name: 'Avatar', kind: 'avatar' },
      { icon: '👤', name: 'Avatar Group', kind: 'avatar-group' },
      { icon: '🏷️', name: 'Chip', kind: 'chip' },
      { icon: '📊', name: 'Stat Card', kind: 'stat-card' },
      { icon: '🗑️', name: 'Empty State', kind: 'empty-state' },
      { icon: '🔒', name: 'Login Form', kind: 'login' },
      { icon: '📄', name: '404 Page', kind: '404' },
    ];

    const panel = document.createElement('div');
    panel.style.cssText = `
      position: fixed;
      top: 70px;
      left: 16px;
      width: 220px;
      max-height: calc(100vh - 100px);
      overflow-y: auto;
      background: rgba(18, 18, 20, 0.97);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 12px;
      z-index: 2147483645;
      box-shadow: 0 16px 40px rgba(0,0,0,0.5);
      pointer-events: all;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.08);';
    setHTML(header, `
      <span style="font-size:13px;font-weight:600;color:rgba(255,255,255,0.9);">Layout Mode</span>
      <span style="font-size:10px;color:rgba(255,255,255,0.3);margin-left:auto;">Press L to close</span>
    `);
    panel.appendChild(header);

    // ── Rearrange mode ──────────────────────────────────────
    this.isRearrangeMode = false;
    this.rearrangeTarget = null;
    this.rearrangeGhost = null;
    this.rearrangeStartX = 0;
    this.rearrangeStartY = 0;

    const rearrangeBtn = document.createElement('button');
    rearrangeBtn.style.cssText = 'width:100%;padding:7px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:7px;color:rgba(255,255,255,0.7);font-size:12px;cursor:pointer;margin-bottom:6px;font-family:inherit;transition:all 0.15s;display:flex;align-items:center;gap:6px;';
    setHTML(rearrangeBtn, '↕️ Rearrange Sections');
    rearrangeBtn.title = 'Click any page element to drag it to a new position';
    rearrangeBtn.onclick = () => {
      this.isRearrangeMode = !this.isRearrangeMode;
      rearrangeBtn.style.background = this.isRearrangeMode ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)';
      rearrangeBtn.style.borderColor = this.isRearrangeMode ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)';
      rearrangeBtn.style.color = this.isRearrangeMode ? '#4ade80' : 'rgba(255,255,255,0.7)';
      if (this.isRearrangeMode) {
        this.showToast('↕️ Rearrange mode ON — click any element to drag it');
      } else {
        this.showToast('Rearrange mode OFF');
      }
    };
    panel.appendChild(rearrangeBtn);

    // Wireframe toggle with opacity slider
    const wireframeOverlay = document.createElement('div');
    wireframeOverlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,${this.wireframeOpacity / 100});pointer-events:none;z-index:2147483640;transition:opacity 0.2s;`;
    wireframeOverlay.style.display = this.isWireframeActive ? 'block' : 'none';
    this.shadowRoot.appendChild(wireframeOverlay);

    const wireBtn = document.createElement('button');
    wireBtn.style.cssText = 'width:100%;padding:7px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:7px;color:rgba(255,255,255,0.7);font-size:12px;cursor:pointer;margin-bottom:4px;font-family:inherit;transition:all 0.15s;display:flex;align-items:center;gap:6px;';
    setHTML(wireBtn, '🔲 Wireframe Mode');
    
    const updateWireBtnStyle = () => {
      wireBtn.style.background = this.isWireframeActive ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)';
      wireBtn.style.borderColor = this.isWireframeActive ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.1)';
      wireBtn.style.color = this.isWireframeActive ? '#60a5fa' : 'rgba(255,255,255,0.7)';
    };
    updateWireBtnStyle();

    wireBtn.onclick = () => {
      this.isWireframeActive = !this.isWireframeActive;
      wireframeOverlay.style.display = this.isWireframeActive ? 'block' : 'none';
      updateWireBtnStyle();
      opacityRow.style.display = this.isWireframeActive ? 'flex' : 'none';
      // Toggle body class for wireframe styling
      if (this.isWireframeActive) {
        document.body.classList.add('pinmark-wireframe-active');
        if (!document.getElementById('pinmark-wireframe-style')) {
          const style = document.createElement('style');
          style.id = 'pinmark-wireframe-style';
          style.textContent = `
            body.pinmark-wireframe-active *:not(pinmark-overlay) {
              background-color: transparent !important;
              color: transparent !important;
              box-shadow: none !important;
              border: 1px solid rgba(150, 150, 150, 0.2) !important;
              background-image: none !important;
            }
            body.pinmark-wireframe-active img, 
            body.pinmark-wireframe-active svg, 
            body.pinmark-wireframe-active video, 
            body.pinmark-wireframe-active iframe {
              opacity: 0.5 !important;
              filter: grayscale(100%) !important;
            }
          `;
          document.head.appendChild(style);
        }
      } else {
        document.body.classList.remove('pinmark-wireframe-active');
      }
    };
    panel.appendChild(wireBtn);

    const opacityRow = document.createElement('div');
    opacityRow.style.cssText = `display:${this.isWireframeActive ? 'flex' : 'none'};align-items:center;gap:6px;padding:4px 6px 8px 6px;`;
    const opacityLabel = document.createElement('span');
    opacityLabel.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.4);white-space:nowrap;';
    opacityLabel.textContent = 'Opacity';
    const opacitySlider = document.createElement('input');
    opacitySlider.type = 'range';
    opacitySlider.min = '0';
    opacitySlider.max = '100';
    opacitySlider.value = this.wireframeOpacity.toString();
    opacitySlider.style.cssText = 'flex:1;height:4px;accent-color:#3b82f6;cursor:pointer;';
    const opacityVal = document.createElement('span');
    opacityVal.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.4);min-width:28px;text-align:right;';
    opacityVal.textContent = this.wireframeOpacity + '%';
    opacitySlider.oninput = () => {
      this.wireframeOpacity = parseInt(opacitySlider.value, 10);
      opacityVal.textContent = this.wireframeOpacity + '%';
      wireframeOverlay.style.background = `rgba(0,0,0,${this.wireframeOpacity / 100})`;
    };
    opacityRow.appendChild(opacityLabel);
    opacityRow.appendChild(opacitySlider);
    opacityRow.appendChild(opacityVal);
    panel.appendChild(opacityRow);

    // Purpose field
    const purposeRow = document.createElement('div');
    purposeRow.style.cssText = 'margin-bottom:10px;';
    const purposeInput = document.createElement('textarea');
    purposeInput.placeholder = 'Purpose / intent (optional)';
    purposeInput.style.cssText = 'width:100%;padding:6px 8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:rgba(255,255,255,0.7);font-size:11px;font-family:inherit;resize:vertical;min-height:32px;max-height:60px;outline:none;box-sizing:border-box;transition:border-color 0.15s;';
    purposeInput.onfocus = () => { purposeInput.style.borderColor = 'rgba(59,130,246,0.4)'; };
    purposeInput.onblur = () => { purposeInput.style.borderColor = 'rgba(255,255,255,0.08)'; };
    purposeRow.appendChild(purposeInput);
    panel.appendChild(purposeRow);

    const gridLabel = document.createElement('div');
    gridLabel.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.3);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.08em;padding:0 2px;';
    gridLabel.textContent = 'Components';
    panel.appendChild(gridLabel);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:4px;';

    for (const comp of COMPONENTS) {
      const item = document.createElement('div');
      item.style.cssText = 'padding:8px 6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:7px;cursor:grab;text-align:center;font-size:11px;color:rgba(255,255,255,0.6);transition:all 0.15s;user-select:none;';
      setHTML(item, `<div style="font-size:18px;margin-bottom:3px;">${comp.icon}</div>${comp.name}`);
      item.title = `Drag to place ${comp.name}`;
      item.draggable = true;

      item.onmouseenter = () => { item.style.background = 'rgba(59,130,246,0.1)'; item.style.borderColor = 'rgba(59,130,246,0.3)'; item.style.color = '#fff'; };
      item.onmouseleave = () => { item.style.background = 'rgba(255,255,255,0.04)'; item.style.borderColor = 'rgba(255,255,255,0.06)'; item.style.color = 'rgba(255,255,255,0.6)'; };

      item.ondragstart = (e) => {
        e.dataTransfer?.setData('text/plain', JSON.stringify({ kind: comp.kind, name: comp.name, purpose: purposeInput.value.trim() }));
      };

      item.onclick = () => {
        // Click to annotate at center viewport
        const x = window.innerWidth / 2;
        const y = window.innerHeight / 2;
        this.addLayoutAnnotation(comp.kind, comp.name, x, y, purposeInput.value.trim());
      };

      grid.appendChild(item);
    }
    panel.appendChild(grid);

    // Drop handler on document
    const onDragEnter = (e: DragEvent) => { e.preventDefault(); };
    const onDragOver = (e: DragEvent) => { e.preventDefault(); };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      try {
        const data = JSON.parse(e.dataTransfer?.getData('text/plain') || '{}');
        if (data.kind) {
          this.addLayoutAnnotation(data.kind, data.name, e.clientX, e.clientY, data.purpose || '');
        }
      } catch {}
    };
    document.addEventListener('dragenter', onDragEnter);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDrop);

    // Rearrange mode event handlers
    const onRearrangeMouseDown = (e: MouseEvent) => {
      if (!this.isRearrangeMode || this.isModalOpen) return;
      const target = e.target as HTMLElement;
      if (this.shadowRoot.contains(target) || target === this.container) return;
      // Stop the overlay's handleClick from also firing a feedback modal for this click.
      e.preventDefault();
      e.stopPropagation();
      this.rearrangeTarget = target;
      this.rearrangeStartX = e.clientX;
      this.rearrangeStartY = e.clientY;
    };
    const onRearrangeMouseMove = (e: MouseEvent) => {
      if (!this.isRearrangeMode || !this.rearrangeTarget) return;
      const dx = e.clientX - this.rearrangeStartX;
      const dy = e.clientY - this.rearrangeStartY;
      if (!this.rearrangeGhost && Math.abs(dx) + Math.abs(dy) > 5) {
        // Create ghost overlay on the target
        this.rearrangeGhost = document.createElement('div');
        const rect = this.rearrangeTarget.getBoundingClientRect();
        this.rearrangeGhost.style.cssText = `position:fixed;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;border:2px dashed #4ade80;background:rgba(34,197,94,0.1);pointer-events:none;z-index:2147483644;transition:all 0.1s;`;
        this.shadowRoot.appendChild(this.rearrangeGhost);
      }
      if (this.rearrangeGhost) {
        this.rearrangeGhost.style.transform = `translate(${dx}px, ${dy}px)`;
      }
    };
    const onRearrangeMouseUp = (e: MouseEvent) => {
      if (!this.isRearrangeMode || !this.rearrangeTarget) return;
      if (this.rearrangeGhost) {
        this.rearrangeGhost.remove();
        this.rearrangeGhost = null;
        // Create a rearrange annotation
        this.addRearrangeAnnotation(this.rearrangeTarget, e.clientX, e.clientY, purposeInput.value.trim());
      }
      this.rearrangeTarget = null;
    };
    document.addEventListener('mousedown', onRearrangeMouseDown);
    document.addEventListener('mousemove', onRearrangeMouseMove);
    document.addEventListener('mouseup', onRearrangeMouseUp);

    (panel as any)._cleanup = () => {
      document.removeEventListener('dragenter', onDragEnter);
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('drop', onDrop);
      document.removeEventListener('mousedown', onRearrangeMouseDown);
      document.removeEventListener('mousemove', onRearrangeMouseMove);
      document.removeEventListener('mouseup', onRearrangeMouseUp);
      document.body.classList.remove('pinmark-wireframe-active');
      wireframeOverlay.remove();
      this.isRearrangeMode = false;
    };
    this.shadowRoot.appendChild(panel);
    this.layoutPanel = panel;
  }

  private hideLayoutPanel() {
    if (this.layoutPanel) {
      const cleanup = (this.layoutPanel as any)._cleanup;
      if (cleanup) cleanup();
      this.layoutPanel.remove();
      this.layoutPanel = null;
    }
  }

  private addLayoutAnnotation(_kind: string, name: string, clientX: number, clientY: number, purpose?: string) {
    const target = (document.elementFromPoint(clientX, clientY) as HTMLElement) || document.body;

    const placeholderRect = {
      x: clientX,
      y: clientY,
      width: 300,
      height: 80,
      top: clientY,
      right: clientX + 300,
      bottom: clientY + 80,
      left: clientX
    };

    const elementInfo = this.elementAnalyzer.analyze(target);
    elementInfo.boundingRect = placeholderRect;

    const purposeText = purpose ? ` — ${purpose}` : '';

    const state: any = {};
    const feedback: FeedbackItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      index: this.feedbackManager.getAll().length + 1,
      comment: `[Layout] Place ${name} here${purposeText}`,
      timestamp: Date.now(),
      url: this.config.url || window.location.href,
      element: elementInfo,
      state,
      consoleLogs: [],
      networkRequests: this.networkInterceptor.getRequests(),
      performanceMetrics: [...this.perfMetrics],
      stateSnapshot: getGlobalStateSnapshot(),
      a11yIssues: auditA11y(target),
      errorTrace: this.errorTracer.getErrors(),
      triage: this.buildTriage(target),
      fpsMetrics: [...this.fpsHistory],
      ...this.getDomAndMemoryMetrics(target),
      markerType: 'area',
      areaRect: { x: placeholderRect.x, y: placeholderRect.y, width: placeholderRect.width, height: placeholderRect.height },
      kind: 'placement'
    } as any;

    this.feedbackManager.add(feedback);
    this.markerManager.addMarker(feedback);
  }

  private addRearrangeAnnotation(target: HTMLElement, clientX: number, clientY: number, purpose?: string) {
    const elementInfo = this.elementAnalyzer.analyze(target);
    const oldRect = target.getBoundingClientRect();

    const placeholderRect = {
      x: clientX,
      y: clientY,
      width: oldRect.width,
      height: oldRect.height,
      top: clientY,
      right: clientX + oldRect.width,
      bottom: clientY + oldRect.height,
      left: clientX
    };

    const purposeText = purpose ? ` — ${purpose}` : '';
    const smartName = target.textContent?.trim().substring(0, 40) || target.tagName.toLowerCase();

    const state: any = {};
    const feedback: FeedbackItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      index: this.feedbackManager.getAll().length + 1,
      comment: `[Layout] Rearrange "${smartName}" to this position${purposeText}`,
      timestamp: Date.now(),
      url: this.config.url || window.location.href,
      element: elementInfo,
      state,
      consoleLogs: [],
      networkRequests: this.networkInterceptor.getRequests(),
      performanceMetrics: [...this.perfMetrics],
      stateSnapshot: getGlobalStateSnapshot(),
      a11yIssues: auditA11y(target),
      errorTrace: this.errorTracer.getErrors(),
      triage: this.buildTriage(target),
      fpsMetrics: [...this.fpsHistory],
      ...this.getDomAndMemoryMetrics(target),
      markerType: 'area',
      areaRect: { x: placeholderRect.x, y: placeholderRect.y, width: placeholderRect.width, height: placeholderRect.height },
      kind: 'rearrange'
    } as any;

    this.feedbackManager.add(feedback);
    this.markerManager.addMarker(feedback);
  }

  public async sendToWebhook() {
    if (!this.settings.webhookUrl) return;

    try {
      const allFeedback = this.feedbackManager.getAll();
      const response = await fetch(this.settings.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: this.config.url || window.location.href,
          timestamp: Date.now(),
          annotations: allFeedback
        })
      });

      if (response.ok) {
        this.toolbar.showSendSuccess();
        if (this.settings.clearAfterCopy) {
          this.clearAll();
        }
      } else {
        console.error('Webhook failed:', response.statusText);
      }
    } catch (e) {
      console.error('Failed to send webhook:', e);
    }
  }

  public loadExistingMarkers() {
    const feedback = this.feedbackManager.getAll();
    feedback.forEach((item) => {
      this.markerManager.addMarker(item);
    });
  }

  private enableBlockingMode() {
    this.container.classList.add('blocking');
    if (!this.blockOverlay) {
      this.blockOverlay = document.createElement('div');
      this.blockOverlay.className = 'pinmark-block-overlay';
      this.shadowRoot.appendChild(this.blockOverlay);
    }
  }

  private disableBlockingMode() {
    this.container.classList.remove('blocking');
    if (this.blockOverlay) {
      this.blockOverlay.remove();
      this.blockOverlay = null;
    }
  }



  activate() {
    this._isActive = true;
    document.body.appendChild(this.container);
    this.setupEventListeners();
    this.networkInterceptor.enable();
    this.errorTracer.enable();
    if (this.config.onToggle) this.config.onToggle(true);
    
    try {
      const stopFn = rrweb.record({
        emit: (event) => {
          this.rrwebEvents.push(event);
          const cutoff = Date.now() - 15000;
          while (this.rrwebEvents.length > 0 && this.rrwebEvents[0].timestamp < cutoff) {
            this.rrwebEvents.shift();
          }
        },
      });
      // rrweb.record() may return undefined if recording is already active
      if (stopFn) {
        this.stopRecording = stopFn as () => void;
      }
    } catch (e) {
      console.warn('[Pinmark] Failed to start rrweb recording:', e);
    }

    // Start Performance Observers
    this.startPerfObservers();
    const loop = (now: number) => {
      if (!this.lastFpsTime) this.lastFpsTime = now;
      this.framesCount++;
      if (now - this.lastFpsTime >= 1000) {
        this.fpsHistory.push({ timestamp: Date.now(), fps: this.framesCount });
        const cutoff = Date.now() - 15000;
        this.fpsHistory = this.fpsHistory.filter(f => f.timestamp >= cutoff);
        this.framesCount = 0;
        this.lastFpsTime = now;
      }
      this.fpsRafId = requestAnimationFrame(loop);
    };
    this.fpsRafId = requestAnimationFrame(loop);


    // Initial update to fix position if layout changed since save
    requestAnimationFrame(() => {
      try {
        this.markerManager.updatePositions(this.feedbackManager.getAll());
      } catch (e) {
        console.error('Failed to update marker positions:', e);
      }
    });
  }

  deactivate() {
    this._isActive = false;
    this.removeEventListeners();
    this.container.remove();
    this.networkInterceptor.disable();
    this.errorTracer.disable();
    this.setAreaSelectActive(false);
    this.toolbar.toggleAreaSelect(false);
    this.isFrozen = false;
    this.frozenStyleEl?.remove();
    this.frozenStyleEl = null;
    this.hideLayoutPanel();
    
    if (this.stopRecording) {
      this.stopRecording();
      this.stopRecording = null;
    }

    if (this.fpsRafId !== null) {
      cancelAnimationFrame(this.fpsRafId);
      this.fpsRafId = null;
    }

    for (const obs of this.perfObservers) {
      obs.disconnect();
    }
    this.perfObservers = [];

    // Clear stale session data
    this.fpsHistory = [];
    this.framesCount = 0;
    this.lastFpsTime = 0;
    this.rrwebEvents = [];
    this.consoleLogs = [];
    this.perfMetrics = [];
    this.networkInterceptor.clear();
    this.errorTracer.clear();

    if (this.config.onToggle) this.config.onToggle(false);
  }

  private startPerfObservers() {
    if (typeof PerformanceObserver === 'undefined') return;
    // Clear any existing observers first
    for (const obs of this.perfObservers) {
      obs.disconnect();
    }
    this.perfObservers = [];

    // Types that typically have FEW buffered entries — safe to replay on start.
    const bufferedTypes = new Set(['longtask', 'layout-shift', 'largest-contentful-paint']);
    // 'mark', 'measure', 'event' can have THOUSANDS of buffered entries (rrweb
    // internal marks, user interactions, etc.) — replaying them all synchronously
    // can hang the content script and cause Chrome to restart it.
    const perfTypes = ['longtask', 'layout-shift', 'largest-contentful-paint', 'event', 'mark', 'measure'];
    for (const type of perfTypes) {
      try {
        const obs = new PerformanceObserver((list) => {
          // If the overlay has been deactivated, skip processing entirely.
          if (!this.isActive) return;
          for (const entry of list.getEntries()) {
            this.perfMetrics.push(entry.toJSON());
            if (entry.entryType === 'layout-shift') {
              const sources = (entry as any).sources || [];
              const shiftScore = (entry as any).value || 0;
              for (const src of sources) {
                if (src.node && src.node.nodeType === 1) {
                  this.highlightLayoutShift(src.node as HTMLElement, shiftScore);
                }
              }
            }
          }
          const cutoff = performance.now() - 15000;
          this.perfMetrics = this.perfMetrics.filter(e => e.startTime >= cutoff);
        });
        obs.observe({ type, buffered: bufferedTypes.has(type) });
        this.perfObservers.push(obs);
      } catch (e) {
        // Feature unsupported, ignore silently.
      }
    }
  }


  setPaused(isPaused: boolean) {
    this.isPaused = isPaused;
    this.toolbar.setPaused(this.isPaused);
    if (this.isPaused) {
      this.hoverBox.hide();
    }
  }

  togglePause() {
    const newState = !this.isPaused;
    this.setPaused(newState);
    if (this.config.onPauseToggle) {
      this.config.onPauseToggle(newState);
    }
  }

  toggleFreeze() {
    this.isFrozen = !this.isFrozen;
    if (this.isFrozen) {
      if (!this.frozenStyleEl) {
        this.frozenStyleEl = document.createElement('style');
        this.frozenStyleEl.id = 'pinmark-freeze-animations';
      }
      this.frozenStyleEl.textContent = `
        *, *::before, *::after {
          animation-play-state: paused !important;
          transition-property: all !important;
          transition-duration: 0s !important;
          transition-delay: 99999s !important;
        }
      `;
      document.head.appendChild(this.frozenStyleEl);
    } else {
      this.frozenStyleEl?.remove();
    }
  }

  toggleMarkers() {
    this.markersVisible = !this.markersVisible;
    this.toolbar.setMarkersVisible(this.markersVisible);
    this.markerManager.setVisible(this.markersVisible);
  }

  public showToast(message: string) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--pmk-bg-2, #111827);
      color: var(--pmk-text, #f9fafb);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-family: system-ui, sans-serif;
      z-index: 2147483647;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: pmkToastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1), pmkToastOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) 1.7s forwards;
    `;
    toast.textContent = message;

    if (!this.shadowRoot.querySelector('#pmk-toast-anim')) {
      const animStyle = document.createElement('style');
      animStyle.id = 'pmk-toast-anim';
      animStyle.textContent = '@keyframes pmkToastIn { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } } @keyframes pmkToastOut { from { opacity: 1; transform: translate(-50%, 0); } to { opacity: 0; transform: translate(-50%, 10px); } }';
      this.shadowRoot.appendChild(animStyle);
    }

    this.shadowRoot.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }


  async copyToClipboard(text: string): Promise<boolean> {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn('[Pinmark] navigator.clipboard failed, trying fallback:', err);
      }
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    let success = false;
    try {
      success = document.execCommand('copy');
    } catch (err) {
      console.error('[Pinmark] Fallback copy failed:', err);
    }
    
    document.body.removeChild(textArea);
    return success;
  }

  async copyFeedback() {
    const markdown = this.feedbackManager.toMarkdown();
    const success = await this.copyToClipboard(markdown);
    if (success) {
      this.toolbar.showCopySuccess();
    }

    if (this.settings.clearAfterCopy) {
      this.clearAll();
    }
  }

  async copyJson() {
    const data = this.feedbackManager.getAll();
    await this.copyToClipboard(JSON.stringify(data, null, 2));

    if (this.settings.clearAfterCopy) {
      this.clearAll();
    }
  }

  downloadJson() {
    const data = this.feedbackManager.getAll();
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pinmark-annotations-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (this.settings.clearAfterCopy) {
      this.clearAll();
    }
  }

  clearAll() {
    if (this.feedbackManager.getAll().length === 0) return;
    this.feedbackManager.clearAll();
    this.markerManager.clearAll();
    this.showToast('Cleared all annotations');
  }

  clearAllMarkers() {
    this.markerManager.clearAll();
  }

  removeMarker(id: string) {
    this.markerManager.removeMarker(id);
  }

  refreshMarkers() {
    this.markerManager.clearAll();
    this.loadExistingMarkers();
  }

  private createGithubIssue() {
    const markdown = this.feedbackManager.toMarkdown();
    if (this.config.onGithubCreate) {
      this.config.onGithubCreate(markdown);
    }
  }

  updateSettings(settings: Partial<PinmarkSettings>) {
    const oldBlockInteractions = this.settings.blockInteractions;
    this.settings = { ...this.settings, ...settings };
    this.markerManager.updateSettings(this.settings as any);

    // Handle blocking mode change
    if (this.settings.blockInteractions !== oldBlockInteractions) {
      if (this.settings.blockInteractions) {
        this.enableBlockingMode();
      } else {
        this.disableBlockingMode();
      }
    }
    
    // Toggle webhook visibility
    this.toolbar.setWebhookEnabled(!!this.settings.webhookUrl);

    // Re-apply theme if the theme setting itself changed
    this.applyTheme(this.settings);
  }

  /** Resolve light/dark from settings and set CSS vars on the host. */
  private applyTheme(settings: PinmarkSettings) {
    const mode = settings.theme === 'auto'
      ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : settings.theme;
    const host = this.container;
    if (mode === 'light') {
      host.style.setProperty('--pmk-bg', '#ffffff');
      host.style.setProperty('--pmk-bg-2', '#f9fafb');
      host.style.setProperty('--pmk-bg-3', '#e5e7eb');
      host.style.setProperty('--pmk-text', '#1f2937');
      host.style.setProperty('--pmk-text-muted', '#6b7280');
      host.style.setProperty('--pmk-border', '#e5e7eb');
    } else {
      host.style.setProperty('--pmk-bg', '#1f2937');
      host.style.setProperty('--pmk-bg-2', '#111827');
      host.style.setProperty('--pmk-bg-3', '#374151');
      host.style.setProperty('--pmk-text', '#f9fafb');
      host.style.setProperty('--pmk-text-muted', '#9ca3af');
      host.style.setProperty('--pmk-border', '#374151');
    }
  }

  updateFeedbackManager(feedbackManager: FeedbackManager) {
    this.feedbackManager = feedbackManager;
  }
}
