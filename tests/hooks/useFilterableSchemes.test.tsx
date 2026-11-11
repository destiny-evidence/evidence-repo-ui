import { describe, test, expect } from "vitest";
import { renderHook } from "@testing-library/preact";
import { useFilterableSchemes } from "@/hooks/useFilterableSchemes";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";
import { makeCommunity } from "../fixtures";

const scheme = (uri: string): ConceptScheme => ({ uri, label: uri, topConcepts: [] });

describe("useFilterableSchemes", () => {
  test("drops the community's excluded schemes", () => {
    const community = makeCommunity({ filterExcludedSchemes: ["b"] });
    const { result } = renderHook(() =>
      useFilterableSchemes(community, [scheme("a"), scheme("b"), scheme("c")]),
    );
    expect(result.current.map((s) => s.uri)).toEqual(["a", "c"]);
  });

  test("is empty while the vocabulary is loading", () => {
    const { result } = renderHook(() => useFilterableSchemes(makeCommunity(), null));
    expect(result.current).toEqual([]);
  });
});
