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
  // A literal axis resolves to its token, a scheme axis to its URI; vocabularyUrl
  // is attached iff either axis is a scheme.
  test.each([
    {
      label: "both literal",
      row: regions,
      column: countries,
      expected: { row: "country_wb_regions", column: "countries" },
    },
    {
      label: "row scheme",
      row: scheme,
      column: countries,
      expected: { row: SCHEME, column: "countries", vocabularyUrl: VOCAB },
    },
    {
      label: "column scheme",
      row: regions,
      column: scheme,
      expected: {
        row: "country_wb_regions",
        column: SCHEME,
        vocabularyUrl: VOCAB,
      },
    },
    {
      label: "both schemes",
      row: scheme,
      column: scheme,
      expected: { row: SCHEME, column: SCHEME, vocabularyUrl: VOCAB },
    },
  ])("$label", ({ row, column, expected }) => {
    expect(axisPairToParams({ row, column }, VOCAB)).toEqual(expected);
  });
});
