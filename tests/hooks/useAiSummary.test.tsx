import { describe, test, expect, vi, beforeEach } from "vitest";
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
  });

  test("run in background hides the drawer but keeps the result on completion", async () => {
    resolveIds(["a"]);
    mockRequest.mockResolvedValue(MOCK_SUMMARY);

    const { result } = renderHook(() => useAiSummary());
    act(() => result.current.generate(input));
    act(() => result.current.runInBackground());

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
    act(() => result.current.dismiss());

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
