export type AnalyticsEventPayload = { name?: string; value?: number };

// Typed Matomo custom events, discriminated on `category` + `action`.
export type AnalyticsEvent =
  | { category: "Search"; action: "Sort Changed"; name: string };
