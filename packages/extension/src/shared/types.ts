import type { PinmarkAnnotation as FeedbackItem, ElementInfo, ComponentInfo } from '@pinmark/core';
export type { FeedbackItem, ElementInfo, ComponentInfo };

export interface ExtensionSettings {
  markerColor: string;
  outputDetail: 'minimal' | 'standard' | 'comprehensive';
  clearAfterCopy: boolean;
  blockInteractions: boolean;
  theme: 'light' | 'dark' | 'auto';
  mcpEndpoint: string;
  autoSync: boolean;
  githubToken?: string;
  githubRepo?: string;
  webhookUrl?: string;
}

export interface ExtensionState {
  isActive: boolean;
  isPaused: boolean;
  markersVisible: boolean;
  currentUrl: string;
}

export type Message =
  | { type: 'TOGGLE_EXTENSION'; tabId?: number }
  | { type: 'GET_STATE'; tabId?: number }
  | { type: 'SET_STATE'; tabId?: number; state: Partial<ExtensionState> }
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; settings: Partial<ExtensionSettings> }
  | { type: 'GET_FEEDBACK'; url: string }
  | { type: 'SAVE_FEEDBACK'; url: string; feedback: FeedbackItem[] }
  | { type: 'ACTIVATE_OVERLAY' }
  | { type: 'DEACTIVATE_OVERLAY' }
  | { type: 'ADD_FEEDBACK'; item: FeedbackItem }
  | { type: 'REMOVE_FEEDBACK'; id: string }
  | { type: 'UPDATE_FEEDBACK'; id: string; updates: Partial<FeedbackItem> }
  | { type: 'COPY_FEEDBACK'; url: string }
  | { type: 'COPY_JSON' }
  | { type: 'CLEAR_FEEDBACK' }
  | { type: 'TOGGLE_MARKERS' }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'CREATE_GITHUB_ISSUE'; url: string; content: string }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<ExtensionSettings> };

export const DEFAULT_SETTINGS: ExtensionSettings = {
  markerColor: '#ef4444',
  outputDetail: 'standard',
  clearAfterCopy: false,
  blockInteractions: false,
  theme: 'auto',
  mcpEndpoint: 'http://localhost:4747',
  autoSync: true,
  githubToken: '',
  githubRepo: '',
  webhookUrl: '',
};
