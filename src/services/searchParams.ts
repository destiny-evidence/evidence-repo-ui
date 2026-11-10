import { parseYear } from "@/utils/year";
import type { SearchFilters, SharedSearchFilters } from "@/services/apiClient";
import { isWbRegionId } from "@/utils/wbRegion";
import { isWbIncomeGroupId } from "@/utils/wbIncomeGroup";

export type SortOption = "newest" | "oldest";

// URL alias → backend ES-style `[-]field_name` wire format.
export const SORT_BACKEND: Record<SortOption, string> = {
  newest: "-publication_year",
  oldest: "publication_year",
};

// Canonical machine name for a sort, including the undefined (relevance)
export function sortKey(sort: SortOption | undefined): string {
  return sort ?? "relevance";
}

// Resolves the `sort` array sent to the API. With no free-text query
// Elasticsearch scores every doc 1, so a "relevance" (undefined) sort
// produces arbitrary ordering. Fall back to `newest` in that case.
// This is deliberately invisible to the URL and the sort dropdown.
export function effectiveSortBackend(
  params: Pick<SearchParams, "q" | "sort">,
): string[] | undefined {
  if (params.sort !== undefined) return [SORT_BACKEND[params.sort]];
  if (params.q.trim() === "") return [SORT_BACKEND.newest];
  return undefined;
}

export interface SearchParams {
  q: string;
  page: number;
  startYear: number | undefined;
  endYear: number | undefined;
  sort: SortOption | undefined;
  // One `concept=` URL param per inner array; URIs in an array are OR'd
  // (one scheme's selected concepts), arrays are AND'd (across schemes).
  conceptFilters: readonly (readonly string[])[];
  countryCodes: readonly string[];
  wbRegionIds: readonly string[];
  wbIncomeGroupIds: readonly string[];
}

// Unknown values fall back to undefined (relevance).
export function parseSort(raw: string | null): SortOption | undefined {
  return raw === "newest" || raw === "oldest" ? raw : undefined;
}

// Strict: plain decimal digits only, safe integer range. Used here for `page`;
// year parsing goes through the shared `parseYear` (which adds the positive guard).
function parseDecimalInt(raw: string | null): number | undefined {
  if (raw === null || !/^\d+$/.test(raw)) return undefined;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : undefined;
}

// Comma-separated and repeated params flatten into one de-duplicated OR'd
// list. Upper-casing mirrors the backend's normalisation, so hand-edited
// lower-case codes still match.
function parseCodeList(
  params: URLSearchParams,
  name: string,
  accept: (code: string) => boolean,
): string[] {
  const codes = new Set<string>();
  for (const raw of params.getAll(name)) {
    for (const piece of raw.split(",")) {
      const code = piece.trim().toUpperCase();
      if (accept(code)) codes.add(code);
    }
  }
  return [...codes];
}

export function parseSearchParams(search: string): SearchParams {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );

  const q = (params.get("q") ?? "").trim();

  const conceptFilters: string[][] = [];
  for (const raw of params.getAll("concept")) {
    const uris = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "");
    if (uris.length > 0) conceptFilters.push(uris);
  }

  const countryCodes = parseCodeList(params, "country", (c) => /^[A-Z]{2}$/.test(c));
  // Unknown region and income group IDs are dropped rather than forwarded: the
  // backend rejects them.
  const wbRegionIds = parseCodeList(params, "country_wb_region", isWbRegionId);
  const wbIncomeGroupIds = parseCodeList(
    params,
    "country_wb_income_group",
    isWbIncomeGroupId,
  );

  const pageRaw = parseDecimalInt(params.get("page"));
  const page = pageRaw !== undefined && pageRaw >= 1 ? pageRaw : 1;

  let startYear = parseYear(params.get("start_year"));
  let endYear = parseYear(params.get("end_year"));
  if (startYear !== undefined && endYear !== undefined && startYear > endYear) {
    startYear = undefined;
    endYear = undefined;
  }

  const sort = parseSort(params.get("sort"));

  return {
    q,
    page,
    startYear,
    endYear,
    sort,
    conceptFilters,
    countryCodes,
    wbRegionIds,
    wbIncomeGroupIds,
  };
}

export function toQueryString(params: SearchParams): string {
  const out = new URLSearchParams();
  if (params.q) out.set("q", params.q);
  for (const group of params.conceptFilters) {
    if (group.length > 0) out.append("concept", group.join(","));
  }
  if (params.countryCodes.length > 0) {
    out.append("country", params.countryCodes.join(","));
  }
  if (params.wbRegionIds.length > 0) {
    out.append("country_wb_region", params.wbRegionIds.join(","));
  }
  if (params.wbIncomeGroupIds.length > 0) {
    out.append("country_wb_income_group", params.wbIncomeGroupIds.join(","));
  }
  if (params.startYear !== undefined)
    out.set("start_year", String(params.startYear));
  if (params.endYear !== undefined) out.set("end_year", String(params.endYear));
  if (params.sort !== undefined) out.set("sort", params.sort);
  if (params.page !== 1) out.set("page", String(params.page));
  return out.toString();
}

export function buildSearchUrl(
  communitySlug: string,
  params: SearchParams,
): string {
  const qs = toQueryString(params);
  return qs ? `/${communitySlug}?${qs}` : `/${communitySlug}`;
}

// history.state key set when a search result opens a record. Carries the search
// entry's own state too, so returning restores it (e.g. its Back to Visualise
// link). State (not a URL param) so a shared record link shows no back link.
const BACK_TO_SEARCH = "backToSearch";

export interface BackToSearch {
  url: string;
  state: unknown;
}

export function backToSearchState(
  url: string,
  state: unknown,
): Record<string, unknown> {
  return { [BACK_TO_SEARCH]: { url, state } };
}

// Reads the search to return to out of an opaque history.state, or null if absent.
export function backToSearchFromState(state: unknown): BackToSearch | null {
  if (!state || typeof state !== "object" || !(BACK_TO_SEARCH in state)) {
    return null;
  }
  const value = (state as Record<string, unknown>)[BACK_TO_SEARCH];
  if (!value || typeof value !== "object") return null;
  const { url, state: searchState } = value as Record<string, unknown>;
  if (typeof url !== "string") return null;
  return { url, state: searchState ?? null };
}

export type SearchFilterParams = Pick<
  SearchParams,
  | "conceptFilters"
  | "countryCodes"
  | "wbRegionIds"
  | "wbIncomeGroupIds"
  | "startYear"
  | "endYear"
>;

// True when anything beyond the free-text query narrows the search.
export function hasFilters(params: SearchFilterParams): boolean {
  return (
    params.conceptFilters.length > 0 ||
    params.countryCodes.length > 0 ||
    params.wbRegionIds.length > 0 ||
    params.wbIncomeGroupIds.length > 0 ||
    params.startYear !== undefined ||
    params.endYear !== undefined
  );
}

// The API filters for a search, shared by every search-style request. Hooks key
// their refetch on this object, so a field added here is forwarded and refetched
// everywhere at once.
export function toSearchFilters(
  params: SearchParams,
  annotations: string[] | undefined,
): SharedSearchFilters {
  return {
    startYear: params.startYear,
    endYear: params.endYear,
    annotation: annotations,
    conceptFilters: params.conceptFilters,
    countryCodes: params.countryCodes,
    wbRegionIds: params.wbRegionIds,
    wbIncomeGroupIds: params.wbIncomeGroupIds,
  };
}

// Maps a SearchParams + community annotations to the query/filters shape the
// whole-result-set endpoints expect (export, reference-id search) — i.e. minus
// pagination. Substitutes "*" for an empty browse-mode query so the backend's
// `min_length=1` constraint is satisfied.
export function toUnpaginatedSearchQuery(
  params: SearchParams,
  annotations: string[] | undefined,
): { query: string; filters: Omit<SearchFilters, "page"> } {
  const filters: Omit<SearchFilters, "page"> = toSearchFilters(params, annotations);
  const sort = effectiveSortBackend(params);
  if (sort !== undefined) filters.sort = sort;
  return { query: params.q.trim() || "*", filters };
}
