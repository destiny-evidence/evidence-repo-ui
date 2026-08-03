export type AnalyticsEventPayload = { name?: string; value?: number };

// Typed Matomo custom events, discriminated on `category` + `action`. Matomo
// carries only a string `name` and numeric `value` beyond the two labels, and
// both are generic slots — so each variant notes what they hold.
export type AnalyticsEvent =
  // name: sort key (relevance | newest | oldest)
  | { category: "Search"; action: "Sort Changed"; name: string }
  // name: results | no-results · value: result count
  | { category: "Search"; action: "Performed"; name: string; value: number }
  // value: page navigated to
  | { category: "Search"; action: "Page Changed"; value: number }
  // value: active filter count when opened
  | { category: "Filters"; action: "Drawer Opened"; value: number }
  // name: filter key (concept-scheme uri | country | year-range); one per active filter
  | { category: "Filters"; action: "Applied"; name: string }
  | { category: "Filters"; action: "Reset All" }
  // name: select | deselect
  | { category: "Selection"; action: "Toggled"; name: string }
  // value: selected count after selecting all
  | { category: "Selection"; action: "Select All"; value: number }
  // value: selected count that was cleared
  | { category: "Selection"; action: "Cleared"; value: number }
  // value: 1-based result rank
  | { category: "Record"; action: "Opened"; value?: number }
  | { category: "Record"; action: "DOI Clicked" }
  // name: reference_id, value: coded concepts on the record
  | {
      category: "Enrichment";
      action: "Request Coding Shown";
      name: string;
      value: number;
    }
  // name: reference_id, value: coded concepts on the record
  | {
      category: "Enrichment";
      action: "Request Coding Clicked";
      name: string;
      value: number;
    };
