import { describe, test, expect } from "vitest";
import { findSharedContext } from "@/services/findingGroups";
import { makeFinding } from "../fixtures";

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
    expect(
      findSharedContext([
        makeFinding({ intervention: null, control: null, context: null }),
        makeFinding({ intervention: null, control: null, context: null }),
      ]),
    ).toBeNull();
  });
});
