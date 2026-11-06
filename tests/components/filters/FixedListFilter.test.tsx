import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { FixedListFilter } from "@/components/filters/FixedListFilter";

const OPTIONS = [
  { id: "HIC", name: "High income" },
  { id: "LIC", name: "Low income" },
] as const;

function checkbox(name: string) {
  return screen.getByRole("checkbox", { name: new RegExp(name) }) as HTMLInputElement;
}

describe("FixedListFilter", () => {
  test("renders every option in the given order, whatever the counts", () => {
    render(
      <FixedListFilter
        options={OPTIONS}
        selected={new Set()}
        counts={new Map([["LIC", 3]])}
        onChange={vi.fn()}
      />,
    );
    const labels = screen.getAllByRole("checkbox").map((c) =>
      c.closest("label")?.textContent?.replace(/\d+$/, ""),
    );
    expect(labels).toEqual(["High income", "Low income"]);
  });

  test("counts === null (no fetch yet) → no badges and nothing disabled", () => {
    render(
      <FixedListFilter options={OPTIONS} selected={new Set()} counts={null} onChange={vi.fn()} />,
    );
    expect(checkbox("High income").disabled).toBe(false);
    expect(checkbox("Low income").disabled).toBe(false);
    expect(screen.queryByLabelText(/results/)).toBeNull();
  });

  test("shows a count badge for rows with results and none at 0", () => {
    render(
      <FixedListFilter
        options={OPTIONS}
        selected={new Set()}
        counts={new Map([["LIC", 1234]])}
        countNoun="investigations"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("1,234 investigations")).toHaveTextContent("1,234");
    expect(screen.queryByLabelText("0 investigations")).toBeNull();
  });

  test("an unselected row missing from the counts is disabled and greyed", () => {
    render(
      <FixedListFilter
        options={OPTIONS}
        selected={new Set()}
        counts={new Map([["LIC", 3]])}
        onChange={vi.fn()}
      />,
    );
    const high = checkbox("High income");
    expect(high.disabled).toBe(true);
    expect(high.closest("label")?.className).toContain("concept-scheme-filter__row--empty");
    expect(checkbox("Low income").disabled).toBe(false);
  });

  test("a selected row stays enabled at 0 so it can be un-ticked", () => {
    render(
      <FixedListFilter
        options={OPTIONS}
        selected={new Set(["HIC"])}
        counts={new Map()}
        onChange={vi.fn()}
      />,
    );
    const high = checkbox("High income");
    expect(high.checked).toBe(true);
    expect(high.disabled).toBe(false);
  });

  test("a row selected earlier in the draft stays enabled after its count drops to 0", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <FixedListFilter
        options={OPTIONS}
        selected={new Set()}
        counts={new Map([["HIC", 2], ["LIC", 3]])}
        onChange={onChange}
      />,
    );
    fireEvent.click(checkbox("High income"));
    expect(onChange).toHaveBeenCalledWith(new Set(["HIC"]));
    // Host applies the selection, then un-ticks it while the count is now 0.
    rerender(
      <FixedListFilter
        options={OPTIONS}
        selected={new Set(["HIC"])}
        counts={new Map([["LIC", 3]])}
        onChange={onChange}
      />,
    );
    fireEvent.click(checkbox("High income"));
    expect(onChange).toHaveBeenLastCalledWith(new Set());
    rerender(
      <FixedListFilter
        options={OPTIONS}
        selected={new Set()}
        counts={new Map([["LIC", 3]])}
        onChange={onChange}
      />,
    );
    expect(checkbox("High income").disabled).toBe(false);
  });

  test("toggling emits the selection with the row added or removed", () => {
    const onChange = vi.fn();
    render(
      <FixedListFilter
        options={OPTIONS}
        selected={new Set(["HIC"])}
        counts={new Map([["HIC", 1], ["LIC", 1]])}
        onChange={onChange}
      />,
    );
    fireEvent.click(checkbox("Low income"));
    expect(onChange).toHaveBeenLastCalledWith(new Set(["HIC", "LIC"]));
    fireEvent.click(checkbox("High income"));
    expect(onChange).toHaveBeenLastCalledWith(new Set());
  });

  test("applies the is-updating class to counts while loading", () => {
    const { container } = render(
      <FixedListFilter
        options={OPTIONS}
        selected={new Set()}
        counts={new Map([["LIC", 3]])}
        countsLoading
        onChange={vi.fn()}
      />,
    );
    expect(
      container.querySelectorAll(".concept-scheme-filter__count.is-updating"),
    ).toHaveLength(1);
  });
});
