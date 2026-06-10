import { describe, test, expect } from "vitest";
import { deriveSummaryTerms } from "@/components/ai-summary/summaryTerms";
import { makeSearchParams } from "../../fixtures";

const labels = new Map([
  ["ex:cost", "Cost-effectiveness"],
  ["ex:access", "Access to Education"],
]);

describe("deriveSummaryTerms", () => {
  test("uses the free-text query when present", () => {
    const params = makeSearchParams({ q: "phonics" });
    expect(deriveSummaryTerms(params, labels)).toEqual(["phonics"]);
  });

  test("resolves concept-filter labels (the map-cell case, q='*')", () => {
    const params = makeSearchParams({
      q: "*",
      conceptFilters: [["ex:cost"], ["ex:access"]],
    });
    expect(deriveSummaryTerms(params, labels)).toEqual([
      "Cost-effectiveness",
      "Access to Education",
    ]);
  });

  test("combines query and concept labels", () => {
    const params = makeSearchParams({
      q: "afghanistan",
      conceptFilters: [["ex:cost"]],
    });
    expect(deriveSummaryTerms(params, labels)).toEqual([
      "afghanistan",
      "Cost-effectiveness",
    ]);
  });

  test("excludes country and year constraints from terms", () => {
    const params = makeSearchParams({
      q: "phonics",
      countryCodes: ["BD", "BJ"],
      startYear: 2015,
      endYear: 2020,
    });
    expect(deriveSummaryTerms(params, labels)).toEqual(["phonics"]);
  });

  test("falls back to the URI when a label is unknown", () => {
    const params = makeSearchParams({ q: "*", conceptFilters: [["ex:missing"]] });
    expect(deriveSummaryTerms(params, labels)).toEqual(["ex:missing"]);
    expect(deriveSummaryTerms(params, null)).toEqual(["ex:missing"]);
  });

  test("is empty for a bare browse-mode search", () => {
    expect(deriveSummaryTerms(makeSearchParams({ q: "*" }), labels)).toEqual([]);
    expect(deriveSummaryTerms(makeSearchParams({ q: "" }), labels)).toEqual([]);
  });
});
