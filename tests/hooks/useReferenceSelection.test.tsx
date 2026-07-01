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

  test("setPageSelected adds a page without dropping the existing selection", () => {
    const { result } = renderHook(() => useReferenceSelection());
    act(() => result.current.setPageSelected(["a", "b"], true));
    // A later page is added, not replaced.
    act(() => result.current.setPageSelected(["c", "d"], true));
    expect(result.current.count(100)).toBe(4);
    expect(result.current.isSelected("a")).toBe(true);
    expect(result.current.isSelected("d")).toBe(true);

    // Deselecting a page removes just those ids.
    act(() => result.current.setPageSelected(["a", "b"], false));
    expect(result.current.count(100)).toBe(2);
    expect(result.current.isSelected("a")).toBe(false);
    expect(result.current.isSelected("c")).toBe(true);
  });

  test("setPageSelected in 'all' mode deselects via exclusions", () => {
    const { result } = renderHook(() => useReferenceSelection());
    act(() => result.current.selectAllPages());
    act(() => result.current.setPageSelected(["x", "y"], false));
    expect(result.current.count(1000)).toBe(998);
    expect(result.current.isSelected("x")).toBe(false);
    // Re-selecting the page clears those exclusions.
    act(() => result.current.setPageSelected(["x", "y"], true));
    expect(result.current.count(1000)).toBe(1000);
  });

  test("selectAllPages selects everything minus later exclusions", () => {
    const { result } = renderHook(() => useReferenceSelection());

    act(() => result.current.selectAllPages());
    expect(result.current.mode).toBe("all");
    expect(result.current.isSelected("anything")).toBe(true);
    expect(result.current.count(1961)).toBe(1961);

    // Deselecting in "all" mode records an exclusion.
    act(() => result.current.toggle("x"));
    expect(result.current.isSelected("x")).toBe(false);
    expect(result.current.count(1961)).toBe(1960);
  });

  test("masterState reflects none / some / all of the visible ids", () => {
    const { result } = renderHook(() => useReferenceSelection());
    const visible = ["a", "b", "c"];
    expect(result.current.masterState(visible)).toBe("none");
    act(() => result.current.toggle("a"));
    expect(result.current.masterState(visible)).toBe("some");
    act(() => result.current.toggle("b"));
    act(() => result.current.toggle("c"));
    expect(result.current.masterState(visible)).toBe("all");
    expect(result.current.masterState([])).toBe("none");
  });

  test("clear resets everything", () => {
    const { result } = renderHook(() => useReferenceSelection());
    act(() => result.current.selectAllPages());
    act(() => result.current.clear());
    expect(result.current.mode).toBe("include");
    expect(result.current.count(100)).toBe(0);
    expect(result.current.isSelected("a")).toBe(false);
  });
});
