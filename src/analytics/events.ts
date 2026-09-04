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
  // name: specific value (concept uri | country code | year-range); one per active value
  | { category: "Filters"; action: "Applied"; name: string }
  // name: category (concept-scheme uri | country | year-range); one per active category
  | { category: "Filters"; action: "Category Applied"; name: string }
  | { category: "Filters"; action: "Reset All" }
  // name: `${rowDim} x ${colDim}` — every view, defaults included: what gets
  // looked at, not what gets chosen.
  | { category: "EvidenceMap"; action: "Map Viewed"; name: string }
  // name: `${rowDim} x ${colDim}` — the pair switched to; only on a real change.
  | { category: "EvidenceMap"; action: "Axes Changed"; name: string }
  // name: specific value (concept uri | country code | year-range); one per active value
  | { category: "EvidenceMap"; action: "Filter Applied"; name: string }
  // name: category (concept-scheme uri | country | year-range); one per active category
  | { category: "EvidenceMap"; action: "Filter Category Applied"; name: string }
  // name: bubble | table
  | { category: "EvidenceMap"; action: "View Toggled"; name: string }
  // name: small | medium | large | xlarge
  | { category: "EvidenceMap"; action: "Cell Size Changed"; name: string }
  // name: `${rowValue} x ${columnValue}` — the cell's two axis values
  | { category: "EvidenceMap"; action: "Cell Clicked"; name: string }
  // name: axis value clicked in the header
  | { category: "EvidenceMap"; action: "Row Clicked"; name: string }
  | { category: "EvidenceMap"; action: "Column Clicked"; name: string }
  // name: panel (draft reset) | banner (over-filtered shortcut)
  | { category: "EvidenceMap"; action: "Reset All"; name: string }
  // name: over-filtered (nothing matches the filters) | no-coverage (matches
  // exist, but none carry a value on both axes)
  | { category: "EvidenceMap"; action: "No Coverage"; name: string }
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
    }
  // name: the format's menu label · value: references the export covers
  | { category: "Export"; action: "Requested"; name: string; value: number }
  | { category: "Export"; action: "Completed"; name: string; value: number }
  | { category: "Export"; action: "Error"; name: string; value: number }
  // name: resource title
  | { category: "Resources"; action: "Link Clicked"; name: string }
  | { category: "Feedback"; action: "FAB Clicked" }
  // name: Search | Visualise
  | { category: "Navigation"; action: "Tab Clicked"; name: string }
  // value: references the summary was asked for
  | { category: "AISummary"; action: "Generate Requested"; value: number }
  // value: ms from request to summary
  | { category: "AISummary"; action: "Completed"; value: number }
  // name: drawer | chip — which Cancel · value: ms waited before giving up
  | { category: "AISummary"; action: "Cancelled"; name: string; value: number }
  // value: ms from request to failure
  | { category: "AISummary"; action: "Error"; value: number }
  // name: button | close — the explicit action, or closing the drawer on a
  // running job, which backgrounds it rather than cancelling
  | { category: "AISummary"; action: "Run In Background"; name: string }
  // name: generating | done — whether the job had finished by the time they came
  // back for it.
  | { category: "AISummary"; action: "Reopened"; name: string }
  | { category: "AISummary"; action: "Downloaded" }
  | { category: "AISummary"; action: "Flagged" }
  | { category: "AISummary"; action: "Search Opened" };
