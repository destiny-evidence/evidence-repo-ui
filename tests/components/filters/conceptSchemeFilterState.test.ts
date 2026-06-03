import { describe, test, expect } from "vitest";
import {
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
  const ENROLMENT: Concept = ACCESS_SUBTREE.narrower![1];

  test("adds the URI when absent and removes it when present", () => {
    const empty = emptyConceptSchemeState();
    const added = toggleConcept(empty, LEAF);
    expect(selectedUris(added)).toEqual([LEAF.uri]);

    const removed = toggleConcept(added, LEAF);
    expect(isEmpty(removed)).toBe(true);
  });

  test("on a parent only adds the parent URI; descendants are not cascaded in", () => {
    // Cascade was removed: selecting the parent matches docs tagged with the
    // parent URI literally, not its subtree. See destiny-repository#655.
    const result = toggleConcept(emptyConceptSchemeState(), ACCESS_SUBTREE);
    expect(isSelected(result, URI_ACCESS)).toBe(true);
    expect(isSelected(result, URI_EDUCATION_FINANCE)).toBe(false);
    expect(isSelected(result, URI_ENROLMENT)).toBe(false);
    expect(selectedCount(result)).toBe(1);
  });

  test("on a selected parent removes only the parent URI; children are untouched", () => {
    const before = conceptSchemeStateFromUris([
      URI_ACCESS,
      URI_EDUCATION_FINANCE,
      URI_ENROLMENT,
    ]);
    const result = toggleConcept(before, ACCESS_SUBTREE);
    expect(isSelected(result, URI_ACCESS)).toBe(false);
    expect(isSelected(result, URI_EDUCATION_FINANCE)).toBe(true);
    expect(isSelected(result, URI_ENROLMENT)).toBe(true);
  });

  test("toggling a child does not auto-rollup its parent even if all siblings are selected", () => {
    // Previously selecting the last missing sibling rolled the parent in
    // — this caused an AND with the (often-empty) parent URI on the backend
    // query. With auto-rollup removed, parent stays unselected.
    const before = conceptSchemeStateFromUris([URI_EDUCATION_FINANCE]);
    const result = toggleConcept(before, ENROLMENT);
    expect(isSelected(result, URI_ENROLMENT)).toBe(true);
    expect(isSelected(result, URI_EDUCATION_FINANCE)).toBe(true);
    expect(isSelected(result, URI_ACCESS)).toBe(false);
  });

  test("toggling a child off does not auto-deselect its parent", () => {
    const before = conceptSchemeStateFromUris([
      URI_ACCESS,
      URI_EDUCATION_FINANCE,
      URI_ENROLMENT,
    ]);
    const result = toggleConcept(before, ENROLMENT);
    expect(isSelected(result, URI_ENROLMENT)).toBe(false);
    expect(isSelected(result, URI_ACCESS)).toBe(true);
    expect(isSelected(result, URI_EDUCATION_FINANCE)).toBe(true);
  });

  test("does not mutate the input state", () => {
    const before = conceptSchemeStateFromUris([URI_EDUCATION_FINANCE]);
    const beforeSnapshot = selectedUris(before);
    toggleConcept(before, ACCESS_SUBTREE);
    expect(selectedUris(before)).toEqual(beforeSnapshot);
  });

  test("leaves unrelated URIs untouched", () => {
    const before = conceptSchemeStateFromUris([URI_LEARNING]);
    const result = toggleConcept(before, ACCESS_SUBTREE);
    expect(isSelected(result, URI_LEARNING)).toBe(true);
    expect(isSelected(result, URI_ACCESS)).toBe(true);
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

  test("a single narrower concept lands in one group", () => {
    const state = conceptSchemeStateFromUris([URI_EDUCATION_FINANCE]);
    expect(toConceptFilterGroups(state, OUTCOME_SCHEME_FIXTURE)).toEqual([
      [URI_EDUCATION_FINANCE],
    ]);
  });

  // The whole scheme is one sibling set, so a parent and its descendants
  // OR-join into a single group rather than AND'ing across depth levels.
  test("a parent and its descendants collapse into one whole-scheme group", () => {
    const state = conceptSchemeStateFromUris([
      URI_ACCESS,
      URI_EDUCATION_FINANCE,
      URI_ENROLMENT,
    ]);
    expect(toConceptFilterGroups(state, OUTCOME_SCHEME_FIXTURE)).toEqual([
      [URI_ACCESS, URI_EDUCATION_FINANCE, URI_ENROLMENT],
    ]);
  });

  test("concepts at different depths all OR-join into one preorder group", () => {
    const state = conceptSchemeStateFromUris([
      URI_LEARNING,
      URI_RETURNS,
      URI_EDUCATION_FINANCE,
    ]);
    // Preorder: Education_Finance (under Access) comes before Learning/Returns.
    expect(toConceptFilterGroups(state, OUTCOME_SCHEME_FIXTURE)).toEqual([
      [URI_EDUCATION_FINANCE, URI_LEARNING, URI_RETURNS],
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
