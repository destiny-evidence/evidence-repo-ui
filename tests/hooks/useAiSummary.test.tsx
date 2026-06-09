import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/preact";

vi.mock("@/services/summariserClient", () => ({
  requestSummary: vi.fn(),
}));

import { requestSummary } from "@/services/summariserClient";
import { useAiSummary } from "@/hooks/useAiSummary";
import { MOCK_SUMMARY } from "@/services/summariserMock";

const mockRequest = vi.mocked(requestSummary);

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

const req = { terms: [{ name: "Afghanistan" }], referenceIds: ["a", "b"] };

beforeEach(() => {
  mockRequest.mockReset();
});

describe("useAiSummary", () => {
  test("starts idle with the drawer closed", () => {
    const { result } = renderHook(() => useAiSummary());
    expect(result.current.status).toBe("idle");
    expect(result.current.drawerOpen).toBe(false);
    expect(result.current.minimized).toBe(false);
  });

  test("generate opens the drawer, then resolves to the result", async () => {
    const d = deferred<typeof MOCK_SUMMARY>();
    mockRequest.mockReturnValue(d.promise);

    const { result } = renderHook(() => useAiSummary());
    act(() => result.current.generate(req));

    expect(result.current.status).toBe("generating");
    expect(result.current.drawerOpen).toBe(true);

    await act(async () => {
      d.resolve(MOCK_SUMMARY);
      await d.promise;
    });

    expect(result.current.status).toBe("done");
    expect(result.current.result).toBe(MOCK_SUMMARY);
    expect(result.current.drawerOpen).toBe(true);
  });

  test("run in background hides the drawer but keeps the result on completion", async () => {
    const d = deferred<typeof MOCK_SUMMARY>();
    mockRequest.mockReturnValue(d.promise);

    const { result } = renderHook(() => useAiSummary());
    act(() => result.current.generate(req));
    act(() => result.current.runInBackground());

    expect(result.current.minimized).toBe(true);
    expect(result.current.drawerOpen).toBe(false);

    await act(async () => {
      d.resolve(MOCK_SUMMARY);
      await d.promise;
    });

    // Still minimized → drawer stays closed, but the result is ready.
    expect(result.current.status).toBe("done");
    expect(result.current.minimized).toBe(true);
    expect(result.current.drawerOpen).toBe(false);

    act(() => result.current.open());
    expect(result.current.drawerOpen).toBe(true);
  });

  test("dismiss aborts and a late resolution does not revive state", async () => {
    const d = deferred<typeof MOCK_SUMMARY>();
    mockRequest.mockReturnValue(d.promise);

    const { result } = renderHook(() => useAiSummary());
    act(() => result.current.generate(req));
    act(() => result.current.dismiss());

    expect(result.current.status).toBe("idle");

    await act(async () => {
      d.resolve(MOCK_SUMMARY);
      await d.promise;
    });

    // The stale request resolved, but the run guard kept us idle.
    expect(result.current.status).toBe("idle");
    expect(result.current.result).toBeNull();
  });

  test("surfaces an error message when the request rejects", async () => {
    const d = deferred<typeof MOCK_SUMMARY>();
    mockRequest.mockReturnValue(d.promise);

    const { result } = renderHook(() => useAiSummary());
    act(() => result.current.generate(req));

    await act(async () => {
      d.reject(new Error("boom"));
      await d.promise.catch(() => undefined);
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.errorMessage).toBe("boom");
  });
});
