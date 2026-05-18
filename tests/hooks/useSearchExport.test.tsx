import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/preact";
import { useSearchExport } from "@/hooks/useSearchExport";
import type { SearchExportRead } from "@/types/models";

vi.mock("@/services/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/apiClient")>();
  return {
    ...actual,
    requestSearchExport: vi.fn(),
    getSearchExport: vi.fn(),
  };
});

vi.mock("@/services/export/export", () => ({
  exportReferencesToExcel: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config")>();
  return {
    ...actual,
    EXPORT_VOCABULARY_URL: "https://test.example/vocab",
    EXPORT_CONTEXT_URL: "https://test.example/context",
  };
});

import {
  requestSearchExport,
  getSearchExport,
} from "@/services/apiClient";
import { exportReferencesToExcel } from "@/services/export/export";

const mockRequest = vi.mocked(requestSearchExport);
const mockGet = vi.mocked(getSearchExport);
const mockExport = vi.mocked(exportReferencesToExcel);

function pending(id = "job-1"): SearchExportRead {
  return { id, status: "pending", truncated: false };
}
function running(id = "job-1"): SearchExportRead {
  return { id, status: "running", truncated: false };
}
function completed(id = "job-1", url = "https://blob/result.jsonl"): SearchExportRead {
  return {
    id,
    status: "completed",
    result_url: url,
    n_references: 42,
    truncated: false,
  };
}
function failed(id = "job-1", error = "boom"): SearchExportRead {
  return { id, status: "failed", truncated: false, error };
}

beforeEach(() => {
  mockRequest.mockReset();
  mockGet.mockReset();
  mockExport.mockReset().mockResolvedValue(undefined);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useSearchExport", () => {
  test("pending → running → completed drives the download", async () => {
    mockRequest.mockResolvedValue(pending());
    mockGet
      .mockResolvedValueOnce(pending())
      .mockResolvedValueOnce(running())
      .mockResolvedValueOnce(completed());

    const { result } = renderHook(() => useSearchExport());

    act(() => {
      result.current.start("phonics", { annotation: ["x"] }, "file.xlsx");
    });
    expect(result.current.status).toBe("requesting");
    await vi.waitFor(() => expect(result.current.status).toBe("polling"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    await vi.waitFor(() => expect(result.current.status).toBe("done"));
    expect(mockExport).toHaveBeenCalledWith(
      "https://blob/result.jsonl",
      "https://test.example/vocab",
      "https://test.example/context",
      "file.xlsx",
    );
    expect(mockRequest).toHaveBeenCalledWith("phonics", { annotation: ["x"] });
  });

  test("failed surfaces the backend error message", async () => {
    mockRequest.mockResolvedValue(pending());
    mockGet.mockResolvedValueOnce(failed("job-1", "search broke"));

    const { result } = renderHook(() => useSearchExport());
    act(() => {
      result.current.start("phonics", {}, "f.xlsx");
    });
    await vi.waitFor(() => expect(result.current.status).toBe("polling"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    await vi.waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.errorMessage).toBe("search broke");
    expect(mockExport).not.toHaveBeenCalled();
  });

  test("POST failure surfaces an error without polling", async () => {
    mockRequest.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useSearchExport());
    act(() => {
      result.current.start("phonics", {}, "f.xlsx");
    });
    await vi.waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.errorMessage).toBe("network down");
    expect(mockGet).not.toHaveBeenCalled();
  });

  test("reset cancels a pending poll", async () => {
    mockRequest.mockResolvedValue(pending());
    mockGet.mockResolvedValue(pending());

    const { result } = renderHook(() => useSearchExport());
    act(() => {
      result.current.start("phonics", {}, "f.xlsx");
    });
    await vi.waitFor(() => expect(result.current.status).toBe("polling"));

    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe("idle");

    // Drain any scheduled timeouts and resolved promises; status must stay idle.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(result.current.status).toBe("idle");
  });

  test("unmount during polling does not throw or update state", async () => {
    mockRequest.mockResolvedValue(pending());
    mockGet.mockResolvedValue(pending());

    const { result, unmount } = renderHook(() => useSearchExport());
    act(() => {
      result.current.start("phonics", {}, "f.xlsx");
    });
    await vi.waitFor(() => expect(result.current.status).toBe("polling"));
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    // No error means cancellation worked — state writes on stale callbacks would
    // surface as React warnings; tooling-level assertion captured by the act helper.
  });

  test("missing result_url on completed surfaces an error", async () => {
    mockRequest.mockResolvedValue({
      id: "job-1",
      status: "completed",
      truncated: false,
    });

    const { result } = renderHook(() => useSearchExport());
    act(() => {
      result.current.start("phonics", {}, "f.xlsx");
    });
    await vi.waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.errorMessage).toMatch(/no download URL/i);
  });
});
