import { Overlay } from './overlay/Overlay';
import { FeedbackManager } from './feedback/FeedbackManager';
import { getSettings, getFeedback } from '../shared/storage';

let overlay: Overlay | null = null;
let feedbackManager: FeedbackManager | null = null;

async function initializeOverlay() {
  if (overlay) return;

  const settings = await getSettings();
  const feedback = await getFeedback(window.location.href);

  feedbackManager = new FeedbackManager(window.location.href, feedback);
  overlay = new Overlay(settings, feedbackManager);
  overlay.activate();
}

function deactivateOverlay() {
  if (overlay) {
    try {
      overlay.deactivate();
    } catch (e) {
      console.error('Error deactivating overlay:', e);
    }
    overlay = null;
  }
  feedbackManager = null;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'ACTIVATE_OVERLAY':
      initializeOverlay();
      break;
    case 'DEACTIVATE_OVERLAY':
      deactivateOverlay();
      break;
    case 'TOGGLE_MARKERS':
      overlay?.toggleMarkers();
      break;
    case 'TOGGLE_PAUSE':
      overlay?.togglePause();
      break;
    case 'CLEAR_FEEDBACK':
      feedbackManager?.clearAll();
      overlay?.clearAllMarkers();
      sendResponse({ success: true });
      break;
    case 'COPY_FEEDBACK':
      const markdown = feedbackManager?.toMarkdown();
      if (markdown) {
        navigator.clipboard.writeText(markdown);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false });
      }
      return true;
    case 'ADD_FEEDBACK':
      feedbackManager?.add(message.item);
      overlay?.loadExistingMarkers();
      sendResponse({ success: true });
      break;
    case 'REMOVE_FEEDBACK':
      feedbackManager?.remove(message.id);
      overlay?.removeMarker(message.id);
      sendResponse({ success: true });
      break;
    case 'UPDATE_FEEDBACK':
      feedbackManager?.update(message.id, message.updates);
      overlay?.refreshMarkers();
      sendResponse({ success: true });
      break;
  }
  return false;
});

document.addEventListener('keydown', (e) => {
  if (!overlay?.isActive) return;

  if (e.key === 'Escape') {
    deactivateOverlay();
  }

  if (e.ctrlKey || e.metaKey) {
    if (e.shiftKey && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      deactivateOverlay();
    }
  }

  if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    const markdown = feedbackManager?.toMarkdown();
    if (markdown) {
      navigator.clipboard.writeText(markdown);
      alert('Feedback copied to clipboard!');
    }
  }

  if (e.key.toLowerCase() === 'h') {
    e.preventDefault();
    overlay?.toggleMarkers();
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      e.preventDefault();
      feedbackManager?.clearAll();
      overlay?.clearAllMarkers();
    }
  }
});
