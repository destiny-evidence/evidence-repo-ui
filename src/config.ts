export const API_BASE = import.meta.env.VITE_API_BASE || "/api";

const VOCAB_PROXY_TARGET = import.meta.env.VITE_VOCAB_PROXY_TARGET;

/**
 * Rewrite an external vocabulary URL to go through the local dev proxy
 * when VITE_VOCAB_PROXY_TARGET is set. In production, returns the URL unchanged.
 */
export function proxyVocabUrl(url: string): string {
  if (!VOCAB_PROXY_TARGET) return url;
  if (url.startsWith(VOCAB_PROXY_TARGET)) {
    return "/vocab-proxy" + url.slice(VOCAB_PROXY_TARGET.length);
  }
  return url;
}
