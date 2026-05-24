import { useEffect, useId, useRef, useState } from "preact/hooks";
import { FilterCard } from "./FilterCard";
import { ConceptSchemeFilter } from "./ConceptSchemeFilter";
import {
  emptyConceptSchemeState,
  parseFacets,
  summary,
  toSearchFacet,
  type ConceptSchemeFilterState,
} from "./conceptSchemeFilterState";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";
import "./FilterDrawer.css";

interface FilterDrawerProps {
  open: boolean;
  schemes: ConceptScheme[];
  appliedFacets: string[];
  onApply: (next: string[]) => void;
  onCancel: () => void;
}

type Draft = Map<string, ConceptSchemeFilterState>;

// Serialise the drawer's per-scheme draft back into the wire format expected
// by SearchParams.searchFacets — one entry per scheme that has at least one
// concept selected.
function draftToFacets(
  draft: Draft,
  schemes: ConceptScheme[],
): string[] {
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

export function FilterDrawer({
  open,
  schemes,
  appliedFacets,
  onApply,
  onCancel,
}: FilterDrawerProps) {
  const [draft, setDraft] = useState<Draft>(() =>
    parseFacets(appliedFacets, schemes),
  );
  const panelRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const titleId = useId();

  // Reset draft from URL on each open, and capture pre-open focus.
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement;
    setDraft(parseFacets(appliedFacets, schemes));
  }, [open, appliedFacets, schemes]);

  // Lock body scroll while the modal is up;
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Focus the dialog panel itself on open (it carries tabindex=-1)
  // Restore focus to wherever it was on close.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    return () => {
      const target = previousFocusRef.current;
      if (target instanceof HTMLElement) target.focus();
    };
  }, [open]);

  // Escape dismisses the drawer (treated as Cancel).
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

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
          <h2 id={titleId} class="filter-drawer__title">
            Filters
          </h2>
        </header>

        <div class="filter-drawer__body">
          {schemes.map((scheme) => {
            const state = draft.get(scheme.uri) ?? emptyConceptSchemeState();
            return (
              <FilterCard
                key={scheme.uri}
                title={scheme.label}
                summary={summary(state)}
              >
                <ConceptSchemeFilter
                  scheme={scheme}
                  state={state}
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
            Reset
          </button>
          <div class="filter-drawer__footer-spacer" />
          <button
            type="button"
            class="filter-drawer__btn filter-drawer__btn--cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            class="filter-drawer__btn filter-drawer__btn--apply"
            onClick={handleApply}
            disabled={!dirty}
          >
            Update Results
          </button>
        </footer>
      </aside>
    </div>
  );
}
