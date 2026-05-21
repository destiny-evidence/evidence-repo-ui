import { describe, test, expect } from "vitest";
import { useState } from "preact/hooks";
import { render, screen, fireEvent } from "@testing-library/preact";
import { FilterCard } from "@/components/filters/FilterCard";
import { ConceptSchemeFilter } from "@/components/filters/ConceptSchemeFilter";
import {
  emptyConceptSchemeState,
  summary,
  toLuceneFragment,
  type ConceptSchemeFilterState,
} from "@/components/filters/conceptSchemeFilterState";
import { OUTCOME_SCHEME_FIXTURE } from "./fixtures";

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
      <pre data-testid="fragment">
        {toLuceneFragment(state, OUTCOME_SCHEME_FIXTURE)}
      </pre>
    </>
  );
}

const URI_ACCESS = "https://vocab.esea.education/OutcomeScheme/C00096";
const URI_EDUCATION_FINANCE =
  "https://vocab.esea.education/OutcomeScheme/C00097";

describe("FilterCard + ConceptSchemeFilter integration", () => {
  test("selecting a parent and a nested child reports the expected summary and Lucene fragment", () => {
    render(<Harness />);

    const header = screen.getByRole("button", { name: /Outcome/ });
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(/selected/)).toBeNull();
    expect(screen.getByTestId("fragment").textContent).toBe("");

    fireEvent.click(header);
    fireEvent.click(screen.getByLabelText("Access to Education"));
    fireEvent.click(screen.getByLabelText("Education Finance"));
    fireEvent.click(header);

    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("2 selected")).toBeDefined();
    expect(screen.getByTestId("fragment").textContent).toBe(
      `(linked_data_concepts:"${URI_ACCESS}"` +
        ` OR linked_data_concepts:"${URI_EDUCATION_FINANCE}")`,
    );
  });
});
