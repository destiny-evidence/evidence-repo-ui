import { afterEach, describe, expect, onTestFinished, test } from "vitest";
import {
  track,
  trackSpaPageView,
  initSpaPageviews,
} from "@/analytics/matomo";
import { URL_CHANGE_EVENT } from "@/services/navigation";

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

  test("carries a numeric value and omits name when absent", () => {
    window._paq = [];
    track({ category: "Search", action: "Page Changed", value: 3 });
    expect(window._paq).toEqual([
      ["trackEvent", "Search", "Page Changed", undefined, 3],
    ]);
  });

  test("carries both name and value", () => {
    window._paq = [];
    track({ category: "Search", action: "Performed", name: "no-results", value: 0 });
    expect(window._paq).toEqual([
      ["trackEvent", "Search", "Performed", "no-results", 0],
    ]);
  });

  test("label-only event pushes neither name nor value", () => {
    window._paq = [];
    track({ category: "Filters", action: "Reset All" });
    expect(window._paq).toEqual([
      ["trackEvent", "Filters", "Reset All", undefined, undefined],
    ]);
  });
});

describe("trackSpaPageView", () => {
  test("pushes custom URL, title, and pageview when enabled", () => {
    window._paq = [];
    trackSpaPageView();
    expect(window._paq).toEqual([
      ["setCustomUrl", window.location.origin + window.location.pathname],
      ["setDocumentTitle", document.title],
      ["trackPageView"],
    ]);
  });
});

const pageViews = () =>
  (window._paq ?? []).filter((cmd) => cmd[0] === "trackPageView");

describe("initSpaPageviews", () => {
  test("fires one pageview per distinct path", () => {
    history.replaceState(null, "", "/hpv");
    window._paq = [];
    const dispose = initSpaPageviews();
    onTestFinished(dispose);

    // navigate() emits URL_CHANGE_EVENT more than once for a single navigation.
    history.pushState(null, "", "/hpv/visualise");
    window.dispatchEvent(new Event(URL_CHANGE_EVENT));
    window.dispatchEvent(new Event(URL_CHANGE_EVENT));
    expect(pageViews()).toHaveLength(1);

    // A genuinely different path fires another.
    history.pushState(null, "", "/hpv/references/1");
    window.dispatchEvent(new Event(URL_CHANGE_EVENT));
    expect(pageViews()).toHaveLength(2);

    // A query-only change on the same path does not.
    history.pushState(null, "", "/hpv/references/1?tab=abstract");
    window.dispatchEvent(new Event(URL_CHANGE_EVENT));
    expect(pageViews()).toHaveLength(2);
  });
});

test.each([
  ["track", () => track({ category: "Search", action: "Sort Changed", name: "x" })],
  ["trackSpaPageView", trackSpaPageView],
  ["initSpaPageviews", initSpaPageviews],
])("%s no-ops when analytics is disabled", (_name, fn) => {
  expect(window._paq).toBeUndefined();
  expect(fn).not.toThrow();
  expect(window._paq).toBeUndefined();
});
