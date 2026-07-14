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
  const { reference_ids } = await searchReferenceIds(query, filters, signal);
  const excluded = new Set(request.excludedIds);
  return reference_ids.filter((id) => !excluded.has(id));
}
