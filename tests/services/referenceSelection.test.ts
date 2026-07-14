import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/apiClient")>();
  return { ...actual, searchReferenceIds: vi.fn() };
});

import { resolveSelectedReferenceIds } from "@/services/referenceSelection";
import { searchReferenceIds } from "@/services/apiClient";

const mockSearchIds = vi.mocked(searchReferenceIds);

beforeEach(() => mockSearchIds.mockReset());

describe("resolveSelectedReferenceIds", () => {
  test("include mode returns the ids without hitting the search", async () => {
    const ids = await resolveSelectedReferenceIds(
      { mode: "include", ids: ["a", "b"] },
      "phonics",
      {},
    );
    expect(ids).toEqual(["a", "b"]);
    expect(mockSearchIds).not.toHaveBeenCalled();
  });

  test("all mode resolves the search's ids minus the exclusions", async () => {
    mockSearchIds.mockResolvedValue({
      reference_ids: ["a", "b", "c", "d"],
      total: { count: 4, is_lower_bound: false },
    });
    const ids = await resolveSelectedReferenceIds(
      { mode: "all", excludedIds: ["b", "d"] },
      "phonics",
      { annotation: ["x"] },
    );
    expect(ids).toEqual(["a", "c"]);
    expect(mockSearchIds).toHaveBeenCalledWith(
      "phonics",
      { annotation: ["x"] },
      undefined,
    );
  });
});
