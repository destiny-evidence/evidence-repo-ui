import type { SearchResult } from "@/types/models";

export const RESULTS_PER_PAGE = 20;

// Fallback for repositories predating `page.max_result_window`; drop when that
// field is guaranteed.
const DEFAULT_MAX_RESULT_WINDOW = 10000;

// How many results the backend will serve, for pagination and for anything that
// has to enumerate the whole match set.
export function resultWindow(result: SearchResult | null): number {
  return result?.page.max_result_window ?? DEFAULT_MAX_RESULT_WINDOW;
}

export function browsablePageCount(result: SearchResult | null): number {
  if (!result) return 1;
  // Clamp to the window before dividing: the window bounds the results that can
  // be reached, not the pages, so dividing it alone would offer 500 every time.
  const reachable = Math.min(result.total.count, resultWindow(result));
  return Math.max(1, Math.ceil(reachable / RESULTS_PER_PAGE));
}

// True when matches were found that pagination cannot reach, so the honest
// total needs explaining rather than just displaying.
export function exceedsResultWindow(result: SearchResult | null): boolean {
  return result !== null && result.total.count > resultWindow(result);
}
