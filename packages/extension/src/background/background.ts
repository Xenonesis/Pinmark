import { getSettings, saveSettings, getFeedback, saveFeedback } from '../shared/storage';

interface TabState {
  isActive: boolean;
  isPaused: boolean;
  markersVisible: boolean;
}

const tabStates = new Map<number, TabState>();

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

function getTabState(tabId: number): TabState {
  if (!tabStates.has(tabId)) {
    tabStates.set(tabId, {
      isActive: false,
      isPaused: false,
      markersVisible: true,
    });
  }
  return tabStates.get(tabId)!;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  switch (message.type) {
    case 'TOGGLE_EXTENSION':
      (async () => {
        try {
          const storage = await chrome.storage.local.get('extensionActive');
          const nextActive = !storage.extensionActive;
          await chrome.storage.local.set({ extensionActive: nextActive });

          // Send message to all tabs to update their state
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

    case 'GET_SETTINGS':
      getSettings().then(sendResponse);
      return true;

    case 'SAVE_SETTINGS':
      saveSettings(message.settings).then(() => sendResponse({ success: true }));
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

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'toggle-pinmark' && tab && tab.id) {
    const state = getTabState(tab.id);
    state.isActive = !state.isActive;
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_EXTENSION', isActive: state.isActive }).catch(() => {
      // Content script might not be loaded yet, we can ignore this
    });
  }
});
