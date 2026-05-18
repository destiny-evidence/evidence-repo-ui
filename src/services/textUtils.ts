// Entity-only decoder using HTML5's escapable-raw-text content model (textarea).
// Named, numeric, and hex character references all decode; tags inside the
// input are preserved as literal characters (textarea does not parse children
// as markup).
//
// Why textarea over DOMParser: DOMParser strips tags silently, which would
// destroy the input if a future synthetic abstract ever contained markup.
// Textarea decodes entities while leaving tags as text, which is the safest
// default for plain-text rendering downstream.
//
// XSS surface: zero. We only read `.value` and the caller renders the result
// as a text node (no innerHTML, no dangerouslySetInnerHTML).
export function decodeHtmlEntities(text: string): string {
  if (!text || !text.includes("&")) return text;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}
