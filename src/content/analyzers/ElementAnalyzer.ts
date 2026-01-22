import type { ElementInfo } from '../../shared/types';
import { SelectorGenerator } from './SelectorGenerator';
import { FrameworkDetector } from './FrameworkDetector';

export class ElementAnalyzer {
  private selectorGenerator: SelectorGenerator;
  private frameworkDetector: FrameworkDetector;

  constructor() {
    this.selectorGenerator = new SelectorGenerator();
    this.frameworkDetector = new FrameworkDetector();
  }

  analyze(element: HTMLElement): ElementInfo {
    const selector = this.selectorGenerator.generate(element);
    const classes = Array.from(element.classList);
    const id = element.id || undefined;
    const textContent = this.extractTextContent(element);
    const dataAttributes = this.extractDataAttributes(element);
    const component = this.frameworkDetector.detect(element);
    const boundingRect = element.getBoundingClientRect();

    return {
      selector,
      tagName: element.tagName.toLowerCase(),
      id,
      classes,
      textContent,
      dataAttributes,
      component,
      boundingRect,
    };
  }

  private extractTextContent(element: HTMLElement): string | undefined {
    const text = element.textContent?.trim();
    if (!text) return undefined;
    const maxLength = 100;
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  private extractDataAttributes(element: HTMLElement): Record<string, string> {
    const dataAttrs: Record<string, string> = {};
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      if (attr.name.startsWith('data-')) {
        dataAttrs[attr.name] = attr.value;
      }
    }
    return dataAttrs;
  }
}
