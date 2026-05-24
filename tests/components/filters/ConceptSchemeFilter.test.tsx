import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { ConceptSchemeFilter } from "@/components/filters/ConceptSchemeFilter";
import {
  conceptSchemeStateFromUris,
  emptyConceptSchemeState,
  selectedUris,
} from "@/components/filters/conceptSchemeFilterState";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";
import {
  OUTCOME_SCHEME_FIXTURE,
  URI_ACCESS,
  URI_EDUCATION_FINANCE,
  URI_ENROLMENT,
} from "./fixtures";

const URI_JOURNAL_ARTICLE =
  "https://vocab.esea.education/DocumentTypeScheme/C00008";
const URI_THESIS = "https://vocab.esea.education/DocumentTypeScheme/C00012";

const JOURNAL_DEFINITION = "A scholarly article published in a journal.";

const SCHEME: ConceptScheme = {
  uri: "https://vocab.esea.education/DocumentTypeScheme",
  label: "Document type",
  topConcepts: [
    {
      uri: URI_JOURNAL_ARTICLE,
      label: "Journal Article",
      definition: JOURNAL_DEFINITION,
    },
    { uri: URI_THESIS, label: "Thesis/Dissertation" },
  ],
};

describe("ConceptSchemeFilter", () => {
  test("renders one checkbox per top concept", () => {
    render(
      <ConceptSchemeFilter
        scheme={SCHEME}
        state={emptyConceptSchemeState()}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Journal Article")).toBeDefined();
    expect(screen.getByLabelText("Thesis/Dissertation")).toBeDefined();
  });

  test("checkbox reflects state", () => {
    render(
      <ConceptSchemeFilter
        scheme={SCHEME}
        state={conceptSchemeStateFromUris([URI_JOURNAL_ARTICLE])}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByLabelText<HTMLInputElement>("Journal Article").checked,
    ).toBe(true);
    expect(
      screen.getByLabelText<HTMLInputElement>("Thesis/Dissertation").checked,
    ).toBe(false);
  });

  test("clicking an unchecked checkbox invokes onChange adding that URI", () => {
    const onChange = vi.fn();
    render(
      <ConceptSchemeFilter
        scheme={SCHEME}
        state={emptyConceptSchemeState()}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("Journal Article"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(selectedUris(onChange.mock.calls[0][0])).toEqual([
      URI_JOURNAL_ARTICLE,
    ]);
  });

  test("clicking a checked checkbox invokes onChange removing that URI", () => {
    const onChange = vi.fn();
    render(
      <ConceptSchemeFilter
        scheme={SCHEME}
        state={conceptSchemeStateFromUris([URI_JOURNAL_ARTICLE])}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("Journal Article"));
    expect(selectedUris(onChange.mock.calls[0][0])).toEqual([]);
  });

  test("re-rendering with a new state from conceptSchemeStateFromUris updates checked", () => {
    const { rerender } = render(
      <ConceptSchemeFilter
        scheme={SCHEME}
        state={emptyConceptSchemeState()}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByLabelText<HTMLInputElement>("Journal Article").checked,
    ).toBe(false);

    rerender(
      <ConceptSchemeFilter
        scheme={SCHEME}
        state={conceptSchemeStateFromUris([URI_JOURNAL_ARTICLE, URI_THESIS])}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByLabelText<HTMLInputElement>("Journal Article").checked,
    ).toBe(true);
    expect(
      screen.getByLabelText<HTMLInputElement>("Thesis/Dissertation").checked,
    ).toBe(true);
  });

  test("wraps the label in a Tooltip when the concept has a definition", () => {
    const { container } = render(
      <ConceptSchemeFilter
        scheme={SCHEME}
        state={emptyConceptSchemeState()}
        onChange={vi.fn()}
      />,
    );
    const tooltip = container.querySelector(
      `.tooltip[data-tooltip="${JOURNAL_DEFINITION}"]`,
    );
    expect(tooltip).not.toBeNull();
    expect(container.querySelectorAll(".tooltip[data-tooltip]")).toHaveLength(
      1,
    );
  });
});

const EDUCATION_FINANCE_DEFINITION =
  "Outcomes covering the funding mechanisms that determine access to education.";

describe("ConceptSchemeFilter (hierarchical)", () => {
  test("renders a checkbox for every concept at every depth", () => {
    render(
      <ConceptSchemeFilter
        scheme={OUTCOME_SCHEME_FIXTURE}
        state={emptyConceptSchemeState()}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Access to Education")).toBeDefined();
    expect(screen.getByLabelText("Education Finance")).toBeDefined();
    expect(screen.getByLabelText("Enrolment and Attendance")).toBeDefined();
    expect(
      screen.getByLabelText("Educational Outcomes and Learning"),
    ).toBeDefined();
    expect(screen.getByLabelText("Returns to Education")).toBeDefined();
  });

  test("renders narrower concepts inside a nested ul under their parent", () => {
    const { container } = render(
      <ConceptSchemeFilter
        scheme={OUTCOME_SCHEME_FIXTURE}
        state={emptyConceptSchemeState()}
        onChange={vi.fn()}
      />,
    );
    const nested = container.querySelectorAll(
      ".concept-scheme-filter__children",
    );
    expect(nested).toHaveLength(1);
    expect(nested[0].querySelectorAll("input[type=checkbox]")).toHaveLength(2);
  });

  test("clicking a nested checkbox invokes onChange adding its URI", () => {
    const onChange = vi.fn();
    render(
      <ConceptSchemeFilter
        scheme={OUTCOME_SCHEME_FIXTURE}
        state={emptyConceptSchemeState()}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("Education Finance"));
    expect(selectedUris(onChange.mock.calls[0][0])).toEqual([
      URI_EDUCATION_FINANCE,
    ]);
  });

  test("parent and child can both be independently checked", () => {
    render(
      <ConceptSchemeFilter
        scheme={OUTCOME_SCHEME_FIXTURE}
        state={conceptSchemeStateFromUris([URI_ACCESS, URI_EDUCATION_FINANCE])}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByLabelText<HTMLInputElement>("Access to Education").checked,
    ).toBe(true);
    expect(
      screen.getByLabelText<HTMLInputElement>("Education Finance").checked,
    ).toBe(true);
    expect(
      screen.getByLabelText<HTMLInputElement>("Enrolment and Attendance")
        .checked,
    ).toBe(false);
  });

  test("a nested concept's definition is surfaced via its own Tooltip", () => {
    const { container } = render(
      <ConceptSchemeFilter
        scheme={OUTCOME_SCHEME_FIXTURE}
        state={emptyConceptSchemeState()}
        onChange={vi.fn()}
      />,
    );
    expect(
      container.querySelector(
        `.tooltip[data-tooltip="${EDUCATION_FINANCE_DEFINITION}"]`,
      ),
    ).not.toBeNull();
  });

  test("clicking an unselected parent selects the parent and all descendants", () => {
    const onChange = vi.fn();
    render(
      <ConceptSchemeFilter
        scheme={OUTCOME_SCHEME_FIXTURE}
        state={emptyConceptSchemeState()}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("Access to Education"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(selectedUris(onChange.mock.calls[0][0])).toEqual([
      URI_ACCESS,
      URI_EDUCATION_FINANCE,
      URI_ENROLMENT,
    ]);
  });

  test("clicking a selected parent clears the parent and all descendants", () => {
    const onChange = vi.fn();
    render(
      <ConceptSchemeFilter
        scheme={OUTCOME_SCHEME_FIXTURE}
        state={conceptSchemeStateFromUris([
          URI_ACCESS,
          URI_EDUCATION_FINANCE,
          URI_ENROLMENT,
        ])}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("Access to Education"));
    expect(selectedUris(onChange.mock.calls[0][0])).toEqual([]);
  });
});
