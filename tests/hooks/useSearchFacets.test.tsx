import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/preact";
import type { ComponentChildren } from "preact";
import { useSearchFacets } from "@/hooks/useSearchFacets";
import { CommunityProvider } from "@/community/CommunityContext";
import type { ReferenceFacetResult } from "@/types/models";
import { makeSearchParams } from "../fixtures";

vi.mock("@/services/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/apiClient")>();
  return { ...actual, searchReferenceFacets: vi.fn() };
});

import { searchReferenceFacets } from "@/services/apiClient";
const mockFacets = vi.mocked(searchReferenceFacets);

const baseParams = makeSearchParams({ q: "phonics" });

function withCommunityPath(path: string) {
  window.history.replaceState(null, "", path);
  return ({ children }: { children: ComponentChildren }) => (
    <CommunityProvider>{children}</CommunityProvider>
  );
}

function result(...pairs: [string, number][]): ReferenceFacetResult {
  return { concepts: pairs.map(([concept, count]) => ({ concept, count })) };
}

function countryResult(...pairs: [string, number][]): ReferenceFacetResult {
  return { countries: pairs.map(([country, count]) => ({ country, count })) };
}

beforeEach(() => {
  mockFacets.mockReset();
  window.history.replaceState(null, "", "/");
});

describe("useSearchFacets", () => {
  test("fetches on mount with q + community annotations + both facet types", async () => {
    mockFacets.mockResolvedValue(result(["ex:A", 12]));
    const { result: hook } = renderHook(() => useSearchFacets(baseParams), {
      wrapper: withCommunityPath("/esea"),
    });
    await waitFor(() => expect(hook.current.loading).toBe(false));
    expect(hook.current.counts?.concepts.get("ex:A")).toBe(12);
    // Turtle URL ends in .ttl (env URL is the .jsonld form; the hook swaps it).
    expect(mockFacets).toHaveBeenCalledWith(
      "phonics",
      expect.objectContaining({
        annotation: ["domain-inclusion/jacobs-education"],
        conceptFilters: [],
      }),
      ["concepts", "countries"],
      expect.objectContaining({
        vocabularyUrl: expect.stringMatching(/\.ttl$/),
      }),
    );
  });

  test("parses both concept and country buckets into their respective Maps", async () => {
    mockFacets.mockResolvedValue({
      concepts: [{ concept: "ex:A", count: 1 }, { concept: "ex:B", count: 2 }],
      countries: [{ country: "DE", count: 50 }, { country: "FR", count: 30 }],
    });
    const { result: hook } = renderHook(() => useSearchFacets(baseParams), {
      wrapper: withCommunityPath("/esea"),
    });
    await waitFor(() => expect(hook.current.counts).not.toBeNull());
    expect(hook.current.counts?.concepts.get("ex:A")).toBe(1);
    expect(hook.current.counts?.concepts.get("ex:B")).toBe(2);
    expect(hook.current.counts?.countries.get("DE")).toBe(50);
    expect(hook.current.counts?.countries.get("FR")).toBe(30);
  });

  test("handles a response with no facet fields as empty Maps", async () => {
    mockFacets.mockResolvedValue({});
    const { result: hook } = renderHook(() => useSearchFacets(baseParams), {
      wrapper: withCommunityPath("/esea"),
    });
    await waitFor(() => expect(hook.current.loading).toBe(false));
    expect(hook.current.counts).not.toBeNull();
    expect(hook.current.counts?.concepts.size).toBe(0);
    expect(hook.current.counts?.countries.size).toBe(0);
  });

  test("parses country buckets even when concepts field is absent", async () => {
    mockFacets.mockResolvedValue(countryResult(["DE", 50]));
    const { result: hook } = renderHook(() => useSearchFacets(baseParams), {
      wrapper: withCommunityPath("/esea"),
    });
    await waitFor(() => expect(hook.current.counts).not.toBeNull());
    expect(hook.current.counts?.countries.get("DE")).toBe(50);
    expect(hook.current.counts?.concepts.size).toBe(0);
  });

  test("does NOT refetch when only page changes", async () => {
    mockFacets.mockResolvedValue(result());
    const { rerender } = renderHook(({ p }) => useSearchFacets(p), {
      wrapper: withCommunityPath("/esea"),
      initialProps: { p: baseParams },
    });
    await waitFor(() => expect(mockFacets).toHaveBeenCalledTimes(1));
    rerender({ p: { ...baseParams, page: 5 } });
    rerender({ p: { ...baseParams, page: 9 } });
    expect(mockFacets).toHaveBeenCalledTimes(1);
  });

  test("does NOT refetch when only sort changes", async () => {
    mockFacets.mockResolvedValue(result());
    const { rerender } = renderHook(({ p }) => useSearchFacets(p), {
      wrapper: withCommunityPath("/esea"),
      initialProps: { p: baseParams },
    });
    await waitFor(() => expect(mockFacets).toHaveBeenCalledTimes(1));
    rerender({ p: { ...baseParams, sort: "newest" as const } });
    rerender({ p: { ...baseParams, sort: "oldest" as const } });
    expect(mockFacets).toHaveBeenCalledTimes(1);
  });

  test("refetches when q changes", async () => {
    mockFacets.mockResolvedValue(result());
    const { rerender } = renderHook(({ p }) => useSearchFacets(p), {
      wrapper: withCommunityPath("/esea"),
      initialProps: { p: baseParams },
    });
    await waitFor(() => expect(mockFacets).toHaveBeenCalledTimes(1));
    rerender({ p: { ...baseParams, q: "synthetic phonics" } });
    await waitFor(() => expect(mockFacets).toHaveBeenCalledTimes(2));
  });

  test("refetches when conceptFilters change (sibling-aware counts depend on the filter set)", async () => {
    mockFacets.mockResolvedValue(result());
    const { rerender } = renderHook(({ p }) => useSearchFacets(p), {
      wrapper: withCommunityPath("/esea"),
      initialProps: { p: baseParams },
    });
    await waitFor(() => expect(mockFacets).toHaveBeenCalledTimes(1));
    rerender({
      p: {
        ...baseParams,
        conceptFilters: [["ex:A"]],
      },
    });
    await waitFor(() => expect(mockFacets).toHaveBeenCalledTimes(2));
  });

  test("preserves prior counts while a new fetch is in flight (dim-while-updating)", async () => {
    const resolvers: ((v: ReferenceFacetResult) => void)[] = [];
    mockFacets.mockImplementation(
      () => new Promise<ReferenceFacetResult>((r) => { resolvers.push(r); }),
    );

    const { result: hook, rerender } = renderHook(
      ({ p }) => useSearchFacets(p),
      {
        wrapper: withCommunityPath("/esea"),
        initialProps: { p: baseParams },
      },
    );
    resolvers[0](result(["ex:A", 10]));
    await waitFor(() => expect(hook.current.counts?.concepts.get("ex:A")).toBe(10));

    rerender({ p: { ...baseParams, q: "next" } });
    expect(hook.current.counts?.concepts.get("ex:A")).toBe(10);
    expect(hook.current.loading).toBe(true);

    resolvers[1](result(["ex:A", 20]));
    await waitFor(() => expect(hook.current.counts?.concepts.get("ex:A")).toBe(20));
  });

  test("clears counts to null on settled error", async () => {
    mockFacets.mockRejectedValue(new Error("boom"));
    const { result: hook } = renderHook(() => useSearchFacets(baseParams), {
      wrapper: withCommunityPath("/esea"),
    });
    await waitFor(() => {
      expect(hook.current.error?.message).toBe("boom");
      expect(hook.current.counts).toBeNull();
      expect(hook.current.loading).toBe(false);
    });
  });

  test("idle (no fetch) when slug resolves to no community", () => {
    mockFacets.mockResolvedValue(result());
    const { result: hook } = renderHook(() => useSearchFacets(baseParams), {
      wrapper: withCommunityPath("/banana"),
    });
    expect(hook.current.counts).toBeNull();
    expect(hook.current.loading).toBe(false);
    expect(hook.current.error).toBeNull();
    expect(mockFacets).not.toHaveBeenCalled();
  });
});
