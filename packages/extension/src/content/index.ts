import { Overlay, FeedbackManager, Launcher } from '@pinmark/pinmark';
import { ChromeStorageAdapter } from './ChromeStorageAdapter';

import { sendMessage } from '../shared/messaging';

console.log('[Pinmark] Content script loaded');

let overlay: Overlay | null = null;
let feedbackManager: FeedbackManager | null = null;
let launcher: Launcher | null = null;
let currentUrl: string = window.location.href;
const storageAdapter = new ChromeStorageAdapter();

async function initializeOverlay() {
  if (overlay) return;

  const settings = await storageAdapter.getSettings();
  const feedback = await storageAdapter.getFeedback(window.location.href);

  currentUrl = window.location.href;
  
  const config = {
    url: currentUrl,
    storage: storageAdapter,
    onSync: (item: any) => {
      chrome.runtime.sendMessage({
        type: 'SYNC_MCP',
        url: currentUrl,
        item: item
      }, (response) => {
        if (response && response.success) {
          console.log('[Pinmark] Synced annotation to MCP server via background');
        } else if (response && response.error) {
          console.warn('[Pinmark] MCP Sync failed in background:', response.error);
        }
      });
    },
    onGithubCreate: (markdown: string) => {
      chrome.runtime.sendMessage({
        type: 'CREATE_GITHUB_ISSUE',
        url: currentUrl,
        content: markdown
      }, (response) => {
        if (response && response.success) {
          console.log('[Pinmark] GitHub issue created:', response.issueUrl);
        } else if (response && response.error) {
          console.warn('[Pinmark] GitHub issue failed:', response.error);
          alert('Failed to create GitHub issue: ' + response.error);
        }
      });
    },
    onToggle: (isActive: boolean) => {
      sendMessage({ type: 'SET_STATE', state: { isActive } }).catch(console.error);
    }
  };

  try {
    console.log('[Pinmark] Initializing overlay...');
    overlay = new Overlay(settings, config, feedback);
    feedbackManager = (overlay as any).feedbackManager;
    console.log('[Pinmark] Activating overlay...');
    overlay.activate();
    if (launcher) launcher.setActive(true);
    console.log('[Pinmark] Overlay activated.');
  } catch (e) {
    console.error('[Pinmark] Error initializing overlay:', e);
  }
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
  if (launcher) launcher.setActive(false);
  feedbackManager = null;
}

let isHandlingUrlChange = false;

async function handleUrlChange() {
  if (isHandlingUrlChange) return;
  isHandlingUrlChange = true;

  try {
    await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));

    const newUrl = window.location.href;

    if (newUrl !== currentUrl && overlay) {
      currentUrl = newUrl;
      overlay.clearAllMarkers();
      
      const settings = await storageAdapter.getSettings();
      const feedback = await storageAdapter.getFeedback(newUrl);
      
      if (!overlay) return;

      const config = {
        url: currentUrl,
        storage: storageAdapter,
        onSync: (item: any) => {
          chrome.runtime.sendMessage({
            type: 'SYNC_MCP',
            url: currentUrl,
            item: item
          }, () => {});
        },
        onGithubCreate: (markdown: string) => {
          chrome.runtime.sendMessage({
            type: 'CREATE_GITHUB_ISSUE',
            url: currentUrl,
            content: markdown
          }, (response) => {
            if (response && response.success) {
              console.log('[Pinmark] GitHub issue created:', response.issueUrl);
            } else if (response && response.error) {
              console.warn('[Pinmark] GitHub issue failed:', response.error);
              alert('Failed to create GitHub issue: ' + response.error);
            }
          });
        },
        onToggle: (isActive: boolean) => {
          sendMessage({ type: 'SET_STATE', state: { isActive } }).catch(console.error);
        }
      };

      // Since we can't cleanly hotswap config inside the current Overlay architecture,
      // it is safer to just recreate it for SPA navigation.
      overlay.deactivate();
      overlay = new Overlay(settings, config, feedback);
      feedbackManager = (overlay as any).feedbackManager;
      overlay.activate();
    }
  } finally {
    isHandlingUrlChange = false;
  }
}

function setupUrlMonitoring() {
  let lastCheckedUrl = window.location.href;

  function checkUrl() {
    const currentUrl = window.location.href;

    if (currentUrl !== lastCheckedUrl && overlay) {
      lastCheckedUrl = currentUrl;
      handleUrlChange();
    }

    requestAnimationFrame(checkUrl);
  }

  requestAnimationFrame(checkUrl);

  window.addEventListener('popstate', () => {
    lastCheckedUrl = window.location.href;
    handleUrlChange();
  });

  window.addEventListener('hashchange', () => {
    lastCheckedUrl = window.location.href;
    handleUrlChange();
  });
}

function initializeLauncher() {
  if (launcher) return;
  launcher = new Launcher();
  launcher.onClick = () => {
    if (overlay) {
      deactivateOverlay();
      sendMessage({ type: 'SET_STATE', state: { isActive: false } }).catch(console.error);
    } else {
      initializeOverlay();
      sendMessage({ type: 'SET_STATE', state: { isActive: true } }).catch(console.error);
    }
  };
}

initializeLauncher();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'TOGGLE_EXTENSION':
      if (message.isActive) {
        initializeOverlay();
      } else {
        deactivateOverlay();
      }
      sendResponse({ success: true });
      break;
    case 'ACTIVATE_OVERLAY':
      initializeOverlay();
      sendResponse({ success: true });
      break;
    case 'DEACTIVATE_OVERLAY':
      deactivateOverlay();
      sendResponse({ success: true });
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
    case 'COPY_JSON':
      if (overlay) {
        overlay.copyJson();
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
    case 'UPDATE_SETTINGS':
      overlay?.updateSettings(message.settings as any);
      sendResponse({ success: true });
      break;
  }
  return false;
});

setupUrlMonitoring();
