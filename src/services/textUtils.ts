// Drop duplicated leading "Abstract " labels from source abstracts.
// Case-sensitive to avoid false positives.
export function stripAbstractLabelPrefix(text: string): string {
  return text.replace(/^Abstract\s+/, "");
}

// Decode entities while preserving tags as literal text. We use <textarea>
// rather than DOMParser because DOMParser would silently strip tags from a
// plain-text abstract. XSS surface stays zero: callers render text, not HTML.
export function decodeHtmlEntities(text: string): string {
  if (!text || !text.includes("&")) return text;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}
