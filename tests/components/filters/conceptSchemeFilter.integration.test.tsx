import { describe, test, expect } from "vitest";
import { useState } from "preact/hooks";
import { render, screen, fireEvent } from "@testing-library/preact";
import { FilterCard } from "@/components/filters/FilterCard";
import { ConceptSchemeFilter } from "@/components/filters/ConceptSchemeFilter";
import {
  emptyConceptSchemeState,
  summary,
  toSearchFacet,
  type ConceptSchemeFilterState,
} from "@/components/filters/conceptSchemeFilterState";
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
  return (
    <>
      <FilterCard title={OUTCOME_SCHEME_FIXTURE.label} summary={summary(state)}>
        <ConceptSchemeFilter
          scheme={OUTCOME_SCHEME_FIXTURE}
          state={state}
          onChange={setState}
        />
      </FilterCard>
      <pre data-testid="facet">
        {toSearchFacet(state, OUTCOME_SCHEME_FIXTURE)}
      </pre>
    </>
  );
}

describe("FilterCard + ConceptSchemeFilter integration", () => {
  test("clicking a parent selects its subtree and surfaces the combined summary and searchFacets entry", () => {
    render(<Harness />);

    const header = screen.getByRole("button", { name: /Outcome/ });
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(/selected/)).toBeNull();
    expect(screen.getByTestId("facet").textContent).toBe("");

    fireEvent.click(header);
    fireEvent.click(screen.getByLabelText("Access to Education"));
    fireEvent.click(header);

    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("3 selected")).toBeDefined();
    expect(screen.getByTestId("facet").textContent).toBe(
      `linked_data_concepts:"${URI_ACCESS}"` +
        ` OR linked_data_concepts:"${URI_EDUCATION_FINANCE}"` +
        ` OR linked_data_concepts:"${URI_ENROLMENT}"`,
    );
  });
});
