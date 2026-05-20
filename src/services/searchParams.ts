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
  // Lucene query fragments (e.g. `linked_data_concepts:"URI_A" OR linked_data_concepts:"URI_B"`)
  // that are AND-joined into q when calling the backend. Embedded inside the
  // q URL param via joinQueryAndFacets / splitFacetsFromQuery so links stay shareable.
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

// Anchored to end-of-string so we only peel off facets that joinQueryAndFacets
// appended. Restricted to `linked_data_concepts:` fragments so a user-typed
// trailing " AND (...)" isn't misread as a facet. `[^)]+` assumes facet
// fragments don't contain ')' — true for the URI form we emit.
const TRAILING_FACET_RE = /\s+AND\s+\((linked_data_concepts:[^)]+)\)\s*$/;

export function splitFacetsFromQuery(rawQ: string): { q: string; facets: string[] } {
  let q = rawQ;
  const facets: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = TRAILING_FACET_RE.exec(q)) !== null) {
    facets.push(match[1]);
    q = q.slice(0, match.index);
  }
  facets.reverse();
  q = q.trim();
  // `* AND (facet)` round-trips back to q="" so the * shim stays canonical
  // on both sides of the URL boundary.
  if (q === "*" && facets.length > 0) q = "";
  return { q, facets };
}

export function joinQueryAndFacets(q: string, facets: string[]): string {
  if (facets.length === 0) return q;
  const head = q === "" ? "*" : q;
  const tail = facets.map((f) => `(${f})`).join(" AND ");
  return `${head} AND ${tail}`;
}

// Lucene fragment wrapping/unwrapping for the `linked_data_concepts` keyword
// field. Each value goes between the quotes — callers pass URIs (resolved
// from SKOS prefLabels at the UI layer) here. The string layer doesn't know
// whether values are labels or URIs; it just wraps and unwraps.
export function valuesToFacet(values: string[]): string {
  return values
    .map((v) => v.trim())
    .filter((v) => v !== "")
    .map((v) => `linked_data_concepts:"${v}"`)
    .join(" OR ");
}

export function facetToValues(fragment: string): string[] {
  const re = /linked_data_concepts:"([^"]*)"/g;
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(fragment)) !== null) {
    out.push(match[1]);
  }
  return out;
}

export function parseSearchParams(search: string): SearchParams {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );

  const rawQ = (params.get("q") ?? "").trim();
  const { q, facets: searchFacets } = splitFacetsFromQuery(rawQ);

  const pageRaw = parseDecimalInt(params.get("page"));
  const page = pageRaw !== undefined && pageRaw >= 1 ? pageRaw : 1;

  let startYear = parseYear(params.get("start_year"));
  let endYear = parseYear(params.get("end_year"));
  if (startYear !== undefined && endYear !== undefined && startYear > endYear) {
    startYear = undefined;
    endYear = undefined;
  }

  const sort = parseSort(params.get("sort"));

  return { q, page, startYear, endYear, sort, searchFacets };
}

export function toQueryString(params: SearchParams): string {
  const out = new URLSearchParams();
  const combinedQ = joinQueryAndFacets(params.q, params.searchFacets);
  if (combinedQ) out.set("q", combinedQ);
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
  if (params.searchFacets.length > 0) filters.searchFacets = params.searchFacets;
  const query = params.q.trim() === "" ? "*" : params.q;
  return { query, filters };
}
