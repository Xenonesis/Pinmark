import type { PinmarkAnnotation } from '@pinmark/core';

export interface PinmarkSettings {
  markerColor: string;
  outputDetail: 'minimal' | 'standard' | 'comprehensive' | 'forensic';
  clearAfterCopy: boolean;
  blockInteractions: boolean;
  hideUntilRestart: boolean;
  theme: 'light' | 'dark' | 'auto';
  mcpEndpoint?: string;
  autoSync?: boolean;
  webhookUrl?: string;
}

export interface StorageAdapter {
  getSettings(): Promise<PinmarkSettings>;
  saveSettings(settings: Partial<PinmarkSettings>): Promise<void>;
  getFeedback(url: string): Promise<PinmarkAnnotation[]>;
  saveFeedback(url: string, feedback: PinmarkAnnotation[]): Promise<void>;
  clearFeedback(url: string): Promise<void>;
}

export interface PinmarkConfig {
  /** The URL representing the current context (default: window.location.href) */
  url?: string;
  /** Storage adapter to persist settings and feedback */
  storage?: StorageAdapter;
  /** Callback fired when a new feedback item is added or updated */
  onSync?: (item: PinmarkAnnotation) => void | Promise<void>;
  /** Callback fired when the overlay is toggled on/off */
  onToggle?: (isActive: boolean) => void;
  /** Callback fired to create a GitHub issue */
  onGithubCreate?: (markdown: string) => void | Promise<void>;
  /** Custom callback to take a screenshot of a specific element. Returns base64 image data URL. */
  captureScreenshot?: (element: HTMLElement) => Promise<string | undefined>;
  /** Whether the overlay is active */
  isActive?: boolean;
}
