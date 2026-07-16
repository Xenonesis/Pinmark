export function setHTML(element: Element, htmlString: string): void {
  element.replaceChildren();
  if (!htmlString) return;
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  
  while (doc.body.firstChild) {
    element.appendChild(doc.body.firstChild);
  }
}
