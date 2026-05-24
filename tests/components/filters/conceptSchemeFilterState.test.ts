import { describe, test, expect } from "vitest";
import {
  buildConceptIndex,
  conceptSchemeStateFromUris,
  emptyConceptSchemeState,
  isEmpty,
  isSelected,
  selectedCount,
  selectedUris,
  summary,
  toggleConcept,
  toSearchFacet,
} from "@/components/filters/conceptSchemeFilterState";
import type {
  Concept,
  ConceptScheme,
} from "@/services/vocabulary/vocabularyService";
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

const SCHEME_INDEX = buildConceptIndex(SCHEME);
const OUTCOME_INDEX = buildConceptIndex(OUTCOME_SCHEME_FIXTURE);

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
  const LEAF: Concept = { uri: URI_JOURNAL_ARTICLE, label: "Journal Article" };

  const ACCESS_SUBTREE = OUTCOME_SCHEME_FIXTURE.topConcepts[0];
  const EDUCATION_FINANCE: Concept = ACCESS_SUBTREE.narrower![0];
  const ENROLMENT: Concept = ACCESS_SUBTREE.narrower![1];

  test("on a leaf adds the URI when absent and removes it when present", () => {
    const empty = emptyConceptSchemeState();
    const added = toggleConcept(empty, LEAF, SCHEME_INDEX);
    expect(selectedUris(added)).toEqual([LEAF.uri]);

    const removed = toggleConcept(added, LEAF, SCHEME_INDEX);
    expect(isEmpty(removed)).toBe(true);
  });

  test("on an unselected parent adds the parent and every descendant", () => {
    const result = toggleConcept(
      emptyConceptSchemeState(),
      ACCESS_SUBTREE,
      OUTCOME_INDEX,
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
    const result = toggleConcept(before, ACCESS_SUBTREE, OUTCOME_INDEX);
    expect(isEmpty(result)).toBe(true);
  });

  test("clicking an unselected parent overrides partial child selections", () => {
    const before = conceptSchemeStateFromUris([URI_EDUCATION_FINANCE]);
    const result = toggleConcept(before, ACCESS_SUBTREE, OUTCOME_INDEX);
    expect(selectedCount(result)).toBe(3);
    expect(isSelected(result, URI_ACCESS)).toBe(true);
    expect(isSelected(result, URI_ENROLMENT)).toBe(true);
  });

  test("clicking a selected parent clears the whole subtree, including children selected independently", () => {
    const before = conceptSchemeStateFromUris([URI_ACCESS, URI_ENROLMENT]);
    const result = toggleConcept(before, ACCESS_SUBTREE, OUTCOME_INDEX);
    expect(isEmpty(result)).toBe(true);
  });

  test("does not mutate the input state", () => {
    const before = conceptSchemeStateFromUris([URI_EDUCATION_FINANCE]);
    const beforeSnapshot = selectedUris(before);
    toggleConcept(before, ACCESS_SUBTREE, OUTCOME_INDEX);
    expect(selectedUris(before)).toEqual(beforeSnapshot);
  });

  test("walks more than two levels deep", () => {
    const grandchild: Concept = { uri: "u:grandchild", label: "Grandchild" };
    const child: Concept = {
      uri: "u:child",
      label: "Child",
      narrower: [grandchild],
    };
    const deep: Concept = {
      uri: "u:root",
      label: "Root",
      narrower: [child],
    };
    const deepIndex = buildConceptIndex({
      uri: "u:scheme",
      label: "Deep",
      topConcepts: [deep],
    });
    const result = toggleConcept(
      emptyConceptSchemeState(),
      deep,
      deepIndex,
    );
    expect(selectedUris(result)).toEqual(["u:root", "u:child", "u:grandchild"]);
  });

  test("leaves URIs from outside the subtree untouched", () => {
    const before = conceptSchemeStateFromUris([URI_LEARNING]);
    const result = toggleConcept(before, ACCESS_SUBTREE, OUTCOME_INDEX);
    expect(isSelected(result, URI_LEARNING)).toBe(true);
    expect(isSelected(result, URI_ACCESS)).toBe(true);
  });

  // Upward reconciliation: selecting the last missing sibling rolls the parent
  // in; deselecting any sibling rolls it back out. Driven by `index.broader`
  // and a per-level "every child selected?" check.
  describe("upward reconciliation", () => {
    test("selecting the last missing child auto-selects the parent", () => {
      const before = conceptSchemeStateFromUris([URI_EDUCATION_FINANCE]);
      const result = toggleConcept(before, ENROLMENT, OUTCOME_INDEX);
      expect(isSelected(result, URI_ACCESS)).toBe(true);
      expect(isSelected(result, URI_EDUCATION_FINANCE)).toBe(true);
      expect(isSelected(result, URI_ENROLMENT)).toBe(true);
    });

    test("selecting fewer than all siblings leaves the parent unselected", () => {
      const result = toggleConcept(
        emptyConceptSchemeState(),
        EDUCATION_FINANCE,
        OUTCOME_INDEX,
      );
      expect(isSelected(result, URI_EDUCATION_FINANCE)).toBe(true);
      expect(isSelected(result, URI_ACCESS)).toBe(false);
    });

    test("deselecting one child of a fully-selected parent removes the parent too", () => {
      const before = conceptSchemeStateFromUris([
        URI_ACCESS,
        URI_EDUCATION_FINANCE,
        URI_ENROLMENT,
      ]);
      const result = toggleConcept(before, ENROLMENT, OUTCOME_INDEX);
      expect(isSelected(result, URI_ENROLMENT)).toBe(false);
      expect(isSelected(result, URI_ACCESS)).toBe(false);
      expect(isSelected(result, URI_EDUCATION_FINANCE)).toBe(true);
    });

    test("cascades through multiple levels when grandchildren complete a grandparent", () => {
      const grandA: Concept = { uri: "u:gA", label: "GA" };
      const grandB: Concept = { uri: "u:gB", label: "GB" };
      const childX: Concept = {
        uri: "u:cX",
        label: "CX",
        narrower: [grandA, grandB],
      };
      const childY: Concept = { uri: "u:cY", label: "CY" };
      const root: Concept = {
        uri: "u:root",
        label: "Root",
        narrower: [childX, childY],
      };
      const idx = buildConceptIndex({
        uri: "u:scheme",
        label: "Cascade",
        topConcepts: [root],
      });

      // Pre-state: grandA + childY already selected. Toggling grandB should
      // complete childX, which together with childY completes root.
      const before = conceptSchemeStateFromUris(["u:gA", "u:cY"]);
      const result = toggleConcept(before, grandB, idx);
      expect(isSelected(result, "u:gB")).toBe(true);
      expect(isSelected(result, "u:cX")).toBe(true);
      expect(isSelected(result, "u:root")).toBe(true);
    });

    test("deselecting a deep leaf cascades the un-selection up multiple levels", () => {
      const grandA: Concept = { uri: "u:gA", label: "GA" };
      const grandB: Concept = { uri: "u:gB", label: "GB" };
      const childX: Concept = {
        uri: "u:cX",
        label: "CX",
        narrower: [grandA, grandB],
      };
      const childY: Concept = { uri: "u:cY", label: "CY" };
      const root: Concept = {
        uri: "u:root",
        label: "Root",
        narrower: [childX, childY],
      };
      const idx = buildConceptIndex({
        uri: "u:scheme",
        label: "Cascade",
        topConcepts: [root],
      });

      const before = conceptSchemeStateFromUris([
        "u:root",
        "u:cX",
        "u:gA",
        "u:gB",
        "u:cY",
      ]);
      const result = toggleConcept(before, grandA, idx);
      expect(isSelected(result, "u:gA")).toBe(false);
      expect(isSelected(result, "u:cX")).toBe(false);
      expect(isSelected(result, "u:root")).toBe(false);
      expect(isSelected(result, "u:gB")).toBe(true);
      expect(isSelected(result, "u:cY")).toBe(true);
    });

    test("clicking an internal node whose siblings are already selected rolls up", () => {
      // Siblings of ACCESS_SUBTREE (Learning, Returns) selected; clicking
      // ACCESS_SUBTREE adds its subtree and should — were there a level above
      // top concepts — propagate. Since top concepts have no parent we just
      // confirm no error and the subtree is added.
      const before = conceptSchemeStateFromUris([URI_LEARNING, URI_RETURNS]);
      const result = toggleConcept(before, ACCESS_SUBTREE, OUTCOME_INDEX);
      expect(isSelected(result, URI_ACCESS)).toBe(true);
      expect(isSelected(result, URI_LEARNING)).toBe(true);
      expect(isSelected(result, URI_RETURNS)).toBe(true);
    });

    test("top concept toggle terminates cleanly with no parent in the index", () => {
      const result = toggleConcept(
        emptyConceptSchemeState(),
        ACCESS_SUBTREE,
        OUTCOME_INDEX,
      );
      expect(isSelected(result, URI_ACCESS)).toBe(true);
    });
  });
});

describe("buildConceptIndex", () => {
  test("indexes every concept in the scheme by URI", () => {
    const idx = buildConceptIndex(OUTCOME_SCHEME_FIXTURE);
    expect(idx.byUri.get(URI_ACCESS)?.label).toBe("Access to Education");
    expect(idx.byUri.get(URI_EDUCATION_FINANCE)?.label).toBe(
      "Education Finance",
    );
    expect(idx.byUri.get(URI_ENROLMENT)?.label).toBe("Enrolment and Attendance");
    expect(idx.byUri.get(URI_LEARNING)?.label).toBe(
      "Educational Outcomes and Learning",
    );
    expect(idx.byUri.get(URI_RETURNS)?.label).toBe("Returns to Education");
  });

  test("maps each non-top concept to its parent and omits top concepts", () => {
    const idx = buildConceptIndex(OUTCOME_SCHEME_FIXTURE);
    expect(idx.broader.get(URI_EDUCATION_FINANCE)).toBe(URI_ACCESS);
    expect(idx.broader.get(URI_ENROLMENT)).toBe(URI_ACCESS);
    expect(idx.broader.has(URI_ACCESS)).toBe(false);
    expect(idx.broader.has(URI_LEARNING)).toBe(false);
    expect(idx.broader.has(URI_RETURNS)).toBe(false);
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
