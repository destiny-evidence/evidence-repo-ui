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
  onChange: (next: ConceptSchemeFilterState) => void;
}

interface ConceptItemProps {
  concept: Concept;
  state: ConceptSchemeFilterState;
  index: ConceptIndex;
  onChange: (next: ConceptSchemeFilterState) => void;
}

function ConceptItem({ concept, state, index, onChange }: ConceptItemProps) {
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
      </label>
      {hasChildren && (
        <ul class="concept-scheme-filter__children">
          {concept.narrower!.map((child) => (
            <ConceptItem
              key={child.uri}
              concept={child}
              state={state}
              index={index}
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
          onChange={onChange}
        />
      ))}
    </ul>
  );
}
