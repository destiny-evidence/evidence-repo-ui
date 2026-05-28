import { useMemo } from "preact/hooks";
import { Tooltip } from "../Tooltip";
import {
  buildConceptIndex,
  isSelected,
  toggleConcept,
  type ConceptIndex,
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
  onChange: (next: ConceptSchemeFilterState) => void;
}

interface ConceptItemProps {
  concept: Concept;
  state: ConceptSchemeFilterState;
  index: ConceptIndex;
  counts: ReadonlyMap<string, number> | null;
  countsLoading: boolean;
  onChange: (next: ConceptSchemeFilterState) => void;
}

const countFormatter = new Intl.NumberFormat();

function formatCount(n: number): string {
  return countFormatter.format(n);
}

function ConceptItem({
  concept,
  state,
  index,
  counts,
  countsLoading,
  onChange,
}: ConceptItemProps) {
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
  const count = counts?.get(concept.uri);
  const selected = isSelected(state, concept.uri);
  // Backend now returns toggle-semantic counts for every sibling, including
  // 0-buckets. A 0 on an unselected row means "selecting this would give 0
  // results" — disable to prevent a guaranteed-empty pick. A 0 on a selected
  // row means "un-selecting this wouldn't change your results" — leave it
  // enabled so the user can act on the signal. `count === undefined` covers
  // both the initial load and any concept the backend didn't return a bucket
  // for; we render those the same as today (no badge, no styling change).
  const isEmpty = count === 0 && !selected;
  const showCountBadge = count !== undefined && !isEmpty;
  const rowClass = `concept-scheme-filter__row${
    isEmpty ? " concept-scheme-filter__row--empty" : ""
  }`;
  const countClass = `concept-scheme-filter__count${
    countsLoading ? " is-updating" : ""
  }${hasChildren ? " concept-scheme-filter__count--parent" : ""}`;
  const countTooltip = hasChildren
    ? "Results you'd see if you toggled this concept. Selecting a parent includes all narrower concepts."
    : undefined;
  const countNode = showCountBadge && (
    <span
      class={countClass}
      aria-label={`${formatCount(count)} investigations`}
      tabIndex={hasChildren ? 0 : undefined}
    >
      {formatCount(count)}
    </span>
  );
  return (
    <li class="concept-scheme-filter__item">
      <label class={rowClass}>
        <input
          class="concept-scheme-filter__checkbox"
          type="checkbox"
          checked={selected}
          disabled={isEmpty}
          onChange={() => onChange(toggleConcept(state, concept, index))}
        />
        {hasDefinition ? (
          <Tooltip text={concept.definition}>{labelNode}</Tooltip>
        ) : (
          labelNode
        )}
        {countNode &&
          (countTooltip ? (
            <Tooltip text={countTooltip}>{countNode}</Tooltip>
          ) : (
            countNode
          ))}
      </label>
      {hasChildren && (
        <ul class="concept-scheme-filter__children">
          {concept.narrower!.map((child) => (
            <ConceptItem
              key={child.uri}
              concept={child}
              state={state}
              index={index}
              counts={counts}
              countsLoading={countsLoading}
              onChange={onChange}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ConceptSchemeFilter({
  scheme,
  state,
  counts = null,
  countsLoading = false,
  onChange,
}: ConceptSchemeFilterProps) {
  const index = useMemo(() => buildConceptIndex(scheme), [scheme]);
  return (
    <ul class="concept-scheme-filter">
      {scheme.topConcepts.map((concept) => (
        <ConceptItem
          key={concept.uri}
          concept={concept}
          state={state}
          index={index}
          counts={counts}
          countsLoading={countsLoading}
          onChange={onChange}
        />
      ))}
    </ul>
  );
}
