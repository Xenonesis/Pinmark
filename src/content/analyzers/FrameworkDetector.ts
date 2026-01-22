import type { ComponentInfo } from '../../shared/types';

export class FrameworkDetector {
  detect(element: HTMLElement): ComponentInfo | undefined {
    const reactInfo = this.detectReact(element);
    if (reactInfo) return reactInfo;

    const angularInfo = this.detectAngular(element);
    if (angularInfo) return angularInfo;

    const vueInfo = this.detectVue(element);
    if (vueInfo) return vueInfo;

    const svelteInfo = this.detectSvelte(element);
    if (svelteInfo) return svelteInfo;

    return undefined;
  }

  private detectReact(element: HTMLElement): ComponentInfo | undefined {
    const fiberKey = Object.keys(element).find((key) =>
      key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')
    );

    if (fiberKey) {
      try {
        const fiber = (element as unknown as Record<string, unknown>)[fiberKey];
        let componentName = 'Unknown';

        if (fiber && typeof fiber === 'object' && 'type' in fiber) {
          const type = fiber.type as { displayName?: string; name?: string };
          componentName = type.displayName || type.name || 'Unknown';
        }

        return {
          framework: 'react',
          name: componentName,
        };
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  private detectAngular(element: HTMLElement): ComponentInfo | undefined {
    if ('__ngContext__' in element) {
      try {
        const ngContext = (element as unknown as Record<string, unknown>).__ngContext__;
        if (ngContext && typeof ngContext === 'object') {
          const context = ngContext as Array<unknown>;
          if (context[0] && typeof context[0] === 'object') {
            const component = context[0] as { constructor?: { name?: string } };
            if (component.constructor?.name) {
              return {
                framework: 'angular',
                name: component.constructor.name,
              };
            }
          }
        }
      } catch {
        return {
          framework: 'angular',
          name: 'Component',
        };
      }
    }

    for (const attr of element.attributes) {
      if (attr.name.startsWith('_ngcontent')) {
        return {
          framework: 'angular',
          name: 'Component',
        };
      }
    }

    const windowNg = (window as unknown as Record<string, unknown>).ng;
    if (typeof windowNg !== 'undefined') {
      try {
        const ng = windowNg as { getComponent: (el: HTMLElement) => unknown };
        if (ng.getComponent) {
          const component = ng.getComponent(element);
          if (component && typeof component === 'object') {
            const constructor = component as { constructor?: { name?: string } };
            if (constructor.constructor?.name) {
              return {
                framework: 'angular',
                name: constructor.constructor.name,
              };
            }
          }
        }
      } catch {
        // Ignore errors
      }
    }

    return undefined;
  }

  private detectVue(element: HTMLElement): ComponentInfo | undefined {
    if ('__vue__' in element) {
      try {
        const vueInstance = (element as unknown as Record<string, unknown>).__vue__;
        if (vueInstance && typeof vueInstance === 'object') {
          const instance = vueInstance as { $options?: { name?: string }; type?: { name?: string } };
          const name = instance.$options?.name || instance.type?.name || 'Component';
          return {
            framework: 'vue',
            name,
          };
        }
      } catch {
        return {
          framework: 'vue',
          name: 'Component',
        };
      }
    }

    if ('__vueParentComponent' in element) {
      return {
        framework: 'vue',
        name: 'Component',
      };
    }

    return undefined;
  }

  private detectSvelte(element: HTMLElement): ComponentInfo | undefined {
    for (const attr of element.attributes) {
      if (attr.name.startsWith('data-svelte-')) {
        return {
          framework: 'svelte',
          name: 'Component',
        };
      }
    }

    return undefined;
  }
}
