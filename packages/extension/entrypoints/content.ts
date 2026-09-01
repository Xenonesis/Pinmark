import { Overlay, FeedbackManager, Launcher } from '@pinmark/pinmark';
import type { FeedbackItem, ExtensionSettings, OverlayConfig } from '@pinmark/core';
import { ChromeStorageAdapter } from '../src/content/ChromeStorageAdapter';
import { sendMessage } from '../src/shared/messaging';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    // Guard against running in subframes/iframes
    if (window.top !== window) {
      // Do not inject overlay/launcher inside iframes
      return;
    }

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
        const storage = await chrome.storage.local.get(['extensionPaused']);
        const isPaused = (storage?.extensionPaused as boolean) ?? false;

        if (overlay) return;

        currentUrl = window.location.href;
        
        const config: OverlayConfig = {
          url: currentUrl,
          storage: storageAdapter,
          isPaused,
          onPauseToggle: (paused: boolean) => {
            sendMessage({ type: 'SET_PAUSE_STATE', isPaused: paused }).catch(console.error);
          },
          onSync: (item: FeedbackItem) => {
            chrome.runtime.sendMessage({
              type: 'SYNC_MCP',
              url: currentUrl,
              item
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
            // Fired only when user explicitly closes overlay via Toolbar Exit or Escape
            if (!isActive) {
              deactivateOverlay();
              sendMessage({ type: 'TOGGLE_EXTENSION', isActive: false }).catch(console.error);
            }
          },
          captureScreenshot: async (element: HTMLElement): Promise<string | undefined> => {
            const { promise, resolve } = Promise.withResolvers<{ dataUrl?: string; error?: string }>();
            chrome.runtime.sendMessage({ type: 'CAPTURE_TAB' }, resolve);
            const response = await promise;

            if (!response || response.error || !response.dataUrl) {
              console.warn('[Pinmark] Viewport capture failed, falling back to html2canvas:', response?.error);
              return undefined;
            }

            const rect = element.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;

            const img = new Image();
            const { promise: loadPromise, resolve: loadResolve, reject: loadReject } = Promise.withResolvers<void>();
            img.onload = () => loadResolve();
            img.onerror = () => loadReject(new Error('Failed to load viewport image'));
            img.src = response.dataUrl;
            await loadPromise;

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
          const win = window as unknown as { __pinmark_overlay_instance?: Overlay };
          if (win.__pinmark_overlay_instance) {
            try {
              console.log('[Pinmark] Found old overlay instance, deactivating...');
              win.__pinmark_overlay_instance.deactivate();
            } catch (e) {
              console.error('[Pinmark] Error deactivating old overlay:', e);
            }
          }

          overlay = new Overlay(settings, config, feedback);
          win.__pinmark_overlay_instance = overlay;
          
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
        const { promise, resolve } = Promise.withResolvers<void>();
        requestAnimationFrame(() => resolve());
        await promise;

        const newUrl = window.location.href;

        if (newUrl !== currentUrl && overlay) {
          currentUrl = newUrl;
          overlay.clearAllMarkers();
          
          const feedback = await storageAdapter.getFeedback(newUrl);
          if (feedbackManager) {
            feedbackManager.clearAll();
            for (const item of feedback) {
              feedbackManager.add(item);
            }
          }
          overlay.loadExistingMarkers();
        }
      } finally {
        isHandlingUrlChange = false;
      }
    }

    function setupUrlMonitoring() {
      let lastCheckedUrl = window.location.href;

      setInterval(() => {
        const checkUrl = window.location.href;
        if (checkUrl !== lastCheckedUrl && overlay) {
          lastCheckedUrl = checkUrl;
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
          sendMessage({ type: 'TOGGLE_EXTENSION', isActive: false }).catch(console.error);
        } else {
          initializeOverlay();
          sendMessage({ type: 'TOGGLE_EXTENSION', isActive: true }).catch(console.error);
        }
      };
    }

    // ── Startup: only show UI if extension is active for this tab ──
    async function startupInit() {
      try {
        const storage = await chrome.storage.local.get('extensionActive');
        const isActive = storage?.extensionActive ?? false;

        // Always initialize the launcher so that background TOGGLE_EXTENSION
        // broadcasts can activate the overlay on this tab without a page reload.
        initializeLauncher();

        if (isActive) {
          // Extension was previously active — restore overlay
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
            if (!overlay) {
              initializeLauncher();
              initializeOverlay();
            }
          } else {
            if (overlay) {
              deactivateOverlay();
            }
          }
          sendResponse({ success: true });
          break;
        case 'ACTIVATE_OVERLAY':
          if (!overlay) {
            initializeLauncher();
            initializeOverlay();
          }
          sendResponse({ success: true });
          break;
        case 'PINMARK_HIGHLIGHT':
          {
            chrome.storage.local.get(['extensionPaused']).then(storage => {
              const isPaused = (storage?.extensionPaused as boolean) ?? false;
              if (isPaused) {
                sendResponse({ success: false, error: 'Extension is paused' });
                return;
              }

              const el = document.querySelector(message.selector);
              if (el) {
                // Scroll into view first so it's visible
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                document.getElementById('pinmark-active-highlight')?.remove();
                const highlight = document.createElement('div');
                highlight.id = 'pinmark-active-highlight';
                const rect = el.getBoundingClientRect();
                highlight.style.position = 'absolute';
                highlight.style.top = `${rect.top + window.scrollY}px`;
                highlight.style.left = `${rect.left + window.scrollX}px`;
                highlight.style.width = `${rect.width}px`;
                highlight.style.height = `${rect.height}px`;
                highlight.style.border = '6px solid #ef4444';
                highlight.style.boxShadow = '0 0 20px 10px rgba(239, 68, 68, 0.6)';
                highlight.style.zIndex = '2147483647';
                highlight.style.pointerEvents = 'none';
                highlight.style.transition = 'opacity 0.2s ease-in-out';
                highlight.style.boxSizing = 'border-box';
                document.body.appendChild(highlight);
                
                // flashing effect
                let visible = true;
                const interval = setInterval(() => {
                  if (!document.getElementById('pinmark-active-highlight')) {
                    clearInterval(interval);
                    return;
                  }
                  visible = !visible;
                  highlight.style.opacity = visible ? '1' : '0.2';
                }, 300);
                
                setTimeout(() => {
                  clearInterval(interval);
                  highlight.remove();
                }, message.durationMs || 3000);
                
                sendResponse({ success: true });
              } else {
                console.warn(`[Pinmark] Highlight target not found: ${message.selector}`);
                sendResponse({ success: false, error: 'Element not found' });
              }
            });
            return true; // Keep channel open for async response
          }
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
        case 'SET_PAUSE_STATE':
          if (message.isPaused) {
            document.getElementById('pinmark-active-highlight')?.remove();
          }
          overlay?.setPaused(message.isPaused);
          break;
        case 'CLEAR_FEEDBACK':
          feedbackManager?.clearAll();
          overlay?.clearAllMarkers();
          sendResponse({ success: true });
          break;
        case 'COPY_FEEDBACK': {
          const markdown = feedbackManager?.toMarkdown();
          if (markdown) {
            navigator.clipboard.writeText(markdown)
              .then(() => sendResponse({ success: true }))
              .catch((err) => {
                console.warn('[Pinmark] Failed to copy markdown to clipboard:', err);
                sendResponse({ success: false, error: (err as Error).message });
              });
          } else {
            sendResponse({ success: false, error: 'No feedback to copy' });
          }
          return true;
        }
        case 'COPY_JSON': {
          if (overlay) {
            try {
              overlay.copyJson();
              sendResponse({ success: true });
            } catch (err) {
              sendResponse({ success: false, error: (err as Error).message });
            }
          } else {
            sendResponse({ success: false, error: 'Overlay not active' });
          }
          return true;
        }
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
          if (message.settings) {
            overlay?.updateSettings(message.settings);
          }
          sendResponse({ success: true });
          break;
      }
      return false;
    });

    setupUrlMonitoring();
  },
});
