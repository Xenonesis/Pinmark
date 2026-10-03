/**
 * Theme provider — manages light/dark/auto mode for any surface.
 *
 * Storage is injected as an adapter so the same class works with
 * localStorage (landing page) or chrome.storage (extension popup).
 *
 * Usage:
 *   const theme = new ThemeProvider({ storage });
 *   await theme.init();
 *   await theme.set('dark');
 *   await theme.cycle();   // light → dark → auto → light
 *   theme.subscribe((mode, resolved) => { ... });
 */

export type ThemeMode = 'light' | 'dark' | 'auto';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeStorage {
  get(): Promise<ThemeMode | null> | ThemeMode | null;
  set(mode: ThemeMode): Promise<void> | void;
}

export type ThemeListener = (mode: ThemeMode, resolved: ResolvedTheme) => void;

export interface ThemeProviderOptions {
  /** Element to set `data-theme` attribute on. Defaults to <html>. */
  target?: HTMLElement;
  /** Storage adapter for persisting the chosen mode. */
  storage: ThemeStorage;
  /** Initial mode if nothing is saved. Default: 'auto'. */
  defaultMode?: ThemeMode;
}

export class ThemeProvider {
  #mode: ThemeMode;
  #target: HTMLElement;
  #storage: ThemeStorage;
  #media: MediaQueryList;
  #listeners = new Set<ThemeListener>();
  #initialized = false;

  constructor(opts: ThemeProviderOptions) {
    this.#target = opts.target ?? document.documentElement;
    this.#storage = opts.storage;
    this.#mode = opts.defaultMode ?? 'auto';
    this.#media = matchMedia('(prefers-color-scheme: dark)');
  }

  async init(): Promise<void> {
    if (this.#initialized) return;
    const saved = await this.#storage.get();
    if (saved === 'light' || saved === 'dark' || saved === 'auto') {
      this.#mode = saved;
    }
    this.#apply();
    this.#media.addEventListener('change', this.#onSystemChange);
    this.#initialized = true;
  }

  /** Currently selected mode (user's choice, may be 'auto'). */
  get mode(): ThemeMode { return this.#mode; }

  /** What the user actually sees: light or dark. */
  get resolved(): ResolvedTheme {
    return this.#mode === 'auto' ? (this.#media.matches ? 'dark' : 'light') : this.#mode;
  }

  async set(mode: ThemeMode): Promise<void> {
    this.#mode = mode;
    await this.#storage.set(mode);
    this.#apply();
    this.#notify();
  }

  /** Cycle through light → dark → auto → light. */
  async cycle(): Promise<ThemeMode> {
    const order: ThemeMode[] = ['light', 'dark', 'auto'];
    const next = order[(order.indexOf(this.#mode) + 1) % order.length] ?? 'light';
    await this.set(next);
    return next;
  }

  subscribe(listener: ThemeListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Tear down listeners. */
  destroy(): void {
    this.#media.removeEventListener('change', this.#onSystemChange);
    this.#listeners.clear();
  }

  #onSystemChange = () => {
    if (this.#mode === 'auto') this.#apply();
  };

  #apply() {
    this.#target.setAttribute('data-theme', this.resolved);
    this.#target.setAttribute('data-theme-mode', this.#mode);
  }

  #notify() {
    this.#listeners.forEach((l) => l(this.#mode, this.resolved));
  }
}

/* ---------- storage adapters ---------- */

export const localStorageAdapter = (key: string): ThemeStorage => ({
  get: () => {
    const v = localStorage.getItem(key);
    return v === 'light' || v === 'dark' || v === 'auto' ? v : null;
  },
  set: (mode) => { localStorage.setItem(key, mode); },
});

/** Wraps a chrome.storage.local key. */
export const chromeStorageAdapter = (key: string): ThemeStorage => ({
  async get() {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        const v = result[key];
        resolve(v === 'light' || v === 'dark' || v === 'auto' ? v : null);
      });
    });
  },
  async set(mode) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: mode }, () => resolve());
    });
  },
});