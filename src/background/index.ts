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
  }

  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
});
