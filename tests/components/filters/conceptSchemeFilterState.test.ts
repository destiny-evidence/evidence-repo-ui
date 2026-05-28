import { describe, test, expect } from "vitest";
import {
  buildConceptIndex,
  conceptSchemeStateFromUris,
  emptyConceptSchemeState,
  isEmpty,
  isSelected,
  parseConceptFilters,
  selectedCount,
  selectedUris,
  summary,
  toConceptFilterGroups,
  toggleConcept,
  totalSelectedCount,
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

describe("toConceptFilterGroups", () => {
  test("returns no groups when state is empty", () => {
    expect(toConceptFilterGroups(emptyConceptSchemeState(), SCHEME)).toEqual([]);
  });

  test("a single top-level selection lands in one group with one URI", () => {
    const state = conceptSchemeStateFromUris([URI_JOURNAL_ARTICLE]);
    expect(toConceptFilterGroups(state, SCHEME)).toEqual([
      [URI_JOURNAL_ARTICLE],
    ]);
  });

  test("multiple sibling selections at the same level collapse into one group", () => {
    const state = conceptSchemeStateFromUris([URI_JOURNAL_ARTICLE, URI_THESIS]);
    expect(toConceptFilterGroups(state, SCHEME)).toEqual([
      [URI_JOURNAL_ARTICLE, URI_THESIS],
    ]);
  });

  test("URIs within a group follow scheme preorder, not insertion order", () => {
    const state = conceptSchemeStateFromUris([
      URI_GOVERNMENT_REPORT,
      URI_JOURNAL_ARTICLE,
    ]);
    expect(toConceptFilterGroups(state, SCHEME)).toEqual([
      [URI_JOURNAL_ARTICLE, URI_GOVERNMENT_REPORT],
    ]);
  });

  test("ignores selected URIs that are not in the scheme", () => {
    const stale = "https://vocab.esea.education/OtherScheme/C99999";
    const state = conceptSchemeStateFromUris([stale, URI_JOURNAL_ARTICLE]);
    expect(toConceptFilterGroups(state, SCHEME)).toEqual([
      [URI_JOURNAL_ARTICLE],
    ]);
  });

  test("a single narrower concept lands in one group keyed by its parent", () => {
    const state = conceptSchemeStateFromUris([URI_EDUCATION_FINANCE]);
    expect(toConceptFilterGroups(state, OUTCOME_SCHEME_FIXTURE)).toEqual([
      [URI_EDUCATION_FINANCE],
    ]);
  });

  // Auto-rollup case: clicking a parent selects it + every descendant. The
  // parent ends up in its own top-level group; the children end up in a
  // separate group keyed by the parent. These groups have disjoint sibling
  // sets, which the backend accepts. Linchpin test — drift here would 400 on
  // the backend.
  test("a fully-selected subtree splits into separate sibling-set groups (parent vs descendants)", () => {
    const state = conceptSchemeStateFromUris([
      URI_ACCESS,
      URI_EDUCATION_FINANCE,
      URI_ENROLMENT,
    ]);
    expect(toConceptFilterGroups(state, OUTCOME_SCHEME_FIXTURE)).toEqual([
      [URI_ACCESS],
      [URI_EDUCATION_FINANCE, URI_ENROLMENT],
    ]);
  });

  test("top-level siblings under different parents do NOT mix with the same scheme's children", () => {
    const state = conceptSchemeStateFromUris([
      URI_LEARNING,
      URI_RETURNS,
      URI_EDUCATION_FINANCE,
    ]);
    // Preorder walk visits Education_Finance (child of Access) before Learning
    // / Returns (top-level siblings), so its group is emitted first.
    expect(toConceptFilterGroups(state, OUTCOME_SCHEME_FIXTURE)).toEqual([
      [URI_EDUCATION_FINANCE],
      [URI_LEARNING, URI_RETURNS],
    ]);
  });
});

describe("parseConceptFilters", () => {
  const DOCUMENT_TYPE_SCHEME: ConceptScheme = SCHEME;

  test("empty input → empty map", () => {
    const result = parseConceptFilters([], [OUTCOME_SCHEME_FIXTURE]);
    expect(result.size).toBe(0);
  });

  test("empty schemes → empty map even if filters carry URIs", () => {
    const result = parseConceptFilters([[URI_JOURNAL_ARTICLE]], []);
    expect(result.size).toBe(0);
  });

  test("single-URI group lands in the owning scheme bucket", () => {
    const result = parseConceptFilters(
      [[URI_JOURNAL_ARTICLE]],
      [DOCUMENT_TYPE_SCHEME],
    );
    expect(result.size).toBe(1);
    const state = result.get(DOCUMENT_TYPE_SCHEME.uri);
    expect(state).toBeDefined();
    expect(selectedUris(state!)).toEqual([URI_JOURNAL_ARTICLE]);
  });

  test("multi-URI group lands in a single scheme bucket", () => {
    const result = parseConceptFilters(
      [[URI_JOURNAL_ARTICLE, URI_THESIS]],
      [DOCUMENT_TYPE_SCHEME],
    );
    const state = result.get(DOCUMENT_TYPE_SCHEME.uri)!;
    expect(selectedCount(state)).toBe(2);
    expect(isSelected(state, URI_JOURNAL_ARTICLE)).toBe(true);
    expect(isSelected(state, URI_THESIS)).toBe(true);
  });

  test("URIs from two schemes split into two buckets", () => {
    const result = parseConceptFilters(
      [[URI_JOURNAL_ARTICLE], [URI_ACCESS]],
      [DOCUMENT_TYPE_SCHEME, OUTCOME_SCHEME_FIXTURE],
    );
    expect(result.size).toBe(2);
    expect(selectedUris(result.get(DOCUMENT_TYPE_SCHEME.uri)!)).toEqual([
      URI_JOURNAL_ARTICLE,
    ]);
    expect(selectedUris(result.get(OUTCOME_SCHEME_FIXTURE.uri)!)).toEqual([
      URI_ACCESS,
    ]);
  });

  test("URIs from the same scheme spread across groups merge into one bucket", () => {
    const result = parseConceptFilters(
      [[URI_JOURNAL_ARTICLE], [URI_THESIS]],
      [DOCUMENT_TYPE_SCHEME],
    );
    expect(result.size).toBe(1);
    expect(selectedCount(result.get(DOCUMENT_TYPE_SCHEME.uri)!)).toBe(2);
  });

  test("URIs that don't belong to any scheme are silently dropped", () => {
    const stale = "https://vocab.esea.education/RetiredScheme/X1";
    const result = parseConceptFilters(
      [[stale, URI_JOURNAL_ARTICLE]],
      [DOCUMENT_TYPE_SCHEME],
    );
    const state = result.get(DOCUMENT_TYPE_SCHEME.uri)!;
    expect(selectedUris(state)).toEqual([URI_JOURNAL_ARTICLE]);
  });

  test("ignores everything when no URI matches any scheme", () => {
    const result = parseConceptFilters(
      [["u:does-not-exist"]],
      [DOCUMENT_TYPE_SCHEME, OUTCOME_SCHEME_FIXTURE],
    );
    expect(result.size).toBe(0);
  });

  test("picks up narrower-tier concept URIs, not just top-level ones", () => {
    const result = parseConceptFilters(
      [[URI_EDUCATION_FINANCE]],
      [OUTCOME_SCHEME_FIXTURE],
    );
    const state = result.get(OUTCOME_SCHEME_FIXTURE.uri)!;
    expect(isSelected(state, URI_EDUCATION_FINANCE)).toBe(true);
  });

  test("round-trips through toConceptFilterGroups", () => {
    // Pick a selection that exercises both a parent and narrower concept.
    const original = conceptSchemeStateFromUris([URI_ACCESS, URI_LEARNING]);
    const groups = toConceptFilterGroups(original, OUTCOME_SCHEME_FIXTURE);
    const parsed = parseConceptFilters(groups, [OUTCOME_SCHEME_FIXTURE]);
    const state = parsed.get(OUTCOME_SCHEME_FIXTURE.uri)!;
    expect([...selectedUris(state)].sort()).toEqual(
      [URI_ACCESS, URI_LEARNING].sort(),
    );
  });
});

describe("totalSelectedCount", () => {
  test("returns 0 when no filters are applied", () => {
    expect(totalSelectedCount([], [OUTCOME_SCHEME_FIXTURE])).toBe(0);
  });

  test("sums individual concept counts across schemes", () => {
    const outcomeGroups = toConceptFilterGroups(
      conceptSchemeStateFromUris([URI_LEARNING, URI_RETURNS]),
      OUTCOME_SCHEME_FIXTURE,
    );
    const docGroups = toConceptFilterGroups(
      conceptSchemeStateFromUris([URI_JOURNAL_ARTICLE]),
      SCHEME,
    );
    expect(
      totalSelectedCount(
        [...outcomeGroups, ...docGroups],
        [OUTCOME_SCHEME_FIXTURE, SCHEME],
      ),
    ).toBe(3);
  });

  test("counts every selected URI in a subtree (parent + descendants)", () => {
    const groups = toConceptFilterGroups(
      conceptSchemeStateFromUris([
        URI_ACCESS,
        URI_EDUCATION_FINANCE,
        URI_ENROLMENT,
      ]),
      OUTCOME_SCHEME_FIXTURE,
    );
    expect(totalSelectedCount(groups, [OUTCOME_SCHEME_FIXTURE])).toBe(3);
  });
});
