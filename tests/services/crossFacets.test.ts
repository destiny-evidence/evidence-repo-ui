import { describe, test, expect } from "vitest";
import {
  AXIS_COUNTRIES,
  AXIS_REGIONS,
  axisPairToParams,
  crossFacetTotals,
  type CrossFacetAxis,
} from "@/services/crossFacets";
import type { ReferenceCrossFacetResult } from "@/types/models";

const VOCAB = "https://vocab.example/v1/vocabulary.ttl";
const SCHEME = "https://vocab.example/scheme/Themes";

const countries: CrossFacetAxis = { kind: "literal", token: AXIS_COUNTRIES };
const regions: CrossFacetAxis = { kind: "literal", token: AXIS_REGIONS };
const scheme: CrossFacetAxis = { kind: "scheme", schemeUri: SCHEME };

describe("axisPairToParams", () => {
  // row→axes[0], column→axes[1]; a literal resolves to its token, a scheme to its
  // URI; vocabularyUrl is attached iff either axis is a scheme.
  test.each([
    {
      label: "both literal",
      row: regions,
      column: countries,
      expected: { axes: ["country_wb_regions", "countries"] },
    },
    {
      label: "row scheme",
      row: scheme,
      column: countries,
      expected: { axes: [SCHEME, "countries"], vocabularyUrl: VOCAB },
    },
    {
      label: "column scheme",
      row: regions,
      column: scheme,
      expected: { axes: ["country_wb_regions", SCHEME], vocabularyUrl: VOCAB },
    },
    {
      label: "both schemes",
      row: scheme,
      column: scheme,
      expected: { axes: [SCHEME, SCHEME], vocabularyUrl: VOCAB },
    },
  ])("$label", ({ row, column, expected }) => {
    expect(axisPairToParams({ row, column }, VOCAB)).toEqual(expected);
  });
});

describe("crossFacetTotals", () => {
  test("reads both totals when the backend sends them", () => {
    const result: ReferenceCrossFacetResult = {
      totals: {
        search: { count: 1961, is_lower_bound: false },
        mapped: { count: 1332, is_lower_bound: false },
      },
      total: { count: 1332, is_lower_bound: false },
      cells: [],
    };
    expect(crossFacetTotals(result)).toEqual({
      search: { count: 1961, is_lower_bound: false },
      mapped: { count: 1332, is_lower_bound: false },
    });
  });

  test("falls back to `total` for both on a backend predating the split", () => {
    const result: ReferenceCrossFacetResult = {
      total: { count: 1961, is_lower_bound: true },
      cells: [],
    };
    expect(crossFacetTotals(result)).toEqual({
      search: { count: 1961, is_lower_bound: true },
      mapped: { count: 1961, is_lower_bound: true },
    });
  });
});
