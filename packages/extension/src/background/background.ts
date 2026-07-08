import { getSettings, saveSettings, getFeedback, saveFeedback } from '../shared/storage';

interface TabState {
  isActive: boolean;
  isPaused: boolean;
  markersVisible: boolean;
}

const tabStates = new Map<number, TabState>();

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
  // Use tabId from message payload (for popup) or from sender.tab (for content scripts)
  const tabId = message.tabId ?? sender.tab?.id;

  switch (message.type) {
    case 'TOGGLE_EXTENSION':
      if (tabId === undefined) {
        sendResponse({ error: 'No tabId provided', isActive: false });
        break;
      }
      const state = getTabState(tabId);
      state.isActive = !state.isActive;
      sendResponse({ isActive: state.isActive });
      break;

    case 'GET_STATE':
      if (tabId === undefined) {
        sendResponse({ error: 'No tabId provided', isActive: false, isPaused: false, markersVisible: true });
        break;
      }
      sendResponse(getTabState(tabId));
      break;

    case 'SET_STATE':
      if (tabId === undefined) {
        sendResponse({ error: 'No tabId provided' });
        break;
      }
      const currentState = getTabState(tabId);
      Object.assign(currentState, message.state);
      sendResponse(getTabState(tabId));
      break;

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
          
          const mcpEndpoint = settings.mcpEndpoint || 'http://127.0.0.1:4747';
          const sessionId = 'session_' + btoa(message.url).replace(/[^a-z0-9]/gi, '').substring(0, 10);
          await fetch(`${mcpEndpoint}/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: message.url, sessionId })
          });
          
          await fetch(`${mcpEndpoint}/sessions/${sessionId}/annotations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message.item)
          });
          sendResponse({ success: true });
        } catch (e) {
          sendResponse({ success: false, error: (e as Error).message });
        }
      })();
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
