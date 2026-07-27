import { URL_CHANGE_EVENT } from "@/services/navigation";
import type { AnalyticsEvent } from "./events";

declare global {
  interface Window {
    _paq?: Array<unknown[]>;
  }
}

/**
 * Initialise the Matomo JavaScript tracker
 *
 * The Matomo site id controls which Matomo measurable we send tracking to.
 * If either argument is empty, analytics is disabled and no script is injected.
 */
export function initMatomo(
  matomoUrl: string | undefined,
  siteId: string | undefined,
): void {
  if (!matomoUrl || !siteId) return;

  const base = matomoUrl.endsWith("/") ? matomoUrl : matomoUrl + "/";
  const _paq = (window._paq = window._paq || []);
  _paq.push(["setTrackerUrl", base + "matomo.php"]);
  _paq.push(["setSiteId", siteId]);

  // Privacy settings must occur prior to any tracking pushes.
  _paq.push(["disableCookies"]);
  _paq.push(["setDoNotTrack", true]);

  _paq.push(["trackPageView"]);
  _paq.push(["enableLinkTracking"]);

  const g = document.createElement("script");
  const s = document.getElementsByTagName("script")[0];
  g.async = true;
  g.src = base + "matomo.js";
  s.parentNode!.insertBefore(g, s);
}

function analyticsEnabled(): boolean {
  return window._paq !== undefined;
}

/**
 * Push an AnalyticsEvent to Matomo
 */
export function track(event: AnalyticsEvent): void {
  if (!analyticsEnabled()) return;
  const { name, value } = event as { name?: string; value?: number };
  window._paq!.push(["trackEvent", event.category, event.action, name, value]);
}

/**
 * Track a Matomo pageview for the current SPA route.
 */
export function trackSpaPageView(): void {
  if (!analyticsEnabled()) return;
  window._paq!.push(["setCustomUrl", window.location.href]);
  window._paq!.push(["setDocumentTitle", document.title]);
  window._paq!.push(["trackPageView"]);
}

/**
 * Fire a Matomo pageview on every SPA route change.
 *
 * Dedupe on the last-tracked URL to send exactly one pageview per distinct URL.
 * A navigate() URL_CHANGE_EVENT it more than once, so this stops double-counting.
 */
export function initSpaPageviews(): void {
  if (!analyticsEnabled()) return;
  let lastTrackedUrl = window.location.href;
  window.addEventListener(URL_CHANGE_EVENT, () => {
    if (window.location.href === lastTrackedUrl) return;
    lastTrackedUrl = window.location.href;
    trackSpaPageView();
  });
}
