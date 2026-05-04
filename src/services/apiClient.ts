import { api } from "@/api/client";
import type { Reference, SearchResult } from "@/types/models";
import type { SortOption } from "@/services/searchParams";

export interface SearchFilters {
  page?: number;
  startYear?: number;
  endYear?: number;
  annotation?: string[];
  sort?: string[];
}

// URL alias → backend ES-style `[-]field_name` wire format.
export const SORT_BACKEND: Record<SortOption, string> = {
  newest: "-publication_year",
  oldest: "publication_year",
};

// Mirrors parseSearchParams: page must be >= 1, years > 0, all safe integers.
// Defends the API boundary against NaN/Infinity/floats from programmatic callers.
function isPositiveSafeInt(n: number | undefined): n is number {
  return n !== undefined && Number.isSafeInteger(n) && n >= 1;
}

export async function searchReferences(
  query: string | undefined,
  filters: SearchFilters = {},
): Promise<SearchResult> {
  const normalizedQuery = query?.trim();
  // Browse-mode shim: empty q would produce "(q) AND ..." on the backend,
  // which is an invalid Lucene query. "*" is match-anything.
  // See destiny-repository/app/domain/references/services/search_service.py:101-102
  const effectiveQuery = normalizedQuery ? normalizedQuery : "*";

  const params = new URLSearchParams();
  params.set("q", effectiveQuery);
  if (isPositiveSafeInt(filters.page)) params.set("page", String(filters.page));
  if (isPositiveSafeInt(filters.startYear)) params.set("start_year", String(filters.startYear));
  if (isPositiveSafeInt(filters.endYear)) params.set("end_year", String(filters.endYear));
  for (const a of filters.annotation ?? []) params.append("annotation", a);
  for (const s of filters.sort ?? []) params.append("sort", s);
  return api.get<SearchResult>(`/v1/references/search/?${params.toString()}`);
}

export async function getReference(id: string): Promise<Reference | null> {
  const results = await api.get<Reference[]>(
    `/v1/references/?identifier=${encodeURIComponent(id)}`,
  );
  return results[0] ?? null;
}
