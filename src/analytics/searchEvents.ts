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

// Stable analytics keys for the filters active in a committed set: one per
// concept scheme (its uri, since schemes have no separate id), plus "country"
// and "year-range" when set. One `Filters / Applied` event is emitted per key,
// so counting by key gives "top filters".
export function activeFilterKeys(
  filters: AppliedFilters,
  schemes: ConceptScheme[],
): string[] {
  const keys = [...parseConceptFilters(filters.conceptFilters, schemes).keys()];
  if (filters.countryCodes.length > 0) keys.push("country");
  if (filters.startYear !== undefined || filters.endYear !== undefined) {
    keys.push("year-range");
  }
  return keys;
}
