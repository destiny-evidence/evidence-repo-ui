import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/preact";
import type { ComponentChildren } from "preact";
import { useCorpusTotal } from "@/hooks/useCorpusTotal";
import { CommunityProvider } from "@/community/CommunityContext";
import { URL_CHANGE_EVENT } from "@/services/navigation";
import type { SearchResult } from "@/types/models";

vi.mock("@/services/apiClient", () => ({
  searchReferences: vi.fn(),
}));

import { searchReferences } from "@/services/apiClient";
const mockSearch = vi.mocked(searchReferences);

const result: SearchResult = {
  total: { count: 5721, is_lower_bound: false },
  page: { count: 20, number: 1 },
  references: [],
};

// Drive the real CommunityProvider through the URL the way the runtime does.
// Tests stay at the integration layer instead of leaking a context-injection
// API just to satisfy synthetic fixtures.
function withCommunityPath(path: string) {
  window.history.replaceState(null, "", path);
  return ({ children }: { children: ComponentChildren }) => (
    <CommunityProvider>{children}</CommunityProvider>
  );
}

beforeEach(() => {
  mockSearch.mockReset();
  window.history.replaceState(null, "", "/");
});

describe("useCorpusTotal", () => {
  test("fires once with browse-mode query and community annotations", async () => {
    mockSearch.mockResolvedValue(result);
    const { result: hook } = renderHook(() => useCorpusTotal(), {
      wrapper: withCommunityPath("/esea"),
    });
    await waitFor(() => expect(hook.current.loading).toBe(false));
    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith(undefined, {
      annotation: ["domain-inclusion/jacobs-education"],
    });
    expect(hook.current.total).toEqual({ count: 5721, is_lower_bound: false });
    expect(hook.current.error).toBeNull();
  });

  test("does not refetch when URL stays on the same community", async () => {
    mockSearch.mockResolvedValue(result);
    const { rerender } = renderHook(() => useCorpusTotal(), {
      wrapper: withCommunityPath("/esea"),
    });
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(1));
    rerender();
    rerender();
    expect(mockSearch).toHaveBeenCalledTimes(1);
  });

  test("returns idle (no fetch, no loading) when slug resolves to no community", () => {
    mockSearch.mockResolvedValue(result);
    const { result: hook } = renderHook(() => useCorpusTotal(), {
      wrapper: withCommunityPath("/banana"),
    });
    expect(hook.current.total).toBeNull();
    expect(hook.current.loading).toBe(false);
    expect(hook.current.error).toBeNull();
    expect(mockSearch).not.toHaveBeenCalled();
  });

  test("transitions to idle when navigating away to an unknown slug", async () => {
    mockSearch.mockResolvedValue(result);
    const { result: hook } = renderHook(() => useCorpusTotal(), {
      wrapper: withCommunityPath("/esea"),
    });
    await waitFor(() => expect(hook.current.total).not.toBeNull());

    act(() => {
      window.history.replaceState(null, "", "/banana");
      window.dispatchEvent(new Event(URL_CHANGE_EVENT));
    });

    await waitFor(() => {
      expect(hook.current.total).toBeNull();
      expect(hook.current.loading).toBe(false);
      expect(hook.current.error).toBeNull();
    });
  });

  test("surfaces error", async () => {
    mockSearch.mockRejectedValue(new Error("boom"));
    const { result: hook } = renderHook(() => useCorpusTotal(), {
      wrapper: withCommunityPath("/esea"),
    });
    await waitFor(() => {
      expect(hook.current.error).toBeDefined();
      expect(hook.current.error!.message).toBe("boom");
      expect(hook.current.total).toBeNull();
    });
  });
});
