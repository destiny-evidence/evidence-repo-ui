import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { CountryFilter } from "@/components/filters/CountryFilter";
import {
  countryStateFromCodes,
  emptyCountryState,
} from "@/components/filters/countryFilterState";

describe("CountryFilter", () => {
  test("counts === null (no fetch yet) → shows only selected codes", () => {
    render(
      <CountryFilter
        state={countryStateFromCodes(["DE"])}
        counts={null}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Germany")).toBeDefined();
    expect(screen.queryByLabelText("France")).toBeNull();
  });

  test("counts === null + no selection → \"Loading countries…\" hint", () => {
    render(
      <CountryFilter
        state={emptyCountryState()}
        counts={null}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Loading countries/i)).toBeDefined();
  });

  test("counts loaded but empty + no selection → \"No countries match\" message", () => {
    render(
      <CountryFilter
        state={emptyCountryState()}
        counts={new Map()}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/No countries match the current filters/i)).toBeDefined();
  });

  test("renders count badge for countries present in the aggregation", () => {
    render(
      <CountryFilter
        state={emptyCountryState()}
        counts={new Map([["DE", 230], ["FR", 76]])}
        onChange={vi.fn()}
      />,
    );
    const germanyRow = screen.getByLabelText(/^Germany/).closest("label")!;
    expect(germanyRow.textContent).toContain("230");
    const franceRow = screen.getByLabelText(/^France/).closest("label")!;
    expect(franceRow.textContent).toContain("76");
  });

  test("hides countries missing from the aggregation once counts have arrived", () => {
    render(
      <CountryFilter
        state={emptyCountryState()}
        counts={new Map([["DE", 230]])}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/^Germany/)).toBeDefined();
    // France missing from counts — drop from the list.
    expect(screen.queryByLabelText(/^France/)).toBeNull();
  });

  test("keeps a selected country visible even when its count is 0 or missing", () => {
    render(
      <CountryFilter
        state={countryStateFromCodes(["FR"])}
        counts={new Map([["DE", 230]])}
        onChange={vi.fn()}
      />,
    );
    // France is selected but has no count → still visible so the user can un-tick.
    const franceInput = screen.getByLabelText<HTMLInputElement>(/^France/);
    expect(franceInput.checked).toBe(true);
  });

  test("does not render a count badge for a 0-count selected country", () => {
    render(
      <CountryFilter
        state={countryStateFromCodes(["FR"])}
        counts={new Map([["DE", 230], ["FR", 0]])}
        onChange={vi.fn()}
      />,
    );
    const franceRow = screen.getByLabelText<HTMLInputElement>(/^France/).closest(
      "label",
    )!;
    expect(franceRow.querySelector(".country-filter__count")).toBeNull();
  });

  test("search with no matches in the aggregation → \"No references for [query]\" message", () => {
    render(
      <CountryFilter
        state={emptyCountryState()}
        counts={new Map([["DE", 1]])}
        onChange={vi.fn()}
      />,
    );
    const search = screen.getByLabelText("Search country");
    fireEvent.input(search, { target: { value: "france" } });
    expect(screen.getByText(/No references for/i)).toBeDefined();
    expect(screen.getByText(/france/i)).toBeDefined();
  });

  test("applies the is-updating class to counts while loading", () => {
    const { container } = render(
      <CountryFilter
        state={emptyCountryState()}
        counts={new Map([["DE", 100]])}
        countsLoading={true}
        onChange={vi.fn()}
      />,
    );
    expect(
      container.querySelector(".country-filter__count.is-updating"),
    ).not.toBeNull();
  });
});
