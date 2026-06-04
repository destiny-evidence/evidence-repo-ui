import { Tooltip } from "../Tooltip";
import {
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
  onChange: (next: ConceptSchemeFilterState) => void;
}

interface ConceptItemProps {
  concept: Concept;
  state: ConceptSchemeFilterState;
  counts: ReadonlyMap<string, number> | null;
  countsLoading: boolean;
  countNoun: string;
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
  const countClass = `concept-scheme-filter__count${
    countsLoading ? " is-updating" : ""
  }${hasChildren ? " concept-scheme-filter__count--parent" : ""}`;
  // Parent counts are a toggle preview for that concept alone — they don't roll
  // up children — which is non-obvious enough to spell out on hover.
  const countTooltip = hasChildren
    ? "Results you'd see if you toggled this concept."
    : undefined;
  const countNode = showCountBadge && (
    <span
      class={countClass}
      aria-label={`${formatCount(count)} ${countNoun}`}
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
          onChange={() => onChange(toggleConcept(state, concept))}
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
              counts={counts}
              countsLoading={countsLoading}
              countNoun={countNoun}
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
  countNoun = "results",
  onChange,
}: ConceptSchemeFilterProps) {
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
          onChange={onChange}
        />
      ))}
    </ul>
  );
}
