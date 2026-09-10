import { searchReferenceIds, type SearchFilters } from "@/services/apiClient";
import type { SelectionRequest } from "@/hooks/useReferenceSelection";

// Resolve a selection to concrete ids. `include` is already explicit; `all`
// needs the search's full id set, minus the exclusions.
export async function resolveSelectedReferenceIds(
  request: SelectionRequest,
  query: string | undefined,
  filters: Omit<SearchFilters, "page">,
  signal?: AbortSignal,
): Promise<string[]> {
  if (request.mode === "include") return request.ids;
  const { reference_ids, total } = await searchReferenceIds(query, filters, signal);
  // Exclusions over a capped list resolve the wrong set, not a short one. A
  // lower-bound count is how a server predating exact totals reports the cap.
  if (total.is_lower_bound || reference_ids.length < total.count) {
    throw new Error(
      "More references match than can be listed, so this selection can't be "
      + "resolved. Refine the search, or select references individually.",
    );
  }
  const excluded = new Set(request.excludedIds);
  return reference_ids.filter((id) => !excluded.has(id));
}
