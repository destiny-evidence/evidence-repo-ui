import { describe, it, expect } from "vitest";
import { browsablePageCount, exceedsResultWindow } from "@/utils/searchPages";
import type { SearchResult } from "@/types/models";

const WINDOW = 10000;
// Enough matches to exceed the window, so the clamp decides the page count.
const OVER_WINDOW_RESULTS = 20000;
const SERVABLE_PAGES = 500;

function result(
  count: number,
  page: Partial<SearchResult["page"]> = {},
): SearchResult {
  return {
    total: { count, is_lower_bound: false },
    page: { count: 20, number: 1, ...page },
    references: [],
  };
}

describe("browsablePageCount", () => {
  it("derives pages from the total when it fits inside the window", () => {
    expect(
      browsablePageCount(result(1000, { max_result_window: WINDOW })),
    ).toBe(50);
  });

  it("clamps to the window rather than offering a page per match", () => {
    expect(
      browsablePageCount(
        result(OVER_WINDOW_RESULTS, { max_result_window: WINDOW }),
      ),
    ).toBe(SERVABLE_PAGES);
  });

  it("divides the total, not the window, for a search well under it", () => {
    // Dividing the window alone would offer 500 pages for 167 matches.
    expect(browsablePageCount(result(167, { max_result_window: WINDOW }))).toBe(9);
  });

  it("reports a single page when nothing matched", () => {
    expect(browsablePageCount(result(0, { max_result_window: WINDOW }))).toBe(1);
  });

  it("assumes today's window when the API does not report one", () => {
    expect(browsablePageCount(result(1000))).toBe(50);
  });

  it("clamps to the assumed window when the API does not report one", () => {
    expect(browsablePageCount(result(OVER_WINDOW_RESULTS))).toBe(SERVABLE_PAGES);
  });

  it("reports a single page before any results arrive", () => {
    expect(browsablePageCount(null)).toBe(1);
  });

  it("follows the API if the backend widens its window", () => {
    expect(
      browsablePageCount(
        result(OVER_WINDOW_RESULTS, { max_result_window: OVER_WINDOW_RESULTS }),
      ),
    ).toBe(1000);
  });
});

describe("exceedsResultWindow", () => {
  it("is true when more matched than the backend will serve", () => {
    expect(
      exceedsResultWindow(
        result(OVER_WINDOW_RESULTS, { max_result_window: WINDOW }),
      ),
    ).toBe(true);
  });

  it("is false at exactly the window, where every match is still reachable", () => {
    expect(
      exceedsResultWindow(result(WINDOW, { max_result_window: WINDOW })),
    ).toBe(false);
  });

  it("is true one match past the window", () => {
    expect(
      exceedsResultWindow(result(WINDOW + 1, { max_result_window: WINDOW })),
    ).toBe(true);
  });

  it("is false for a search well inside the window", () => {
    expect(
      exceedsResultWindow(result(167, { max_result_window: WINDOW })),
    ).toBe(false);
  });

  it("is false when nothing matched", () => {
    expect(
      exceedsResultWindow(result(0, { max_result_window: WINDOW })),
    ).toBe(false);
  });

  it("compares against the assumed window when the API reports none", () => {
    expect(exceedsResultWindow(result(OVER_WINDOW_RESULTS))).toBe(true);
  });

  it("is false before any results arrive", () => {
    expect(exceedsResultWindow(null)).toBe(false);
  });

  // A repository predating the published window caps the count at 10,000 and
  // flags it as a lower bound. The total it shows ("10,000+") and the 500 pages
  // it offers already agree, so there is no gap to explain and this must stay
  // silent. Deliberate: it is what makes the UI safe to deploy first.
  it("is false for a legacy capped response, which explains itself via the + suffix", () => {
    const legacy: SearchResult = {
      total: { count: WINDOW, is_lower_bound: true },
      page: { count: 20, number: 1 },
      references: [],
    };
    expect(exceedsResultWindow(legacy)).toBe(false);
  });

  it("is false once the backend widens its window to cover the total", () => {
    expect(
      exceedsResultWindow(
        result(OVER_WINDOW_RESULTS, { max_result_window: OVER_WINDOW_RESULTS }),
      ),
    ).toBe(false);
  });
});
