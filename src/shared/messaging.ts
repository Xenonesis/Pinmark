import type { Message } from './types';

export function sendMessage<T = unknown>(message: Message): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response as T);
      }
    });
  });
}

export function sendToContentScript<T = unknown>(tabId: number, message: Message): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response as T);
      }
    });
  });
}

export function onMessage(callback: (message: Message, sender: chrome.runtime.MessageSender) => unknown) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      const result = callback(message, sender);
      if (result && typeof result === 'object' && 'then' in result) {
        (result as Promise<unknown>).then(sendResponse).catch((error) => {
          console.error('Message handler error:', error);
          sendResponse({ error: error.message });
        });
        return true;
      }
    } catch (error) {
      console.error('Message handler error:', error);
      sendResponse({ error: (error as Error).message });
    }
  });
}
