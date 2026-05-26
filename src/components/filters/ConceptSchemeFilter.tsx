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

// Compact-locale notation (1234 → "1.2K", 1_500_000 → "1.5M"). Honours the
// browser locale via Intl rather than rolling our own k/M suffixes.
const compactFormatter = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatCount(n: number): string {
  return compactFormatter.format(n);
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
  const countClass = `concept-scheme-filter__count${
    countsLoading ? " is-updating" : ""
  }${hasChildren ? " concept-scheme-filter__count--parent" : ""}`;
  // Parent rows expose only the count for the parent URI itself (not a
  // rollup of descendants), which can confuse readers since clicking the
  // parent cascades into its subtree. Surface that semantic via a tooltip.
  const countTooltip = hasChildren
    ? "References tagged with this concept. Select to also include narrower concepts."
    : undefined;
  const countNode = count !== undefined && (
    <span
      class={countClass}
      aria-label={`${count} references`}
      tabIndex={hasChildren ? 0 : undefined}
    >
      {formatCount(count)}
    </span>
  );
  return (
    <li class="concept-scheme-filter__item">
      <label class="concept-scheme-filter__row">
        <input
          class="concept-scheme-filter__checkbox"
          type="checkbox"
          checked={isSelected(state, concept.uri)}
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
