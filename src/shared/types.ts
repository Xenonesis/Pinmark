export interface FeedbackItem {
  id: string;
  index: number;
  comment: string;
  timestamp: number;
  url: string;
  category?: 'bug' | 'improvement' | 'question' | 'design';
  element: ElementInfo;
}

export interface ElementInfo {
  selector: string;
  tagName: string;
  id?: string;
  classes: string[];
  textContent?: string;
  dataAttributes: Record<string, string>;
  component?: ComponentInfo;
  boundingRect: DOMRect;
  screenshot?: string;
}

export interface ComponentInfo {
  framework: 'react' | 'angular' | 'vue' | 'svelte' | 'unknown';
  name: string;
  props?: Record<string, unknown>;
  filePath?: string;
}

export interface ExtensionSettings {
  markerColor: string;
  outputDetail: 'minimal' | 'standard' | 'comprehensive';
  clearAfterCopy: boolean;
  blockInteractions: boolean;
  theme: 'light' | 'dark' | 'auto';
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
  | { type: 'CLEAR_FEEDBACK' }
  | { type: 'TOGGLE_MARKERS' }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<ExtensionSettings> };

export const DEFAULT_SETTINGS: ExtensionSettings = {
  markerColor: '#ef4444',
  outputDetail: 'standard',
  clearAfterCopy: false,
  blockInteractions: false,
  theme: 'auto',
};
