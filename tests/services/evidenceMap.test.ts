import { describe, test, expect } from "vitest";
import {
  axisToken,
  buildEvidenceMapModel,
  parseAxis,
  resolveMapAxis,
  bubbleRadius,
  formatCompact,
  legendTicks,
  cellSearchParams,
  axisSearchParams,
  backToVisualiseState,
  backToVisualiseUrl,
  type AxisCategory,
} from "@/services/evidenceMap";
import { AXIS_COUNTRIES } from "@/services/crossFacets";
import type {
  CrossFacetCell,
  EvidenceMapAxis,
  EvidenceMapAxes,
} from "@/types/models";
import type { SearchParams } from "@/services/searchParams";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";
import { countryName } from "@/utils/country";

function cell(row: string, column: string, count: number): CrossFacetCell {
  return { axes: [row, column], count };
}

// Identity label resolver, overridable per test.
const ident = (key: string) => key;

// Axis input for buildEvidenceMapModel; defaults derive everything from cells.
function axisOf(
  categories: AxisCategory[] = [],
  labelFor: (key: string) => string = ident,
) {
  return { categories, labelFor };
}

describe("buildEvidenceMapModel", () => {
  test("derives row/column categories from the cells when the axis has none", () => {
    const model = buildEvidenceMapModel(
      [cell("r1", "c1", 3), cell("r1", "c2", 5), cell("r2", "c1", 1)],
      axisOf(),
      axisOf(),
    );
    expect(model.rows.map((r) => r.key)).toEqual(["r1", "r2"]);
    expect(model.columns.map((c) => c.key)).toEqual(["c1", "c2"]);
  });

  test("includes zero-hit categories from the axis, not just cell values", () => {
    const model = buildEvidenceMapModel(
      [cell("r1", "c1", 3)],
      axisOf([
        { key: "r1", label: "Row One" },
        { key: "r2", label: "Row Two" },
      ]),
      axisOf([
        { key: "c1", label: "Col One" },
        { key: "c2", label: "Col Two" },
      ]),
    );
    expect(model.rows.map((r) => r.key)).toEqual(["r1", "r2"]);
    expect(model.columns.map((c) => c.key)).toEqual(["c1", "c2"]);
    // The zero-hit intersection is empty; the populated one carries its count.
    expect(model.getCount("r1", "c1")).toBe(3);
    expect(model.getCount("r2", "c2")).toBeUndefined();
  });

  test("unions cell keys the axis categories don't enumerate (never drops data)", () => {
    const model = buildEvidenceMapModel(
      [cell("rX", "cY", 2)],
      axisOf([{ key: "r1", label: "Row One" }]),
      axisOf([{ key: "c1", label: "Col One" }]),
    );
    expect(model.rows.map((r) => r.key)).toContain("rX");
    expect(model.columns.map((c) => c.key)).toContain("cY");
    expect(model.getCount("rX", "cY")).toBe(2);
  });

  test("labels categories from the axis, cell-only keys from labelFor", () => {
    const model = buildEvidenceMapModel(
      [cell("r1", "cX", 1)],
      axisOf([{ key: "r1", label: "Row One" }], ident),
      axisOf([{ key: "c1", label: "Col One" }], (k) => `label:${k}`),
    );
    expect(model.rows[0].label).toBe("Row One");
    expect(model.columns.find((c) => c.key === "cX")?.label).toBe("label:cX");
  });

  test("preserves the axis category order (the scheme hierarchy), unsorted", () => {
    const model = buildEvidenceMapModel(
      [cell("u:a", "x", 1), cell("u:b", "x", 1)],
      // Given in hierarchy order (parent "Zebra" before its sorted children),
      // not alphabetical — that order must survive unchanged.
      axisOf([
        { key: "u:z", label: "Zebra" },
        { key: "u:a", label: "Apple" },
        { key: "u:b", label: "Banana" },
      ]),
      axisOf(),
    );
    expect(model.rows.map((r) => r.label)).toEqual(["Zebra", "Apple", "Banana"]);
  });

  test("appends cell-only keys after the axis categories, alphabetized", () => {
    const model = buildEvidenceMapModel(
      [cell("u:z", "x", 1), cell("u:b", "x", 1), cell("u:a", "x", 1)],
      axisOf([{ key: "u:z", label: "Zebra" }], (k) =>
        k === "u:a" ? "Apple" : k === "u:b" ? "Banana" : k,
      ),
      axisOf(),
    );
    // Enumerated "Zebra" stays first; the two cell-only keys trail it in label order.
    expect(model.rows.map((r) => r.label)).toEqual(["Zebra", "Apple", "Banana"]);
  });

  test("looks up counts by pair, reports the maximum, and leaves empties undefined", () => {
    const model = buildEvidenceMapModel(
      [cell("r1", "c1", 7), cell("r1", "c2", 12), cell("r2", "c1", 9)],
      axisOf(),
      axisOf(),
    );
    expect(model.getCount("r1", "c1")).toBe(7);
    expect(model.getCount("r2", "c1")).toBe(9);
    expect(model.getCount("r2", "c2")).toBeUndefined();
    expect(model.maxCount).toBe(12);
  });

  test("sums duplicate (row, column) pairs defensively", () => {
    const model = buildEvidenceMapModel(
      [cell("r1", "c1", 3), cell("r1", "c1", 4)],
      axisOf(),
      axisOf(),
    );
    expect(model.getCount("r1", "c1")).toBe(7);
    expect(model.maxCount).toBe(7);
  });

  test("handles no cells and no categories", () => {
    const model = buildEvidenceMapModel([], axisOf(), axisOf());
    expect(model.rows).toEqual([]);
    expect(model.columns).toEqual([]);
    expect(model.maxCount).toBe(0);
    expect(model.getCount("r1", "c1")).toBeUndefined();
  });
});

describe("resolveMapAxis", () => {
  // Scheme URIs are normalized to full URIs when the vocabulary is parsed.
  const scheme: ConceptScheme = {
    uri: "https://vocab.esea.education/OutcomeScheme",
    label: "Outcome Scheme",
    topConcepts: [
      {
        uri: "https://vocab.esea.education/OutcomeScheme/C1",
        label: "Access to Education",
        narrower: [
          {
            uri: "https://vocab.esea.education/OutcomeScheme/C2",
            label: "Enrolment",
            definition: "Children enrolled in school",
          },
        ],
      },
      {
        uri: "https://vocab.esea.education/OutcomeScheme/C3",
        label: "Learning",
      },
    ],
  };
  const labels = new Map([
    ["https://vocab.esea.education/OutcomeScheme/C1", "Access to Education"],
  ]);

  test("titles a scheme axis from its label and lists its concepts (flattened)", () => {
    const axis = resolveMapAxis(
      {
        kind: "scheme",
        schemeUri: "https://vocab.esea.education/OutcomeScheme",
      },
      [scheme],
      labels,
    );
    // schemeDisplayLabel strips the trailing "Scheme".
    expect(axis.title).toBe("Outcome");
    // Depth-first flatten: a parent, its narrower, then the next top concept.
    expect(axis.categories.map((c) => c.label)).toEqual([
      "Access to Education",
      "Enrolment",
      "Learning",
    ]);
    expect(axis.labelFor("https://vocab.esea.education/OutcomeScheme/C1")).toBe(
      "Access to Education",
    );
    // Concept definitions carry through so the grid can show them in the tooltip.
    expect(axis.categories.map((c) => c.definition)).toEqual([
      undefined,
      "Children enrolled in school",
      undefined,
    ]);
  });

  test("retains scheme hierarchy, depth, order, and definitions", () => {
    const axis = resolveMapAxis(
      {
        kind: "scheme",
        schemeUri: "https://vocab.esea.education/OutcomeScheme",
      },
      [scheme],
      labels,
    );
    expect(axis.tree).toEqual([
      {
        category: {
          key: "https://vocab.esea.education/OutcomeScheme/C1",
          label: "Access to Education",
        },
        depth: 0,
        children: [
          {
            category: {
              key: "https://vocab.esea.education/OutcomeScheme/C2",
              label: "Enrolment",
              definition: "Children enrolled in school",
            },
            depth: 1,
            children: [],
          },
        ],
      },
      {
        category: {
          key: "https://vocab.esea.education/OutcomeScheme/C3",
          label: "Learning",
        },
        depth: 0,
        children: [],
      },
    ]);
  });

  test("emits each concept once, even when reachable under two parents", () => {
    // The vocabulary build orders siblings; flattenScheme preserves that order
    // but must not double-emit a concept that is both a top concept and a
    // narrower of another subtree (a malformed-but-possible vocab).
    const europe = {
      uri: "u:europe",
      label: "Europe",
      narrower: [
        { uri: "u:france", label: "France" },
        { uri: "u:spain", label: "Spain" },
      ],
    };
    const scheme: ConceptScheme = {
      uri: "https://vocab.esea.education/RegionScheme",
      label: "Region Scheme",
      topConcepts: [
        { uri: "u:africa", label: "Africa", narrower: [europe] },
        europe,
      ],
    };
    const axis = resolveMapAxis(
      { kind: "scheme", schemeUri: "https://vocab.esea.education/RegionScheme" },
      [scheme],
      null,
    );
    // Europe (and its children) is emitted under Africa; its second appearance
    // as a top concept is skipped — no duplicate keys.
    expect(axis.categories.map((c) => c.key)).toEqual([
      "u:africa",
      "u:europe",
      "u:france",
      "u:spain",
    ]);
    expect(axis.tree?.map((node) => node.category.key)).toEqual(["u:africa"]);
    expect(axis.tree?.[0].children.map((node) => node.category.key)).toEqual([
      "u:europe",
    ]);
    expect(
      axis.tree?.[0].children[0].children.map((node) => node.category.key),
    ).toEqual(["u:france", "u:spain"]);
  });

  test("falls back to the local name and no categories when the scheme is absent", () => {
    const axis = resolveMapAxis(
      {
        kind: "scheme",
        schemeUri: "https://vocab.esea.education/MysteryScheme",
      },
      [scheme],
      labels,
    );
    expect(axis.title).toBe("MysteryScheme");
    expect(axis.categories).toEqual([]);
    expect(axis.tree).toBeUndefined();
    // Unknown values pass through unchanged.
    expect(axis.labelFor("urn:unknown")).toBe("urn:unknown");
  });

  test("expands a countries axis through Intl, with no enumerated categories yet", () => {
    const axis = resolveMapAxis({ kind: "countries" }, null, null);
    expect(axis.title).toBe("Countries");
    expect(axis.categories).toEqual([]);
    expect(axis.tree).toBeUndefined();
    expect(axis.labelFor("FR")).toBe(countryName("FR"));
    expect(axis.labelFor("FR")).not.toBe("FR");
  });
});

describe("bubbleRadius", () => {
  test("square-root ramp: count 1 at the floor, max at the ceiling", () => {
    expect(bubbleRadius(1, 100, 4, 22)).toBeCloseTo(4);
    expect(bubbleRadius(100, 100, 4, 22)).toBe(22);
    // (√25 − 1)/(√100 − 1) = 4/9 of the way up the 4→22 range.
    expect(bubbleRadius(25, 100, 4, 22)).toBeCloseTo(12);
  });

  test("returns 0 for non-positive counts or empty data", () => {
    expect(bubbleRadius(0, 10, 4, 20)).toBe(0);
    expect(bubbleRadius(-5, 10, 4, 20)).toBe(0);
    expect(bubbleRadius(5, 0, 4, 20)).toBe(0);
  });

  test("anchors count 1 at the floor regardless of the maximum", () => {
    expect(bubbleRadius(1, 10000, 4, 22)).toBe(4);
  });

  test("the largest count maps to the maximum radius", () => {
    expect(bubbleRadius(50, 50, 4, 22)).toBe(22);
  });

  test("shows the only value at full size when every count is 1", () => {
    expect(bubbleRadius(1, 1, 4, 22)).toBe(22);
  });
});

describe("formatCompact", () => {
  test("leaves counts below 1000 untouched and abbreviates larger ones", () => {
    expect(formatCompact(7)).toBe("7");
    expect(formatCompact(355)).toBe("355");
    expect(formatCompact(1234)).toBe("1.2K");
    expect(formatCompact(12345)).toBe("12K");
    expect(formatCompact(99999)).toBe("100K");
    expect(formatCompact(1000000)).toBe("1M");
  });
});

describe("legendTicks", () => {
  test("returns nothing when there is no data", () => {
    expect(legendTicks(0)).toEqual([]);
    expect(legendTicks(-3)).toEqual([]);
  });

  test("lists every value for small maxima", () => {
    expect(legendTicks(3)).toEqual([1, 2, 3]);
  });

  test("produces ascending ticks ending at the maximum", () => {
    const ticks = legendTicks(24);
    expect(ticks[ticks.length - 1]).toBe(24);
    expect([...ticks].sort((a, b) => a - b)).toEqual(ticks);
    expect(new Set(ticks).size).toBe(ticks.length);
  });

  test("brackets the range: floor, the visual midpoint, and the maximum", () => {
    expect(legendTicks(355)).toEqual([1, 98, 355]);
    expect(legendTicks(462)).toEqual([1, 126, 462]);
  });
});

describe("axisToken / parseAxis", () => {
  const SCHEME: EvidenceMapAxis = {
    kind: "scheme",
    schemeUri: "https://vocab.esea.education/EducationLevelScheme",
  };
  const COUNTRIES: EvidenceMapAxis = { kind: "countries" };

  test("a scheme axis tokenises to its URI", () => {
    expect(axisToken(SCHEME)).toBe(SCHEME.schemeUri);
  });

  test("a countries axis tokenises to the literal countries token", () => {
    expect(axisToken(COUNTRIES)).toBe(AXIS_COUNTRIES);
  });

  test("round-trips a scheme axis", () => {
    expect(parseAxis(axisToken(SCHEME))).toEqual(SCHEME);
  });

  test("round-trips a countries axis", () => {
    expect(parseAxis(axisToken(COUNTRIES))).toEqual(COUNTRIES);
  });

  test("parses any non-countries token as a scheme URI", () => {
    expect(parseAxis("https://vocab.example/Thing")).toEqual({
      kind: "scheme",
      schemeUri: "https://vocab.example/Thing",
    });
  });
});

describe("cellSearchParams", () => {
  const base: SearchParams = {
    q: "literacy",
    page: 3,
    startYear: 2010,
    endYear: undefined,
    sort: "newest",
    conceptFilters: [["scheme-a:x"]],
    countryCodes: ["FR"],
  };

  test("scheme×scheme adds a single-concept group per axis and resets page", () => {
    const axes: EvidenceMapAxes = {
      row: { kind: "scheme", schemeUri: "scheme:level" },
      column: { kind: "scheme", schemeUri: "scheme:theme" },
    };
    const next = cellSearchParams(
      base,
      axes,
      { key: "level:primary", label: "Primary" },
      { key: "theme:literacy", label: "Literacy" },
    );
    expect(next.conceptFilters).toEqual([
      ["scheme-a:x"],
      ["level:primary"],
      ["theme:literacy"],
    ]);
    expect(next.countryCodes).toEqual(["FR"]);
    expect(next.page).toBe(1);
    // Other params are carried through untouched.
    expect(next.q).toBe("literacy");
    expect(next.sort).toBe("newest");
    expect(next.startYear).toBe(2010);
  });

  test("a countries axis contributes a country code, de-duplicated", () => {
    const axes: EvidenceMapAxes = {
      row: { kind: "countries" },
      column: { kind: "scheme", schemeUri: "scheme:theme" },
    };
    const next = cellSearchParams(
      base,
      axes,
      { key: "FR", label: "France" },
      { key: "theme:literacy", label: "Literacy" },
    );
    // FR was already applied — not duplicated.
    expect(next.countryCodes).toEqual(["FR"]);
    expect(next.conceptFilters).toEqual([["scheme-a:x"], ["theme:literacy"]]);
  });

  test("a countries axis appends a new code to the existing filter", () => {
    const axes: EvidenceMapAxes = {
      row: { kind: "scheme", schemeUri: "scheme:level" },
      column: { kind: "countries" },
    };
    const next = cellSearchParams(
      base,
      axes,
      { key: "level:primary", label: "Primary" },
      { key: "DE", label: "Germany" },
    );
    // DE is new — added alongside the already-applied FR.
    expect(next.countryCodes).toEqual(["FR", "DE"]);
  });

  test("does not mutate the base params", () => {
    const axes: EvidenceMapAxes = {
      row: { kind: "scheme", schemeUri: "scheme:level" },
      column: { kind: "countries" },
    };
    cellSearchParams(
      base,
      axes,
      { key: "level:primary", label: "Primary" },
      { key: "DE", label: "Germany" },
    );
    expect(base.conceptFilters).toEqual([["scheme-a:x"]]);
    expect(base.countryCodes).toEqual(["FR"]);
  });
});

describe("axisSearchParams", () => {
  const base: SearchParams = {
    q: "literacy",
    page: 3,
    startYear: 2010,
    endYear: undefined,
    sort: "newest",
    conceptFilters: [["scheme-a:x"]],
    countryCodes: ["FR"],
  };

  test("a scheme axis adds a single-concept group and resets page", () => {
    const next = axisSearchParams(
      base,
      { kind: "scheme", schemeUri: "scheme:level" },
      { key: "level:primary", label: "Primary" },
    );
    expect(next.conceptFilters).toEqual([["scheme-a:x"], ["level:primary"]]);
    expect(next.countryCodes).toEqual(["FR"]);
    expect(next.page).toBe(1);
    expect(next.q).toBe("literacy");
  });

  test("a countries axis appends a new, de-duplicated country code", () => {
    const added = axisSearchParams(
      base,
      { kind: "countries" },
      { key: "DE", label: "Germany" },
    );
    expect(added.countryCodes).toEqual(["FR", "DE"]);

    const dupe = axisSearchParams(
      base,
      { kind: "countries" },
      { key: "FR", label: "France" },
    );
    expect(dupe.countryCodes).toEqual(["FR"]);
  });

  test("does not mutate the base params", () => {
    axisSearchParams(
      base,
      { kind: "scheme", schemeUri: "scheme:level" },
      { key: "level:primary", label: "Primary" },
    );
    expect(base.conceptFilters).toEqual([["scheme-a:x"]]);
  });
});

describe("back-to-visualise history state", () => {
  test("round-trips the map URL", () => {
    const url = "/edu/visualise?q=x&row=a&column=b";
    expect(backToVisualiseUrl(backToVisualiseState(url))).toBe(url);
  });

  test("returns null for absent or malformed state", () => {
    expect(backToVisualiseUrl(null)).toBeNull();
    expect(backToVisualiseUrl(undefined)).toBeNull();
    expect(backToVisualiseUrl({})).toBeNull();
    expect(backToVisualiseUrl({ backToVisualise: 42 })).toBeNull();
    expect(backToVisualiseUrl("just a string")).toBeNull();
  });
});
