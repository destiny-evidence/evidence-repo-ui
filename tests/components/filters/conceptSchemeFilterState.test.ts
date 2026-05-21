import { describe, test, expect } from "vitest";
import {
  conceptSchemeStateFromUris,
  emptyConceptSchemeState,
  isEmpty,
  isSelected,
  selectedCount,
  selectedUris,
  summary,
  toggleConcept,
  toggleConceptSubtree,
  toSearchFacet,
  type Concept,
  type ConceptScheme,
} from "@/components/filters/conceptSchemeFilterState";
import {
  OUTCOME_SCHEME_FIXTURE,
  URI_ACCESS,
  URI_EDUCATION_FINANCE,
  URI_ENROLMENT,
  URI_LEARNING,
  URI_RETURNS,
} from "./fixtures";

// Real concept URIs from the ESEA DocumentTypeScheme vocabulary
// (https://vocab.evidence-repository.org/published/.../1.1/vocabulary.jsonld).
const URI_JOURNAL_ARTICLE =
  "https://vocab.esea.education/DocumentTypeScheme/C00008";
const URI_THESIS = "https://vocab.esea.education/DocumentTypeScheme/C00012";
const URI_GOVERNMENT_REPORT =
  "https://vocab.esea.education/DocumentTypeScheme/C00013";

const SCHEME: ConceptScheme = {
  uri: "https://vocab.esea.education/DocumentTypeScheme",
  label: "Document type",
  topConcepts: [
    { uri: URI_JOURNAL_ARTICLE, label: "Journal Article" },
    { uri: URI_THESIS, label: "Thesis/Dissertation" },
    { uri: URI_GOVERNMENT_REPORT, label: "Government Report/Document" },
  ],
};

describe("emptyConceptSchemeState", () => {
  test("starts empty", () => {
    const state = emptyConceptSchemeState();
    expect(isEmpty(state)).toBe(true);
    expect(selectedCount(state)).toBe(0);
    expect(summary(state)).toBe("");
  });
});

describe("conceptSchemeStateFromUris", () => {
  test("round-trips a list of URIs through selectedUris", () => {
    const state = conceptSchemeStateFromUris([
      URI_JOURNAL_ARTICLE,
      URI_THESIS,
    ]);
    expect(selectedCount(state)).toBe(2);
    expect(isSelected(state, URI_JOURNAL_ARTICLE)).toBe(true);
    expect(isSelected(state, URI_THESIS)).toBe(true);
    expect(isSelected(state, URI_GOVERNMENT_REPORT)).toBe(false);
    expect(selectedUris(state)).toEqual([URI_JOURNAL_ARTICLE, URI_THESIS]);
  });

  test("empty iterable is equivalent to emptyConceptSchemeState", () => {
    const state = conceptSchemeStateFromUris([]);
    expect(isEmpty(state)).toBe(true);
    expect(selectedCount(state)).toBe(0);
  });

  test("dedupes repeated URIs", () => {
    const state = conceptSchemeStateFromUris([
      URI_JOURNAL_ARTICLE,
      URI_JOURNAL_ARTICLE,
      URI_THESIS,
    ]);
    expect(selectedCount(state)).toBe(2);
  });
});

describe("summary", () => {
  test("returns N selected for one and many", () => {
    expect(summary(conceptSchemeStateFromUris([URI_JOURNAL_ARTICLE]))).toBe(
      "1 selected",
    );
    expect(
      summary(
        conceptSchemeStateFromUris([
          URI_JOURNAL_ARTICLE,
          URI_THESIS,
          URI_GOVERNMENT_REPORT,
        ]),
      ),
    ).toBe("3 selected");
  });
});

describe("toggleConcept", () => {
  test("adds a URI when absent", () => {
    const before = emptyConceptSchemeState();
    const after = toggleConcept(before, URI_JOURNAL_ARTICLE);
    expect(isSelected(after, URI_JOURNAL_ARTICLE)).toBe(true);
    expect(selectedCount(after)).toBe(1);
  });

  test("removes a URI when present", () => {
    const before = conceptSchemeStateFromUris([
      URI_JOURNAL_ARTICLE,
      URI_THESIS,
    ]);
    const after = toggleConcept(before, URI_JOURNAL_ARTICLE);
    expect(isSelected(after, URI_JOURNAL_ARTICLE)).toBe(false);
    expect(isSelected(after, URI_THESIS)).toBe(true);
    expect(selectedCount(after)).toBe(1);
  });

  test("does not mutate the input state", () => {
    const before = conceptSchemeStateFromUris([URI_JOURNAL_ARTICLE]);
    const beforeSnapshot = selectedUris(before);
    toggleConcept(before, URI_THESIS);
    toggleConcept(before, URI_JOURNAL_ARTICLE);
    expect(selectedUris(before)).toEqual(beforeSnapshot);
    expect(selectedCount(before)).toBe(1);
  });

  test("is idempotent over add+remove", () => {
    const start = emptyConceptSchemeState();
    const roundTrip = toggleConcept(
      toggleConcept(start, URI_JOURNAL_ARTICLE),
      URI_JOURNAL_ARTICLE,
    );
    expect(isEmpty(roundTrip)).toBe(true);
  });
});

describe("toggleConceptSubtree", () => {
  const LEAF: Concept = { uri: URI_JOURNAL_ARTICLE, label: "Journal Article" };

  const ACCESS_SUBTREE = OUTCOME_SCHEME_FIXTURE.topConcepts[0];

  test("on a leaf behaves identically to toggleConcept", () => {
    const empty = emptyConceptSchemeState();
    expect(selectedUris(toggleConceptSubtree(empty, LEAF))).toEqual(
      selectedUris(toggleConcept(empty, LEAF.uri)),
    );
    const oneSelected = conceptSchemeStateFromUris([LEAF.uri]);
    expect(selectedUris(toggleConceptSubtree(oneSelected, LEAF))).toEqual(
      selectedUris(toggleConcept(oneSelected, LEAF.uri)),
    );
  });

  test("on an unselected parent adds the parent and every descendant", () => {
    const result = toggleConceptSubtree(
      emptyConceptSchemeState(),
      ACCESS_SUBTREE,
    );
    expect(isSelected(result, URI_ACCESS)).toBe(true);
    expect(isSelected(result, URI_EDUCATION_FINANCE)).toBe(true);
    expect(isSelected(result, URI_ENROLMENT)).toBe(true);
    expect(selectedCount(result)).toBe(3);
  });

  test("on a fully selected parent removes the parent and every descendant", () => {
    const before = conceptSchemeStateFromUris([
      URI_ACCESS,
      URI_EDUCATION_FINANCE,
      URI_ENROLMENT,
    ]);
    const result = toggleConceptSubtree(before, ACCESS_SUBTREE);
    expect(isEmpty(result)).toBe(true);
  });

  test("clicking an unselected parent overrides partial child selections", () => {
    const before = conceptSchemeStateFromUris([URI_EDUCATION_FINANCE]);
    const result = toggleConceptSubtree(before, ACCESS_SUBTREE);
    expect(selectedCount(result)).toBe(3);
    expect(isSelected(result, URI_ACCESS)).toBe(true);
    expect(isSelected(result, URI_ENROLMENT)).toBe(true);
  });

  test("clicking a selected parent clears the whole subtree, including children selected independently", () => {
    const before = conceptSchemeStateFromUris([URI_ACCESS, URI_ENROLMENT]);
    const result = toggleConceptSubtree(before, ACCESS_SUBTREE);
    expect(isEmpty(result)).toBe(true);
  });

  test("does not mutate the input state", () => {
    const before = conceptSchemeStateFromUris([URI_EDUCATION_FINANCE]);
    const beforeSnapshot = selectedUris(before);
    toggleConceptSubtree(before, ACCESS_SUBTREE);
    expect(selectedUris(before)).toEqual(beforeSnapshot);
  });

  test("walks more than two levels deep", () => {
    const deep: Concept = {
      uri: "u:root",
      label: "Root",
      narrower: [
        {
          uri: "u:child",
          label: "Child",
          narrower: [{ uri: "u:grandchild", label: "Grandchild" }],
        },
      ],
    };
    const result = toggleConceptSubtree(emptyConceptSchemeState(), deep);
    expect(selectedUris(result)).toEqual(["u:root", "u:child", "u:grandchild"]);
  });

  test("leaves URIs from outside the subtree untouched", () => {
    const before = conceptSchemeStateFromUris([URI_LEARNING]);
    const result = toggleConceptSubtree(before, ACCESS_SUBTREE);
    expect(isSelected(result, URI_LEARNING)).toBe(true);
    expect(isSelected(result, URI_ACCESS)).toBe(true);
  });
});

describe("toSearchFacet", () => {
  test("returns empty string when state is empty", () => {
    expect(toSearchFacet(emptyConceptSchemeState(), SCHEME)).toBe("");
  });

  test("returns a single clause without parentheses for one selection", () => {
    const state = conceptSchemeStateFromUris([URI_JOURNAL_ARTICLE]);
    expect(toSearchFacet(state, SCHEME)).toBe(
      `linked_data_concepts:"${URI_JOURNAL_ARTICLE}"`,
    );
  });

  test("joins multiple selections with OR and no outer parens", () => {
    const state = conceptSchemeStateFromUris([
      URI_JOURNAL_ARTICLE,
      URI_THESIS,
    ]);
    expect(toSearchFacet(state, SCHEME)).toBe(
      `linked_data_concepts:"${URI_JOURNAL_ARTICLE}"` +
        ` OR linked_data_concepts:"${URI_THESIS}"`,
    );
  });

  test("uses scheme.topConcepts order, not insertion order", () => {
    const state = conceptSchemeStateFromUris([
      URI_GOVERNMENT_REPORT,
      URI_JOURNAL_ARTICLE,
    ]);
    expect(toSearchFacet(state, SCHEME)).toBe(
      `linked_data_concepts:"${URI_JOURNAL_ARTICLE}"` +
        ` OR linked_data_concepts:"${URI_GOVERNMENT_REPORT}"`,
    );
  });

  test("ignores selected URIs that are not in the scheme", () => {
    const stale = "https://vocab.esea.education/OtherScheme/C99999";
    const state = conceptSchemeStateFromUris([stale, URI_JOURNAL_ARTICLE]);
    expect(toSearchFacet(state, SCHEME)).toBe(
      `linked_data_concepts:"${URI_JOURNAL_ARTICLE}"`,
    );
  });

  test("embeds the full concept URI verbatim inside the quotes", () => {
    const state = conceptSchemeStateFromUris([URI_JOURNAL_ARTICLE]);
    const fragment = toSearchFacet(state, SCHEME);
    expect(fragment).toContain(URI_JOURNAL_ARTICLE);
    expect(fragment.startsWith('linked_data_concepts:"')).toBe(true);
    expect(fragment.endsWith('"')).toBe(true);
  });

  test("includes a selected narrower concept from a two-tier scheme", () => {
    const state = conceptSchemeStateFromUris([URI_EDUCATION_FINANCE]);
    expect(toSearchFacet(state, OUTCOME_SCHEME_FIXTURE)).toBe(
      `linked_data_concepts:"${URI_EDUCATION_FINANCE}"`,
    );
  });

  test("walks the tree depth-first preorder when ordering clauses", () => {
    const state = conceptSchemeStateFromUris([
      URI_RETURNS,
      URI_ENROLMENT,
      URI_ACCESS,
      URI_LEARNING,
    ]);
    expect(toSearchFacet(state, OUTCOME_SCHEME_FIXTURE)).toBe(
      `linked_data_concepts:"${URI_ACCESS}"` +
        ` OR linked_data_concepts:"${URI_ENROLMENT}"` +
        ` OR linked_data_concepts:"${URI_LEARNING}"` +
        ` OR linked_data_concepts:"${URI_RETURNS}"`,
    );
  });

  test("emits both parent and child clauses when both are selected", () => {
    const state = conceptSchemeStateFromUris([
      URI_ACCESS,
      URI_EDUCATION_FINANCE,
    ]);
    expect(toSearchFacet(state, OUTCOME_SCHEME_FIXTURE)).toBe(
      `linked_data_concepts:"${URI_ACCESS}"` +
        ` OR linked_data_concepts:"${URI_EDUCATION_FINANCE}"`,
    );
  });
});
