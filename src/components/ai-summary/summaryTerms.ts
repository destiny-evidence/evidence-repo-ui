import type { SearchParams } from "@/services/searchParams";

/**
 * The terms a summary is framed around, drawn from the current search: the
 * free-text query (when set) plus the labels of any applied concept filters —
 * the subjects the summary intersects. A map cell arrives as concept filters
 * with no free-text query, so resolving them to labels is what gives a
 * map-driven summary its terms. Country and year filters are scoping
 * constraints rather than subjects, so they're excluded (they still scope
 * which references are summarised).
 */
export function deriveSummaryTerms(
  params: SearchParams,
  labels: Map<string, string> | null,
): string[] {
  const queryTerm =
    params.q !== "" && params.q !== "*" ? [params.q] : [];
  const conceptTerms = params.conceptFilters
    .flat()
    .map((uri) => labels?.get(uri) ?? uri);
  return [...queryTerm, ...conceptTerms];
}
