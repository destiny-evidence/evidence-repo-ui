import {
  indexConceptPaths,
  parseConceptFilters,
} from "@/components/filters/conceptSchemeFilterState";
import {
  schemeDisplayLabel,
  type ConceptScheme,
} from "@/services/vocabulary/vocabularyService";
import { countryName } from "@/utils/country";
import { wbRegionName } from "@/utils/wbRegion";
import { hasFilters, type SearchParams } from "@/services/searchParams";
import type { Community } from "@/types/models";

// True when the user has actually searched or filtered — as opposed to a plain
// browse landing (no query, no filters), which is already a pageview and would
// otherwise dominate the "Search Performed" metric.
export function hasActiveSearch(params: SearchParams): boolean {
  return params.q !== "" || hasFilters(params);
}

// "· filtered" separates keywords that found nothing from ones the filters
// emptied. A community's own default filters don't count.
export function siteSearchCategory(
  community: Pick<Community, "slug" | "searchDefaults">,
  params: SearchParams,
): string {
  const endYear =
    params.endYear === community.searchDefaults?.endYear ? undefined : params.endYear;
  return hasFilters({ ...params, endYear }) ? `${community.slug} · filtered` : community.slug;
}

// Concept values carry their whole branch, root first, so a nested concept says
// where it sits.
const PATH_SEPARATOR = " > ";

/**
 * A concept's branch as analytics names it. `fallback` covers values the index
 * can't place — a country code, or a cell key the axis doesn't enumerate.
 * Shared with the evidence map so its clicks and its filters read alike.
 */
export function conceptPathName(
  paths: ReadonlyMap<string, string[]>,
  uri: string,
  fallback: string,
): string {
  return paths.get(uri)?.join(PATH_SEPARATOR) ?? fallback;
}

// The filters active in a committed search, at both granularities we track:
// `values` is the specific selections — each concept's path, each country, and
// the `start-end` year range — feeding one `Applied` event each; `categories` is
// the facet each belongs to (the concept scheme, plus "Country", "World Bank
// region" and "Year range"), feeding one `Category Applied` event each.
export function activeFilters(
  filters: Pick<
    SearchParams,
    "conceptFilters" | "countryCodes" | "wbRegionIds" | "startYear" | "endYear"
  >,
  schemes: ConceptScheme[],
): { values: string[]; categories: string[] } {
  const conceptPaths = indexConceptPaths(schemes);
  const values: string[] = [];
  const categories: string[] = [];

  for (const [schemeUri, uris] of parseConceptFilters(filters.conceptFilters, schemes)) {
    const scheme = schemes.find((s) => s.uri === schemeUri);
    // Neither lookup can miss — both read the schemes parseConceptFilters
    // matched against. The uri is filler to satisfy the types.
    categories.push(scheme ? schemeDisplayLabel(scheme.label) : schemeUri);
    for (const uri of uris) {
      values.push(conceptPathName(conceptPaths, uri, uri));
    }
  }
  if (filters.countryCodes.length > 0) {
    categories.push("Country");
    values.push(...filters.countryCodes.map(countryName));
  }
  if (filters.wbRegionIds.length > 0) {
    categories.push("World Bank region");
    values.push(...filters.wbRegionIds.map(wbRegionName));
  }
  if (filters.startYear !== undefined || filters.endYear !== undefined) {
    categories.push("Year range");
    values.push(`${filters.startYear ?? ""}-${filters.endYear ?? ""}`);
  }

  return { values, categories };
}
