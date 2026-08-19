import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/preact";

vi.mock("@/services/summariserClient", () => ({
  requestSummary: vi.fn(),
}));
vi.mock("@/services/apiClient", () => ({
  searchReferenceIds: vi.fn(),
}));

import { requestSummary } from "@/services/summariserClient";
import { searchReferenceIds } from "@/services/apiClient";
import { useAiSummary, type AiSummaryInput } from "@/hooks/useAiSummary";
import { MOCK_SUMMARY } from "@/services/summariserMock";

const mockRequest = vi.mocked(requestSummary);
const mockIds = vi.mocked(searchReferenceIds);

/** A promise plus its resolve/reject, so a test can drive completion timing. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const input: AiSummaryInput = {
  query: "afghanistan",
  filters: { annotation: ["domain-inclusion/hpv"] },
  context: {
    terms: ["Afghanistan"],
    count: { count: 3, is_lower_bound: false },
    countNoun: "references",
  },
  originUrl: "/test-community?q=afghanistan",
};

function resolveIds(reference_ids: string[]) {
  mockIds.mockResolvedValue({
    total: { count: reference_ids.length, is_lower_bound: false },
    reference_ids,
  });
}

beforeEach(() => {
  mockRequest.mockReset();
  mockIds.mockReset();
});

describe("useAiSummary", () => {
  test("starts idle with the drawer closed", () => {
    const { result } = renderHook(() => useAiSummary());
    expect(result.current.status).toBe("idle");
    expect(result.current.drawerOpen).toBe(false);
    expect(result.current.minimized).toBe(false);
  });

  test("gathers ids then summarises them, opening the drawer", async () => {
    resolveIds(["a", "b", "c"]);
    mockRequest.mockResolvedValue(MOCK_SUMMARY);

    const { result } = renderHook(() => useAiSummary());
    act(() => result.current.generate(input));

    expect(result.current.status).toBe("generating");
    expect(result.current.drawerOpen).toBe(true);

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.result).toBe(MOCK_SUMMARY);
    // Context is snapshotted so a later search can't make the drawer drift.
    expect(result.current.context).toEqual(input.context);

    // ids endpoint queried with the search descriptor; its ids feed the summary.
    expect(mockIds).toHaveBeenCalledWith(
      input.query,
      input.filters,
      expect.anything(),
    );
    // Summariser terms are derived from the snapshotted context labels.
    expect(mockRequest).toHaveBeenCalledWith(
      { terms: [{ name: "Afghanistan" }], referenceIds: ["a", "b", "c"] },
      expect.anything(),
    );
    // The bibliography source is the whole search.
    expect(result.current.referenceSource).toEqual({
      kind: "search",
      query: input.query,
      filters: input.filters,
    });
  });

  test("an include selection summarises those ids directly, without a search", async () => {
    mockRequest.mockResolvedValue(MOCK_SUMMARY);

    const { result } = renderHook(() => useAiSummary());
    act(() =>
      result.current.generate({
        ...input,
        selection: { mode: "include", ids: ["x", "y"] },
      }),
    );

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(mockIds).not.toHaveBeenCalled();
    expect(mockRequest).toHaveBeenCalledWith(
      { terms: [{ name: "Afghanistan" }], referenceIds: ["x", "y"] },
      expect.anything(),
    );
    // The bibliography lists exactly the selected ids.
    expect(result.current.referenceSource).toEqual({
      kind: "ids",
      referenceIds: ["x", "y"],
    });
  });

  test("an all selection summarises the search's ids minus exclusions", async () => {
    resolveIds(["a", "b", "c", "d"]);
    mockRequest.mockResolvedValue(MOCK_SUMMARY);

    const { result } = renderHook(() => useAiSummary());
    act(() =>
      result.current.generate({
        ...input,
        selection: { mode: "all", excludedIds: ["b"] },
      }),
    );

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(mockRequest).toHaveBeenCalledWith(
      { terms: [{ name: "Afghanistan" }], referenceIds: ["a", "c", "d"] },
      expect.anything(),
    );
  });

  test("run in background hides the drawer but keeps the result on completion", async () => {
    resolveIds(["a"]);
    mockRequest.mockResolvedValue(MOCK_SUMMARY);

    const { result } = renderHook(() => useAiSummary());
    act(() => result.current.generate(input));
    act(() => result.current.runInBackground("button"));

    expect(result.current.minimized).toBe(true);
    expect(result.current.drawerOpen).toBe(false);

    await waitFor(() => expect(result.current.status).toBe("done"));
    // Still minimized → drawer stays closed, but the result is ready.
    expect(result.current.minimized).toBe(true);
    expect(result.current.drawerOpen).toBe(false);

    act(() => result.current.open());
    expect(result.current.drawerOpen).toBe(true);
  });

  test("dismiss aborts and a late resolution does not revive state", async () => {
    resolveIds(["a"]);
    const d = deferred<typeof MOCK_SUMMARY>();
    mockRequest.mockReturnValue(d.promise);

    const { result } = renderHook(() => useAiSummary());
    act(() => result.current.generate(input));
    act(() => result.current.dismiss("drawer"));

    expect(result.current.status).toBe("idle");

    await act(async () => {
      d.resolve(MOCK_SUMMARY);
      await d.promise;
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.result).toBeNull();
  });

  test("surfaces an error message when the summary request rejects", async () => {
    resolveIds(["a"]);
    mockRequest.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useAiSummary());
    act(() => result.current.generate(input));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.errorMessage).toBe("boom");
  });

  test("surfaces an error when gathering ids fails", async () => {
    mockIds.mockRejectedValue(new Error("ids down"));

    const { result } = renderHook(() => useAiSummary());
    act(() => result.current.generate(input));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.errorMessage).toBe("ids down");
    expect(mockRequest).not.toHaveBeenCalled();
  });

});

describe("useAiSummary analytics", () => {
  // A pinned clock the test advances by hand, so durations are exact.
  let now = 0;

  beforeEach(() => {
    now = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    // An empty queue is what `track()` reads as "analytics enabled".
    window._paq = [];
  });
  afterEach(() => {
    vi.restoreAllMocks();
    window._paq = undefined;
  });

  function events(action?: string) {
    return (window._paq ?? []).filter(
      (e) =>
        e[0] === "trackEvent" &&
        e[1] === "AISummary" &&
        (action === undefined || e[2] === action),
    );
  }

  test("times a completed run from request to summary", async () => {
    resolveIds(["a"]);
    const d = deferred<typeof MOCK_SUMMARY>();
    mockRequest.mockReturnValue(d.promise);

    const { result } = renderHook(() => useAiSummary());
    act(() => result.current.generate(input));
    // The request counts the references it was asked for, not the ids resolved.
    expect(events("Generate Requested")).toEqual([
      ["trackEvent", "AISummary", "Generate Requested", undefined, 3],
    ]);

    now = 4_500;
    await act(async () => {
      d.resolve(MOCK_SUMMARY);
      await d.promise;
    });

    expect(events("Completed")).toEqual([
      ["trackEvent", "AISummary", "Completed", undefined, 3_500],
    ]);
  });

  test("times a failed run, and sends no error text", async () => {
    resolveIds(["a"]);
    mockRequest.mockRejectedValue(new Error("boom /reference/abc-123"));

    const { result } = renderHook(() => useAiSummary());
    act(() => result.current.generate(input));
    now = 2_200;

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(events("Error")).toEqual([
      ["trackEvent", "AISummary", "Error", undefined, 1_200],
    ]);
  });

  test("records where a cancellation came from, and how long they waited", async () => {
    resolveIds(["a"]);
    mockRequest.mockReturnValue(deferred<typeof MOCK_SUMMARY>().promise);

    const { result } = renderHook(() => useAiSummary());
    act(() => result.current.generate(input));
    now = 9_000;
    act(() => result.current.dismiss("chip"));

    expect(events("Cancelled")).toEqual([
      ["trackEvent", "AISummary", "Cancelled", "chip", 8_000],
    ]);
  });

  test("clearing a finished summary is not a cancellation", async () => {
    resolveIds(["a"]);
    mockRequest.mockResolvedValue(MOCK_SUMMARY);

    const { result } = renderHook(() => useAiSummary());
    act(() => result.current.generate(input));
    await waitFor(() => expect(result.current.status).toBe("done"));
    act(() => result.current.dismiss("drawer"));

    expect(events("Cancelled")).toEqual([]);
  });

  test("a community switch dropping a running job is not a cancellation", () => {
    resolveIds(["a"]);
    mockRequest.mockReturnValue(deferred<typeof MOCK_SUMMARY>().promise);

    const { result } = renderHook(() => useAiSummary());
    act(() => result.current.generate(input));
    act(() => result.current.dismiss("community-switch"));

    expect(events("Cancelled")).toEqual([]);
  });

  test("records whether a reopened job had finished or was still running", async () => {
    resolveIds(["a"]);
    const d = deferred<typeof MOCK_SUMMARY>();
    mockRequest.mockReturnValue(d.promise);

    const { result } = renderHook(() => useAiSummary());
    act(() => result.current.generate(input));
    act(() => result.current.runInBackground("button"));
    // Came back while it was still working.
    act(() => result.current.open());

    act(() => result.current.runInBackground("button"));
    await act(async () => {
      d.resolve(MOCK_SUMMARY);
      await d.promise;
    });
    // Came back to a finished summary.
    act(() => result.current.open());

    expect(events("Reopened").map((e) => e[3])).toEqual([
      "generating",
      "done",
    ]);
  });

  test("records whether backgrounding was chosen or fell out of closing", () => {
    resolveIds(["a"]);
    mockRequest.mockReturnValue(deferred<typeof MOCK_SUMMARY>().promise);

    const { result } = renderHook(() => useAiSummary());
    act(() => result.current.generate(input));
    act(() => result.current.runInBackground("close"));

    expect(events("Run In Background")).toEqual([
      ["trackEvent", "AISummary", "Run In Background", "close", undefined],
    ]);
  });
});
