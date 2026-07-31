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

// Analytics keys for the filters this Apply newly added, relative to what was
// already committed. A key is "added" when its selection gains a value that
// wasn't there before — a new concept within a scheme (even one already
// filtered), a new country code, or a newly-set/changed year range — so
// refining an existing facet still registers while re-applying an unchanged set
// does not. One `Filters / Applied` event is emitted per key: a concept scheme
// by its uri (schemes have no separate id), plus "country" and "year-range".
export function addedFilterKeys(
  previous: AppliedFilters,
  next: AppliedFilters,
  schemes: ConceptScheme[],
): string[] {
  const keys: string[] = [];

  const before = parseConceptFilters(previous.conceptFilters, schemes);
  for (const [schemeUri, uris] of parseConceptFilters(next.conceptFilters, schemes)) {
    const prev = before.get(schemeUri);
    if ([...uris].some((uri) => !prev?.has(uri))) keys.push(schemeUri);
  }

  const beforeCountries = new Set(previous.countryCodes);
  if (next.countryCodes.some((code) => !beforeCountries.has(code))) {
    keys.push("country");
  }

  const yearSet = next.startYear !== undefined || next.endYear !== undefined;
  const yearChanged =
    next.startYear !== previous.startYear || next.endYear !== previous.endYear;
  if (yearSet && yearChanged) keys.push("year-range");

  return keys;
}
