import type { BreadcrumbItem } from '@pinmark/core';

export class BreadcrumbTracker {
  private breadcrumbs: BreadcrumbItem[] = [];
  private maxBreadcrumbs: number = 20;
  private isListening: boolean = false;
  private cleanupFns: Array<() => void> = [];

  constructor(maxBreadcrumbs: number = 20) {
    this.maxBreadcrumbs = maxBreadcrumbs;
  }

  start(): void {
    if (this.isListening || typeof window === 'undefined') return;
    this.isListening = true;

    // 1. Click Listener
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Skip clicking inside pinmark UI
      if (target.closest && (target.closest('pinmark-overlay') || target.closest('#pinmark-launcher-host'))) {
        return;
      }

      const tag = target.tagName.toLowerCase();
      const text = (target.textContent || '').trim().slice(0, 30);
      const aria = target.getAttribute('aria-label') || target.getAttribute('title') || undefined;
      const testId = target.getAttribute('data-testid') || undefined;
      
      let descriptor = tag;
      if (testId) descriptor = `[data-testid="${testId}"]`;
      else if (aria) descriptor = `${tag}[aria-label="${aria}"]`;
      else if (target.id) descriptor = `#${target.id}`;
      else if (target.className && typeof target.className === 'string') {
        const cls = target.className.split(' ')[0];
        if (cls) descriptor = `${tag}.${cls}`;
      }

      this.addBreadcrumb({
        timestamp: Date.now(),
        type: 'click',
        target: descriptor,
        text: text || undefined,
        url: window.location.href,
      });
    };
    window.addEventListener('click', handleClick, { capture: true, passive: true });
    this.cleanupFns.push(() => window.removeEventListener('click', handleClick, { capture: true }));

    // 2. Input / Change Listener
    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement | null;
      if (!target || !target.tagName) return;
      if (target.closest && (target.closest('pinmark-overlay') || target.closest('#pinmark-launcher-host'))) {
        return;
      }

      const name = target.name || target.id || target.getAttribute('data-testid') || target.tagName.toLowerCase();
      const type = target.type || 'text';
      if (type === 'password') return; // Privacy protect password fields

      this.addBreadcrumb({
        timestamp: Date.now(),
        type: 'input',
        target: `${target.tagName.toLowerCase()}[name="${name}"]`,
        text: `type=${type}`,
        url: window.location.href,
      });
    };
    window.addEventListener('change', handleInput, { capture: true, passive: true });
    this.cleanupFns.push(() => window.removeEventListener('change', handleInput, { capture: true }));

    // 3. Navigation / Route Changes
    const handlePopState = () => {
      this.addBreadcrumb({
        timestamp: Date.now(),
        type: 'route_change',
        url: window.location.href,
        text: document.title,
      });
    };
    window.addEventListener('popstate', handlePopState);
    this.cleanupFns.push(() => window.removeEventListener('popstate', handlePopState));

    // Hook history pushState & replaceState
    const origPushState = history.pushState;
    if (origPushState) {
      history.pushState = (...args) => {
        const res = origPushState.apply(history, args);
        this.addBreadcrumb({
          timestamp: Date.now(),
          type: 'route_change',
          url: window.location.href,
          text: document.title,
        });
        return res;
      };
      this.cleanupFns.push(() => {
        history.pushState = origPushState;
      });
    }

    // 4. Modal / Dialog Observers
    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of Array.from(mutation.addedNodes)) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as HTMLElement;
              if (el.tagName && (el.tagName.toLowerCase() === 'dialog' || el.getAttribute('role') === 'dialog' || el.hasAttribute('aria-modal'))) {
                this.addBreadcrumb({
                  timestamp: Date.now(),
                  type: 'modal_open',
                  target: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : ''),
                  text: 'Modal / Dialog opened',
                  url: window.location.href,
                });
              }
            }
          }
        }
      });
      observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
      this.cleanupFns.push(() => observer.disconnect());
    }
  }

  addBreadcrumb(item: BreadcrumbItem): void {
    this.breadcrumbs.push(item);
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  getRecentBreadcrumbs(limit: number = 10): BreadcrumbItem[] {
    return this.breadcrumbs.slice(-limit);
  }

  clear(): void {
    this.breadcrumbs = [];
  }

  stop(): void {
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
    this.isListening = false;
  }
}
