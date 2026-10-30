import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/preact";
import { MapFiltersMenu } from "@/components/visualise/MapFiltersMenu";
import { makeSearchParams } from "../../fixtures";
import { OUTCOME_SCHEME_FIXTURE, URI_LEARNING } from "../filters/fixtures";
import type { SearchParams } from "@/services/searchParams";

beforeEach(cleanup);

function setup(params: SearchParams, count = 0) {
  const onEditInPanel = vi.fn();
  render(
    <MapFiltersMenu
      params={params}
      count={count}
      schemes={[OUTCOME_SCHEME_FIXTURE]}
      onEditInPanel={onEditInPanel}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /^filters/i }));
  return {
    onEditInPanel,
    panel: screen.getByRole("group", { name: "Applied filters" }),
  };
}

describe("MapFiltersMenu", () => {
  test("lists each applied filter under its group", () => {
    const { panel } = setup(
      makeSearchParams({
        conceptFilters: [[URI_LEARNING], ["https://example.org/unknown#Gone"]],
        countryCodes: ["KE"],
        startYear: 2015,
      }),
      4,
    );
    const rows = within(panel)
      .getAllByRole("term")
      .map((term) => [term.textContent, term.nextElementSibling?.textContent]);
    expect(rows).toEqual([
      ["Outcome", "Educational Outcomes and Learning"],
      ["Other", "Gone"],
      ["Countries", "Kenya"],
      ["Publication year", "from 2015"],
    ]);
  });

  test("says when nothing is applied, and points to the panel", () => {
    const { panel, onEditInPanel } = setup(makeSearchParams());
    expect(within(panel).getByText("None applied")).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: /configure in panel/i }));
    expect(onEditInPanel).toHaveBeenCalled();
    expect(screen.queryByRole("group", { name: "Applied filters" })).toBeNull();
  });
});
