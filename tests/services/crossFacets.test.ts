import { describe, test, expect } from "vitest";
import {
  AXIS_COUNTRIES,
  AXIS_REGIONS,
  axisPairToParams,
  type CrossFacetAxis,
} from "@/services/crossFacets";

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
