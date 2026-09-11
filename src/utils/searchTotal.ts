import type { SearchResultTotal } from "@/types/models";

// Renders "N+" for a count the backend reports as a floor rather than exact.
// A repository that counts exactly never sets that, so the suffix disappears.
export function formatTotal(total: SearchResultTotal): string {
  return `${total.count.toLocaleString()}${total.is_lower_bound ? "+" : ""}`;
}
