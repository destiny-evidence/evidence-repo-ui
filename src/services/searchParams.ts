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
  // One `concept=` URL param per inner array; URIs in an array are OR'd
  // (must share a sibling set), arrays are AND'd.
  conceptFilters: readonly (readonly string[])[];
  // ISO-3166 alpha-2. Translated to Lucene `linked_data_countries:` clauses
  // at the API boundary since the backend has no structured country filter.
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
    const uris = raw.split(",").map((s) => s.trim()).filter((s) => s !== "");
    if (uris.length > 0) conceptFilters.push(uris);
  }

  // Upper-case + strip mirrors the backend's normalisation, so hand-edited
  // URLs with lower-case codes still match the right rows.
  const countryCodes: string[] = [];
  for (const raw of params.getAll("country")) {
    const code = raw.trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(code)) countryCodes.push(code);
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
  for (const code of params.countryCodes) out.append("country", code);
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

// "*" substitution satisfies the backend's `min_length=1` constraint when
// the user hasn't typed anything and has no country filter.
export function toExportSearchQuery(
  params: SearchParams,
  annotations: string[] | undefined,
): {
  query: string;
  filters: Omit<SearchFilters, "page">;
} {
  const filters: Omit<SearchFilters, "page"> = {
    startYear: params.startYear,
    endYear: params.endYear,
    annotation: annotations,
  };
  if (params.sort !== undefined) filters.sort = [SORT_BACKEND[params.sort]];
  if (params.conceptFilters.length > 0) {
    filters.conceptFilters = params.conceptFilters;
  }
  const query = buildLuceneQuery(params.q, params.countryCodes) || "*";
  return { query, filters };
}

// Base is paren-wrapped because Lucene binds AND tighter than OR:
// `a OR b AND (f)` would parse as `a OR (b AND (f))`. Empty base → `*`.
export function buildLuceneQuery(
  q: string,
  countryCodes: readonly string[],
): string {
  const trimmed = q.trim();
  if (countryCodes.length === 0) return trimmed;
  const base = trimmed === "" ? "*" : `(${trimmed})`;
  const countryClause = countryCodes
    .map((c) => `linked_data_countries:${c}`)
    .join(" OR ");
  return `${base} AND (${countryClause})`;
}
