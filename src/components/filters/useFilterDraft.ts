import { useMemo, useState } from "preact/hooks";
import { useSearchFacets, type FacetCounts } from "@/hooks/useSearchFacets";
import type { SearchParams } from "@/services/searchParams";
import type { CrossFacetAxisPair } from "@/services/crossFacets";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";
import {
  emptyConceptSchemeState,
  parseConceptFilters,
  toConceptFilterGroups,
  type ConceptSchemeFilterState,
} from "./conceptSchemeFilterState";
import {
  countryStateFromCodes,
  emptyCountryState,
  selectedCodes,
  type CountryFilterState,
} from "./countryFilterState";
import {
  validate as validateYearRange,
  isYearInputReady,
  emptyYearRangeState,
  isDirty as isYearDirty,
  yearRangeFromParams,
  type ValidationResult,
  type YearRangeFilterState,
} from "./yearRangeFilterState";

// The filter selections committed to the URL — emitted by "Show results".
export interface AppliedFilters {
  conceptFilters: readonly (readonly string[])[];
  countryCodes: readonly string[];
  startYear: number | undefined;
  endYear: number | undefined;
}

type ConceptDraft = Map<string, ConceptSchemeFilterState>;

export interface FilterDraft {
  schemes: ConceptScheme[] | null;
  countryDraft: CountryFilterState;
  yearDraft: YearRangeFilterState;
  onSchemeChange: (scheme: ConceptScheme, next: ConceptSchemeFilterState) => void;
  setCountryDraft: (next: CountryFilterState) => void;
  setYearDraft: (next: YearRangeFilterState) => void;
  conceptStateFor: (scheme: ConceptScheme) => ConceptSchemeFilterState;
  yearValidation: ValidationResult;
  facetCounts: FacetCounts | null;
  facetCountsLoading: boolean;
  facetError: Error | null;
  reset: () => void;
  // True when the draft differs from what's applied (year errors count as dirty).
  dirty: boolean;
  // dirty AND the year range is valid — gates "Show results".
  canApply: boolean;
  // The applied selection, or null when the year range is invalid.
  buildApplied: () => AppliedFilters | null;
}

// What a filter surface needs to seed its draft.
export interface FilterDraftInputs {
  // Null when the vocabulary is unavailable — applied concept filters then
  // pass through untouched, since nothing can show or edit them.
  schemes: ConceptScheme[] | null;
  appliedConceptFilters: readonly (readonly string[])[];
  appliedCountryCodes: readonly string[];
  appliedStartYear: number | undefined;
  appliedEndYear: number | undefined;
  // Drives the facet-count fetch alongside the draft — the source of truth for
  // q / annotations. Owned by the page hosting the filters.
  params: SearchParams;
  axes?: CrossFacetAxisPair;
}

function draftToConceptFilters(
  draft: ConceptDraft,
  schemes: ConceptScheme[],
): string[][] {
  const groups: string[][] = [];
  for (const scheme of schemes) {
    const state = draft.get(scheme.uri);
    if (!state || state.size === 0) continue;
    for (const group of toConceptFilterGroups(state, scheme)) {
      groups.push(group);
    }
  }
  return groups;
}

function codeArraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const seen = new Set(a);
  for (const x of b) if (!seen.has(x)) return false;
  return true;
}

// Order-insensitive: backend OR's within a group and AND's between groups,
// so neither ordering is load-bearing for dirty-checking.
function conceptFiltersEqual(
  a: readonly (readonly string[])[],
  b: readonly (readonly string[])[],
): boolean {
  if (a.length !== b.length) return false;
  const canon = (g: readonly string[]) => [...g].sort().join("\n");
  const seen = new Set(a.map(canon));
  for (const g of b) if (!seen.has(canon(g))) return false;
  return true;
}

/**
 * Owns the draft filter state (concepts / countries / year range), the eager
 * facet-count fetch that previews the draft, and the reset / dirty / apply
 * derivations. Shared by the search drawer and the evidence-map config panel so
 * both drive filters identically.
 *
 * Seeded from the applied filters once, on mount, never re-read: hosts remount
 * it whenever the applied filters or schemes change — without the schemes, the
 * applied concept filters parse to nothing.
 */
export function useFilterDraft({
  schemes,
  appliedConceptFilters,
  appliedCountryCodes,
  appliedStartYear,
  appliedEndYear,
  params,
  axes,
}: FilterDraftInputs): FilterDraft {
  const [conceptDraft, setConceptDraft] = useState<ConceptDraft>(() =>
    parseConceptFilters(appliedConceptFilters, schemes ?? []),
  );
  // State rather than the applied value itself so "Reset all" can clear them.
  const [opaqueConceptFilters, setOpaqueConceptFilters] =
    useState(appliedConceptFilters);
  const [countryDraft, setCountryDraft] = useState<CountryFilterState>(() =>
    countryStateFromCodes(appliedCountryCodes),
  );
  const [yearDraft, setYearDraft] = useState<YearRangeFilterState>(() =>
    yearRangeFromParams(appliedStartYear, appliedEndYear),
  );

  const draftConceptFilters = useMemo(
    () =>
      schemes === null
        ? opaqueConceptFilters
        : draftToConceptFilters(conceptDraft, schemes),
    [conceptDraft, schemes, opaqueConceptFilters],
  );
  const draftCountryCodes = useMemo(
    () => selectedCodes(countryDraft),
    [countryDraft],
  );
  const yearValidation = useMemo(() => validateYearRange(yearDraft), [yearDraft]);

  // Only feed each year into the preview fetch when its input is "ready"
  // (empty or a complete 4-digit year) — partial typing like "20" shouldn't
  // trigger a refetch per keystroke.
  const startReady = isYearInputReady(yearDraft.start);
  const endReady = isYearInputReady(yearDraft.end);
  const facetParams: SearchParams = {
    ...params,
    conceptFilters: draftConceptFilters,
    countryCodes: draftCountryCodes,
    startYear:
      yearValidation.ok && startReady ? yearValidation.startYear : appliedStartYear,
    endYear:
      yearValidation.ok && endReady ? yearValidation.endYear : appliedEndYear,
  };
  const {
    counts: facetCounts,
    loading: facetCountsLoading,
    error: facetError,
  } = useSearchFacets(facetParams, axes);

  function onSchemeChange(
    scheme: ConceptScheme,
    next: ConceptSchemeFilterState,
  ) {
    setConceptDraft((prev) => {
      const updated = new Map(prev);
      if (next.size === 0) updated.delete(scheme.uri);
      else updated.set(scheme.uri, next);
      return updated;
    });
  }

  function conceptStateFor(scheme: ConceptScheme): ConceptSchemeFilterState {
    return conceptDraft.get(scheme.uri) ?? emptyConceptSchemeState();
  }

  function reset() {
    setConceptDraft(new Map());
    setOpaqueConceptFilters([]);
    setCountryDraft(emptyCountryState());
    setYearDraft(emptyYearRangeState());
  }

  const facetsDirty =
    !codeArraysEqual(draftCountryCodes, appliedCountryCodes) ||
    !conceptFiltersEqual(draftConceptFilters, appliedConceptFilters);
  const yearDirty = isYearDirty(yearDraft, appliedStartYear, appliedEndYear);
  const dirty = facetsDirty || yearDirty;
  const canApply = dirty && yearValidation.ok;

  function buildApplied(): AppliedFilters | null {
    if (!yearValidation.ok) return null;
    return {
      conceptFilters: draftConceptFilters,
      countryCodes: draftCountryCodes,
      startYear: yearValidation.startYear,
      endYear: yearValidation.endYear,
    };
  }

  return {
    schemes,
    countryDraft,
    yearDraft,
    onSchemeChange,
    setCountryDraft,
    setYearDraft,
    conceptStateFor,
    yearValidation,
    facetCounts,
    facetCountsLoading,
    facetError,
    reset,
    dirty,
    canApply,
    buildApplied,
  };
}
