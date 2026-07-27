import { parseYear } from "@/utils/year";
import type { SearchFilters } from "@/services/apiClient";

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

  // Upper-case + strip mirrors the backend's normalisation, so hand-edited
  // URLs with lower-case codes still match the right rows.
  const countryCodes: string[] = [];
  for (const raw of params.getAll("country")) {
    for (const piece of raw.split(",")) {
      const code = piece.trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(code)) countryCodes.push(code);
    }
  }

  const pageRaw = parseDecimalInt(params.get("page"));
  const page = pageRaw !== undefined && pageRaw >= 1 ? pageRaw : 1;

  let startYear = parseYear(params.get("start_year"));
  let endYear = parseYear(params.get("end_year"));
  if (startYear !== undefined && endYear !== undefined && startYear > endYear) {
    startYear = undefined;
    endYear = undefined;
  }

  const sort = parseSort(params.get("sort"));

  return { q, page, startYear, endYear, sort, conceptFilters, countryCodes };
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

// Maps a SearchParams + community annotations to the query/filters shape the
// whole-result-set endpoints expect (export, reference-id search) — i.e. minus
// pagination. Substitutes "*" for an empty browse-mode query so the backend's
// `min_length=1` constraint is satisfied.
export function toUnpaginatedSearchQuery(
  params: SearchParams,
  annotations: string[] | undefined,
): { query: string; filters: Omit<SearchFilters, "page"> } {
  const filters: Omit<SearchFilters, "page"> = {
    startYear: params.startYear,
    endYear: params.endYear,
    annotation: annotations,
  };
  const sort = effectiveSortBackend(params);
  if (sort !== undefined) filters.sort = sort;
  if (params.conceptFilters.length > 0) {
    filters.conceptFilters = params.conceptFilters;
  }
  if (params.countryCodes.length > 0) {
    filters.countryCodes = params.countryCodes;
  }
  return { query: params.q.trim() || "*", filters };
}
