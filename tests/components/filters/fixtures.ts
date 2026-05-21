import type { ConceptScheme } from "@/components/filters/conceptSchemeFilterState";

// Trimmed slice of ESEA's OutcomeScheme — three top-level outcomes with
// real concept URIs from the published vocabulary, two narrower concepts
// under the first. Used by filter state, component, and integration tests
// so a single hierarchical scheme is the source of truth for all of them.
export const OUTCOME_SCHEME_FIXTURE: ConceptScheme = {
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
