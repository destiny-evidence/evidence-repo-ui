import { describe, test, expect } from "vitest";
import {
  buildEvidenceMapModel,
  resolveMapAxis,
  bubbleRadius,
  legendTicks,
  BUBBLE_MAX_RADIUS,
  BUBBLE_MIN_RADIUS,
} from "@/services/evidenceMap";
import type { CrossFacetCell } from "@/types/models";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";
import { countryName } from "@/utils/country";

function cell(row: string, column: string, count: number): CrossFacetCell {
  return { axes: [row, column], count };
}

// Identity label resolver, overridable per test.
const ident = (key: string) => key;

describe("buildEvidenceMapModel", () => {
  test("derives unique row/column categories from the cells", () => {
    const model = buildEvidenceMapModel(
      [cell("r1", "c1", 3), cell("r1", "c2", 5), cell("r2", "c1", 1)],
      ident,
      ident,
    );
    expect(model.rows.map((r) => r.key)).toEqual(["r1", "r2"]);
    expect(model.columns.map((c) => c.key)).toEqual(["c1", "c2"]);
  });

  test("resolves rows and columns with their own label functions", () => {
    const model = buildEvidenceMapModel(
      [cell("r", "c", 1)],
      () => "Row label",
      () => "Column label",
    );
    expect(model.rows[0].label).toBe("Row label");
    expect(model.columns[0].label).toBe("Column label");
  });

  test("sorts categories by label, not raw key", () => {
    const labels: Record<string, string> = { "u:b": "Apple", "u:a": "Banana" };
    const resolve = (k: string) => labels[k] ?? k;
    const model = buildEvidenceMapModel(
      [cell("u:a", "x", 1), cell("u:b", "x", 1)],
      resolve,
      resolve,
    );
    // u:b ("Apple") sorts before u:a ("Banana") despite key order.
    expect(model.rows.map((r) => r.label)).toEqual(["Apple", "Banana"]);
  });

  test("looks up counts by pair and returns undefined for empty intersections", () => {
    const model = buildEvidenceMapModel(
      [cell("r1", "c1", 7), cell("r2", "c2", 2)],
      ident,
      ident,
    );
    expect(model.getCount("r1", "c1")).toBe(7);
    expect(model.getCount("r2", "c2")).toBe(2);
    expect(model.getCount("r1", "c2")).toBeUndefined();
  });

  test("tracks the maximum cell count", () => {
    const model = buildEvidenceMapModel(
      [cell("r1", "c1", 4), cell("r1", "c2", 12), cell("r2", "c1", 9)],
      ident,
      ident,
    );
    expect(model.maxCount).toBe(12);
  });

  test("sums duplicate (row, column) pairs defensively", () => {
    const model = buildEvidenceMapModel(
      [cell("r1", "c1", 3), cell("r1", "c1", 4)],
      ident,
      ident,
    );
    expect(model.getCount("r1", "c1")).toBe(7);
    expect(model.maxCount).toBe(7);
  });

  test("handles no cells", () => {
    const model = buildEvidenceMapModel([], ident, ident);
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
    topConcepts: [],
  };
  const labels = new Map([
    ["https://vocab.esea.education/OutcomeScheme/C1", "Access to Education"],
  ]);

  test("titles a scheme axis from its vocabulary label", () => {
    const axis = resolveMapAxis(
      { kind: "scheme", schemeUri: "https://vocab.esea.education/OutcomeScheme" },
      [scheme],
      labels,
    );
    // schemeDisplayLabel strips the trailing "Scheme".
    expect(axis.title).toBe("Outcome");
    expect(
      axis.labelFor("https://vocab.esea.education/OutcomeScheme/C1"),
    ).toBe("Access to Education");
  });

  test("falls back to the local name when the scheme isn't in the vocabulary", () => {
    const axis = resolveMapAxis(
      { kind: "scheme", schemeUri: "https://vocab.esea.education/MysteryScheme" },
      [scheme],
      labels,
    );
    expect(axis.title).toBe("MysteryScheme");
    // Unknown values pass through unchanged.
    expect(axis.labelFor("urn:unknown")).toBe("urn:unknown");
  });

  test("expands a countries axis through Intl", () => {
    const axis = resolveMapAxis({ kind: "countries" }, null, null);
    expect(axis.title).toBe("Countries");
    expect(axis.labelFor("FR")).toBe(countryName("FR"));
    expect(axis.labelFor("FR")).not.toBe("FR");
  });
});

describe("bubbleRadius", () => {
  test("scales by area: quadrupling the count doubles the radius", () => {
    // minRadius 0 to isolate the area math from the legibility floor.
    const big = bubbleRadius(16, 16, 20, 0);
    const quarter = bubbleRadius(4, 16, 20, 0);
    expect(big).toBe(20);
    expect(quarter).toBeCloseTo(10);
  });

  test("returns 0 for non-positive counts or empty data", () => {
    expect(bubbleRadius(0, 10)).toBe(0);
    expect(bubbleRadius(-5, 10)).toBe(0);
    expect(bubbleRadius(5, 0)).toBe(0);
  });

  test("clamps small positive counts up to the minimum radius", () => {
    // 22 * sqrt(1/10000) ≈ 0.22, well below the floor.
    expect(bubbleRadius(1, 10000)).toBe(BUBBLE_MIN_RADIUS);
  });

  test("largest count maps to the maximum radius by default", () => {
    expect(bubbleRadius(50, 50)).toBe(BUBBLE_MAX_RADIUS);
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
