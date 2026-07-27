import type { AppliedFilters } from "@/components/filters/useFilterDraft";
import { parseConceptFilters } from "@/components/filters/conceptSchemeFilterState";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";

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
