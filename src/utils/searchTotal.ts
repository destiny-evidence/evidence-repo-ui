import type { SearchResultTotal } from "@/types/models";

// The backend counts matches exactly; is_lower_bound marks the cases where it
// couldn't (a search timeout), so render "N+" rather than understating N.
export function formatTotal(total: SearchResultTotal): string {
  return `${total.count.toLocaleString()}${total.is_lower_bound ? "+" : ""}`;
}
