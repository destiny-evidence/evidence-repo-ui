export type AnalyticsEventPayload = { name?: string; value?: number };

// Typed Matomo custom events, discriminated on `category` + `action`.
export type AnalyticsEvent =
  | { category: "Search"; action: "Sort Changed"; name: string }
  | { category: "Enrichment"; action: "Request Coding Clicked"; name: string }
  | { category: "Enrichment"; action: "Request Coding Shown"; name: string };
