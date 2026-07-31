import { getSettings, saveSettings, getFeedback, saveFeedback } from '../shared/storage';

let mcpEventSource: EventSource | null = null;

async function setupEventSource() {
  const settings = await getSettings();
  if (!settings.autoSync || !settings.mcpEndpoint) {
    if (mcpEventSource) {
      mcpEventSource.close();
      mcpEventSource = null;
    }
    return;
  }
  
  const mcpEndpoint = (settings.mcpEndpoint || 'http://127.0.0.1:4747').replace(/\/+$/, '');
  const sseUrl = `${mcpEndpoint}/events`;
  
  // Avoid reconnecting if already connected to same URL
  if (mcpEventSource && mcpEventSource.url === sseUrl && mcpEventSource.readyState !== EventSource.CLOSED) {
    return;
  }
  
  if (mcpEventSource) {
    mcpEventSource.close();
  }
  
  try {
    mcpEventSource = new EventSource(sseUrl);
    mcpEventSource.addEventListener('pinmark:highlight', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'PINMARK_HIGHLIGHT',
              selector: data.selector,
              durationMs: data.durationMs
            });
          }
        });
      } catch (e) {
        console.error('Failed to parse highlight event', e);
      }
    });
    
    mcpEventSource.addEventListener('error', () => {
      // Basic retry fallback
      if (mcpEventSource && mcpEventSource.readyState === EventSource.CLOSED) {
        setTimeout(setupEventSource, 5000);
      }
    });
  } catch(e) {
    console.warn('Failed to setup SSE in background', e);
  }
}

// Initialize on startup
setupEventSource();

async function postJson(url: string, body: unknown): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`MCP server returned ${response.status} ${response.statusText}`);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  switch (message.type) {
    case 'TOGGLE_EXTENSION':
      (async () => {
        try {
          const storage = await chrome.storage.local.get('extensionActive');
          // Respect explicit isActive payload (sent by popup); fall back to a
          // blind toggle only when no explicit value is provided (legacy callers).
          const nextActive = (message.isActive !== undefined)
            ? message.isActive
            : !storage.extensionActive;
          await chrome.storage.local.set({ extensionActive: nextActive });

          // Broadcast new state to all tabs
          const tabs = await chrome.tabs.query({});
          for (const tab of tabs) {
            if (tab.id !== undefined) {
              chrome.tabs.sendMessage(tab.id, {
                type: 'TOGGLE_EXTENSION',
                isActive: nextActive
              }).catch(() => {});
            }
          }

          sendResponse({ isActive: nextActive });
        } catch (e) {
          sendResponse({ error: (e as Error).message, isActive: false });
        }
      })();
      return true;

    case 'GET_STATE':
      chrome.storage.local.get('extensionActive').then((storage) => {
        sendResponse({ isActive: storage.extensionActive ?? false });
      });
      return true;

    case 'SET_STATE':
      (async () => {
        try {
          const isActive = message.state.isActive;
          await chrome.storage.local.set({ extensionActive: isActive });

          // Send message to all other tabs to sync the state
          const tabs = await chrome.tabs.query({});
          for (const tab of tabs) {
            if (tab.id !== undefined && tab.id !== sender.tab?.id) {
              chrome.tabs.sendMessage(tab.id, {
                type: 'TOGGLE_EXTENSION',
                isActive: isActive
              }).catch(() => {});
            }
          }
          sendResponse({ success: true });
        } catch (e) {
          sendResponse({ error: (e as Error).message });
        }
      })();
      return true;

    case 'SET_PAUSE_STATE':
      (async () => {
        try {
          const isPaused = message.isPaused;
          await chrome.storage.local.set({ extensionPaused: isPaused });

          // Broadcast pause state to all other tabs
          const tabs = await chrome.tabs.query({});
          for (const tab of tabs) {
            if (tab.id !== undefined && tab.id !== sender.tab?.id) {
              chrome.tabs.sendMessage(tab.id, {
                type: 'SET_PAUSE_STATE',
                isPaused: isPaused
              }).catch(() => {});
            }
          }
          sendResponse({ success: true });
        } catch (e) {
          sendResponse({ error: (e as Error).message });
        }
      })();
      return true;

    case 'GET_SETTINGS':
      getSettings().then(sendResponse);
      return true;

    case 'SAVE_SETTINGS':
      saveSettings(message.settings).then(() => {
        setupEventSource();
        sendResponse({ success: true });
      });
      return true;

    case 'GET_FEEDBACK':
      getFeedback(message.url).then(sendResponse);
      return true;

    case 'SAVE_FEEDBACK':
      saveFeedback(message.url, message.feedback).then(() => sendResponse({ success: true }));
      return true;

    case 'SYNC_MCP':
      (async () => {
        try {
          const settings = await getSettings();
          if (!settings.autoSync || !settings.mcpEndpoint) {
            sendResponse({ success: false });
            return;
          }
          
          const mcpEndpoint = (settings.mcpEndpoint || 'http://127.0.0.1:4747').replace(/\/+$/, '');
          const sessionId = 'session_' + btoa(message.url).replace(/[^a-z0-9]/gi, '').substring(0, 10);
          await postJson(`${mcpEndpoint}/sessions`, { url: message.url, sessionId });
          await postJson(`${mcpEndpoint}/sessions/${sessionId}/annotations`, message.item);
          sendResponse({ success: true });
        } catch (e) {
          const error = (e as Error).message;
          sendResponse(error === 'Failed to fetch' ? { success: false, skipped: true } : { success: false, error });
        }
      })();
      return true;

    case 'CAPTURE_TAB':
      chrome.tabs.captureVisibleTab(chrome.windows.WINDOW_ID_CURRENT, { format: 'jpeg', quality: 80 })
        .then((dataUrl) => {
          sendResponse({ dataUrl });
        })
        .catch((err) => {
          console.error('[Pinmark] Error capturing visible tab:', err);
          sendResponse({ error: err.message });
        });
      return true;

    case 'CREATE_GITHUB_ISSUE':
      (async () => {
        try {
          const settings = await getSettings();
          if (!settings.githubToken || !settings.githubRepo) {
            sendResponse({ success: false, error: 'GitHub token or repo not configured in settings.' });
            return;
          }
          
          const response = await fetch(`https://api.github.com/repos/${settings.githubRepo}/issues`, {
            method: 'POST',
            headers: {
              'Authorization': `token ${settings.githubToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              title: `Pinmark Feedback: ${new URL(message.url).pathname}`,
              body: message.content
            })
          });

          if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
          }
          const data = await response.json();
          sendResponse({ success: true, issueUrl: data.html_url });
        } catch (e) {
          sendResponse({ success: false, error: (e as Error).message });
        }
      })();
      return true;

    case 'OPEN_SETTINGS':
      // Open the extension popup inline (not a new tab).
      // openPopup() is Chrome-only — guard for Firefox/Safari where it's absent.
      if (chrome.action?.openPopup) {
        chrome.action.openPopup().catch(() => {
          // openPopup() requires user gesture — fallback: do nothing
          // The user can click the extension icon to open settings
        });
      }
      sendResponse({ success: true });
      return true;
  }

  return false;
});


chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'toggle-pinmark' && tab && tab.id) {
    try {
      // Use chrome.storage.local — consistent with the popup toggle flow
      const storage = await chrome.storage.local.get('extensionActive');
      const nextActive = !storage.extensionActive;
      await chrome.storage.local.set({ extensionActive: nextActive });

      // Broadcast to all tabs
      const tabs = await chrome.tabs.query({});
      for (const t of tabs) {
        if (t.id !== undefined) {
          chrome.tabs.sendMessage(t.id, {
            type: 'TOGGLE_EXTENSION',
            isActive: nextActive
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.error('[Pinmark] keyboard toggle failed:', e);
    }
  }
});
