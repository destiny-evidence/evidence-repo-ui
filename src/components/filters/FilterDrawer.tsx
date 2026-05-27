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
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";
import "./FilterDrawer.css";

interface FilterDrawerProps {
  open: boolean;
  schemes: ConceptScheme[];
  appliedFacets: string[];
  // Drives the facet-count fetch alongside the draft. Owned by SearchPage as
  // the source of truth for q / years / annotations.
  params: SearchParams;
  onApply: (next: string[]) => void;
  onCancel: () => void;
}

type Draft = Map<string, ConceptSchemeFilterState>;

// Serialise the drawer's per-scheme draft back into the wire format expected
// by SearchParams.searchFacets — one entry per scheme that has at least one
// concept selected.
function draftToFacets(draft: Draft, schemes: ConceptScheme[]): string[] {
  const facets: string[] = [];
  for (const scheme of schemes) {
    const state = draft.get(scheme.uri);
    if (!state || state.size === 0) continue;
    const facet = toSearchFacet(state, scheme);
    if (facet !== "") facets.push(facet);
  }
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

// Thin wrapper that gates rendering — and therefore hook execution — on
// `open`. Keeping the hooks inside FilterDrawerPanel means we don't fire the
// facet-count fetch (or any of the effects) until the drawer is actually
// opened, so users who never refine don't pay the network cost.
export function FilterDrawer({ open, ...rest }: FilterDrawerProps) {
  if (!open) return null;
  return <FilterDrawerPanel {...rest} />;
}

type FilterDrawerPanelProps = Omit<FilterDrawerProps, "open">;

function FilterDrawerPanel({
  schemes,
  appliedFacets,
  params,
  onApply,
  onCancel,
}: FilterDrawerPanelProps) {
  const [draft, setDraft] = useState<Draft>(() =>
    parseFacets(appliedFacets, schemes),
  );
  const panelRef = useRef<HTMLElement>(null);
  // Captured at mount (= drawer open). useRef's initial value runs once on
  // mount, so this snapshots the focused element at the moment the user
  // triggered open.
  const previousFocusRef = useRef<Element | null>(document.activeElement);
  const titleId = useId();

  // Eager facet counts: every toggle changes `draft`, which retriggers the
  // fetch via the hook's cache key.
  const draftFacets = useMemo(
    () => draftToFacets(draft, schemes),
    [draft, schemes],
  );
  const facetParams: SearchParams = {
    ...params,
    searchFacets: draftFacets,
  };
  const {
    counts: facetCounts,
    loading: facetCountsLoading,
    error: facetError,
  } = useSearchFacets(facetParams);

  // Lock body scroll while mounted; restore on unmount.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Focus the dialog panel itself on mount (it carries tabindex=-1).
  // Restore focus to wherever it was on unmount.
  useEffect(() => {
    panelRef.current?.focus();
    return () => {
      const target = previousFocusRef.current;
      if (target instanceof HTMLElement) target.focus();
    };
  }, []);

  // Escape dismisses the drawer (treated as Cancel).
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
  }

  function handleApply() {
    onApply(draftToFacets(draft, schemes));
  }

  const dirty = !facetsEqual(draftToFacets(draft, schemes), appliedFacets);

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
          {schemes.map((scheme) => {
            const state = draft.get(scheme.uri) ?? emptyConceptSchemeState();
            // Per-scheme suppression: once any concept in this scheme is
            // selected, the facet endpoint's counts become co-occurrence with
            // that selection (siblings show ~0). Hide counts for the scheme
            // until the user clears the selection.
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
            disabled={!dirty}
          >
            Show results
          </button>
        </footer>
      </aside>
    </div>
  );
}
