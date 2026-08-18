export const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export const KEYCLOAK_URL = import.meta.env.VITE_KEYCLOAK_URL;
export const KEYCLOAK_REALM = import.meta.env.VITE_KEYCLOAK_REALM;
export const KEYCLOAK_CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID;

// Matomo JS tracker config.
// MATOMO_URL is the instance base.
// MATOMO_SITE_ID controls which measurable we send tracking to
export const MATOMO_URL = import.meta.env.VITE_MATOMO_URL;
export const MATOMO_SITE_ID = import.meta.env.VITE_MATOMO_SITE_ID;

export const FEEDBACK_FORM_URL: string | undefined =
  import.meta.env.VITE_FEEDBACK_FORM_URL;

// Where "Flag this summary" sends accuracy reports (a Google Form for now).
export const AI_SUMMARY_FLAG_FORM_URL: string | undefined =
  import.meta.env.VITE_AI_SUMMARY_FLAG_FORM_URL;

// Google Forms pre-filled link for coding requests, carrying {referenceUrl},
// {name} and {email} placeholders in place of its answer values. Unset until
// the form exists; the UI hides the request panel without it.
export const ENRICHMENT_FORM_URL: string | undefined =
  import.meta.env.VITE_ENRICHMENT_FORM_URL;

// Base URL of the evidence-summariser service. Unset until the service is
// deployed; the UI hides the AI summaries feature while it's absent.
export const SUMMARISER_BASE: string | undefined =
  import.meta.env.VITE_SUMMARISER_BASE;

// Local-dev escape hatch: serve a canned summary instead of calling the (slow,
// costly) summariser. Enables the feature gate too, so no dummy base is needed.
export const SUMMARISER_MOCK: boolean =
  import.meta.env.VITE_SUMMARISER_MOCK === "true";

// How long the mock pretends to work, in ms — long enough to exercise the
// generating spinner, "Run in background", and cancel. Defaults to 1.5s.
export const SUMMARISER_MOCK_DELAY_MS: number =
  Number(import.meta.env.VITE_SUMMARISER_MOCK_DELAY_MS) || 1500;

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

const BLOB_PROXY_TARGET = import.meta.env.VITE_BLOB_PROXY_TARGET;

/**
 * Rewrite a signed blob-storage URL (e.g. a search-export download) through the
 * local dev proxy when VITE_BLOB_PROXY_TARGET is set. The deployed storage
 * account's CORS allows only the production UI origins, so local dev can't fetch
 * the blob cross-origin; the proxy makes it same-origin. The SAS query string is
 * preserved. In production, returns the URL unchanged.
 */
export function proxyBlobUrl(url: string): string {
  if (!BLOB_PROXY_TARGET) return url;
  if (url.startsWith(BLOB_PROXY_TARGET)) {
    return "/blob-proxy" + url.slice(BLOB_PROXY_TARGET.length);
  }
  return url;
}
