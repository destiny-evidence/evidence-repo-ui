import { afterEach, describe, expect, test } from "vitest";
import { track } from "@/analytics/matomo";

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
