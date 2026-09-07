import { describe, test, expect, vi } from "vitest";
import { selectionEnabled } from "@/components/search/selectionEnabled";
import { makeCommunity } from "../../fixtures";

vi.mock("@/config", () => ({
  SUMMARISER_BASE: "https://summariser.example",
  SUMMARISER_MOCK: false,
}));

describe("selectionEnabled", () => {
  test("off when the community hasn't opted in", () => {
    const community = makeCommunity({
      features: { referenceSelection: false, exportsEnabled: true },
    });
    expect(selectionEnabled(community, true)).toBe(false);
  });

  test("on when opted in and export is available", () => {
    const community = makeCommunity({
      features: { referenceSelection: true, exportsEnabled: true, aiSummaries: false },
    });
    expect(selectionEnabled(community, false)).toBe(true);
  });

  test("on when opted in and AI summaries are available (no export)", () => {
    const community = makeCommunity({
      features: { referenceSelection: true, exportsEnabled: false, aiSummaries: true },
    });
    expect(selectionEnabled(community, true)).toBe(true);
  });

  test("off when opted in but neither export nor AI is usable", () => {
    const community = makeCommunity({
      features: { referenceSelection: true, exportsEnabled: false, aiSummaries: true },
    });
    // No writer role ⇒ AI summaries unavailable ⇒ nothing to act on.
    expect(selectionEnabled(community, false)).toBe(false);
  });

  test("off for a null community", () => {
    expect(selectionEnabled(null, true)).toBe(false);
  });
});
