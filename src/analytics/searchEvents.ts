import type { AppliedFilters } from "@/components/filters/useFilterDraft";
import {
  indexConceptPaths,
  parseConceptFilters,
} from "@/components/filters/conceptSchemeFilterState";
import {
  schemeDisplayLabel,
  type ConceptScheme,
} from "@/services/vocabulary/vocabularyService";
import { countryName } from "@/utils/country";
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

// Concept values carry their whole branch, root first, so a nested concept says
// where it sits.
const PATH_SEPARATOR = " > ";

// The filters active in a committed search, at both granularities we track:
// `values` is the specific selections — each concept's path, each country, and
// the `start-end` year range — feeding one `Applied` event each; `categories` is
// the facet each belongs to (the concept scheme, plus "Country" and "Year
// range"), feeding one `Category Applied` event each.
export function activeFilters(
  filters: AppliedFilters,
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
      values.push(conceptPaths.get(uri)?.join(PATH_SEPARATOR) ?? uri);
    }
  }
  if (filters.countryCodes.length > 0) {
    categories.push("Country");
    values.push(...filters.countryCodes.map(countryName));
  }
  if (filters.startYear !== undefined || filters.endYear !== undefined) {
    categories.push("Year range");
    values.push(`${filters.startYear ?? ""}-${filters.endYear ?? ""}`);
  }

  return { values, categories };
}
