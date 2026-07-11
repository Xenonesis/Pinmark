import { Overlay, FeedbackManager, Launcher } from '@pinmark/pinmark';
import { ChromeStorageAdapter } from './ChromeStorageAdapter';

import { sendMessage } from '../shared/messaging';

console.log('[Pinmark] Content script loaded');

let overlay: Overlay | null = null;
let feedbackManager: FeedbackManager | null = null;
let launcher: Launcher | null = null;
let currentUrl: string = window.location.href;
const storageAdapter = new ChromeStorageAdapter();

let isInitializing = false;

async function initializeOverlay() {
  if (overlay || isInitializing) return;
  isInitializing = true;

  try {
    const settings = await storageAdapter.getSettings();
    const feedback = await storageAdapter.getFeedback(window.location.href);

    if (overlay) return;

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
      },
      captureScreenshot: async (element: HTMLElement): Promise<string | undefined> => {
        const response = await new Promise<{ dataUrl?: string; error?: string }>((resolve) => {
          chrome.runtime.sendMessage({ type: 'CAPTURE_TAB' }, resolve);
        });

        if (!response || response.error || !response.dataUrl) {
          console.warn('[Pinmark] Viewport capture failed, falling back to html2canvas:', response?.error);
          return undefined; // return undefined to trigger html2canvas fallback
        }

        const rect = element.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load viewport image'));
          img.src = response.dataUrl!;
        });

        const canvas = document.createElement('canvas');
        const sourceX = Math.max(0, rect.left * dpr);
        const sourceY = Math.max(0, rect.top * dpr);
        const sourceW = Math.min(img.width - sourceX, rect.width * dpr);
        const sourceH = Math.min(img.height - sourceY, rect.height * dpr);

        if (sourceW <= 0 || sourceH <= 0) {
          return undefined;
        }

        canvas.width = sourceW;
        canvas.height = sourceH;

        const ctx = canvas.getContext('2d');
        if (!ctx) return undefined;

        ctx.drawImage(
          img,
          sourceX,
          sourceY,
          sourceW,
          sourceH,
          0,
          0,
          sourceW,
          sourceH
        );

        return canvas.toDataURL('image/jpeg', 0.8);
      }
    };

    try {
      console.log('[Pinmark] Initializing overlay...');

      // Clean up any existing instance from a previous HMR/reload
      if ((window as any).__pinmark_overlay_instance) {
        try {
          console.log('[Pinmark] Found old overlay instance, deactivating...');
          (window as any).__pinmark_overlay_instance.deactivate();
        } catch (e) {
          console.error('[Pinmark] Error deactivating old overlay:', e);
        }
      }

      overlay = new Overlay(settings as any, config, feedback as any);
      (window as any).__pinmark_overlay_instance = overlay;
      
      feedbackManager = overlay.getFeedbackManager();
      console.log('[Pinmark] Activating overlay...');
      overlay.activate();
      // Apply hide-until-restart: markers start hidden if setting is on
      if (settings.hideUntilRestart) {
        overlay.toggleMarkers();
      }
      if (launcher) launcher.setActive(true);
      console.log('[Pinmark] Overlay activated.');
    } catch (e) {
      console.error('[Pinmark] Error initializing overlay:', e);
    }
  } finally {
    isInitializing = false;
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
      feedbackManager = overlay.getFeedbackManager();
      overlay.activate();
    }
  } finally {
    isHandlingUrlChange = false;
  }
}

function setupUrlMonitoring() {
  let lastCheckedUrl = window.location.href;

  setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastCheckedUrl && overlay) {
      lastCheckedUrl = currentUrl;
      handleUrlChange();
    }
  }, 1000);

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

// ── Startup: only show UI if extension is active for this tab ──
async function startupInit() {
  try {
    const storage = await chrome.storage.local.get('extensionActive');
    const isActive = storage?.extensionActive ?? false;

    if (isActive) {
      // Extension was previously active — restore launcher + overlay
      initializeLauncher();
      await initializeOverlay();
    }
  } catch (e) {
    console.warn('[Pinmark] Error during startup initialization:', e);
  }
}

startupInit();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'TOGGLE_EXTENSION':
      if (message.isActive) {
        initializeLauncher();
        initializeOverlay();
      } else {
        deactivateOverlay();
      }
      sendResponse({ success: true });
      break;
    case 'ACTIVATE_OVERLAY':
      initializeLauncher();
      initializeOverlay();
      sendResponse({ success: true });
      break;
    case 'DEACTIVATE_OVERLAY':
      deactivateOverlay();
      // Also destroy launcher so nothing shows on page when disabled
      if (launcher) {
        try { launcher.destroy?.(); } catch { /* ignore */ }
        launcher = null;
      }
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
