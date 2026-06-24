import type { PinmarkSettings as ExtensionSettings } from '../core/types';
import type { PinmarkAnnotation as FeedbackItem } from '@pinmark/core';

export interface MarkerCallbacks {
  onEdit: (id: string) => void;
  onDelete: (id: string) => void | Promise<void>;
  onCopy: (id: string) => void;
}

const ICONS = {
  edit: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
  copy: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
  check: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  delete: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`
};

const MARKER_STYLES = (color: string) => `
  .pinmark-markers-container {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 2147483645;
  }

  .pinmark-marker {
    position: absolute;
    width: 28px;
    height: 28px;
    background-color: ${color};
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: transform 0.15s ease-out, opacity 0.15s ease-out;
    pointer-events: all;
    user-select: none;
  }

  .pinmark-marker:hover {
    transform: scale(1.15);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  .pinmark-marker.pinmark-marker-multi {
    background-color: var(--pmk-success, #22c55e);
  }

  .pinmark-marker.hidden {
    opacity: 0;
    pointer-events: none;
  }

  .pinmark-marker-popup {
    position: absolute;
    bottom: calc(100% + 10px);
    left: 50%;
    transform: translateX(-50%);
    background: rgba(24, 24, 27, 0.95);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 12px 14px;
    min-width: 200px;
    max-width: 280px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity 0.15s ease-out, visibility 0.15s ease-out, transform 0.15s ease-out;
    z-index: 2147483646;
  }

  .pinmark-marker-popup::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: rgba(24, 24, 27, 0.95);
  }

  .pinmark-marker:hover .pinmark-marker-popup {
    opacity: 1;
    visibility: visible;
    pointer-events: all;
    transform: translateX(-50%) translateY(-2px);
  }

  .pinmark-marker-comment {
    color: rgba(255, 255, 255, 0.95);
    font-size: 13px;
    line-height: 1.5;
    margin-bottom: 12px;
    word-wrap: break-word;
    white-space: pre-wrap;
    font-weight: 400;
  }

  .pinmark-marker-actions {
    display: flex;
    gap: 6px;
    justify-content: flex-end;
    align-items: center;
  }

  .pinmark-marker-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 0.15s ease;
    padding: 0;
  }

  .pinmark-marker-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .pinmark-marker-btn.delete:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }
`;

export class MarkerManager {
  private shadowRoot: ShadowRoot;
  private settings: ExtensionSettings;
  private callbacks: MarkerCallbacks;
  private container: HTMLElement;
  private markers = new Map<string, { element: HTMLElement; commentEl: HTMLElement }>();
  private visible = true;

  constructor(shadowRoot: ShadowRoot, settings: ExtensionSettings, callbacks: MarkerCallbacks) {
    this.shadowRoot = shadowRoot;
    this.settings = settings;
    this.callbacks = callbacks;
    
    // Create container for markers
    this.container = document.createElement('div');
    this.container.className = 'pinmark-markers-container';
    this.shadowRoot.appendChild(this.container);
    
    this.injectStyles();
  }

  private injectStyles() {
    let styleElement = this.shadowRoot.querySelector('#pinmark-marker-styles');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'pinmark-marker-styles';
      this.shadowRoot.appendChild(styleElement);
    }
    (styleElement as HTMLStyleElement).textContent = MARKER_STYLES(this.settings.markerColor);
  }

  addMarker(feedback: FeedbackItem) {
    const rect = feedback.element.boundingRect;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    const marker = document.createElement('div');
    marker.className = 'pinmark-marker';
    if (feedback.markerType === 'multi' || feedback.markerType === 'area') {
      marker.classList.add('pinmark-marker-multi');
    }
    marker.dataset.feedbackId = feedback.id;
    marker.textContent = feedback.index.toString();
    marker.style.top = `${rect.top + scrollTop - 14}px`;
    marker.style.left = `${rect.left + scrollLeft + rect.width / 2 - 14}px`;

    // Create popup container
    const popup = document.createElement('div');
    popup.className = 'pinmark-marker-popup';

    // Comment text
    const commentEl = document.createElement('div');
    commentEl.className = 'pinmark-marker-comment';
    commentEl.textContent = feedback.comment;

    // Actions container
    const actions = document.createElement('div');
    actions.className = 'pinmark-marker-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'pinmark-marker-btn edit';
    editBtn.innerHTML = ICONS.edit;
    editBtn.title = 'Edit';
    editBtn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.callbacks.onEdit(feedback.id);
    };

    const copyBtn = document.createElement('button');
    copyBtn.className = 'pinmark-marker-btn copy';
    copyBtn.innerHTML = ICONS.copy;
    copyBtn.title = 'Copy';
    copyBtn.onclick = async (e) => {
      e.stopPropagation();
      e.preventDefault();
      copyBtn.innerHTML = ICONS.check;
      copyBtn.style.color = '#22c55e';
      setTimeout(() => {
        copyBtn.innerHTML = ICONS.copy;
        copyBtn.style.color = '';
      }, 1000);
      this.callbacks.onCopy(feedback.id);
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'pinmark-marker-btn delete';
    deleteBtn.innerHTML = ICONS.delete;
    deleteBtn.title = 'Delete';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.callbacks.onDelete(feedback.id);
    };

    actions.appendChild(editBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(deleteBtn);
    popup.appendChild(commentEl);
    popup.appendChild(actions);
    marker.appendChild(popup);

    this.container.appendChild(marker);
    this.markers.set(feedback.id, { element: marker, commentEl });

    if (!this.visible) {
      marker.classList.add('hidden');
    }
  }

  updateMarkerTooltip(id: string, newComment: string) {
    const markerData = this.markers.get(id);
    if (markerData) {
      markerData.commentEl.textContent = newComment;
    }
  }

  removeMarker(id: string) {
    const markerData = this.markers.get(id);
    if (markerData) {
      markerData.element.remove();
      this.markers.delete(id);
    }
  }

  clearAll() {
    this.markers.forEach(({ element }) => element.remove());
    this.markers.clear();
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.markers.forEach(({ element }) => {
      if (visible) {
        element.classList.remove('hidden');
      } else {
        element.classList.add('hidden');
      }
    });
  }

  updatePositions(feedbackItems: FeedbackItem[]) {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    feedbackItems.forEach(item => {
      const markerData = this.markers.get(item.id);
      if (!markerData) return;

      let rect = item.element.boundingRect;
      try {
        const currentElement = document.querySelector(item.element.selector);
        if (currentElement) {
          rect = currentElement.getBoundingClientRect();
        }
      } catch (e) {
        // Ignore selector errors, keep original rect
      }

      markerData.element.style.top = `${rect.top + scrollTop - 14}px`;
      markerData.element.style.left = `${rect.left + scrollLeft + rect.width / 2 - 14}px`;
    });
  }

  updateSettings(settings: ExtensionSettings) {
    this.settings = settings;
    this.injectStyles();
  }
}
