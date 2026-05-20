import { api } from "@/api/client";
import { joinQueryAndFacets } from "@/services/searchParams";
import type { Reference, SearchExportRead, SearchResult } from "@/types/models";

export interface SearchFilters {
  page?: number;
  startYear?: number;
  endYear?: number;
  annotation?: string[];
  sort?: string[];
  // Lucene fragments AND-joined onto q before the request is built.
  // See joinQueryAndFacets for the wrapping convention.
  searchFacets?: string[];
}

// Mirrors parseSearchParams: page must be >= 1, years > 0, all safe integers.
// Defends the API boundary against NaN/Infinity/floats from programmatic callers.
function isPositiveSafeInt(n: number | undefined): n is number {
  return n !== undefined && Number.isSafeInteger(n) && n >= 1;
}

export async function searchReferences(
  query: string | undefined,
  filters: SearchFilters = {},
): Promise<SearchResult> {
  const normalizedQuery = query?.trim() ?? "";
  // Browse-mode shim: empty q would produce "(q) AND ..." on the backend,
  // which is an invalid Lucene query. "*" is match-anything. joinQueryAndFacets
  // applies the same shim when facets are present without a user query.
  // See destiny-repository/app/domain/references/services/search_service.py:101-102
  const effectiveQuery =
    joinQueryAndFacets(normalizedQuery, filters.searchFacets ?? []) || "*";

  const params = new URLSearchParams();
  params.set("q", effectiveQuery);
  if (isPositiveSafeInt(filters.page)) params.set("page", String(filters.page));
  if (isPositiveSafeInt(filters.startYear)) params.set("start_year", String(filters.startYear));
  if (isPositiveSafeInt(filters.endYear)) params.set("end_year", String(filters.endYear));
  for (const a of filters.annotation ?? []) params.append("annotation", a);
  for (const s of filters.sort ?? []) params.append("sort", s);
  return api.get<SearchResult>(`/v1/references/search/?${params.toString()}`);
}

// Same q + facet joining as searchReferences. The search page still gates
// the button when both q and searchFacets are empty, but the * shim here
// covers programmatic callers and facet-only exports.
export async function requestSearchExport(
  query: string,
  filters: Omit<SearchFilters, "page"> = {},
): Promise<SearchExportRead> {
  const effectiveQuery =
    joinQueryAndFacets(query.trim(), filters.searchFacets ?? []) || "*";

  const params = new URLSearchParams();
  params.set("q", effectiveQuery);
  if (isPositiveSafeInt(filters.startYear)) params.set("start_year", String(filters.startYear));
  if (isPositiveSafeInt(filters.endYear)) params.set("end_year", String(filters.endYear));
  for (const a of filters.annotation ?? []) params.append("annotation", a);
  for (const s of filters.sort ?? []) params.append("sort", s);
  return api.post<SearchExportRead>(
    `/v1/references/search/exports/?${params.toString()}`,
    undefined,
  );
}

export async function getSearchExport(id: string): Promise<SearchExportRead> {
  return api.get<SearchExportRead>(
    `/v1/references/search/exports/${encodeURIComponent(id)}/`,
  );
}

export async function getReference(id: string): Promise<Reference | null> {
  const results = await api.get<Reference[]>(
    `/v1/references/?identifier=${encodeURIComponent(id)}`,
  );
  return results[0] ?? null;
}
