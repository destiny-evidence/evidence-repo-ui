import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/preact";

vi.mock("@/services/export/searchExportJob", () => ({
  runSearchExportToCompletion: vi.fn(),
}));
vi.mock("@/services/export/risExport", () => ({
  fetchRisAsApaInputs: vi.fn(),
}));

import { useReferenceListExport } from "@/hooks/useReferenceListExport";
import { runSearchExportToCompletion } from "@/services/export/searchExportJob";
import { fetchRisAsApaInputs } from "@/services/export/risExport";

const mockRun = vi.mocked(runSearchExportToCompletion);
const mockFetch = vi.mocked(fetchRisAsApaInputs);

beforeEach(() => {
  mockRun.mockReset();
  mockFetch.mockReset();
});

describe("useReferenceListExport", () => {
  test("loads the search's references as RIS, then APA inputs", async () => {
    mockRun.mockResolvedValue("https://blob/result.ris");
    const inputs = [{ authors: ["Jane Smith"], year: 2021, title: "X" }];
    mockFetch.mockResolvedValue(inputs);

    const { result } = renderHook(() =>
      useReferenceListExport({ query: "phonics", filters: {} }, true),
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.inputs).toEqual(inputs);
    // Requests the same search as a RIS export.
    expect(mockRun).toHaveBeenCalledWith(
      "phonics",
      {},
      "ris",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  test("applies the browse shim for an empty query", async () => {
    mockRun.mockResolvedValue("u");
    mockFetch.mockResolvedValue([]);
    renderHook(() =>
      useReferenceListExport({ query: undefined, filters: {} }, true),
    );
    await waitFor(() => expect(mockRun).toHaveBeenCalled());
    expect(mockRun).toHaveBeenCalledWith("*", {}, "ris", expect.any(Object));
  });

  test("stays idle and does not fetch when disabled", () => {
    const { result } = renderHook(() =>
      useReferenceListExport({ query: "phonics", filters: {} }, false),
    );
    expect(result.current.status).toBe("idle");
    expect(mockRun).not.toHaveBeenCalled();
  });

  test("surfaces an error when the export fails", async () => {
    mockRun.mockRejectedValue(new Error("export broke"));
    const { result } = renderHook(() =>
      useReferenceListExport({ query: "phonics", filters: {} }, true),
    );
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("export broke");
  });
});
