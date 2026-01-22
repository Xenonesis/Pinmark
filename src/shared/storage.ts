import type { ExtensionSettings, FeedbackItem } from './types';

const SETTINGS_KEY = 'agentecho_settings';

export function getStorageKeyForUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `agentecho_feedback_${urlObj.origin}${urlObj.pathname}`;
  } catch {
    return `agentecho_feedback_${url}`;
  }
}

export async function getSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    chrome.storage.local.get([SETTINGS_KEY], (result) => {
      resolve(result[SETTINGS_KEY] || {
        markerColor: '#ef4444',
        outputDetail: 'standard',
        clearAfterCopy: false,
        blockInteractions: false,
        theme: 'auto',
      });
    });
  });
}

export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SETTINGS_KEY]: updated }, () => resolve());
  });
}

export async function getFeedback(url: string): Promise<FeedbackItem[]> {
  const key = getStorageKeyForUrl(url);
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key] || []);
    });
  });
}

export async function saveFeedback(url: string, feedback: FeedbackItem[]): Promise<void> {
  const key = getStorageKeyForUrl(url);
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: feedback }, () => resolve());
  });
}

export async function clearFeedback(url: string): Promise<void> {
  const key = getStorageKeyForUrl(url);
  return new Promise((resolve) => {
    chrome.storage.local.remove([key], () => resolve());
  });
}
