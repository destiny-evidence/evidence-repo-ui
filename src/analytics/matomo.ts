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
