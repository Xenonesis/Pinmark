import type { ComponentInfo } from '@pinmark/core';

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
    // Check for explicit dev attributes on element or ancestors
    let domSourcePath: string | undefined;
    let domLineNumber: number | undefined;

    const inspectAttr = element.getAttribute('data-source') || 
                        element.getAttribute('data-source-file') ||
                        element.getAttribute('data-loc') ||
                        element.getAttribute('data-inspector-source') ||
                        element.getAttribute('data-astro-source-file');
    if (inspectAttr) {
      const parts = inspectAttr.split(':');
      domSourcePath = parts[0];
      if (parts[1]) domLineNumber = parseInt(parts[1], 10);
    }

    const nameAttr = element.getAttribute('data-pmk-react-component');
    if (nameAttr && nameAttr !== 'Unknown') {
      const hierarchyStr = element.getAttribute('data-pmk-react-hierarchy');
      let hierarchy: string[] | undefined = undefined;
      if (hierarchyStr) {
        try {
          hierarchy = JSON.parse(hierarchyStr);
        } catch (e) {}
      }
      return {
        framework: 'react',
        name: nameAttr,
        hierarchy,
        filePath: domSourcePath,
        lineNumber: domLineNumber,
      };
    }

    const fiberKey = Object.keys(element).find((key) =>
      key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')
    );

    if (fiberKey) {
      try {
        const fiber = (element as unknown as Record<string, unknown>)[fiberKey] as Record<string, unknown>;
        let componentName = 'Unknown';
        const hierarchy: string[] = [];
        let filePath: string | undefined = domSourcePath;
        let lineNumber: number | undefined = domLineNumber;

        let currentFiber: Record<string, unknown> | undefined = fiber;
        while (currentFiber) {
          if (currentFiber.type && (typeof currentFiber.type === 'function' || typeof currentFiber.type === 'object')) {
            const type = currentFiber.type as { displayName?: string; name?: string };
            const name = type.displayName || type.name;
            if (name) {
              if (componentName === 'Unknown') componentName = name;
              // Avoid duplicates if multiple fibers wrap the same component
              if (hierarchy[0] !== name) {
                hierarchy.unshift(name);
              }
            }
          }
          
          if (!filePath) {
            const debugSource = currentFiber._debugSource as { fileName?: string; lineNumber?: number } | undefined;
            if (debugSource?.fileName) {
              filePath = debugSource.fileName;
              lineNumber = debugSource.lineNumber;
            } else {
              const memoizedProps = currentFiber.memoizedProps as Record<string, unknown> | undefined;
              const sourceProp = memoizedProps?.__source as { fileName?: string; lineNumber?: number } | undefined;
              if (sourceProp?.fileName) {
                filePath = sourceProp.fileName;
                lineNumber = sourceProp.lineNumber;
              }
            }
          }
          
          currentFiber = currentFiber.return as Record<string, unknown> | undefined;
        }

        return {
          framework: 'react',
          name: componentName,
          hierarchy: hierarchy.length > 0 ? hierarchy : undefined,
          filePath,
          lineNumber
        };
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  private detectAngular(element: HTMLElement): ComponentInfo | undefined {
    const windowNg = (window as any).ng;
    let hierarchy: string[] = [];
    let name = 'Component';

    if (typeof windowNg !== 'undefined' && windowNg.getComponent) {
      let current: HTMLElement | null = element;
      while (current) {
        try {
          const component = windowNg.getComponent(current);
          if (component && typeof component === 'object') {
            const compName = component.constructor?.name;
            if (compName) {
              if (name === 'Component') name = compName;
              if (hierarchy[0] !== compName) hierarchy.unshift(compName);
            }
          }
        } catch { }
        current = current.parentElement;
      }
      
      if (hierarchy.length > 0) {
        return { framework: 'angular', name, hierarchy };
      }
    }

    if ('__ngContext__' in element) {
      try {
        const ngContext = (element as any).__ngContext__;
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
        return { framework: 'angular', name: 'Component' };
      }
    }

    for (const attr of element.attributes) {
      if (attr.name.startsWith('_ngcontent')) {
        return { framework: 'angular', name: 'Component' };
      }
    }

    return undefined;
  }

  private detectVue(element: HTMLElement): ComponentInfo | undefined {
    if ('__vue__' in element) {
      try {
        const vueInstance = (element as any).__vue__;
        if (vueInstance && typeof vueInstance === 'object') {
          const hierarchy: string[] = [];
          let currentInstance = vueInstance;
          let name = 'Component';
          let filePath: string | undefined;

          while (currentInstance) {
            const compName = currentInstance.$options?.name || currentInstance.type?.name || currentInstance.$options?._componentTag;
            if (compName) {
              if (name === 'Component') name = compName;
              if (hierarchy[0] !== compName) hierarchy.unshift(compName);
            }
            if (!filePath && currentInstance.$options?.__file) {
              filePath = currentInstance.$options.__file;
            }
            currentInstance = currentInstance.$parent;
          }

          return {
            framework: 'vue',
            name,
            hierarchy: hierarchy.length > 0 ? hierarchy : undefined,
            filePath
          };
        }
      } catch {
        return { framework: 'vue', name: 'Component' };
      }
    }

    if ('__vueParentComponent' in element) {
      return { framework: 'vue', name: 'Component' };
    }

    return undefined;
  }

  private detectSvelte(element: HTMLElement): ComponentInfo | undefined {
    let current: HTMLElement | null = element;
    let name = 'Component';
    const hierarchy: string[] = [];
    let filePath: string | undefined;

    while (current && current.nodeType === 1) {
      let isSvelte = false;
      for (const attr of current.attributes) {
        if (attr.name.startsWith('data-svelte-')) {
          isSvelte = true;
          break;
        }
      }
      
      if (isSvelte) {
        const compName = 'SvelteComponent';
        if (hierarchy[0] !== compName) hierarchy.unshift(compName);
      }
      
      if ((current as any).__svelte_meta) {
        const meta = (current as any).__svelte_meta;
        if (meta.loc && meta.loc.file) {
          if (!filePath) filePath = meta.loc.file;
        }
      }

      current = current.parentElement;
    }

    if (hierarchy.length > 0) {
      return { framework: 'svelte', name, hierarchy: hierarchy.length > 0 ? hierarchy : undefined, filePath };
    }

    return undefined;
  }
}
