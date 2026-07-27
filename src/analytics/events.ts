export type AnalyticsEventPayload = { name?: string; value?: number };

// Typed Matomo custom events, discriminated on `category` + `action`.
export type AnalyticsEvent =
  | { category: "Search"; action: "Sort Changed"; name: string }
  | { category: "Search"; action: "Performed"; name: string; value: number }
  | { category: "Search"; action: "Page Changed"; value: number }
  | { category: "Filters"; action: "Drawer Opened"; value: number }
  | { category: "Filters"; action: "Applied"; name: string }
  | { category: "Filters"; action: "Reset All" }
  | { category: "Selection"; action: "Toggled"; name: string }
  | { category: "Selection"; action: "Select All"; value: number }
  | { category: "Selection"; action: "Cleared"; value: number }
  | { category: "Record"; action: "Opened"; value?: number }
  | { category: "Record"; action: "DOI Clicked" };
