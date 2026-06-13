import { describe, expect, test } from "vitest";
import { orderFilterItems } from "@/components/filters/filterOrder";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";

function scheme(uri: string, label: string): ConceptScheme {
  return { uri, label, topConcepts: [] };
}

// Display labels strip a trailing "Scheme"; alphabetizing must use that form.
const zebra = scheme("u:zebra", "Zebra Scheme");
const apple = scheme("u:apple", "Apple Scheme");
const country = scheme("u:country", "Country");
const region = scheme("u:region", "Region");
const convening = scheme("u:convening", "Learning Convening");

function kinds(items: ReturnType<typeof orderFilterItems>): string[] {
  return items.map((i) =>
    i.kind === "scheme" ? i.scheme.uri : i.kind,
  );
}

describe("orderFilterItems", () => {
  test("default order: year, country, then schemes alphabetically by display label", () => {
    const items = orderFilterItems([zebra, apple]);
    expect(kinds(items)).toEqual(["year", "country", "u:apple", "u:zebra"]);
  });

  test("omits the country card when the facet filter is hidden", () => {
    const items = orderFilterItems([apple], { showCountryFacetFilter: false });
    expect(kinds(items)).toEqual(["year", "u:apple"]);
  });

  test("pins schemes by URI in order, then appends the rest alphabetically", () => {
    const items = orderFilterItems([zebra, apple, country, region, convening], {
      pinned: ["u:convening", "year", "u:country", "u:region"],
      showCountryFacetFilter: false,
    });
    expect(kinds(items)).toEqual([
      "u:convening",
      "year",
      "u:country",
      "u:region",
      "u:apple",
      "u:zebra",
    ]);
  });

  test("a pinned scheme isn't repeated by the trailing alphabetical sweep", () => {
    const items = orderFilterItems([zebra, apple], {
      pinned: ["u:zebra"],
      showCountryFacetFilter: false,
    });
    expect(kinds(items)).toEqual(["u:zebra", "u:apple"]);
  });

  test("ignores pinned URIs for schemes not present", () => {
    const items = orderFilterItems([apple], {
      pinned: ["u:missing", "year"],
      showCountryFacetFilter: false,
    });
    expect(kinds(items)).toEqual(["year", "u:apple"]);
  });
});
