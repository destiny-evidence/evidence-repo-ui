export const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export const KEYCLOAK_URL = import.meta.env.VITE_KEYCLOAK_URL;
export const KEYCLOAK_REALM = import.meta.env.VITE_KEYCLOAK_REALM;
export const KEYCLOAK_CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID;

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
