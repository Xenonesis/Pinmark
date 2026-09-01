// Main world script for Pinmark
// Runs in the host page context to extract React Component names safely
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  world: 'MAIN',
  main() {
    const inspectedElements = new WeakSet<HTMLElement>();

    document.addEventListener('mouseover', (e) => {
      let el = e.target as HTMLElement | null;
      let depth = 0;

      while (el && depth < 10) {
        depth++;
        if (inspectedElements.has(el)) break;
        if (el.hasAttribute && el.hasAttribute('data-pmk-react-component')) {
          inspectedElements.add(el);
          break;
        }

        const reactKey = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
        if (reactKey) {
          inspectedElements.add(el);
          const fiber = (el as unknown as Record<string, unknown>)[reactKey] as { type?: { displayName?: string; name?: string }; elementType?: { displayName?: string; name?: string }; return?: unknown } | undefined;
          let name = "Unknown";
          const hierarchy: string[] = [];
          let curr = fiber;
          let fiberDepth = 0;

          while (curr && fiberDepth < 25) {
            fiberDepth++;
            const type = curr.type || curr.elementType;
            if (type && (typeof type === 'object' || typeof type === 'function')) {
              const compName = type.displayName || type.name;
              if (compName && typeof compName === 'string') {
                if (name === "Unknown") name = compName;
                if (hierarchy[0] !== compName) hierarchy.unshift(compName);
              }
            }
            curr = curr.return as typeof curr;
          }

          if (name !== "Unknown" && el.setAttribute) {
            el.setAttribute('data-pmk-react-component', name);
            if (hierarchy.length > 0) {
              el.setAttribute('data-pmk-react-hierarchy', JSON.stringify(hierarchy));
            }
          }
          break;
        }

        el = el.parentElement;
      }
    }, { capture: true, passive: true });
  },
});
