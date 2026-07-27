import { afterEach, describe, expect, test } from "vitest";
import {
  track,
  trackSpaPageView,
  initSpaPageviews,
} from "@/analytics/matomo";
import { URL_CHANGE_EVENT } from "@/services/navigation";

// track() guards on window._paq, which initMatomo only creates when analytics
// is configured. These tests drive that guard by setting/clearing _paq directly.
afterEach(() => {
  delete window._paq;
});

describe("track", () => {
  test("pushes the trackEvent tuple when analytics is enabled", () => {
    window._paq = [];
    track({ category: "Search", action: "Sort Changed", name: "newest" });
    expect(window._paq).toEqual([
      ["trackEvent", "Search", "Sort Changed", "newest", undefined],
    ]);
  });

  test("no-ops (no push, no throw) when analytics is disabled", () => {
    expect(window._paq).toBeUndefined();
    expect(() =>
      track({ category: "Search", action: "Sort Changed", name: "newest" }),
    ).not.toThrow();
    expect(window._paq).toBeUndefined();
  });
});

describe("trackSpaPageView", () => {
  test("pushes custom URL, title, and pageview when enabled", () => {
    window._paq = [];
    trackSpaPageView();
    expect(window._paq).toEqual([
      ["setCustomUrl", window.location.href],
      ["setDocumentTitle", document.title],
      ["trackPageView"],
    ]);
  });

  test("no-ops when analytics is disabled", () => {
    expect(() => trackSpaPageView()).not.toThrow();
    expect(window._paq).toBeUndefined();
  });
});

const pageViews = () =>
  (window._paq ?? []).filter((cmd) => cmd[0] === "trackPageView");

describe("initSpaPageviews", () => {
  // Seeds lastTrackedUrl on the current URL and adds a single URL_CHANGE_EVENT
  // listener (called once, as in main.tsx), so the burst-dedupe holds.
  test("fires one pageview per distinct URL, deduping the navigate() burst", () => {
    history.replaceState(null, "", "/hpv");
    window._paq = [];
    initSpaPageviews();

    // navigate() emits URL_CHANGE_EVENT more than once for a single navigation.
    history.pushState(null, "", "/hpv/visualise");
    window.dispatchEvent(new Event(URL_CHANGE_EVENT));
    window.dispatchEvent(new Event(URL_CHANGE_EVENT));
    expect(pageViews()).toHaveLength(1);

    // A genuinely different URL fires another.
    history.pushState(null, "", "/hpv/references/1");
    window.dispatchEvent(new Event(URL_CHANGE_EVENT));
    expect(pageViews()).toHaveLength(2);
  });

  test("no-ops when analytics is disabled", () => {
    expect(() => initSpaPageviews()).not.toThrow();
    expect(window._paq).toBeUndefined();
  });
});
