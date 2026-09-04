import { describe, test, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/preact";
import type { ComponentChildren } from "preact";
import { useCrossFacets } from "@/hooks/useCrossFacets";
import { CommunityProvider } from "@/community/CommunityContext";
import {
  AXIS_COUNTRIES,
  AXIS_REGIONS,
  type CrossFacetAxisPair,
} from "@/services/crossFacets";
import type { ReferenceCrossFacetResult } from "@/types/models";
import { makeSearchParams } from "../fixtures";

vi.mock("@/services/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/apiClient")>();
  return { ...actual, crossFacets: vi.fn() };
});

import { crossFacets } from "@/services/apiClient";
const mockCrossFacets = vi.mocked(crossFacets);

const baseParams = makeSearchParams({ q: "phonics" });
const SCHEME = "https://vocab.example/scheme/Themes";
const regionVsScheme: CrossFacetAxisPair = {
  row: { kind: "literal", token: AXIS_REGIONS },
  column: { kind: "scheme", schemeUri: SCHEME },
};
const regionVsCountry: CrossFacetAxisPair = {
  row: { kind: "literal", token: AXIS_REGIONS },
  column: { kind: "literal", token: AXIS_COUNTRIES },
};

function withCommunityPath(path: string) {
  window.history.replaceState(null, "", path);
  return ({ children }: { children: ComponentChildren }) => (
    <CommunityProvider>{children}</CommunityProvider>
  );
}

function result(
  ...cells: [string, string, number][]
): ReferenceCrossFacetResult {
  return {
    totals: {
      search: { count: 99, is_lower_bound: false },
      mapped: { count: 99, is_lower_bound: false },
    },
    cells: cells.map(([a0, a1, count]) => ({ axes: [a0, a1], count })),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
}

beforeEach(() => {
  mockCrossFacets.mockReset();
  window.history.replaceState(null, "", "/");
});

describe("useCrossFacets", () => {
  test("forwards filters, resolves axes against the Turtle vocab, returns cells + totals", async () => {
    mockCrossFacets.mockResolvedValue(result(["AFE", SCHEME, 7]));
    const { result: hook } = renderHook(
      () => useCrossFacets(baseParams, regionVsScheme),
      { wrapper: withCommunityPath("/esea") },
    );
    await waitFor(() => expect(hook.current.loading).toBe(false));

    expect(hook.current.result?.totals.mapped.count).toBe(99);
    expect(hook.current.result?.cells).toEqual([
      { axes: ["AFE", SCHEME], count: 7 },
    ]);
    expect(mockCrossFacets).toHaveBeenCalledWith(
      "phonics",
      expect.objectContaining({
        annotation: ["domain-inclusion/jacobs-education"],
        conceptFilters: [],
      }),
      {
        axes: ["country_wb_regions", SCHEME],
        vocabularyUrl: expect.stringMatching(/\.ttl$/),
      },
    );
  });

  test("refetches when the axis selection changes", async () => {
    mockCrossFacets.mockResolvedValue(result());
    const { rerender } = renderHook(
      ({ axes }) => useCrossFacets(baseParams, axes),
      {
        wrapper: withCommunityPath("/esea"),
        initialProps: { axes: regionVsScheme },
      },
    );
    await waitFor(() => expect(mockCrossFacets).toHaveBeenCalledTimes(1));
    rerender({ axes: regionVsCountry });
    await waitFor(() => expect(mockCrossFacets).toHaveBeenCalledTimes(2));
  });

  test("does not refetch when a caller rerenders equivalent query inputs", async () => {
    mockCrossFacets.mockResolvedValue(result());
    const { rerender } = renderHook(
      ({ params, axes }) => useCrossFacets(params, axes),
      {
        wrapper: withCommunityPath("/esea"),
        initialProps: { params: baseParams, axes: regionVsScheme },
      },
    );
    await waitFor(() => expect(mockCrossFacets).toHaveBeenCalledTimes(1));

    await act(async () =>
      rerender({
        params: { ...baseParams },
        axes: {
          row: { ...regionVsScheme.row },
          column: { ...regionVsScheme.column },
        },
      }),
    );
    expect(mockCrossFacets).toHaveBeenCalledTimes(1);
  });

  test("does not publish an older response after a newer axis request wins", async () => {
    const first = deferred<ReferenceCrossFacetResult>();
    const second = deferred<ReferenceCrossFacetResult>();
    mockCrossFacets
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result: hook, rerender } = renderHook(
      ({ axes }) => useCrossFacets(baseParams, axes),
      {
        wrapper: withCommunityPath("/esea"),
        initialProps: { axes: regionVsScheme },
      },
    );
    await waitFor(() => expect(mockCrossFacets).toHaveBeenCalledTimes(1));

    rerender({ axes: regionVsCountry });
    await waitFor(() => expect(mockCrossFacets).toHaveBeenCalledTimes(2));
    await act(async () => second.resolve(result(["AFE", "AU", 22])));
    await waitFor(() => expect(hook.current.loading).toBe(false));
    expect(hook.current.result?.cells[0]).toEqual({
      axes: ["AFE", "AU"],
      count: 22,
    });
    expect(hook.current.resultAxes).toEqual(regionVsCountry);

    await act(async () => first.resolve(result(["AFE", SCHEME, 11])));
    expect(hook.current.result?.cells[0]).toEqual({
      axes: ["AFE", "AU"],
      count: 22,
    });
    expect(hook.current.resultAxes).toEqual(regionVsCountry);
  });

  test("clears result to null on settled error", async () => {
    mockCrossFacets.mockRejectedValue(new Error("boom"));
    const { result: hook } = renderHook(
      () => useCrossFacets(baseParams, regionVsScheme),
      { wrapper: withCommunityPath("/esea") },
    );
    await waitFor(() => {
      expect(hook.current.error?.message).toBe("boom");
      expect(hook.current.result).toBeNull();
      expect(hook.current.loading).toBe(false);
    });
  });

  test("idle (no fetch) when slug resolves to no community", () => {
    mockCrossFacets.mockResolvedValue(result());
    const { result: hook } = renderHook(
      () => useCrossFacets(baseParams, regionVsScheme),
      { wrapper: withCommunityPath("/banana") },
    );
    expect(hook.current.result).toBeNull();
    expect(hook.current.loading).toBe(false);
    expect(hook.current.error).toBeNull();
    expect(mockCrossFacets).not.toHaveBeenCalled();
  });
});
