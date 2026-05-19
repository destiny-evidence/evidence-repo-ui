// Some sources (notably the EEF EPPI ingester) capture the literal section
// label "Abstract" as the first word of the abstract body. Strip it so the
// page doesn't render the heading "Abstract" directly above a body that
// also starts with "Abstract". Case-sensitive: sentences that genuinely
// start with "abstract" or "ABSTRACT" pass through untouched.
export function stripAbstractLabelPrefix(text: string): string {
  return text.replace(/^Abstract\s+/, "");
}

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
