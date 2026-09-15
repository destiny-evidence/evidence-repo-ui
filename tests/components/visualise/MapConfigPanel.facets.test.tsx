import { beforeEach, describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import type { ComponentProps } from "preact";
import { api } from "@/api/client";
import { MapConfigPanel } from "@/components/visualise/MapConfigPanel";
import { FilterDrawer } from "@/components/filters/FilterDrawer";
import type { EvidenceMapAxes, ReferenceFacetResult } from "@/types/models";
import { makeCommunity, makeSearchParams } from "../../fixtures";
import {
  DOCUMENT_TYPE_SCHEME,
  OUTCOME_SCHEME_FIXTURE,
  URI_JOURNAL,
} from "../filters/fixtures";

vi.mock("@/api/client", () => ({ api: { get: vi.fn() } }));
vi.mock("@/community/CommunityContext", () => ({
  useCommunity: () => makeCommunity({
    vocabularyUrl: "https://vocab.example/vocabulary.jsonld",
    defaultAnnotations: ["domain-inclusion/test"],
  }),
}));

const mockGet = vi.mocked(api.get);
const axes: EvidenceMapAxes = {
  row: { kind: "scheme", schemeUri: OUTCOME_SCHEME_FIXTURE.uri },
  column: { kind: "scheme", schemeUri: DOCUMENT_TYPE_SCHEME.uri },
};
const baseProps: ComponentProps<typeof MapConfigPanel> = {
  schemes: [OUTCOME_SCHEME_FIXTURE, DOCUMENT_TYPE_SCHEME],
  loading: false,
  appliedAxes: axes,
  defaultAxes: axes,
  appliedConceptFilters: [],
  appliedCountryCodes: [],
  appliedStartYear: undefined,
  appliedEndYear: undefined,
  params: makeSearchParams({ q: "climate" }),
  defaultExpandedFilters: [DOCUMENT_TYPE_SCHEME.uri],
  onApply: vi.fn(),
};

function facetResult(count: number): ReferenceFacetResult {
  return { concepts: [{ concept: URI_JOURNAL, count }] };
}

function latestParams(): URLSearchParams {
  const url = mockGet.mock.calls.at(-1)![0];
  expect(url).toMatch(/^\/v1\/references\/search\/facets\/\?/);
  return new URLSearchParams(url.split("?")[1]);
}

beforeEach(() => {
  mockGet.mockReset().mockResolvedValue(facetResult(12));
});

describe("map panel facet requests", () => {
  test("sends both scheme axes and Turtle vocabulary without a concept selection", async () => {
    render(<MapConfigPanel {...baseProps} />);
    await screen.findByLabelText("12 results");
    const params = latestParams();
    expect(params.getAll("axes")).toEqual([
      OUTCOME_SCHEME_FIXTURE.uri, DOCUMENT_TYPE_SCHEME.uri,
    ]);
    expect(params.get("vocabulary")).toBe("https://vocab.example/vocabulary.ttl");
    expect(params.has("concept")).toBe(false);
    expect(params.get("q")).toBe("climate");
    expect(params.getAll("annotation")).toEqual(["domain-inclusion/test"]);
    expect(params.getAll("facet")).toEqual(["concepts", "countries"]);
  });

  test.each([
    ["Rows (y)", ["countries", DOCUMENT_TYPE_SCHEME.uri]],
    ["Columns (x)", [OUTCOME_SCHEME_FIXTURE.uri, "countries"]],
  ])("refreshes counts when %s changes without applying the map", async (label, expectedAxes) => {
    const onApply = vi.fn();
    render(<MapConfigPanel {...baseProps} onApply={onApply} />);
    await screen.findByLabelText("12 results");
    mockGet.mockResolvedValue(facetResult(7));

    fireEvent.change(screen.getByLabelText(label), { target: { value: "countries" } });
    await screen.findByLabelText("7 results");
    expect(latestParams().getAll("axes")).toEqual(expectedAxes);
    expect(latestParams().get("vocabulary")).toBe("https://vocab.example/vocabulary.ttl");
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox", { name: /Journal Article/ }));
    await waitFor(() => expect(latestParams().getAll("concept")).toEqual([URI_JOURNAL]));
    expect(latestParams().getAll("axes")).toEqual(expectedAxes);
    fireEvent.click(screen.getByRole("button", { name: "Show results" }));
    expect(onApply).toHaveBeenCalledWith({
      axes: {
        row: label === "Rows (y)" ? { kind: "countries" } : axes.row,
        column: label === "Columns (x)" ? { kind: "countries" } : axes.column,
      },
      filters: {
        conceptFilters: [[URI_JOURNAL]], countryCodes: [],
        startYear: undefined, endYear: undefined,
      },
    });
  });

  test("Reset all fetches for the default axes and cleared filters without applying", async () => {
    const onApply = vi.fn();
    render(<MapConfigPanel
      {...baseProps}
      appliedAxes={{ row: { kind: "countries" }, column: axes.row }}
      appliedConceptFilters={[[URI_JOURNAL]]}
      appliedCountryCodes={["AU"]}
      appliedStartYear={2000}
      appliedEndYear={2020}
      onApply={onApply}
    />);
    await screen.findByLabelText("12 results");
    expect(latestParams().getAll("axes")).toEqual(["countries", OUTCOME_SCHEME_FIXTURE.uri]);
    expect(latestParams().getAll("concept")).toEqual([URI_JOURNAL]);
    mockGet.mockResolvedValue(facetResult(25));

    fireEvent.click(screen.getByRole("button", { name: "Reset all" }));
    await screen.findByLabelText("25 results");
    const params = latestParams();
    expect(params.getAll("axes")).toEqual([OUTCOME_SCHEME_FIXTURE.uri, DOCUMENT_TYPE_SCHEME.uri]);
    for (const key of ["concept", "country", "start_year", "end_year"]) {
      expect(params.has(key)).toBe(false);
    }
    expect(params.get("vocabulary")).toBe("https://vocab.example/vocabulary.ttl");
    expect(onApply).not.toHaveBeenCalled();
  });

  test("sends the vocabulary for literal-only axes", async () => {
    // Reachable from the URL: ?row=countries&column=countries parses even though
    // the dropdowns disable it.
    render(<MapConfigPanel
      {...baseProps}
      appliedAxes={{ row: { kind: "countries" }, column: { kind: "countries" } }}
    />);
    await screen.findByLabelText("12 results");
    expect(latestParams().getAll("axes")).toEqual(["countries", "countries"]);
    expect(latestParams().get("vocabulary")).toBe("https://vocab.example/vocabulary.ttl");

    fireEvent.click(screen.getByRole("checkbox", { name: /Journal Article/ }));
    await waitFor(() => expect(latestParams().getAll("concept")).toEqual([URI_JOURNAL]));
    expect(latestParams().get("vocabulary")).toBe("https://vocab.example/vocabulary.ttl");
  });

  test("ignores a late response for the previous axes", async () => {
    let resolvePrevious!: (value: ReferenceFacetResult) => void;
    mockGet.mockReturnValueOnce(new Promise<ReferenceFacetResult>((resolve) => {
      resolvePrevious = resolve;
    }));
    render(<MapConfigPanel {...baseProps} />);
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("Rows (y)"), { target: { value: "countries" } });
    await screen.findByLabelText("12 results");
    await act(async () => resolvePrevious(facetResult(99)));
    expect(screen.getByLabelText("12 results")).toBeInTheDocument();
    expect(screen.queryByLabelText("99 results")).toBeNull();
  });
});

test("the Search drawer sends no axes, and sends the vocabulary with or without a concept", async () => {
  render(<FilterDrawer {...baseProps} open onCancel={() => {}} onApply={vi.fn()} />);
  await screen.findByLabelText("12 results");
  expect(latestParams().has("axes")).toBe(false);
  expect(latestParams().get("vocabulary")).toBe("https://vocab.example/vocabulary.ttl");

  fireEvent.click(screen.getByRole("checkbox", { name: /Journal Article/ }));
  await waitFor(() => expect(latestParams().getAll("concept")).toEqual([URI_JOURNAL]));
  expect(latestParams().has("axes")).toBe(false);
  expect(latestParams().get("vocabulary")).toBe("https://vocab.example/vocabulary.ttl");
});
