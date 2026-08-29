import type { ResilientSelectors } from '@pinmark/core';

export class SelectorEngine {
  generateResilientSelectors(element: HTMLElement): ResilientSelectors {
    const testId = this.extractTestId(element);
    const aria = this.extractAria(element);
    const textAnchor = this.extractTextAnchor(element);
    const semanticPath = this.extractSemanticPath(element);
    const xpath = this.extractXPath(element);

    const bestRobust = testId || aria || textAnchor || semanticPath || xpath || undefined;

    return {
      testId,
      aria,
      textAnchor,
      semanticPath,
      xpath,
      bestRobust,
    };
  }

  private extractTestId(element: HTMLElement): string | undefined {
    const testAttrs = [
      'data-testid',
      'data-test',
      'data-cy',
      'data-qa',
      'data-qa-id',
      'data-test-id',
    ];
    for (const attr of testAttrs) {
      const val = element.getAttribute(attr);
      if (val) {
        return `[${attr}="${val}"]`;
      }
    }
    // Check parent testid
    const parentTestEl = element.closest('[data-testid], [data-test], [data-cy]') as HTMLElement | null;
    if (parentTestEl && parentTestEl !== element) {
      for (const attr of testAttrs) {
        const val = parentTestEl.getAttribute(attr);
        if (val) {
          const tag = element.tagName.toLowerCase();
          return `[${attr}="${val}"] ${tag}`;
        }
      }
    }
    return undefined;
  }

  private extractAria(element: HTMLElement): string | undefined {
    const tag = element.tagName.toLowerCase();
    const ariaLabel = element.getAttribute('aria-label');
    const role = element.getAttribute('role');
    const title = element.getAttribute('title');

    if (ariaLabel) {
      return `${tag}[aria-label="${ariaLabel}"]`;
    }
    if (role && title) {
      return `[role="${role}"][title="${title}"]`;
    }
    if (role) {
      return `${tag}[role="${role}"]`;
    }
    if (title) {
      return `${tag}[title="${title}"]`;
    }
    return undefined;
  }

  private extractTextAnchor(element: HTMLElement): string | undefined {
    const tag = element.tagName.toLowerCase();
    const text = (element.textContent || '').trim();
    if (text && text.length > 0 && text.length <= 40 && !text.includes('\n')) {
      const safeText = text.replace(/"/g, '\\"');
      return `${tag}:has-text("${safeText}")`;
    }
    return undefined;
  }

  private extractSemanticPath(element: HTMLElement): string | undefined {
    const path: string[] = [];
    let current: HTMLElement | null = element;
    let depth = 0;

    while (current && current !== document.body && current !== document.documentElement && depth < 5) {
      const tag = current.tagName.toLowerCase();
      let segment = tag;
      
      // Clean non-hashed classes
      const cleanClasses = Array.from(current.classList).filter((cls) => {
        // filter out tailwind arbitrary values, hash classes (e.g. css-1a2b, _3kdf)
        if (/^css-[a-z0-9]+/i.test(cls)) return false;
        if (/^_[a-z0-9_]+/i.test(cls)) return false;
        if (/^[a-z0-9]{8,}$/i.test(cls)) return false;
        return true;
      });

      if (cleanClasses.length > 0) {
        segment += `.${cleanClasses.slice(0, 2).join('.')}`;
      }

      path.unshift(segment);
      current = current.parentElement;
      depth++;
    }

    return path.length > 0 ? path.join(' > ') : undefined;
  }

  private extractXPath(element: HTMLElement): string | undefined {
    const tag = element.tagName.toLowerCase();
    const id = element.id;
    if (id && !/^[0-9]+|:/.test(id)) {
      return `//${tag}[@id='${id}']`;
    }
    const text = (element.textContent || '').trim();
    if (text && text.length > 0 && text.length <= 30 && !text.includes('\n') && !text.includes("'")) {
      return `//${tag}[contains(text(),'${text}')]`;
    }
    return undefined;
  }
}
