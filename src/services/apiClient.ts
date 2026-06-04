import { api } from "@/api/client";
import type {
  Reference,
  ReferenceCrossFacetResult,
  ReferenceFacetResult,
  SearchExportRead,
  SearchResult,
} from "@/types/models";

export type FacetType = "concepts" | "countries";

export interface SearchFilters {
  page?: number;
  startYear?: number;
  endYear?: number;
  annotation?: string[];
  sort?: string[];
  // One `concept=` URL param per inner array; URIs in an array are OR'd
  // (must share a sibling set in the vocab), arrays are AND'd.
  conceptFilters?: readonly (readonly string[])[];
  // ISO-3166 alpha-2 codes; comma-joined into a single `country=` param. The
  // facet endpoint accepts only one OR'd country filter, which this satisfies.
  countryCodes?: readonly string[];
}

// Mirrors parseSearchParams: page must be >= 1, years > 0, all safe integers.
// Defends the API boundary against NaN/Infinity/floats from programmatic callers.
function isPositiveSafeInt(n: number | undefined): n is number {
  return n !== undefined && Number.isSafeInteger(n) && n >= 1;
}

// concept and country are always serialised together — one `concept=` per
// sibling group, one `country=` for the OR'd codes. Extend here when the
// backend grows another structured filter (e.g. `country_wb_region=`).
function appendStructuredFilters(
  params: URLSearchParams,
  filters: Pick<SearchFilters, "conceptFilters" | "countryCodes">,
): void {
  for (const group of filters.conceptFilters ?? []) {
    if (group.length > 0) params.append("concept", group.join(","));
  }
  if (filters.countryCodes?.length) {
    params.append("country", filters.countryCodes.join(","));
  }
}

type SharedFilterFields = "startYear" | "endYear" | "annotation" | "conceptFilters" | "countryCodes";

function buildSharedSearchParams(
  query: string | undefined,
  filters: Pick<SearchFilters, SharedFilterFields>,
): URLSearchParams {
  const normalizedQuery = query?.trim();
  // Browse-mode shim: empty q would produce "(q) AND ..." on the backend,
  // which is an invalid Lucene query. "*" is match-anything.
  // See destiny-repository/app/domain/references/services/search_service.py:101-102
  const effectiveQuery = normalizedQuery ? normalizedQuery : "*";

  const params = new URLSearchParams();
  params.set("q", effectiveQuery);
  if (isPositiveSafeInt(filters.startYear)) params.set("start_year", String(filters.startYear));
  if (isPositiveSafeInt(filters.endYear)) params.set("end_year", String(filters.endYear));
  for (const a of filters.annotation ?? []) params.append("annotation", a);
  appendStructuredFilters(params, filters);
  return params;
}

export async function searchReferences(
  query: string | undefined,
  filters: SearchFilters = {},
): Promise<SearchResult> {
  const params = buildSharedSearchParams(query, filters);
  if (isPositiveSafeInt(filters.page)) params.set("page", String(filters.page));
  for (const s of filters.sort ?? []) params.append("sort", s);
  return api.get<SearchResult>(`/v1/references/search/?${params.toString()}`);
}

export async function searchReferenceFacets(
  query: string | undefined,
  filters: Pick<SearchFilters, SharedFilterFields>,
  facets: FacetType[],
  options: { vocabularyUrl?: string } = {},
): Promise<ReferenceFacetResult> {
  const params = buildSharedSearchParams(query, filters);
  for (const f of facets) params.append("facet", f);
  // `vocabulary=` is what triggers sibling-aware aggregation; only required
  // when concept filters are active.
  if (options.vocabularyUrl && filters.conceptFilters?.length) {
    params.set("vocabulary", options.vocabularyUrl);
  }
  return api.get<ReferenceFacetResult>(
    `/v1/references/search/facets/?${params.toString()}`,
  );
}

// Cross-tabulates two axes over the references matching the search, for evidence
// maps. Same filters as searchReferences; build `axes` with axisPairToParams.
export async function crossFacets(
  query: string | undefined,
  filters: Pick<SearchFilters, SharedFilterFields>,
  axes: { axes: readonly [string, string]; vocabularyUrl?: string },
): Promise<ReferenceCrossFacetResult> {
  const params = buildSharedSearchParams(query, filters);
  // Repeated `axes=` param, in order — the backend reads it as a 2-tuple.
  for (const axis of axes.axes) params.append("axes", axis);
  if (axes.vocabularyUrl) params.set("vocabulary", axes.vocabularyUrl);
  return api.get<ReferenceCrossFacetResult>(
    `/v1/references/search/cross-facets/?${params.toString()}`,
  );
}

// Unlike searchReferences, no empty-q → "*" shim: the export endpoint is
// gated at the search page (button disabled when q is empty), and an
// explicit "*" from the user is forwarded as-is.
export async function requestSearchExport(
  query: string,
  filters: Omit<SearchFilters, "page"> = {},
): Promise<SearchExportRead> {
  const params = new URLSearchParams();
  params.set("q", query.trim());
  if (isPositiveSafeInt(filters.startYear)) params.set("start_year", String(filters.startYear));
  if (isPositiveSafeInt(filters.endYear)) params.set("end_year", String(filters.endYear));
  for (const a of filters.annotation ?? []) params.append("annotation", a);
  for (const s of filters.sort ?? []) params.append("sort", s);
  appendStructuredFilters(params, filters);
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
