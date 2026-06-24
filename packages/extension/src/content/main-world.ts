// Main world script for Pinmark
// This script runs in the same context as the webpage to access React Fiber properties.

document.addEventListener('mouseover', (e) => {
  let el = e.target as HTMLElement;
  while (el) {
    if (el.hasAttribute('data-pmk-react-component')) break;
    const reactKey = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
    if (reactKey) {
      const fiber = (el as any)[reactKey];
      let name = "Unknown";
      const hierarchy = [];
      let curr = fiber;
      while (curr) {
        const type = curr.type || curr.elementType;
        if (type && (typeof type === 'object' || typeof type === 'function')) {
          const compName = type.displayName || type.name;
          if (compName) {
            if (name === "Unknown") name = compName;
            if (hierarchy[0] !== compName) hierarchy.unshift(compName);
          }
        }
        curr = curr.return;
      }
      el.setAttribute('data-pmk-react-component', name);
      if (hierarchy.length > 0) {
        el.setAttribute('data-pmk-react-hierarchy', JSON.stringify(hierarchy));
      }
      break;
    }
    el = el.parentElement as HTMLElement;
  }
}, { capture: true, passive: true });
