import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/preact";
import type { ComponentChildren } from "preact";
import { useSearch } from "@/hooks/useSearch";
import { CommunityProvider } from "@/community/CommunityContext";
import type { SearchResult } from "@/types/models";
import type { SearchParams } from "@/services/searchParams";

vi.mock("@/services/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/apiClient")>();
  return { ...actual, searchReferences: vi.fn() };
});

import { searchReferences } from "@/services/apiClient";
const mockSearch = vi.mocked(searchReferences);

const baseParams: SearchParams = { q: "phonics", page: 1, startYear: undefined, endYear: undefined, sort: undefined };

// Drive the real CommunityProvider through the URL the way the runtime does.
function withCommunityPath(path: string) {
  window.history.replaceState(null, "", path);
  return ({ children }: { children: ComponentChildren }) => (
    <CommunityProvider>{children}</CommunityProvider>
  );
}

function makeResult(count: number): SearchResult {
  return {
    total: { count, is_lower_bound: false },
    page: { count: Math.min(count, 20), number: 1 },
    references: [],
  };
}

beforeEach(() => {
  mockSearch.mockReset();
  window.history.replaceState(null, "", "/");
});

describe("useSearch", () => {
  test("fetches on mount with community-derived annotations", async () => {
    mockSearch.mockResolvedValue(makeResult(47));
    const { result } = renderHook(() => useSearch(baseParams), {
      wrapper: withCommunityPath("/esea"),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.results?.total.count).toBe(47);
    expect(mockSearch).toHaveBeenCalledWith("phonics", {
      page: 1,
      startYear: undefined,
      endYear: undefined,
      annotation: ["domain-inclusion/jacobs-education"],
    });
  });

  test("no refetch on stable key", async () => {
    mockSearch.mockResolvedValue(makeResult(5));
    const { rerender } = renderHook(
      ({ p }) => useSearch(p),
      {
        wrapper: withCommunityPath("/esea"),
        initialProps: { p: { ...baseParams } },
      },
    );
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(1));
    rerender({ p: { ...baseParams } });
    rerender({ p: { ...baseParams } });
    expect(mockSearch).toHaveBeenCalledTimes(1);
  });

  test("refetches when params change", async () => {
    mockSearch.mockResolvedValue(makeResult(5));
    const { rerender } = renderHook(
      ({ p }) => useSearch(p),
      {
        wrapper: withCommunityPath("/esea"),
        initialProps: { p: baseParams },
      },
    );
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(1));
    rerender({ p: { ...baseParams, page: 2 } });
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(2));
  });

  test("preserves prior results during new fetch (keeps rows visible for dim-while-updating)", async () => {
    const resolvers: ((v: SearchResult) => void)[] = [];
    mockSearch.mockImplementation(
      () => new Promise<SearchResult>((r) => { resolvers.push(r); }),
    );

    const { result, rerender } = renderHook(
      ({ p }) => useSearch(p),
      {
        wrapper: withCommunityPath("/esea"),
        initialProps: { p: baseParams },
      },
    );
    resolvers[0](makeResult(10));
    await waitFor(() => expect(result.current.results?.total.count).toBe(10));

    rerender({ p: { ...baseParams, page: 2 } });
    expect(result.current.results?.total.count).toBe(10);
    expect(result.current.loading).toBe(true);

    resolvers[1](makeResult(20));
    await waitFor(() => expect(result.current.results?.total.count).toBe(20));
  });

  test("clears results to null on settled error", async () => {
    mockSearch.mockResolvedValueOnce(makeResult(10));
    const { result, rerender } = renderHook(
      ({ p }) => useSearch(p),
      {
        wrapper: withCommunityPath("/esea"),
        initialProps: { p: baseParams },
      },
    );
    await waitFor(() => expect(result.current.results?.total.count).toBe(10));

    mockSearch.mockRejectedValueOnce(new Error("boom"));
    rerender({ p: { ...baseParams, page: 2 } });
    await waitFor(() => {
      expect(result.current.error?.message).toBe("boom");
      expect(result.current.results).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });

  test("cancellation: rerender with new params prevents old fetch from leaking", async () => {
    let firstResolve: (v: SearchResult) => void = () => {};
    let secondResolve: (v: SearchResult) => void = () => {};
    mockSearch
      .mockImplementationOnce(() => new Promise<SearchResult>((r) => { firstResolve = r; }))
      .mockImplementationOnce(() => new Promise<SearchResult>((r) => { secondResolve = r; }));

    const { result, rerender } = renderHook(
      ({ p }) => useSearch(p),
      {
        wrapper: withCommunityPath("/esea"),
        initialProps: { p: baseParams },
      },
    );
    rerender({ p: { ...baseParams, page: 2 } });

    firstResolve(makeResult(999));
    secondResolve(makeResult(2));
    await waitFor(() => expect(result.current.results?.total.count).toBe(2));
  });

  test("error from initial fetch populates error (results stays null — nothing to preserve)", async () => {
    mockSearch.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useSearch(baseParams), {
      wrapper: withCommunityPath("/esea"),
    });
    await waitFor(() => {
      expect(result.current.error?.message).toBe("boom");
      expect(result.current.results).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });

  test("retry refetches without mutating URL", async () => {
    window.history.replaceState(null, "", "/esea");
    const pushSpy = vi.spyOn(history, "pushState");
    const replaceSpy = vi.spyOn(history, "replaceState");
    mockSearch.mockResolvedValue(makeResult(1));
    const { result } = renderHook(() => useSearch(baseParams), {
      wrapper: ({ children }) => <CommunityProvider>{children}</CommunityProvider>,
    });
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(1));

    act(() => { result.current.retry(); });
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(2));
    expect(pushSpy).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
    pushSpy.mockRestore();
    replaceSpy.mockRestore();
  });

  test("retry preserves prior results while refetching", async () => {
    const resolvers: ((v: SearchResult) => void)[] = [];
    mockSearch.mockImplementation(
      () => new Promise<SearchResult>((r) => { resolvers.push(r); }),
    );

    const { result } = renderHook(() => useSearch(baseParams), {
      wrapper: withCommunityPath("/esea"),
    });
    resolvers[0](makeResult(10));
    await waitFor(() => expect(result.current.results?.total.count).toBe(10));

    act(() => { result.current.retry(); });
    expect(result.current.results?.total.count).toBe(10);
    expect(result.current.loading).toBe(true);

    resolvers[1](makeResult(11));
    await waitFor(() => expect(result.current.results?.total.count).toBe(11));
  });

  test.each([
    { sort: "newest" as const, wire: "-publication_year" },
    { sort: "oldest" as const, wire: "publication_year" },
  ])("translates sort=$sort to backend wire format $wire", async ({ sort, wire }) => {
    mockSearch.mockResolvedValue(makeResult(1));
    renderHook(() => useSearch({ ...baseParams, sort }), {
      wrapper: withCommunityPath("/esea"),
    });
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(1));
    expect(mockSearch).toHaveBeenCalledWith("phonics", expect.objectContaining({ sort: [wire] }));
  });

  test("omits sort filter when params.sort is undefined", async () => {
    mockSearch.mockResolvedValue(makeResult(1));
    renderHook(() => useSearch(baseParams), {
      wrapper: withCommunityPath("/esea"),
    });
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(1));
    const [, filters] = mockSearch.mock.calls[0];
    expect(filters).not.toHaveProperty("sort");
  });

  test("refetches when sort changes (cache key includes sort)", async () => {
    mockSearch.mockResolvedValue(makeResult(1));
    const { rerender } = renderHook(
      ({ p }) => useSearch(p),
      {
        wrapper: withCommunityPath("/esea"),
        initialProps: { p: baseParams },
      },
    );
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(1));
    rerender({ p: { ...baseParams, sort: "newest" as const } });
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(2));
    rerender({ p: { ...baseParams, sort: "oldest" as const } });
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(3));
  });

  test("returns idle (no fetch) when slug resolves to no community", () => {
    mockSearch.mockResolvedValue(makeResult(1));
    const { result } = renderHook(() => useSearch(baseParams), {
      wrapper: withCommunityPath("/banana"),
    });
    expect(result.current.results).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.retry).toBe("function");
    expect(mockSearch).not.toHaveBeenCalled();
  });
});
