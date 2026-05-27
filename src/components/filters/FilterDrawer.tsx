import { useEffect, useId, useMemo, useRef, useState } from "preact/hooks";
import { FilterCard } from "./FilterCard";
import { ConceptSchemeFilter } from "./ConceptSchemeFilter";
import {
  emptyConceptSchemeState,
  parseFacets,
  summary,
  toSearchFacet,
  type ConceptSchemeFilterState,
} from "./conceptSchemeFilterState";
import { useSearchFacets } from "@/hooks/useSearchFacets";
import type { SearchParams } from "@/services/searchParams";
import { CountryFilter } from "./CountryFilter";
import {
  emptyCountryState,
  parseFacets as parseCountryFacets,
  summary as countrySummary,
  toSearchFacet as countryToSearchFacet,
  type CountryFilterState,
} from "./countryFilterState";
import { YearRangeFilter } from "./YearRangeFilter";
import {
  commit as commitYearRange,
  emptyYearRangeState,
  isDirty as isYearDirty,
  summary as yearSummary,
  yearRangeFromParams,
  type YearRangeFilterState,
} from "./yearRangeFilterState";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";
import "./FilterDrawer.css";

export interface AppliedFilters {
  searchFacets: string[];
  startYear: number | undefined;
  endYear: number | undefined;
}

interface FilterDrawerProps {
  open: boolean;
  schemes: ConceptScheme[];
  appliedFacets: string[];
  appliedStartYear: number | undefined;
  appliedEndYear: number | undefined;
  // Drives the facet-count fetch alongside the draft. Owned by SearchPage as
  // the source of truth for q / annotations.
  params: SearchParams;
  onApply: (next: AppliedFilters) => void;
  onCancel: () => void;
}

type Draft = Map<string, ConceptSchemeFilterState>;

// Serialise both drafts back into the wire format expected by
// SearchParams.searchFacets — one entry per scheme that has at least one
// concept selected, plus one trailing entry for the country selection
// (if any). Country goes last so the URL form mirrors the on-screen order
// (country card first, then schemes) when read left-to-right after
// build-time stripping.
function draftToFacets(
  draft: Draft,
  schemes: ConceptScheme[],
  countryDraft: CountryFilterState,
): string[] {
  const facets: string[] = [];
  for (const scheme of schemes) {
    const state = draft.get(scheme.uri);
    if (!state || state.size === 0) continue;
    const facet = toSearchFacet(state, scheme);
    if (facet !== "") facets.push(facet);
  }
  const countryFacet = countryToSearchFacet(countryDraft);
  if (countryFacet !== "") facets.push(countryFacet);
  return facets;
}

// Order-insensitive set equality on facet strings. URL ordering of
// `searchFacets` is incidental — we don't want to flag the draft as dirty
// just because two schemes' fragments swapped position.
function facetsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const seen = new Set(a);
  for (const x of b) if (!seen.has(x)) return false;
  return true;
}

// Scheme labels arrive from the vocabulary as e.g. "Document Type Scheme" —
// the trailing word is implementation detail of the SKOS model and noise to
// the reader. Strip it (case-insensitive, only as a trailing whole word) for
// display in the drawer.
function schemeDisplayLabel(label: string): string {
  return label.replace(/\s+Scheme$/i, "");
}

// Gates hook execution on `open` — users who never refine don't fetch facets.
export function FilterDrawer({ open, ...rest }: FilterDrawerProps) {
  if (!open) return null;
  return <FilterDrawerPanel {...rest} />;
}

type FilterDrawerPanelProps = Omit<FilterDrawerProps, "open">;

function FilterDrawerPanel({
  schemes,
  appliedFacets,
  appliedStartYear,
  appliedEndYear,
  params,
  onApply,
  onCancel,
}: FilterDrawerPanelProps) {
  const [draft, setDraft] = useState<Draft>(() =>
    parseFacets(appliedFacets, schemes),
  );
  const [countryDraft, setCountryDraft] = useState<CountryFilterState>(() =>
    parseCountryFacets(appliedFacets),
  );
  const [yearDraft, setYearDraft] = useState<YearRangeFilterState>(() =>
    yearRangeFromParams(appliedStartYear, appliedEndYear),
  );
  const panelRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<Element | null>(document.activeElement);
  const titleId = useId();

  const draftFacets = useMemo(
    () => draftToFacets(draft, schemes, countryDraft),
    [draft, schemes, countryDraft],
  );
  const yearCommitted = useMemo(() => commitYearRange(yearDraft), [yearDraft]);
  // Feed the draft year range into the facet-count fetch when it's valid so
  // the eager preview narrows alongside the user's edits; fall back to the
  // applied URL values otherwise (parseSearchParams guarantees those are
  // self-consistent).
  const facetParams: SearchParams = {
    ...params,
    searchFacets: draftFacets,
    startYear: yearCommitted.ok ? yearCommitted.startYear : appliedStartYear,
    endYear: yearCommitted.ok ? yearCommitted.endYear : appliedEndYear,
  };
  const {
    counts: facetCounts,
    loading: facetCountsLoading,
    error: facetError,
  } = useSearchFacets(facetParams);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    panelRef.current?.focus();
    return () => {
      const target = previousFocusRef.current;
      if (target instanceof HTMLElement) target.focus();
    };
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  function onSchemeChange(
    scheme: ConceptScheme,
    next: ConceptSchemeFilterState,
  ) {
    setDraft((prev) => {
      const updated = new Map(prev);
      if (next.size === 0) updated.delete(scheme.uri);
      else updated.set(scheme.uri, next);
      return updated;
    });
  }

  function handleReset() {
    setDraft(new Map());
    setCountryDraft(emptyCountryState());
    setYearDraft(emptyYearRangeState());
  }

  function handleApply() {
    if (!yearCommitted.ok) return;
    onApply({
      searchFacets: draftToFacets(draft, schemes, countryDraft),
      startYear: yearCommitted.startYear,
      endYear: yearCommitted.endYear,
    });
  }

  const facetsDirty = !facetsEqual(
    draftToFacets(draft, schemes, countryDraft),
    appliedFacets,
  );
  const yearDirty = isYearDirty(yearDraft, appliedStartYear, appliedEndYear);
  const canApply = (facetsDirty || yearDirty) && yearCommitted.ok;

  return (
    <div class="filter-drawer" role="presentation">
      <div class="filter-drawer__backdrop" aria-hidden="true" />
      <aside
        ref={panelRef}
        class="filter-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header class="filter-drawer__header">
          <div class="filter-drawer__heading">
            <h2 id={titleId} class="filter-drawer__title">
              Refine the evidence
            </h2>
            {/* "*" is the browse-mode sentinel — don't echo it as a query. */}
            {params.q !== "" && params.q !== "*" && (
              <p class="filter-drawer__subtitle">Searching for “{params.q}”</p>
            )}
          </div>
          <button
            type="button"
            class="filter-drawer__btn filter-drawer__btn--cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
        </header>

        <div class="filter-drawer__body">
          {facetError && (
            <div class="filter-drawer__notice" role="status">
              Investigation counts unavailable.
            </div>
          )}
          <FilterCard title="Publication year" summary={yearSummary(yearDraft)}>
            <YearRangeFilter state={yearDraft} onChange={setYearDraft} />
          </FilterCard>
          <FilterCard title="Country" summary={countrySummary(countryDraft)}>
            <CountryFilter
              state={countryDraft}
              onChange={setCountryDraft}
            />
          </FilterCard>
          {schemes.map((scheme) => {
            const state = draft.get(scheme.uri) ?? emptyConceptSchemeState();
            // Counts intersect with selected concepts, so siblings of a
            // selection drop to ~0; hide per-scheme once anything's picked.
            const showCounts = state.size === 0 && facetCounts !== null;
            return (
              <FilterCard
                key={scheme.uri}
                title={schemeDisplayLabel(scheme.label)}
                summary={summary(state)}
              >
                <ConceptSchemeFilter
                  scheme={scheme}
                  state={state}
                  counts={showCounts ? facetCounts : null}
                  countsLoading={facetCountsLoading}
                  onChange={(next) => onSchemeChange(scheme, next)}
                />
              </FilterCard>
            );
          })}
        </div>

        <footer class="filter-drawer__footer">
          <button
            type="button"
            class="filter-drawer__btn filter-drawer__btn--reset"
            onClick={handleReset}
          >
            Reset all
          </button>
          <button
            type="button"
            class="filter-drawer__btn filter-drawer__btn--apply"
            onClick={handleApply}
            disabled={!canApply}
          >
            Show results
          </button>
        </footer>
      </aside>
    </div>
  );
}
