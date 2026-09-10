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

  test("all mode rejects when the id list came back capped", async () => {
    // Exclusions applied to a capped list resolve the wrong set, not a short one.
    mockSearchIds.mockResolvedValue({
      reference_ids: ["a", "b"],
      total: { count: 5, is_lower_bound: false },
    });
    await expect(
      resolveSelectedReferenceIds({ mode: "all", excludedIds: ["b"] }, "phonics", {}),
    ).rejects.toThrow(/refine the search/i);
  });

  test("all mode rejects a lower-bound count, where the list length reveals nothing", async () => {
    // A server predating exact totals reports the cap as the count, so the list
    // is exactly as long as the count and only the flag shows it was capped.
    mockSearchIds.mockResolvedValue({
      reference_ids: ["a", "b", "c"],
      total: { count: 3, is_lower_bound: true },
    });
    await expect(
      resolveSelectedReferenceIds({ mode: "all", excludedIds: ["b"] }, "phonics", {}),
    ).rejects.toThrow(/refine the search/i);
  });
});
