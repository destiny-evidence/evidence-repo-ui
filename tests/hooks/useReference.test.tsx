import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/preact";
import { useReference } from "@/hooks/useReference";

vi.mock("@/services/apiClient", () => ({
  getReference: vi.fn(),
}));

import { getReference } from "@/services/apiClient";

const mockGetReference = vi.mocked(getReference);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useReference", () => {
  test("returns loading state then reference on success", async () => {
    const ref = { id: "abc", visibility: "public" as const, identifiers: null, enhancements: null };
    mockGetReference.mockResolvedValue(ref);

    const { result } = renderHook(() => useReference("abc"));

    await waitFor(() => {
      expect(result.current.reference).toEqual(ref);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  test("returns error on failure", async () => {
    mockGetReference.mockRejectedValue(new Error("Not found"));

    const { result } = renderHook(() => useReference("missing"));

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
      expect(result.current.error!.message).toBe("Not found");
      expect(result.current.loading).toBe(false);
      expect(result.current.reference).toBeNull();
    });
  });

  test("does not fetch when id is undefined", () => {
    renderHook(() => useReference(undefined));
    expect(mockGetReference).not.toHaveBeenCalled();
  });
});
