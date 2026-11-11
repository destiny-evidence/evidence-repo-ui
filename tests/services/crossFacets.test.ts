import { describe, test, expect } from "vitest";
import {
  AXIS_COUNTRIES,
  AXIS_INCOME_GROUPS,
  axisPairToParams,
} from "@/services/crossFacets";
import type { MapAxis } from "@/types/models";

const VOCAB = "https://vocab.example/v1/vocabulary.ttl";
const SCHEME = "https://vocab.example/scheme/Themes";

const countries: MapAxis = { kind: "literal", token: AXIS_COUNTRIES };
const incomeGroups: MapAxis = { kind: "literal", token: AXIS_INCOME_GROUPS };
const scheme: MapAxis = { kind: "scheme", schemeUri: SCHEME };

describe("axisPairToParams", () => {
  // row→axes[0], column→axes[1]; a literal resolves to its token, a scheme to its
  // URI. The vocabulary always rides along; the backend decides if it needs it.
  test.each([
    {
      label: "both literal",
      row: incomeGroups,
      column: countries,
      expected: { axes: ["country_wb_income_groups", "countries"], vocabularyUrl: VOCAB },
    },
    {
      label: "row scheme",
      row: scheme,
      column: countries,
      expected: { axes: [SCHEME, "countries"], vocabularyUrl: VOCAB },
    },
    {
      label: "column scheme",
      row: countries,
      column: scheme,
      expected: { axes: ["countries", SCHEME], vocabularyUrl: VOCAB },
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

