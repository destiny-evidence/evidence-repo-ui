import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";

// Real concept URIs from ESEA's OutcomeScheme. Exported so tests can
// assert on URI identity without redefining these opaque values.
export const URI_ACCESS = "https://vocab.esea.education/OutcomeScheme/C00096";
export const URI_EDUCATION_FINANCE =
  "https://vocab.esea.education/OutcomeScheme/C00097";
export const URI_ENROLMENT =
  "https://vocab.esea.education/OutcomeScheme/C00098";
export const URI_LEARNING = "https://vocab.esea.education/OutcomeScheme/C00122";
export const URI_RETURNS = "https://vocab.esea.education/OutcomeScheme/C00130";

// Trimmed slice of ESEA's OutcomeScheme — three top-level outcomes, two
// narrower concepts under the first. Labels and definitions live inline
// so tests asserting on display strings keep the literal as a second
// opinion on fixture content.
export const OUTCOME_SCHEME_FIXTURE: ConceptScheme = {
  uri: "https://vocab.esea.education/OutcomeScheme",
  label: "Outcome",
  topConcepts: [
    {
      uri: URI_ACCESS,
      label: "Access to Education",
      narrower: [
        {
          uri: URI_EDUCATION_FINANCE,
          label: "Education Finance",
          definition:
            "Outcomes covering the funding mechanisms that determine access to education.",
        },
        {
          uri: URI_ENROLMENT,
          label: "Enrolment and Attendance",
        },
      ],
    },
    {
      uri: URI_LEARNING,
      label: "Educational Outcomes and Learning",
    },
    {
      uri: URI_RETURNS,
      label: "Returns to Education",
    },
  ],
};
