import type { AppliedFilters } from "@/components/filters/useFilterDraft";
import { parseConceptFilters } from "@/components/filters/conceptSchemeFilterState";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";
import type { SearchParams } from "@/services/searchParams";

// True when the user has actually searched or filtered — as opposed to a plain
// browse landing (no query, no filters), which is already a pageview and would
// otherwise dominate the "Search Performed" metric.
export function hasActiveSearch(params: SearchParams): boolean {
  return (
    params.q !== "" ||
    params.conceptFilters.length > 0 ||
    params.countryCodes.length > 0 ||
    params.startYear !== undefined ||
    params.endYear !== undefined
  );
}

// The filters active in a committed search, at both granularities we track:
// `values` is the specific selections (each concept uri, each country code, and
// "year-range" when set — a range has no enumerable value), feeding one
// `Filters / Applied` event each; `categories` is the facet each belongs to (the
// concept scheme uri, since schemes have no separate id, plus "country" and
// "year-range"), feeding one `Filters / Category Applied` event each. Both are
// emitted because Matomo can't roll values up to their category itself. Concept
// uris outside any supplied scheme are dropped from both.
export function activeFilters(
  filters: AppliedFilters,
  schemes: ConceptScheme[],
): { values: string[]; categories: string[] } {
  const values: string[] = [];
  const categories: string[] = [];

  for (const [schemeUri, uris] of parseConceptFilters(filters.conceptFilters, schemes)) {
    categories.push(schemeUri);
    values.push(...uris);
  }
  if (filters.countryCodes.length > 0) {
    categories.push("country");
    values.push(...filters.countryCodes);
  }
  if (filters.startYear !== undefined || filters.endYear !== undefined) {
    categories.push("year-range");
    values.push("year-range");
  }

  return { values, categories };
}
