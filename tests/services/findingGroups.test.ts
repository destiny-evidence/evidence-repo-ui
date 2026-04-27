import { describe, test, expect } from "vitest";
import { findSharedContext } from "@/services/findingGroups";
import type { FindingData } from "@/types/investigation";

function makeFinding(overrides: Partial<FindingData> = {}): FindingData {
  return {
    intervention: { id: "_:int", name: "Intervention" },
    interventionRef: "_:int",
    control: { id: "_:ctrl", description: "Control" },
    controlRef: "_:ctrl",
    context: { id: "_:ctx" },
    contextRef: "_:ctx",
    outcome: null,
    ...overrides,
  };
}

describe("findSharedContext", () => {
  test("returns shared context when all findings share same IDs", () => {
    const shared = findSharedContext([
      makeFinding(),
      makeFinding({ intervention: null }),
      makeFinding({ intervention: null, control: null, context: null }),
    ]);
    expect(shared).not.toBeNull();
    expect(shared?.intervention.name).toBe("Intervention");
    expect(shared?.control.description).toBe("Control");
  });

  test("returns null when interventions differ", () => {
    const shared = findSharedContext([
      makeFinding(),
      makeFinding({
        intervention: { id: "_:other", name: "Other" },
        interventionRef: "_:other",
      }),
    ]);
    expect(shared).toBeNull();
  });

  test("returns null for single finding", () => {
    expect(findSharedContext([makeFinding()])).toBeNull();
  });

  test("returns null for empty findings", () => {
    expect(findSharedContext([])).toBeNull();
  });

  test("returns null when IDs are missing", () => {
    expect(
      findSharedContext([
        makeFinding({ intervention: { id: "", name: "X" }, interventionRef: undefined }),
        makeFinding({ intervention: { id: "", name: "X" }, interventionRef: undefined }),
      ]),
    ).toBeNull();
  });

  test("returns null when refs match across findings but no full object resolves", () => {
    // Both findings reference _:int / _:ctrl / _:ctx but no finding ever
    // contains the full object — happens when the upstream data has dangling
    // blank-node refs. We can't surface a SharedContext we don't have.
    expect(
      findSharedContext([
        makeFinding({ intervention: null, control: null, context: null }),
        makeFinding({ intervention: null, control: null, context: null }),
      ]),
    ).toBeNull();
  });
});
