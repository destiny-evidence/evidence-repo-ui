import { useId, useMemo, useState } from "preact/hooks";
import { Tooltip } from "../common/Tooltip";
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
  onToggleExpand: (uri: string) => void;
  onChange: (next: ConceptSchemeFilterState) => void;
}

const countFormatter = new Intl.NumberFormat();

function formatCount(n: number): string {
  return countFormatter.format(n);
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
  onToggleExpand,
  onChange,
}: ConceptItemProps) {
  const childrenId = useId();
  const hasDefinition = !!concept.definition;
  const labelClass = hasDefinition
    ? "concept-scheme-filter__label concept-scheme-filter__label--has-tooltip"
    : "concept-scheme-filter__label";
  const labelNode = (
    <span class={labelClass} tabIndex={hasDefinition ? 0 : undefined}>
      {concept.label}
    </span>
  );
  const hasChildren = !!concept.narrower && concept.narrower.length > 0;
  const rawCount = counts?.get(concept.uri);
  // Once a response has arrived, a concept missing from it has 0 matches
  // (standard terms aggregation omits 0-buckets). Key on `counts != null`
  // alone so previously-greyed rows stay greyed through a refetch.
  const count: number | undefined =
    rawCount !== undefined ? rawCount : counts != null ? 0 : undefined;
  const selected = isSelected(state, concept.uri);
  // 0 + unselected = guaranteed-empty pick → disable. 0 + selected stays
  // enabled so the user can un-tick a no-op filter.
  const isEmpty = count === 0 && !selected;
  const showCountBadge = count !== undefined && count > 0;
  const rowClass = `concept-scheme-filter__row${
    isEmpty ? " concept-scheme-filter__row--empty" : ""
  }`;
  // Parent counts are a toggle preview for that concept alone — they don't
  // roll up children — which is non-obvious enough to spell out on hover.
  // Except on ancestor-closed communities (the collapsible case), where the
  // parent's count does cover its subtree and the caveat doesn't apply.
  const countTooltip =
    hasChildren && !collapsible
      ? "Results you'd see if you toggled this concept."
      : undefined;
  const countClass = `concept-scheme-filter__count${
    countsLoading ? " is-updating" : ""
  }${countTooltip ? " concept-scheme-filter__count--parent" : ""}`;
  const countNode = showCountBadge && (
    <span
      class={countClass}
      aria-label={`${formatCount(count)} ${countNoun}`}
      tabIndex={countTooltip ? 0 : undefined}
    >
      {formatCount(count)}
    </span>
  );
  const isExpanded = expanded.has(concept.uri);
  // Collapsed subtrees unmount rather than hide: checked state lives in
  // `state`, not the DOM, and Destiny-size schemes render hundreds of rows.
  const showChildren = hasChildren && (!collapsible || isExpanded);
  // A collapsed branch can hide a checked descendant; mark the parent so the
  // active filter stays visible. Checked wins over mixed when both apply.
  const hidesCheckedDescendant =
    collapsible && !isExpanded && checkedAncestors.has(concept.uri);
  const rowNode = (
    <label class={rowClass}>
      <input
        class="concept-scheme-filter__checkbox"
        type="checkbox"
        checked={selected}
        indeterminate={hidesCheckedDescendant && !selected}
        disabled={isEmpty}
        onChange={() => onChange(toggleConcept(state, concept))}
      />
      {hasDefinition ? (
        <Tooltip text={concept.definition}>{labelNode}</Tooltip>
      ) : (
        labelNode
      )}
      {countNode && (
        <span class="concept-scheme-filter__count-slot">
          {countTooltip ? (
            <Tooltip text={countTooltip}>{countNode}</Tooltip>
          ) : (
            countNode
          )}
        </span>
      )}
    </label>
  );
  return (
    <li class="concept-scheme-filter__item">
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
    <ul class="concept-scheme-filter">
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
          onToggleExpand={toggleExpand}
          onChange={onChange}
        />
      ))}
    </ul>
  );
}
