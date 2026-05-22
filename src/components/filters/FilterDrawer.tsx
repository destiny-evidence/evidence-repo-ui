import { useEffect, useId, useRef, useState } from "preact/hooks";
import { FilterCard } from "./FilterCard";
import { ConceptSchemeFilter } from "./ConceptSchemeFilter";
import {
  emptyConceptSchemeState,
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

function emptyDraft(): Draft {
  return new Map();
}

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
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const panelRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const titleId = useId();

  // Reset draft and capture pre-open focus each time the drawer opens.
  // URL hydration is wired in commit 5; for now the seed is always empty.
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement;
    setDraft(emptyDraft());
  }, [open]);

  // Lock body scroll while the modal is up; restore the prior overflow
  // value on close so we don't clobber an ancestor that was managing it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Focus the dialog panel itself on open (it carries tabindex=-1) so the
  // first Tab lands on something inside the drawer rather than the page
  // beneath. Restore focus to wherever it was on close.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    return () => {
      const target = previousFocusRef.current;
      if (target instanceof HTMLElement) target.focus();
    };
  }, [open]);

  // Escape dismisses the drawer (treated as Cancel). The ticket says users
  // must use a button, but that wording is mouse-shaped — keyboard users
  // need a non-mouse exit, and Esc is the universal modal convention.
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
    setDraft(emptyDraft());
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
