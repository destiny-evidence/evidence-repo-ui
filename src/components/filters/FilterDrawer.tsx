import { useEffect, useId, useMemo, useRef, useState } from "preact/hooks";
import { FilterCard } from "./FilterCard";
import { ConceptSchemeFilter } from "./ConceptSchemeFilter";
import {
  emptyConceptSchemeState,
  parseConceptFilters,
  summary,
  toConceptFilterGroups,
  type ConceptSchemeFilterState,
} from "./conceptSchemeFilterState";
import { useSearchFacets } from "@/hooks/useSearchFacets";
import type { SearchParams } from "@/services/searchParams";
import { CountryFilter } from "./CountryFilter";
import {
  countryStateFromCodes,
  emptyCountryState,
  selectedCodes,
  summary as countrySummary,
  type CountryFilterState,
} from "./countryFilterState";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";
import "./FilterDrawer.css";

export interface AppliedFilters {
  conceptFilters: readonly (readonly string[])[];
  countryCodes: readonly string[];
}

interface FilterDrawerProps {
  open: boolean;
  schemes: ConceptScheme[];
  appliedConceptFilters: readonly (readonly string[])[];
  appliedCountryCodes: readonly string[];
  // Drives the facet-count fetch alongside the draft. Owned by SearchPage as
  // the source of truth for q / years / annotations.
  params: SearchParams;
  onApply: (next: AppliedFilters) => void;
  onCancel: () => void;
}

type Draft = Map<string, ConceptSchemeFilterState>;

// Serialise the concept draft into the structured `conceptFilters` shape:
// for each scheme that has at least one selection, emit one or more
// sibling-set groups via `toConceptFilterGroups`. The flat result is ordered
// by scheme order, then preorder within each scheme — stable URLs.
function draftToConceptFilters(
  draft: Draft,
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

// Order-insensitive equality on country code arrays.
function codeArraysEqual(
  a: readonly string[],
  b: readonly string[],
): boolean {
  if (a.length !== b.length) return false;
  const seen = new Set(a);
  for (const x of b) if (!seen.has(x)) return false;
  return true;
}

// Order-insensitive equality on structured concept filters. Two filter arrays
// are equivalent if they contain the same set of sibling-groups, and each
// group contains the same URIs (order within a group is incidental — backend
// OR's them; order between groups is incidental — backend AND's them).
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
  appliedConceptFilters,
  appliedCountryCodes,
  params,
  onApply,
  onCancel,
}: FilterDrawerPanelProps) {
  const [draft, setDraft] = useState<Draft>(() =>
    parseConceptFilters(appliedConceptFilters, schemes),
  );
  const [countryDraft, setCountryDraft] = useState<CountryFilterState>(() =>
    countryStateFromCodes(appliedCountryCodes),
  );
  const panelRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<Element | null>(document.activeElement);
  const titleId = useId();

  const draftConceptFilters = useMemo(
    () => draftToConceptFilters(draft, schemes),
    [draft, schemes],
  );
  const draftCountryCodes = useMemo(
    () => selectedCodes(countryDraft),
    [countryDraft],
  );
  const facetParams: SearchParams = {
    ...params,
    conceptFilters: draftConceptFilters,
    countryCodes: draftCountryCodes,
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
  }

  function handleApply() {
    onApply({
      conceptFilters: draftConceptFilters,
      countryCodes: draftCountryCodes,
    });
  }

  const dirty =
    !codeArraysEqual(draftCountryCodes, appliedCountryCodes) ||
    !conceptFiltersEqual(draftConceptFilters, appliedConceptFilters);

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
          <FilterCard title="Country" summary={countrySummary(countryDraft)}>
            <CountryFilter
              state={countryDraft}
              onChange={setCountryDraft}
            />
          </FilterCard>
          {schemes.map((scheme) => {
            const state = draft.get(scheme.uri) ?? emptyConceptSchemeState();
            return (
              <FilterCard
                key={scheme.uri}
                title={schemeDisplayLabel(scheme.label)}
                summary={summary(state)}
              >
                <ConceptSchemeFilter
                  scheme={scheme}
                  state={state}
                  counts={facetCounts}
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
            disabled={!dirty}
          >
            Show results
          </button>
        </footer>
      </aside>
    </div>
  );
}
