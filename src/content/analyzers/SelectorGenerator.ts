export class SelectorGenerator {
  generate(element: HTMLElement): string {
    if (element.id) {
      const idSelector = `#${this.escapeCssValue(element.id)}`;
      if (this.isUnique(idSelector)) {
        return idSelector;
      }
    }

    const uniqueClass = this.findUniqueClassSelector(element);
    if (uniqueClass) {
      return uniqueClass;
    }

    const uniqueDataAttr = this.findUniqueDataAttributeSelector(element);
    if (uniqueDataAttr) {
      return uniqueDataAttr;
    }

    return this.generatePathSelector(element);
  }

  private escapeCssValue(value: string): string {
    return value.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1');
  }

  private isUnique(selector: string): boolean {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  }

  private findUniqueClassSelector(element: HTMLElement): string | null {
    const classes = Array.from(element.classList);
    for (const cls of classes) {
      const selector = `${element.tagName.toLowerCase()}.${this.escapeCssValue(cls)}`;
      if (this.isUnique(selector)) {
        return selector;
      }
    }

    const classList = classes.map((c) => this.escapeCssValue(c)).join('.');
    if (classList) {
      const selector = `${element.tagName.toLowerCase()}.${classList}`;
      if (this.isUnique(selector)) {
        return selector;
      }
    }

    return null;
  }

  private findUniqueDataAttributeSelector(element: HTMLElement): string | null {
    for (const attr of element.attributes) {
      if (attr.name.startsWith('data-') && attr.value) {
        const selector = `${element.tagName.toLowerCase()}[${attr.name}="${this.escapeAttributeValue(attr.value)}"]`;
        if (this.isUnique(selector)) {
          return selector;
        }
      }
    }

    return null;
  }

  private escapeAttributeValue(value: string): string {
    return value.replace(/"/g, '\\"');
  }

  private generatePathSelector(element: HTMLElement): string {
    const parts: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += `#${this.escapeCssValue(current.id)}`;
        parts.unshift(selector);
        break;
      }

      const classes = Array.from(current.classList);
      if (classes.length > 0) {
        selector += `.${classes.map((c) => this.escapeCssValue(c)).join('.')}`;
      }

      const siblings = this.getSiblings(current);
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }

      parts.unshift(selector);
      current = current.parentElement;
    }

    return parts.join(' > ');
  }

  private getSiblings(element: HTMLElement): HTMLElement[] {
    const siblings: HTMLElement[] = [];
    let sibling = element.parentElement?.firstElementChild as HTMLElement | null;

    while (sibling) {
      if (sibling.nodeType === Node.ELEMENT_NODE) {
        siblings.push(sibling);
      }
      sibling = sibling.nextElementSibling as HTMLElement | null;
    }

    return siblings;
  }
}
