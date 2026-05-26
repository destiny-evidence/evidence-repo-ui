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

beforeEach(() => {
  mockFacets.mockReset();
  window.history.replaceState(null, "", "/");
});

describe("useSearchFacets", () => {
  test("fetches on mount with q + community annotations", async () => {
    mockFacets.mockResolvedValue(result(["ex:A", 12]));
    const { result: hook } = renderHook(() => useSearchFacets(baseParams), {
      wrapper: withCommunityPath("/esea"),
    });
    await waitFor(() => expect(hook.current.loading).toBe(false));
    expect(hook.current.counts?.get("ex:A")).toBe(12);
    expect(mockFacets).toHaveBeenCalledWith(
      "phonics",
      expect.objectContaining({
        annotation: ["domain-inclusion/jacobs-education"],
      }),
      ["concepts"],
    );
  });

  test("converts the SDK response array to a Map keyed by concept URI", async () => {
    mockFacets.mockResolvedValue(result(["ex:A", 1], ["ex:B", 2]));
    const { result: hook } = renderHook(() => useSearchFacets(baseParams), {
      wrapper: withCommunityPath("/esea"),
    });
    await waitFor(() => expect(hook.current.counts).not.toBeNull());
    expect(hook.current.counts?.size).toBe(2);
    expect(hook.current.counts?.get("ex:A")).toBe(1);
    expect(hook.current.counts?.get("ex:B")).toBe(2);
  });

  test("handles a response with no concepts field as an empty Map", async () => {
    mockFacets.mockResolvedValue({});
    const { result: hook } = renderHook(() => useSearchFacets(baseParams), {
      wrapper: withCommunityPath("/esea"),
    });
    await waitFor(() => expect(hook.current.loading).toBe(false));
    expect(hook.current.counts).not.toBeNull();
    expect(hook.current.counts?.size).toBe(0);
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

  test("refetches when facets change (counts are intersection-with-selection)", async () => {
    mockFacets.mockResolvedValue(result());
    const { rerender } = renderHook(({ p }) => useSearchFacets(p), {
      wrapper: withCommunityPath("/esea"),
      initialProps: { p: baseParams },
    });
    await waitFor(() => expect(mockFacets).toHaveBeenCalledTimes(1));
    rerender({
      p: {
        ...baseParams,
        searchFacets: ['linked_data_concepts:"ex:A"'],
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
    await waitFor(() => expect(hook.current.counts?.get("ex:A")).toBe(10));

    rerender({ p: { ...baseParams, q: "next" } });
    expect(hook.current.counts?.get("ex:A")).toBe(10);
    expect(hook.current.loading).toBe(true);

    resolvers[1](result(["ex:A", 20]));
    await waitFor(() => expect(hook.current.counts?.get("ex:A")).toBe(20));
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
