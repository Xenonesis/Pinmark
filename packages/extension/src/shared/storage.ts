import type { ExtensionSettings, FeedbackItem } from './types';

const SETTINGS_KEY = 'pinmark_settings';

export function getStorageKeyForUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `pinmark_feedback_${urlObj.origin}${urlObj.pathname}`;
  } catch {
    return `pinmark_feedback_${url}`;
  }
}

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get([SETTINGS_KEY]);
  return (result[SETTINGS_KEY] as ExtensionSettings) || {
    markerColor: '#ef4444',
    outputDetail: 'standard',
    clearAfterCopy: false,
    blockInteractions: false,
    hideUntilRestart: false,
    theme: 'auto',
    mcpEndpoint: 'http://127.0.0.1:4747',
    autoSync: false,
    githubToken: '',
    githubRepo: '',
    webhookUrl: '',
  };
}

export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await chrome.storage.local.set({ [SETTINGS_KEY]: updated });
}

export async function getFeedback(url: string): Promise<FeedbackItem[]> {
  const key = getStorageKeyForUrl(url);
  const result = await chrome.storage.local.get([key]);
  return (result[key] as FeedbackItem[]) || [];
}

export async function saveFeedback(url: string, feedback: FeedbackItem[]): Promise<void> {
  const key = getStorageKeyForUrl(url);
  await chrome.storage.local.set({ [key]: feedback });
}

export async function clearFeedback(url: string): Promise<void> {
  const key = getStorageKeyForUrl(url);
  await chrome.storage.local.remove([key]);
}
