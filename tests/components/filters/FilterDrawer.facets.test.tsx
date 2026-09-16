import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import type { ComponentProps } from "preact";
import { api } from "@/api/client";
import { FilterDrawer } from "@/components/filters/FilterDrawer";
import type { ReferenceFacetResult } from "@/types/models";
import { makeCommunity, makeSearchParams } from "../../fixtures";
import {
  DOCUMENT_TYPE_SCHEME,
  OUTCOME_SCHEME_FIXTURE,
  URI_JOURNAL,
} from "./fixtures";

// Mocks the API rather than useSearchFacets, so the assertions see the real
// request the drawer builds.
vi.mock("@/api/client", () => ({ api: { get: vi.fn() } }));
vi.mock("@/community/CommunityContext", () => ({
  useCommunity: () => makeCommunity({
    vocabularyUrl: "https://vocab.example/vocabulary.jsonld",
    defaultAnnotations: ["domain-inclusion/test"],
  }),
}));

const mockGet = vi.mocked(api.get);
const baseProps: ComponentProps<typeof FilterDrawer> = {
  schemes: [OUTCOME_SCHEME_FIXTURE, DOCUMENT_TYPE_SCHEME],
  appliedConceptFilters: [],
  appliedCountryCodes: [],
  appliedStartYear: undefined,
  appliedEndYear: undefined,
  params: makeSearchParams({ q: "climate" }),
  defaultExpandedFilters: [DOCUMENT_TYPE_SCHEME.uri],
  open: true,
  onApply: vi.fn(),
  onCancel: () => {},
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

test("the Search drawer sends no axes, and sends the vocabulary with or without a concept", async () => {
  render(<FilterDrawer {...baseProps} />);
  await screen.findByLabelText("12 results");
  expect(latestParams().has("axes")).toBe(false);
  expect(latestParams().get("vocabulary")).toBe("https://vocab.example/vocabulary.ttl");

  fireEvent.click(screen.getByRole("checkbox", { name: /Journal Article/ }));
  await waitFor(() => expect(latestParams().getAll("concept")).toEqual([URI_JOURNAL]));
  expect(latestParams().has("axes")).toBe(false);
  expect(latestParams().get("vocabulary")).toBe("https://vocab.example/vocabulary.ttl");
});
