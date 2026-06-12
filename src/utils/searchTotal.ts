import type { SearchResultTotal } from "@/types/models";

// ES caps deep pagination at 10k; when the true count exceeds that, the backend
// returns is_lower_bound=true and count=10000. Render "10,000+" so the UI
// doesn't understate the size.
export function formatTotal(total: SearchResultTotal): string {
  return `${total.count.toLocaleString()}${total.is_lower_bound ? "+" : ""}`;
}
