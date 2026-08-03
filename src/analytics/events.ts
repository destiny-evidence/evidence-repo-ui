export type AnalyticsEventPayload = { name?: string; value?: number };

// Typed Matomo custom events, discriminated on `category` + `action`.
export type AnalyticsEvent =
  | { category: "Search"; action: "Sort Changed"; name: string }
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
