import { describe, test, expect } from "vitest";
import { useState } from "preact/hooks";
import { render, screen, fireEvent } from "@testing-library/preact";
import { FilterCard } from "@/components/filters/FilterCard";
import { ConceptSchemeFilter } from "@/components/filters/ConceptSchemeFilter";
import {
  emptyConceptSchemeState,
  summary,
  toConceptFilterGroups,
  type ConceptSchemeFilterState,
} from "@/components/filters/conceptSchemeFilterState";
import {
  parseSearchParams,
  toQueryString,
} from "@/services/searchParams";
import { makeSearchParams } from "../../fixtures";
import {
  OUTCOME_SCHEME_FIXTURE,
  URI_ACCESS,
  URI_EDUCATION_FINANCE,
  URI_ENROLMENT,
} from "./fixtures";

function Harness() {
  const [state, setState] = useState<ConceptSchemeFilterState>(
    emptyConceptSchemeState(),
  );
  const groups = toConceptFilterGroups(state, OUTCOME_SCHEME_FIXTURE);
  return (
    <>
      <FilterCard title={OUTCOME_SCHEME_FIXTURE.label} summary={summary(state)}>
        <ConceptSchemeFilter
          scheme={OUTCOME_SCHEME_FIXTURE}
          state={state}
          onChange={setState}
        />
      </FilterCard>
      <pre data-testid="groups">{JSON.stringify(groups)}</pre>
    </>
  );
}

describe("FilterCard + ConceptSchemeFilter integration", () => {
  test("clicking a parent emits structured concept-filter groups that round-trip through the search pipeline", () => {
    render(<Harness />);

    const header = screen.getByRole("button", { name: /Outcome/ });
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(/selected/)).toBeNull();
    expect(screen.getByTestId("groups").textContent).toBe("[]");

    fireEvent.click(header);
    fireEvent.click(screen.getByLabelText("Access to Education"));
    fireEvent.click(header);

    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("3 selected")).toBeDefined();
    // Auto-rollup: parent + descendants land in disjoint sibling-set groups.
    const groups: string[][] = JSON.parse(
      screen.getByTestId("groups").textContent ?? "[]",
    );
    expect(groups).toEqual([
      [URI_ACCESS],
      [URI_EDUCATION_FINANCE, URI_ENROLMENT],
    ]);

    // Round-trip through the URL — a missing comma-join would split each URI
    // into its own concept= param and trip the backend's sibling-set rule.
    const params = makeSearchParams({ conceptFilters: groups });
    const url = "?" + toQueryString(params);
    expect(parseSearchParams(url).conceptFilters).toEqual(groups);
  });
});
