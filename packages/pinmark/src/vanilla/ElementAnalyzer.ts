import type { ElementInfo } from '@pinmark/core';
import { SelectorGenerator } from './SelectorGenerator.js';
import { FrameworkDetector } from './FrameworkDetector.js';

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
    const computedStyles = this.extractComputedStyles(element);
    const accessibility = this.extractAccessibility(element);
    const animations = this.extractAnimations(element);

    return {
      selector,
      tagName: element.tagName.toLowerCase(),
      id,
      classes,
      textContent,
      dataAttributes,
      component,
      boundingRect,
      computedStyles,
      accessibility,
      animations,
    } as any;
  }

  private extractAnimations(element: HTMLElement): any[] {
    const results: any[] = [];
    const computed = window.getComputedStyle(element);
    
    // Check CSS Animations
    const animNames = computed.animationName.split(',').map(s => s.trim()).filter(s => s && s !== 'none');
    const animDurations = computed.animationDuration.split(',').map(s => s.trim());
    const animTimings = computed.animationTimingFunction.split(',').map(s => s.trim());
    
    animNames.forEach((name, i) => {
      const dur = animDurations[i] || animDurations[0] || '0s';
      if (dur === '0s') return;
      results.push({
        type: 'css-animation',
        name,
        duration: dur,
        timingFunction: animTimings[i] || animTimings[0] || 'ease',
      });
    });

    // Check CSS Transitions
    const transProps = computed.transitionProperty.split(',').map(s => s.trim()).filter(s => s && s !== 'none' && s !== 'all');
    const transDurations = computed.transitionDuration.split(',').map(s => s.trim());
    const transTimings = computed.transitionTimingFunction.split(',').map(s => s.trim());
    
    transProps.forEach((prop, i) => {
      const dur = transDurations[i] || transDurations[0] || '0s';
      if (dur === '0s') return;
      results.push({
        type: 'css-transition',
        property: prop,
        duration: dur,
        timingFunction: transTimings[i] || transTimings[0] || 'ease',
      });
    });

    return results;
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

  private extractComputedStyles(element: HTMLElement): Record<string, string> {
    const styles = window.getComputedStyle(element);
    const propertiesToExtract = [
      'display', 'flex-direction', 'align-items', 'justify-content', 'gap',
      'position', 'top', 'right', 'bottom', 'left',
      'color', 'background-color',
      'font-size', 'font-weight', 'font-family', 'line-height',
      'padding', 'margin',
      'border', 'border-radius',
      'width', 'height',
      'opacity', 'visibility'
    ];

    const result: Record<string, string> = {};
    for (const prop of propertiesToExtract) {
      const value = styles.getPropertyValue(prop);
      if (value && value !== 'none' && value !== 'normal' && value !== '0px' && value !== 'rgba(0, 0, 0, 0)') {
        result[prop] = value;
      }
    }
    return result;
  }

  private extractAccessibility(element: HTMLElement): Record<string, string> {
    const a11y: Record<string, string> = {};
    
    const role = element.getAttribute('role');
    if (role) a11y.role = role;
    
    if (element.hasAttribute('tabindex')) {
      a11y.tabindex = element.getAttribute('tabindex') || '';
    }

    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      if (attr.name.startsWith('aria-')) {
        a11y[attr.name] = attr.value;
      }
    }

    if (element.hasAttribute('alt')) a11y.alt = element.getAttribute('alt') || '';
    if (element.hasAttribute('title')) a11y.title = element.getAttribute('title') || '';
    if (element.hasAttribute('for')) a11y.for = element.getAttribute('for') || '';

    return Object.keys(a11y).length > 0 ? a11y : undefined as any;
  }
}
