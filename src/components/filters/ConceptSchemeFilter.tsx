import { useId, useMemo, useState } from "preact/hooks";
import { ChevronDownIcon, ChevronRightIcon } from "@/components/common/icons";
import {
  ancestorUrisOf,
  defaultExpandedUris,
  isSelected,
  toggleConcept,
  type ConceptSchemeFilterState,
} from "./conceptSchemeFilterState";
import type {
  Concept,
  ConceptScheme,
} from "@/services/vocabulary/vocabularyService";
import { FilterOptionRow, resolveCount, useEverSelected } from "./FilterOptions";
import "./ConceptSchemeFilter.css";

interface ConceptSchemeFilterProps {
  scheme: ConceptScheme;
  state: ConceptSchemeFilterState;
  counts?: ReadonlyMap<string, number> | null;
  countsLoading?: boolean;
  countNoun?: string;
  // Collapse child lists behind their parents. Only safe on communities whose
  // codings are ancestor-closed — elsewhere a parent checkbox doesn't stand
  // for its children, so hiding them hides checkboxes users need.
  collapsible?: boolean;
  onChange: (next: ConceptSchemeFilterState) => void;
}

interface ConceptItemProps {
  concept: Concept;
  state: ConceptSchemeFilterState;
  counts: ReadonlyMap<string, number> | null;
  countsLoading: boolean;
  countNoun: string;
  collapsible: boolean;
  expanded: ReadonlySet<string>;
  checkedAncestors: ReadonlySet<string>;
  everSelected: ReadonlySet<string>;
  onToggleExpand: (uri: string) => void;
  onChange: (next: ConceptSchemeFilterState) => void;
}

function ConceptItem({
  concept,
  state,
  counts,
  countsLoading,
  countNoun,
  collapsible,
  expanded,
  checkedAncestors,
  everSelected,
  onToggleExpand,
  onChange,
}: ConceptItemProps) {
  const childrenId = useId();
  const hasChildren = !!concept.narrower && concept.narrower.length > 0;
  // Parent counts are a toggle preview for that concept alone — they don't
  // roll up children — which is non-obvious enough to spell out on hover.
  // Except on ancestor-closed communities (the collapsible case), where the
  // parent's count does cover its subtree and the caveat doesn't apply.
  const countTooltip =
    hasChildren && !collapsible
      ? "Results you'd see if you toggled this concept."
      : undefined;
  const isExpanded = expanded.has(concept.uri);
  // Collapsed subtrees unmount rather than hide: checked state lives in
  // `state`, not the DOM, and Destiny-size schemes render hundreds of rows.
  const showChildren = hasChildren && (!collapsible || isExpanded);
  // A collapsed branch can hide a checked descendant; mark the parent so the
  // active filter stays visible. Checked wins over mixed when both apply.
  const hidesCheckedDescendant =
    collapsible && !isExpanded && checkedAncestors.has(concept.uri);
  const rowNode = (
    <FilterOptionRow
      label={concept.label}
      labelTooltip={concept.definition || undefined}
      count={resolveCount(counts, concept.uri)}
      countTooltip={countTooltip}
      countsLoading={countsLoading}
      countNoun={countNoun}
      checked={isSelected(state, concept.uri)}
      indeterminate={hidesCheckedDescendant}
      everSelected={everSelected.has(concept.uri)}
      onToggle={() => onChange(toggleConcept(state, concept))}
    />
  );
  return (
    <li class="filter-options__item">
      {collapsible ? (
        <div class="concept-scheme-filter__row-group">
          {hasChildren ? (
            <button
              type="button"
              class="concept-scheme-filter__toggle"
              aria-expanded={isExpanded}
              aria-controls={isExpanded ? childrenId : undefined}
              aria-label={`Child concepts of ${concept.label}`}
              onClick={() => onToggleExpand(concept.uri)}
            >
              {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
            </button>
          ) : (
            <span
              class="concept-scheme-filter__toggle-spacer"
              aria-hidden="true"
            />
          )}
          {rowNode}
        </div>
      ) : (
        rowNode
      )}
      {showChildren && (
        <ul
          id={collapsible ? childrenId : undefined}
          class="concept-scheme-filter__children"
        >
          {concept.narrower!.map((child) => (
            <ConceptItem
              key={child.uri}
              concept={child}
              state={state}
              counts={counts}
              countsLoading={countsLoading}
              countNoun={countNoun}
              collapsible={collapsible}
              expanded={expanded}
              checkedAncestors={checkedAncestors}
              everSelected={everSelected}
              onToggleExpand={onToggleExpand}
              onChange={onChange}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

const NONE_EXPANDED: ReadonlySet<string> = new Set();

export function ConceptSchemeFilter({
  scheme,
  state,
  counts = null,
  countsLoading = false,
  countNoun = "results",
  collapsible = false,
  onChange,
}: ConceptSchemeFilterProps) {
  // Seeded once: every surface remounts this component when applied filters
  // change, so expansion never needs to follow `state` after mount.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() =>
    collapsible ? defaultExpandedUris(scheme, state) : NONE_EXPANDED,
  );

  const [everSelected, recordSelected] = useEverSelected(state);

  const handleChange = (next: ConceptSchemeFilterState) => {
    recordSelected(next);
    onChange(next);
  };

  const checkedAncestors = useMemo(
    () => (collapsible ? ancestorUrisOf(scheme, state) : NONE_EXPANDED),
    [collapsible, scheme, state],
  );

  const toggleExpand = (uri: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(uri)) next.add(uri);
      return next;
    });
  };

  return (
    <ul class="filter-options">
      {scheme.topConcepts.map((concept) => (
        <ConceptItem
          key={concept.uri}
          concept={concept}
          state={state}
          counts={counts}
          countsLoading={countsLoading}
          countNoun={countNoun}
          collapsible={collapsible}
          expanded={expanded}
          checkedAncestors={checkedAncestors}
          everSelected={everSelected}
          onToggleExpand={toggleExpand}
          onChange={handleChange}
        />
      ))}
    </ul>
  );
}
