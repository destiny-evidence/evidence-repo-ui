import { parseYear } from "@/utils/year";
import type { SearchFilters } from "@/services/apiClient";

export type SortOption = "newest" | "oldest";

// URL alias → backend ES-style `[-]field_name` wire format.
export const SORT_BACKEND: Record<SortOption, string> = {
  newest: "-publication_year",
  oldest: "publication_year",
};

export interface SearchParams {
  q: string;
  page: number;
  startYear: number | undefined;
  endYear: number | undefined;
  sort: SortOption | undefined;
  searchFacets: string[];
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

  const pageRaw = parseDecimalInt(params.get("page"));
  const page = pageRaw !== undefined && pageRaw >= 1 ? pageRaw : 1;

  let startYear = parseYear(params.get("start_year"));
  let endYear = parseYear(params.get("end_year"));
  if (startYear !== undefined && endYear !== undefined && startYear > endYear) {
    startYear = undefined;
    endYear = undefined;
  }

  const sort = parseSort(params.get("sort"));

  return { q, page, startYear, endYear, sort, searchFacets: [] };
}

export function toQueryString(params: SearchParams): string {
  const out = new URLSearchParams();
  if (params.q) out.set("q", params.q);
  if (params.startYear !== undefined) out.set("start_year", String(params.startYear));
  if (params.endYear !== undefined) out.set("end_year", String(params.endYear));
  if (params.sort !== undefined) out.set("sort", params.sort);
  if (params.page !== 1) out.set("page", String(params.page));
  return out.toString();
}

export function buildSearchUrl(communitySlug: string, params: SearchParams): string {
  const qs = toQueryString(params);
  return qs ? `/${communitySlug}?${qs}` : `/${communitySlug}`;
}

// Maps a SearchParams + community annotations to the query/filters shape the
// export endpoint expects. Substitutes "*" for an empty `q` so the backend's
// `min_length=1` constraint is satisfied for browse-mode and year-only
// exports.
export function toExportSearchQuery(
  params: SearchParams,
  annotations: string[] | undefined,
): { query: string; filters: Omit<SearchFilters, "page"> } {
  const filters: Omit<SearchFilters, "page"> = {
    startYear: params.startYear,
    endYear: params.endYear,
    annotation: annotations,
  };
  if (params.sort !== undefined) filters.sort = [SORT_BACKEND[params.sort]];
  const query = params.q.trim() === "" ? "*" : params.q;
  return { query, filters };
}

// Base is paren-wrapped because Lucene binds AND tighter than OR:
// `a OR b AND (f)` would parse as `a OR (b AND (f))`. Empty base → `*`.
export function buildFacetedQuery(q: string, facets: string[]): string {
  const trimmed = q.trim();
  if (facets.length === 0) return trimmed;
  const base = trimmed === "" ? "*" : `(${trimmed})`;
  return [base, ...facets.map((f) => `(${f})`)].join(" AND ");
}

const LDC_URI = /(linked_data_concepts:")([^"]+)(")/g;

export function expandFacets(facets: string[], vocabBase: string): string[] {
  return facets.map((f) =>
    f.replace(LDC_URI, (_, prefix, uri, suffix) =>
      uri.startsWith("http") ? `${prefix}${uri}${suffix}` : `${prefix}${vocabBase}${uri}${suffix}`,
    ),
  );
}

export function compactFacets(facets: string[], vocabBase: string): string[] {
  return facets.map((f) =>
    f.replace(LDC_URI, (_, prefix, uri, suffix) =>
      uri.startsWith(vocabBase) ? `${prefix}${uri.slice(vocabBase.length)}${suffix}` : `${prefix}${uri}${suffix}`,
    ),
  );
}
