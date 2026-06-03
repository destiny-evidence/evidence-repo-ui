import { vi } from "vitest";
import { api } from "@/api/client";
import {
  searchReferences,
  searchReferenceFacets,
  crossFacets,
  getReference,
} from "@/services/apiClient";
import type {
  Reference,
  ReferenceCrossFacetResult,
  ReferenceFacetResult,
  SearchResult,
} from "@/types/models";

vi.mock("@/api/client", () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockedGet = vi.mocked(api.get);

beforeEach(() => {
  mockedGet.mockReset();
});

describe("searchReferences", () => {
  const result: SearchResult = {
    total: { count: 1, is_lower_bound: false },
    page: { count: 10, number: 1 },
    references: [],
  };

  test("calls the correct endpoint with query", async () => {
    mockedGet.mockResolvedValue(result);
    await searchReferences("climate change");
    expect(mockedGet).toHaveBeenCalledWith(
      "/v1/references/search/?q=climate+change",
    );
  });

  test("appends page filter", async () => {
    mockedGet.mockResolvedValue(result);
    await searchReferences("test", { page: 3 });
    expect(mockedGet).toHaveBeenCalledWith(
      "/v1/references/search/?q=test&page=3",
    );
  });

  test.each([
    { label: "zero",        value: 0 },
    { label: "negative",    value: -3 },
    { label: "fractional",  value: 1.5 },
    { label: "NaN",         value: NaN },
    { label: "Infinity",    value: Infinity },
    { label: "overflow",    value: Number.MAX_SAFE_INTEGER + 2 },
  ])("omits page when value is $label", async ({ value }) => {
    mockedGet.mockResolvedValue(result);
    await searchReferences("test", { page: value });
    expect(mockedGet).toHaveBeenCalledWith(
      "/v1/references/search/?q=test",
    );
  });

  test.each([
    { label: "zero",        value: 0 },
    { label: "negative",    value: -1 },
    { label: "fractional",  value: 2010.5 },
    { label: "NaN",         value: NaN },
    { label: "Infinity",    value: Infinity },
    { label: "overflow",    value: Number.MAX_SAFE_INTEGER + 2 },
  ])("omits start_year and end_year when value is $label", async ({ value }) => {
    mockedGet.mockResolvedValue(result);
    await searchReferences("test", { startYear: value, endYear: value });
    const params = new URLSearchParams(mockedGet.mock.calls[0][0].split("?")[1]);
    expect(params.has("start_year")).toBe(false);
    expect(params.has("end_year")).toBe(false);
  });

  test("appends multiple annotation params", async () => {
    mockedGet.mockResolvedValue(result);
    await searchReferences("test", { annotation: ["foo", "bar"] });
    const url = mockedGet.mock.calls[0][0];
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.getAll("annotation")).toEqual(["foo", "bar"]);
  });

  test("returns the result from api.get", async () => {
    mockedGet.mockResolvedValue(result);
    const res = await searchReferences("test");
    expect(res).toBe(result);
  });

  test("trims whitespace from query", async () => {
    mockedGet.mockResolvedValue(result);
    await searchReferences("  phonics  ");
    expect(mockedGet).toHaveBeenCalledWith(
      "/v1/references/search/?q=phonics",
    );
  });

  test.each([
    { label: "empty string", q: "" },
    { label: "whitespace only", q: "   " },
    { label: "undefined", q: undefined as string | undefined },
  ])("$label query → browse-mode q=*", async ({ q }) => {
    mockedGet.mockResolvedValue(result);
    await searchReferences(q);
    expect(mockedGet).toHaveBeenCalledWith(
      "/v1/references/search/?q=*",
    );
  });

  test("half-open range: startYear only → start_year set, end_year absent", async () => {
    mockedGet.mockResolvedValue(result);
    await searchReferences("test", { startYear: 2010 });
    const params = new URLSearchParams(mockedGet.mock.calls[0][0].split("?")[1]);
    expect(params.get("start_year")).toBe("2010");
    expect(params.has("end_year")).toBe(false);
  });

  test("half-open range: endYear only → end_year set, start_year absent", async () => {
    mockedGet.mockResolvedValue(result);
    await searchReferences("test", { endYear: 2024 });
    const params = new URLSearchParams(mockedGet.mock.calls[0][0].split("?")[1]);
    expect(params.get("end_year")).toBe("2024");
    expect(params.has("start_year")).toBe(false);
  });

  test("closed range: both years set → both serialized", async () => {
    mockedGet.mockResolvedValue(result);
    await searchReferences("test", { startYear: 2010, endYear: 2024 });
    const params = new URLSearchParams(mockedGet.mock.calls[0][0].split("?")[1]);
    expect(params.get("start_year")).toBe("2010");
    expect(params.get("end_year")).toBe("2024");
  });

  test("appends multiple sort params", async () => {
    mockedGet.mockResolvedValue(result);
    await searchReferences("test", { sort: ["relevance", "-year"] });
    const url = mockedGet.mock.calls[0][0];
    expect(new URLSearchParams(url.split("?")[1]).getAll("sort")).toEqual([
      "relevance",
      "-year",
    ]);
  });
});

describe("searchReferenceFacets", () => {
  const emptyResult: ReferenceFacetResult = { concepts: [] };

  test("hits the /facets/ endpoint with q and one facet param", async () => {
    mockedGet.mockResolvedValue(emptyResult);
    await searchReferenceFacets("phonics", {}, ["concepts"]);
    expect(mockedGet).toHaveBeenCalledWith(
      "/v1/references/search/facets/?q=phonics&facet=concepts",
    );
  });

  test("empty/whitespace query becomes browse-mode q=*", async () => {
    mockedGet.mockResolvedValue(emptyResult);
    await searchReferenceFacets("   ", {}, ["concepts"]);
    const url = mockedGet.mock.calls[0][0];
    expect(new URLSearchParams(url.split("?")[1]).get("q")).toBe("*");
  });

  test("forwards year and annotation filters; never sends page or sort", async () => {
    mockedGet.mockResolvedValue(emptyResult);
    await searchReferenceFacets(
      "phonics",
      { startYear: 2010, endYear: 2020, annotation: ["a", "b"] },
      ["concepts"],
    );
    const url = mockedGet.mock.calls[0][0];
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("start_year")).toBe("2010");
    expect(params.get("end_year")).toBe("2020");
    expect(params.getAll("annotation")).toEqual(["a", "b"]);
    expect(params.has("page")).toBe(false);
    expect(params.has("sort")).toBe(false);
  });

  test("appends one facet param per requested facet", async () => {
    mockedGet.mockResolvedValue(emptyResult);
    await searchReferenceFacets("x", {}, ["concepts", "concepts"]);
    const url = mockedGet.mock.calls[0][0];
    expect(new URLSearchParams(url.split("?")[1]).getAll("facet")).toEqual([
      "concepts",
      "concepts",
    ]);
  });

  test("returns the result from api.get", async () => {
    const result: ReferenceFacetResult = {
      concepts: [{ concept: "ex:A", count: 5 }],
    };
    mockedGet.mockResolvedValue(result);
    const res = await searchReferenceFacets("x", {}, ["concepts"]);
    expect(res).toBe(result);
  });
});

describe("crossFacets", () => {
  const result: ReferenceCrossFacetResult = {
    total: { count: 42, is_lower_bound: false },
    cells: [{ row: "AFE", column: "ex:Theme", count: 7 }],
  };

  test("hits the /cross-facets/ endpoint with q, row and column", async () => {
    mockedGet.mockResolvedValue(result);
    await crossFacets("phonics", {}, {
      row: "country_wb_regions",
      column: "countries",
    });
    expect(mockedGet.mock.calls[0][0]).toMatch(
      /^\/v1\/references\/search\/cross-facets\/\?/,
    );
    const params = new URLSearchParams(mockedGet.mock.calls[0][0].split("?")[1]);
    expect(params.get("q")).toBe("phonics");
    expect(params.get("row")).toBe("country_wb_regions");
    expect(params.get("column")).toBe("countries");
  });

  test("appends vocabulary only when provided", async () => {
    mockedGet.mockResolvedValue(result);
    await crossFacets("x", {}, { row: "countries", column: "countries" });
    expect(
      new URLSearchParams(mockedGet.mock.calls[0][0].split("?")[1]).has("vocabulary"),
    ).toBe(false);

    await crossFacets("x", {}, {
      row: "https://vocab.example/scheme/Themes",
      column: "countries",
      vocabularyUrl: "https://vocab.example/v1/vocabulary.ttl",
    });
    expect(
      new URLSearchParams(mockedGet.mock.calls[1][0].split("?")[1]).get("vocabulary"),
    ).toBe("https://vocab.example/v1/vocabulary.ttl");
  });


  test("forwards concept and country filters", async () => {
    mockedGet.mockResolvedValue(result);
    await crossFacets(
      "phonics",
      { conceptFilters: [["ex:A"], ["ex:B"]], countryCodes: ["DE", "FR"] },
      { row: "countries", column: "country_wb_regions" },
    );
    const params = new URLSearchParams(mockedGet.mock.calls[0][0].split("?")[1]);
    expect(params.getAll("concept")).toEqual(["ex:A", "ex:B"]);
    expect(params.get("country")).toBe("DE,FR");
  });

  test("returns the result from api.get", async () => {
    mockedGet.mockResolvedValue(result);
    const res = await crossFacets("x", {}, { row: "countries", column: "countries" });
    expect(res).toBe(result);
  });
});

describe("getReference", () => {
  test("calls the identifier lookup endpoint", async () => {
    const ref = { id: "abc-123" } as Reference;
    mockedGet.mockResolvedValue([ref]);
    await getReference("abc-123");
    expect(mockedGet).toHaveBeenCalledWith(
      "/v1/references/?identifier=abc-123",
    );
  });

  test("returns the first result", async () => {
    const ref = { id: "abc-123" } as Reference;
    mockedGet.mockResolvedValue([ref]);
    const res = await getReference("abc-123");
    expect(res).toBe(ref);
  });

  test("returns null when no results", async () => {
    mockedGet.mockResolvedValue([]);
    const res = await getReference("nonexistent");
    expect(res).toBeNull();
  });

  test("encodes identifier in URL", async () => {
    mockedGet.mockResolvedValue([]);
    await getReference("doi:10.1000/abc123");
    expect(mockedGet).toHaveBeenCalledWith(
      "/v1/references/?identifier=doi%3A10.1000%2Fabc123",
    );
  });
});
