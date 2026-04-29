import { describe, test, expect } from "vitest";
import { toHierarchicalTag, conceptsToTags } from "@/services/conceptLabels";

describe("toHierarchicalTag", () => {
  const labels = new Map([
    ["u:parent", "School Organization"],
    ["u:child", "Tracking of Students"],
  ]);
  const broader = new Map([["u:child", "u:parent"]]);

  test("returns parent + child when both labels resolve", () => {
    expect(
      toHierarchicalTag({ uri: "u:child", label: "Tracking of Students" }, labels, broader),
    ).toEqual({ parent: "School Organization", label: "Tracking of Students" });
  });

  test("returns flat tag when concept has no broader", () => {
    expect(
      toHierarchicalTag({ uri: "u:parent", label: "School Organization" }, labels, broader),
    ).toEqual({ label: "School Organization" });
  });

  test("falls back to URI when concept label is missing", () => {
    expect(
      toHierarchicalTag({ uri: "u:unknown", label: undefined }, labels, broader),
    ).toEqual({ label: "u:unknown" });
  });

  test("omits parent when broader URI resolves but parent label is missing", () => {
    const broaderOnly = new Map([["u:orphan", "u:missing-parent"]]);
    const result = toHierarchicalTag(
      { uri: "u:orphan", label: "Orphan" },
      labels,
      broaderOnly,
    );
    expect(result).toEqual({ label: "Orphan" });
  });

  test("includes definition when present in the definitions map", () => {
    const definitions = new Map([
      ["u:child", "Practice of grouping students by ability."],
    ]);
    const result = toHierarchicalTag(
      { uri: "u:child", label: "Tracking of Students" },
      labels,
      broader,
      definitions,
    );
    expect(result).toEqual({
      parent: "School Organization",
      label: "Tracking of Students",
      definition: "Practice of grouping students by ability.",
    });
  });

  test("omits definition when map is undefined or has no entry", () => {
    const result = toHierarchicalTag(
      { uri: "u:child", label: "Tracking of Students" },
      labels,
      broader,
    );
    expect(result.definition).toBeUndefined();

    const empty = new Map<string, string>();
    expect(
      toHierarchicalTag(
        { uri: "u:child", label: "Tracking of Students" },
        labels,
        broader,
        empty,
      ).definition,
    ).toBeUndefined();
  });
});

describe("conceptsToTags", () => {
  const labels = new Map([["u:a", "Alpha"]]);
  const broader = new Map<string, string>();

  test("maps annotations to tags", () => {
    const tags = conceptsToTags(
      [{ value: { uri: "u:a", label: "Alpha" } }],
      labels,
      broader,
    );
    expect(tags).toEqual([{ label: "Alpha" }]);
  });

  test("returns empty array when annotations is undefined", () => {
    expect(conceptsToTags(undefined, labels, broader)).toEqual([]);
  });
});
