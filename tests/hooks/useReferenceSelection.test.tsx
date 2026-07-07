import { describe, test, expect } from "vitest";
import { renderHook, act } from "@testing-library/preact";
import { useReferenceSelection } from "@/hooks/useReferenceSelection";

describe("useReferenceSelection", () => {
  test("include mode: toggle selects/deselects and counts", () => {
    const { result } = renderHook(() => useReferenceSelection());

    act(() => result.current.toggle("a"));
    act(() => result.current.toggle("b"));
    expect(result.current.isSelected("a")).toBe(true);
    expect(result.current.isSelected("c")).toBe(false);
    expect(result.current.count(100)).toBe(2);

    act(() => result.current.toggle("a"));
    expect(result.current.isSelected("a")).toBe(false);
    expect(result.current.count(100)).toBe(1);
  });

  test("selectAll selects everything, minus later per-row exclusions", () => {
    const { result } = renderHook(() => useReferenceSelection());

    act(() => result.current.selectAll());
    expect(result.current.mode).toBe("all");
    expect(result.current.isSelected("anything")).toBe(true);
    expect(result.current.count(1961)).toBe(1961);

    // Deselecting a row in "all" mode records an exclusion.
    act(() => result.current.toggle("x"));
    expect(result.current.isSelected("x")).toBe(false);
    expect(result.current.count(1961)).toBe(1960);

    // Re-selecting it clears the exclusion.
    act(() => result.current.toggle("x"));
    expect(result.current.count(1961)).toBe(1961);
  });

  test("clear resets everything", () => {
    const { result } = renderHook(() => useReferenceSelection());
    act(() => result.current.selectAll());
    act(() => result.current.clear());
    expect(result.current.mode).toBe("include");
    expect(result.current.count(100)).toBe(0);
    expect(result.current.isSelected("a")).toBe(false);
  });
});
