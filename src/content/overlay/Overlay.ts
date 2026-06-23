import { HoverBox } from './HoverBox';
import { MarkerManager } from './MarkerManager';
import { Toolbar } from './Toolbar';
import { FeedbackModal } from './FeedbackModal';
import { ElementAnalyzer } from '../analyzers/ElementAnalyzer';
import type { ExtensionSettings, FeedbackItem } from '../../shared/types';
import type { FeedbackManager } from '../feedback/FeedbackManager';
import { sendMessage } from '../../shared/messaging';

const OVERLAY_STYLES = `
  :host {
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

  .pinmark-overlay-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2147483647;
  }

  .pinmark-overlay-container.blocking {
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
  private markerManager: MarkerManager;
  private toolbar: Toolbar;
  private feedbackModal: FeedbackModal;
  private elementAnalyzer: ElementAnalyzer;
  private feedbackManager: FeedbackManager;
  private settings: ExtensionSettings;
  public isActive = false;
  private isPaused = false;
  private markersVisible = true;
  private targetElement: HTMLElement | null = null;
  private isModalOpen = false;

  constructor(settings: ExtensionSettings, feedbackManager: FeedbackManager) {
    this.settings = settings;
    this.feedbackManager = feedbackManager;

    this.container = document.createElement('div');
    this.container.className = 'pinmark-overlay-container';
    this.shadowRoot = this.container.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.id = 'pinmark-overlay-styles';
    style.textContent = OVERLAY_STYLES;
    this.shadowRoot.appendChild(style);
    this.applyTheme(settings);

    this.hoverBox = new HoverBox(this.shadowRoot);
    this.markerManager = new MarkerManager(this.shadowRoot, settings, {
      onEdit: (id) => this.handleEditFeedback(id),
      onDelete: (id) => this.handleDeleteFeedback(id),
    });
    this.toolbar = new Toolbar(this.shadowRoot, settings);
    this.feedbackModal = new FeedbackModal(this.shadowRoot);
    this.elementAnalyzer = new ElementAnalyzer();

    this.setupEventListeners();
    this.setupToolbarListeners();
    this.loadExistingMarkers();

    // Apply block interactions setting
    if (this.settings.blockInteractions) {
      this.enableBlockingMode();
    }
  }

  private setupEventListeners() {
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('click', this.handleClick, true);
  }

  private removeEventListeners() {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('click', this.handleClick, true);
  }

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.isActive || this.isPaused || this.isModalOpen) return;

    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || target === this.container || target === this.blockOverlay) {
      this.hoverBox.hide();
      this.targetElement = null;
      return;
    }

    // Check if target is inside our shadow DOM
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
    if (!this.isActive || this.isPaused || this.isModalOpen) return;

    const target = e.target as HTMLElement;

    // Check if click is inside our shadow DOM (toolbar, markers, etc.)
    // When clicking an element inside Shadow DOM, the event target is retargeted to the host (this.container)
    if (this.shadowRoot.contains(target) || target === this.container) {
      return;
    }

    // Check if clicking on the block overlay or if blocking is enabled
    // We prioritize feedback selection over blocking
    if (this.targetElement) {
      e.preventDefault();
      e.stopPropagation();
      this.promptForFeedback(this.targetElement);
      return;
    }

    if (this.settings.blockInteractions || target === this.blockOverlay) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return;
    }

    // Default behavior for non-target clicks when blocking is disabled
    // (do nothing, let event propagate)
  };

  private async promptForFeedback(element: HTMLElement) {
    this.isModalOpen = true;
    this.hoverBox.hide();

    const result = await this.feedbackModal.show(element);
    this.isModalOpen = false;

    if (!result) return;

    const elementInfo = this.elementAnalyzer.analyze(element);
    const feedback: FeedbackItem = {
      id: crypto.randomUUID(),
      index: this.feedbackManager.getAll().length + 1,
      comment: result.comment,
      timestamp: Date.now(),
      url: window.location.href,
      element: elementInfo,
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
      const result = await this.feedbackModal.show(placeholder, feedback.comment);
      this.isModalOpen = false;

      if (result) {
        this.feedbackManager.update(id, { comment: result.comment });
        this.markerManager.updateMarkerTooltip(id, result.comment);
      }
      return;
    }

    this.isModalOpen = true;
    const result = await this.feedbackModal.show(element, feedback.comment);
    this.isModalOpen = false;

    if (result) {
      this.feedbackManager.update(id, { comment: result.comment });
      this.markerManager.updateMarkerTooltip(id, result.comment);
    }
  }

  private async handleDeleteFeedback(id: string) {
    this.feedbackManager.remove(id);
    this.markerManager.removeMarker(id);
    // Re-index remaining markers
    await this.reindexMarkers();
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

  private setupToolbarListeners() {
    this.toolbar.onPauseToggle = () => this.togglePause();
    this.toolbar.onMarkersToggle = () => this.toggleMarkers();
    this.toolbar.onCopy = () => this.copyFeedback();
    this.toolbar.onClear = () => this.clearAll();
    this.toolbar.onExit = () => this.deactivate();
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
    this.isActive = true;
    document.body.appendChild(this.container);
    window.addEventListener('resize', this.handleResize);
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
    this.isActive = false;
    this.removeEventListeners();
    window.removeEventListener('resize', this.handleResize);
    this.container.remove();
    sendMessage({ type: 'SET_STATE', state: { isActive: false } }).catch(console.error);
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    this.toolbar.setPaused(this.isPaused);
    if (this.isPaused) {
      this.hoverBox.hide();
    }
  }

  toggleMarkers() {
    this.markersVisible = !this.markersVisible;
    this.markerManager.setVisible(this.markersVisible);
    this.toolbar.setMarkersVisible(this.markersVisible);
  }

  async copyFeedback() {
    const markdown = this.feedbackManager.toMarkdown();
    await navigator.clipboard.writeText(markdown);
    this.toolbar.showCopySuccess();

    if (this.settings.clearAfterCopy) {
      this.clearAll();
    }
  }

  clearAll() {
    this.feedbackManager.clearAll();
    this.markerManager.clearAll();
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

  updateSettings(settings: Partial<ExtensionSettings>) {
    const oldBlockInteractions = this.settings.blockInteractions;
    this.settings = { ...this.settings, ...settings };
    this.markerManager.updateSettings(this.settings);

    // Handle blocking mode change
    if (this.settings.blockInteractions !== oldBlockInteractions) {
      if (this.settings.blockInteractions) {
        this.enableBlockingMode();
      } else {
        this.disableBlockingMode();
      }
    }
    // Re-apply theme if the theme setting itself changed
    this.applyTheme(this.settings);
  }

  /** Resolve light/dark from settings and set CSS vars on the host. */
  private applyTheme(settings: ExtensionSettings) {
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
