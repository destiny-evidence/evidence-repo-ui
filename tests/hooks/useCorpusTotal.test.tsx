import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/preact";
import { useCorpusTotal } from "@/hooks/useCorpusTotal";
import type { Community, SearchResult } from "@/types/models";

vi.mock("@/services/apiClient", () => ({
  searchReferences: vi.fn(),
}));

import { searchReferences } from "@/services/apiClient";
const mockSearch = vi.mocked(searchReferences);

const community: Community = {
  slug: "esea",
  name: "Education",
  defaultAnnotations: ["domain-inclusion/jacobs-education"],
};

const result: SearchResult = {
  total: { count: 5721, is_lower_bound: false },
  page: { count: 20, number: 1 },
  references: [],
};

beforeEach(() => {
  mockSearch.mockReset();
});

describe("useCorpusTotal", () => {
  test("fires once with browse-mode query and community annotations", async () => {
    mockSearch.mockResolvedValue(result);
    const { result: hook } = renderHook(() => useCorpusTotal(community));
    await waitFor(() => expect(hook.current.loading).toBe(false));
    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith(undefined, {
      annotation: ["domain-inclusion/jacobs-education"],
    });
    expect(hook.current.total).toEqual({ count: 5721, is_lower_bound: false });
    expect(hook.current.error).toBeNull();
  });

  test("does not refetch when community prop is stable", async () => {
    mockSearch.mockResolvedValue(result);
    const { rerender } = renderHook(
      ({ c }) => useCorpusTotal(c),
      { initialProps: { c: community } },
    );
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(1));
    rerender({ c: community });
    rerender({ c: community });
    expect(mockSearch).toHaveBeenCalledTimes(1);
  });

  test("refetches when community slug changes", async () => {
    mockSearch.mockResolvedValue(result);
    const other: Community = { slug: "other", name: "Other", defaultAnnotations: [] };
    const { rerender } = renderHook(
      ({ c }) => useCorpusTotal(c),
      { initialProps: { c: community } },
    );
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(1));
    rerender({ c: other });
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(2));
  });

  test("refetches when annotations change for same slug", async () => {
    mockSearch.mockResolvedValue(result);
    const reannotated: Community = {
      ...community,
      defaultAnnotations: ["domain-inclusion/jacobs-education", "source/extra-filter"],
    };
    const { rerender } = renderHook(
      ({ c }) => useCorpusTotal(c),
      { initialProps: { c: community } },
    );
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(1));
    rerender({ c: reannotated });
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(2));
    expect(mockSearch).toHaveBeenLastCalledWith(undefined, {
      annotation: ["domain-inclusion/jacobs-education", "source/extra-filter"],
    });
  });

  test("key disambiguates annotation arrays even when an element contains a comma", async () => {
    mockSearch.mockResolvedValue(result);
    const c1: Community = { ...community, defaultAnnotations: ["a,b"] };
    const c2: Community = { ...community, defaultAnnotations: ["a", "b"] };
    const { rerender } = renderHook(
      ({ c }) => useCorpusTotal(c),
      { initialProps: { c: c1 } },
    );
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(1));
    rerender({ c: c2 });
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(2));
  });

  test("surfaces error", async () => {
    mockSearch.mockRejectedValue(new Error("boom"));
    const { result: hook } = renderHook(() => useCorpusTotal(community));
    await waitFor(() => {
      expect(hook.current.error).toBeDefined();
      expect(hook.current.error!.message).toBe("boom");
      expect(hook.current.total).toBeNull();
    });
  });
});
