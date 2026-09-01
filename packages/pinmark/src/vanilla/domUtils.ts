export function setHTML(element: Element, htmlString: string): void {
  element.replaceChildren();
  if (!htmlString) return;
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  
  while (doc.body.firstChild) {
    element.appendChild(doc.body.firstChild);
  }
}

export function escapeHTML(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
