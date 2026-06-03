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
  test("clicking concepts emits structured concept-filter groups that round-trip through the search pipeline", () => {
    render(<Harness />);

    const header = screen.getByRole("button", { name: /Outcome/ });
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(/selected/)).toBeNull();
    expect(screen.getByTestId("groups").textContent).toBe("[]");

    fireEvent.click(header);
    // Click a parent and one of its children individually (cascade was removed,
    // destiny-repository#655) — both should OR-join into the one scheme group.
    fireEvent.click(screen.getByLabelText("Access to Education"));
    fireEvent.click(screen.getByLabelText("Education Finance"));
    fireEvent.click(header);

    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("2 selected")).toBeDefined();
    // The whole scheme is one sibling set, so parent + child OR-join into a
    // single group (preorder: Access before its child Education Finance).
    const groups: string[][] = JSON.parse(
      screen.getByTestId("groups").textContent ?? "[]",
    );
    expect(groups).toEqual([
      [URI_ACCESS, URI_EDUCATION_FINANCE],
    ]);

    // Round-trip through the URL — a missing comma-join would split each URI
    // into its own concept= param and AND them instead of OR'ing the scheme.
    const params = makeSearchParams({ conceptFilters: groups });
    const url = "?" + toQueryString(params);
    expect(parseSearchParams(url).conceptFilters).toEqual(groups);
  });
});
