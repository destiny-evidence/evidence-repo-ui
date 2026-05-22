import { useState } from "preact/hooks";
import { FilterCard } from "@/components/filters/FilterCard";
import { ConceptSchemeFilter } from "@/components/filters/ConceptSchemeFilter";
import {
  emptyConceptSchemeState,
  selectedCount,
  selectedUris,
  summary,
  toSearchFacet,
  type ConceptSchemeFilterState,
} from "@/components/filters/conceptSchemeFilterState";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";
import "./DevFiltersPage.css";

interface DevFiltersPageProps {
  path?: string;
}

// Slice of ESEA's OutcomeScheme used purely to exercise the filter
// components in isolation while the FilterDrawer is still under
// construction. Lives here rather than in tests/ to keep src/ self-contained.
const OUTCOME_SCHEME: ConceptScheme = {
  uri: "https://vocab.esea.education/OutcomeScheme",
  label: "Outcome",
  topConcepts: [
    {
      uri: "https://vocab.esea.education/OutcomeScheme/C00096",
      label: "Access to Education",
      narrower: [
        {
          uri: "https://vocab.esea.education/OutcomeScheme/C00097",
          label: "Education Finance",
          definition:
            "Outcomes covering the funding mechanisms that determine access to education.",
        },
        {
          uri: "https://vocab.esea.education/OutcomeScheme/C00098",
          label: "Enrolment and Attendance",
        },
      ],
    },
    {
      uri: "https://vocab.esea.education/OutcomeScheme/C00122",
      label: "Educational Outcomes and Learning",
    },
    {
      uri: "https://vocab.esea.education/OutcomeScheme/C00130",
      label: "Returns to Education",
    },
  ],
};

export function DevFiltersPage(_props: DevFiltersPageProps) {
  const [state, setState] = useState<ConceptSchemeFilterState>(
    emptyConceptSchemeState(),
  );
  return (
    <div class="dev-filters-page">
      <h1 class="dev-filters-page__title">Filter component sandbox</h1>
      <p class="dev-filters-page__intro">
        FilterCard + ConceptSchemeFilter wired against a trimmed slice of
        the ESEA OutcomeScheme. Toggle checkboxes and watch the live state
        below update.
      </p>

      <FilterCard title={OUTCOME_SCHEME.label} summary={summary(state)}>
        <ConceptSchemeFilter
          scheme={OUTCOME_SCHEME}
          state={state}
          onChange={setState}
        />
      </FilterCard>

      <section class="dev-filters-page__state">
        <h2 class="dev-filters-page__state-title">Live state</h2>
        <dl class="dev-filters-page__state-grid">
          <dt>selectedCount</dt>
          <dd>{selectedCount(state)}</dd>
          <dt>summary</dt>
          <dd>{summary(state) || <em>(empty)</em>}</dd>
          <dt>selectedUris</dt>
          <dd>
            <pre>{JSON.stringify(selectedUris(state), null, 2)}</pre>
          </dd>
          <dt>toSearchFacet</dt>
          <dd>
            <pre>
              {toSearchFacet(state, OUTCOME_SCHEME) || "(empty)"}
            </pre>
          </dd>
        </dl>
      </section>
    </div>
  );
}
