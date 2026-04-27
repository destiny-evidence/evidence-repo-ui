import { describe, test, expect } from "vitest";
import { groupFindings } from "@/services/findingGroups";
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

describe("groupFindings", () => {
  test("returns shared context when all findings share same IDs", () => {
    const findings = [
      makeFinding(),
      makeFinding({ intervention: null }),
      makeFinding({ intervention: null, control: null, context: null }),
    ];

    const group = groupFindings(findings);
    expect(group.shared).not.toBeNull();
    expect(group.shared?.intervention.name).toBe("Intervention");
    expect(group.shared?.control.description).toBe("Control");
    expect(group.findings).toHaveLength(3);
  });

  test("returns null shared when interventions differ", () => {
    const findings = [
      makeFinding(),
      makeFinding({
        intervention: { id: "_:other", name: "Other" },
        interventionRef: "_:other",
      }),
    ];

    const group = groupFindings(findings);
    expect(group.shared).toBeNull();
  });

  test("returns null shared for single finding", () => {
    const group = groupFindings([makeFinding()]);
    expect(group.shared).toBeNull();
  });

  test("returns null shared for empty findings", () => {
    const group = groupFindings([]);
    expect(group.shared).toBeNull();
  });

  test("returns null shared when IDs are missing", () => {
    const findings = [
      makeFinding({ intervention: { id: "", name: "X" }, interventionRef: undefined }),
      makeFinding({ intervention: { id: "", name: "X" }, interventionRef: undefined }),
    ];

    const group = groupFindings(findings);
    expect(group.shared).toBeNull();
  });

  test("returns null shared when refs match across findings but no full object resolves", () => {
    // Both findings reference _:int / _:ctrl / _:ctx but no finding ever
    // contains the full object — happens when the upstream data has dangling
    // blank-node refs. We can't surface a SharedContext we don't have.
    const findings = [
      makeFinding({
        intervention: null,
        control: null,
        context: null,
      }),
      makeFinding({
        intervention: null,
        control: null,
        context: null,
      }),
    ];

    const group = groupFindings(findings);
    expect(group.shared).toBeNull();
    expect(group.findings).toHaveLength(2);
  });
});
