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

  test("pins a scheme by URI and groups geographic schemes in config order", () => {
    const items = orderFilterItems([zebra, apple, country, region, convening], {
      order: [
        "u:convening",
        "year",
        "geographicSchemes",
        "otherSchemes",
      ],
      geographicSchemes: ["u:country", "u:region"],
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

  test("never places a scheme twice; the first slot claiming it wins", () => {
    const items = orderFilterItems([country], {
      order: ["u:country", "geographicSchemes", "otherSchemes"],
      geographicSchemes: ["u:country"],
      showCountryFacetFilter: false,
    });
    expect(kinds(items)).toEqual(["u:country"]);
  });

  test("appends a trailing otherSchemes sweep so no scheme is dropped", () => {
    const items = orderFilterItems([zebra, apple], {
      order: ["year"],
    });
    expect(kinds(items)).toEqual(["year", "u:apple", "u:zebra"]);
  });

  test("ignores order tokens for schemes not present", () => {
    const items = orderFilterItems([apple], {
      order: ["u:missing", "year", "otherSchemes"],
      showCountryFacetFilter: false,
    });
    expect(kinds(items)).toEqual(["year", "u:apple"]);
  });
});
