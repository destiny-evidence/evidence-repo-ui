import { describe, test, expect } from "vitest";
import {
  buildEvidenceMapModel,
  resolveMapAxis,
  bubbleRadius,
  legendTicks,
  type AxisCategory,
} from "@/services/evidenceMap";
import type { CrossFacetCell } from "@/types/models";
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

  test("sorts categories by label, not raw key", () => {
    const model = buildEvidenceMapModel(
      [cell("u:a", "x", 1), cell("u:b", "x", 1)],
      axisOf([
        { key: "u:b", label: "Apple" },
        { key: "u:a", label: "Banana" },
      ]),
      axisOf(),
    );
    // u:b ("Apple") sorts before u:a ("Banana") despite key order.
    expect(model.rows.map((r) => r.label)).toEqual(["Apple", "Banana"]);
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
  // Scheme URIs are normalized to full IRIs when the vocabulary is parsed.
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
      { kind: "scheme", schemeUri: "https://vocab.esea.education/OutcomeScheme" },
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
    expect(
      axis.labelFor("https://vocab.esea.education/OutcomeScheme/C1"),
    ).toBe("Access to Education");
  });

  test("falls back to the local name and no categories when the scheme is absent", () => {
    const axis = resolveMapAxis(
      { kind: "scheme", schemeUri: "https://vocab.esea.education/MysteryScheme" },
      [scheme],
      labels,
    );
    expect(axis.title).toBe("MysteryScheme");
    expect(axis.categories).toEqual([]);
    // Unknown values pass through unchanged.
    expect(axis.labelFor("urn:unknown")).toBe("urn:unknown");
  });

  test("expands a countries axis through Intl, with no enumerated categories yet", () => {
    const axis = resolveMapAxis({ kind: "countries" }, null, null);
    expect(axis.title).toBe("Countries");
    expect(axis.categories).toEqual([]);
    expect(axis.labelFor("FR")).toBe(countryName("FR"));
    expect(axis.labelFor("FR")).not.toBe("FR");
  });
});

describe("bubbleRadius", () => {
  test("scales by area: quadrupling the count doubles the radius", () => {
    // minRadius 0 to isolate the area math from the legibility floor.
    expect(bubbleRadius(16, 16, 0, 20)).toBe(20);
    expect(bubbleRadius(4, 16, 0, 20)).toBeCloseTo(10);
  });

  test("returns 0 for non-positive counts or empty data", () => {
    expect(bubbleRadius(0, 10, 4, 20)).toBe(0);
    expect(bubbleRadius(-5, 10, 4, 20)).toBe(0);
    expect(bubbleRadius(5, 0, 4, 20)).toBe(0);
  });

  test("clamps small positive counts up to the minimum radius", () => {
    // 22 * sqrt(1/10000) ≈ 0.22, well below the floor.
    expect(bubbleRadius(1, 10000, 4, 22)).toBe(4);
  });

  test("the largest count maps to the maximum radius", () => {
    expect(bubbleRadius(50, 50, 4, 22)).toBe(22);
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
});
