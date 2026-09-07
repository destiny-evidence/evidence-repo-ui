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
  DEEP_OUTCOME_SCHEME_FIXTURE,
  OUTCOME_SCHEME_FIXTURE,
  URI_ACCESS,
  URI_EDUCATION_FINANCE,
  URI_ENROLMENT,
  URI_SCHOOL_FEES,
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

  test("renders locale-grouped counts next to concepts when counts are provided", () => {
    const counts = new Map<string, number>([
      [URI_ACCESS, 12],
      [URI_EDUCATION_FINANCE, 1234],
    ]);
    render(
      <ConceptSchemeFilter
        scheme={OUTCOME_SCHEME_FIXTURE}
        state={emptyConceptSchemeState()}
        counts={counts}
        countsLoading={false}
        onChange={vi.fn()}
      />,
    );
    // Compute the expected separator at test time so this passes regardless
    // of the test runner's locale (en-US → "1,234", de-DE → "1.234").
    const expected1234 = new Intl.NumberFormat().format(1234);
    // Count's aria-label augments the input's accessible name (deliberate, so
    // screen readers announce it) — match with a regex on the visible label.
    const accessRow = screen
      .getByLabelText(/^Access to Education/)
      .closest("label")!;
    expect(accessRow.textContent).toContain("12");
    const financeRow = screen
      .getByLabelText(/^Education Finance/)
      .closest("label")!;
    expect(financeRow.textContent).toContain(expected1234);
  });

  test("omits the count when the URI is missing from the counts map", () => {
    // Map has Access only; the others should render with no count node.
    const counts = new Map<string, number>([[URI_ACCESS, 7]]);
    const { container } = render(
      <ConceptSchemeFilter
        scheme={OUTCOME_SCHEME_FIXTURE}
        state={emptyConceptSchemeState()}
        counts={counts}
        countsLoading={false}
        onChange={vi.fn()}
      />,
    );
    expect(
      container.querySelectorAll(".concept-scheme-filter__count"),
    ).toHaveLength(1);
  });

  test("renders no count nodes when counts prop is null", () => {
    const { container } = render(
      <ConceptSchemeFilter
        scheme={OUTCOME_SCHEME_FIXTURE}
        state={emptyConceptSchemeState()}
        counts={null}
        countsLoading={false}
        onChange={vi.fn()}
      />,
    );
    expect(
      container.querySelector(".concept-scheme-filter__count"),
    ).toBeNull();
  });

  test("wraps a parent concept's count in a Tooltip clarifying it's a toggle preview", () => {
    const counts = new Map<string, number>([
      [URI_ACCESS, 774],
      [URI_EDUCATION_FINANCE, 264],
    ]);
    const { container } = render(
      <ConceptSchemeFilter
        scheme={OUTCOME_SCHEME_FIXTURE}
        state={emptyConceptSchemeState()}
        counts={counts}
        countsLoading={false}
        onChange={vi.fn()}
      />,
    );
    // Parent ("Access to Education") has children → count wrapped in Tooltip,
    // and the text no longer claims selecting it rolls up its children.
    const parentCount = container.querySelector(
      ".concept-scheme-filter__count--parent",
    );
    expect(parentCount).not.toBeNull();
    const tooltip = parentCount?.closest("[data-tooltip]");
    expect(tooltip).not.toBeNull();
    expect(tooltip?.getAttribute("data-tooltip")).toBe(
      "Results you'd see if you toggled this concept.",
    );

    // Leaf ("Education Finance") has no children → bare count, no tooltip.
    const leafCount = Array.from(
      container.querySelectorAll(".concept-scheme-filter__count"),
    ).find(
      (n) => !n.classList.contains("concept-scheme-filter__count--parent"),
    );
    expect(leafCount).toBeDefined();
    expect(leafCount?.closest("[data-tooltip]")).toBeNull();
  });

  test("applies the is-updating class to counts while loading", () => {
    const counts = new Map<string, number>([[URI_ACCESS, 7]]);
    const { container } = render(
      <ConceptSchemeFilter
        scheme={OUTCOME_SCHEME_FIXTURE}
        state={emptyConceptSchemeState()}
        counts={counts}
        countsLoading={true}
        onChange={vi.fn()}
      />,
    );
    expect(
      container.querySelector(
        ".concept-scheme-filter__count.is-updating",
      ),
    ).not.toBeNull();
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

  test("clicking an unselected parent selects only the parent URI", () => {
    // Clicking a parent adds only the parent URI — no cascade into
    // descendants; it matches docs tagged with that URI literally.
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
    expect(selectedUris(onChange.mock.calls[0][0])).toEqual([URI_ACCESS]);
  });

  test("clicking a selected parent removes only the parent URI; children stay", () => {
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
    expect([...selectedUris(onChange.mock.calls[0][0])].sort()).toEqual(
      [URI_EDUCATION_FINANCE, URI_ENROLMENT].sort(),
    );
  });
});

describe("ConceptSchemeFilter 0-count rendering", () => {
  test("unselected concept with count=0 → disabled checkbox + row--empty class + no badge", () => {
    const counts = new Map<string, number>([
      [URI_ACCESS, 50],
      [URI_EDUCATION_FINANCE, 0],
    ]);
    render(
      <ConceptSchemeFilter
        scheme={OUTCOME_SCHEME_FIXTURE}
        state={emptyConceptSchemeState()}
        counts={counts}
        onChange={vi.fn()}
      />,
    );
    const financeInput = screen.getByLabelText<HTMLInputElement>(
      /^Education Finance/,
    );
    expect(financeInput.disabled).toBe(true);
    const financeRow = financeInput.closest("label")!;
    expect(financeRow.className).toContain("concept-scheme-filter__row--empty");
    expect(
      financeRow.querySelector(".concept-scheme-filter__count"),
    ).toBeNull();
  });

  test("selected concept with count=0 → checkbox stays enabled, badge still hidden", () => {
    const counts = new Map<string, number>([[URI_EDUCATION_FINANCE, 0]]);
    render(
      <ConceptSchemeFilter
        scheme={OUTCOME_SCHEME_FIXTURE}
        state={conceptSchemeStateFromUris([URI_EDUCATION_FINANCE])}
        counts={counts}
        onChange={vi.fn()}
      />,
    );
    const financeInput = screen.getByLabelText<HTMLInputElement>(
      /^Education Finance/,
    );
    expect(financeInput.disabled).toBe(false);
    expect(financeInput.checked).toBe(true);
    const financeRow = financeInput.closest("label")!;
    expect(financeRow.className).not.toContain(
      "concept-scheme-filter__row--empty",
    );
  });

  test("count > 0 renders normally regardless of selection", () => {
    const counts = new Map<string, number>([
      [URI_ACCESS, 50],
      [URI_EDUCATION_FINANCE, 10],
    ]);
    render(
      <ConceptSchemeFilter
        scheme={OUTCOME_SCHEME_FIXTURE}
        state={emptyConceptSchemeState()}
        counts={counts}
        onChange={vi.fn()}
      />,
    );
    const accessInput = screen.getByLabelText<HTMLInputElement>(
      /^Access to Education/,
    );
    expect(accessInput.disabled).toBe(false);
    expect(
      accessInput.closest("label")!.className,
    ).not.toContain("concept-scheme-filter__row--empty");
  });

  test("missing concept after counts have settled → treated as 0 (disabled + empty)", () => {
    // Standard terms aggregation omits 0-buckets, so a concept missing from
    // the settled response has 0 matches under the active filter.
    const counts = new Map<string, number>([[URI_ACCESS, 50]]);
    render(
      <ConceptSchemeFilter
        scheme={OUTCOME_SCHEME_FIXTURE}
        state={emptyConceptSchemeState()}
        counts={counts}
        countsLoading={false}
        onChange={vi.fn()}
      />,
    );
    const financeInput = screen.getByLabelText<HTMLInputElement>(
      /^Education Finance/,
    );
    expect(financeInput.disabled).toBe(true);
    expect(
      financeInput.closest("label")!.className,
    ).toContain("concept-scheme-filter__row--empty");
  });

  test("missing concept stays disabled across a refetch (dim-while-updating)", () => {
    // Prior counts survive a refetch, so previously-greyed rows shouldn't
    // briefly become clickable while the new response is in flight.
    const counts = new Map<string, number>([[URI_ACCESS, 50]]);
    render(
      <ConceptSchemeFilter
        scheme={OUTCOME_SCHEME_FIXTURE}
        state={emptyConceptSchemeState()}
        counts={counts}
        countsLoading={true}
        onChange={vi.fn()}
      />,
    );
    const financeInput = screen.getByLabelText<HTMLInputElement>(
      /^Education Finance/,
    );
    expect(financeInput.disabled).toBe(true);
    expect(
      financeInput.closest("label")!.className,
    ).toContain("concept-scheme-filter__row--empty");
  });

  test("counts === null (no fetch yet) → all rows render normally", () => {
    render(
      <ConceptSchemeFilter
        scheme={OUTCOME_SCHEME_FIXTURE}
        state={emptyConceptSchemeState()}
        counts={null}
        countsLoading={false}
        onChange={vi.fn()}
      />,
    );
    const financeInput = screen.getByLabelText<HTMLInputElement>(
      /^Education Finance/,
    );
    expect(financeInput.disabled).toBe(false);
  });
});

describe("ConceptSchemeFilter (collapsible)", () => {
  test("flag off renders no toggle buttons", () => {
    render(
      <ConceptSchemeFilter
        scheme={DEEP_OUTCOME_SCHEME_FIXTURE}
        state={emptyConceptSchemeState()}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByLabelText("School Fees")).toBeDefined();
  });

  test("opens showing top concepts and immediate children; deeper collapsed", () => {
    render(
      <ConceptSchemeFilter
        scheme={DEEP_OUTCOME_SCHEME_FIXTURE}
        state={emptyConceptSchemeState()}
        collapsible
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Access to Education")).toBeDefined();
    expect(screen.getByLabelText("Education Finance")).toBeDefined();
    expect(screen.queryByLabelText("School Fees")).toBeNull();
  });

  test("expand and collapse toggle a branch's visibility and aria-expanded", () => {
    render(
      <ConceptSchemeFilter
        scheme={DEEP_OUTCOME_SCHEME_FIXTURE}
        state={emptyConceptSchemeState()}
        collapsible
        onChange={vi.fn()}
      />,
    );
    const toggle = screen.getByRole("button", {
      name: "Child concepts of Education Finance",
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("School Fees")).toBeDefined();
    expect(toggle.getAttribute("aria-controls")).toBe(
      screen.getByLabelText("School Fees").closest("ul")!.id,
    );
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText("School Fees")).toBeNull();
  });

  test("a branch holding a checked concept starts expanded", () => {
    render(
      <ConceptSchemeFilter
        scheme={DEEP_OUTCOME_SCHEME_FIXTURE}
        state={conceptSchemeStateFromUris([URI_SCHOOL_FEES])}
        collapsible
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByLabelText<HTMLInputElement>("School Fees").checked,
    ).toBe(true);
  });

  test("collapsing leaves checked descendants applied", () => {
    const onChange = vi.fn();
    render(
      <ConceptSchemeFilter
        scheme={DEEP_OUTCOME_SCHEME_FIXTURE}
        state={conceptSchemeStateFromUris([URI_SCHOOL_FEES])}
        collapsible
        onChange={onChange}
      />,
    );
    const toggle = screen.getByRole("button", {
      name: "Child concepts of Education Finance",
    });
    fireEvent.click(toggle);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("School Fees")).toBeNull();
    fireEvent.click(toggle);
    expect(
      screen.getByLabelText<HTMLInputElement>("School Fees").checked,
    ).toBe(true);
  });

  test("expand/collapse leaves visible count badges untouched", () => {
    const counts = new Map([
      [URI_ACCESS, 10],
      [URI_EDUCATION_FINANCE, 4],
    ]);
    render(
      <ConceptSchemeFilter
        scheme={DEEP_OUTCOME_SCHEME_FIXTURE}
        state={emptyConceptSchemeState()}
        counts={counts}
        collapsible
        onChange={vi.fn()}
      />,
    );
    const badge = () => screen.getByLabelText("4 results");
    expect(badge().textContent).toBe("4");
    const toggle = screen.getByRole("button", {
      name: "Child concepts of Education Finance",
    });
    fireEvent.click(toggle);
    expect(badge().textContent).toBe("4");
    fireEvent.click(toggle);
    expect(badge().textContent).toBe("4");
  });

  test("parent counts carry no tooltip when collapsible", () => {
    const counts = new Map([
      [URI_ACCESS, 10],
      [URI_EDUCATION_FINANCE, 4],
    ]);
    const { container } = render(
      <ConceptSchemeFilter
        scheme={DEEP_OUTCOME_SCHEME_FIXTURE}
        state={emptyConceptSchemeState()}
        counts={counts}
        collapsible
        onChange={vi.fn()}
      />,
    );
    const parentCount = screen.getByLabelText("10 results");
    expect(parentCount.closest("[data-tooltip]")).toBeNull();
    expect(
      container.querySelector(".concept-scheme-filter__count--parent"),
    ).toBeNull();
  });

  test("a collapsed parent hiding a checked descendant shows a mixed state", () => {
    render(
      <ConceptSchemeFilter
        scheme={DEEP_OUTCOME_SCHEME_FIXTURE}
        state={conceptSchemeStateFromUris([URI_SCHOOL_FEES])}
        collapsible
        onChange={vi.fn()}
      />,
    );
    const parent = screen.getByLabelText<HTMLInputElement>("Education Finance");
    expect(parent.indeterminate).toBe(false);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Child concepts of Education Finance",
      }),
    );
    expect(parent.indeterminate).toBe(true);
    // The grandparent's branch is still open, so it shows nothing.
    expect(
      screen.getByLabelText<HTMLInputElement>("Access to Education")
        .indeterminate,
    ).toBe(false);
  });

  test("a checked collapsed parent stays checked, not mixed", () => {
    render(
      <ConceptSchemeFilter
        scheme={DEEP_OUTCOME_SCHEME_FIXTURE}
        state={conceptSchemeStateFromUris([
          URI_EDUCATION_FINANCE,
          URI_SCHOOL_FEES,
        ])}
        collapsible
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Child concepts of Education Finance",
      }),
    );
    const parent = screen.getByLabelText<HTMLInputElement>("Education Finance");
    expect(parent.checked).toBe(true);
    expect(parent.indeterminate).toBe(false);
  });

  test("expansion is seeded at mount only; later selection changes don't expand", () => {
    const { rerender } = render(
      <ConceptSchemeFilter
        scheme={DEEP_OUTCOME_SCHEME_FIXTURE}
        state={emptyConceptSchemeState()}
        collapsible
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("School Fees")).toBeNull();
    rerender(
      <ConceptSchemeFilter
        scheme={DEEP_OUTCOME_SCHEME_FIXTURE}
        state={conceptSchemeStateFromUris([URI_SCHOOL_FEES])}
        collapsible
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("School Fees")).toBeNull();
  });

  test("checkbox labels stay unambiguous alongside toggle buttons", () => {
    render(
      <ConceptSchemeFilter
        scheme={DEEP_OUTCOME_SCHEME_FIXTURE}
        state={emptyConceptSchemeState()}
        collapsible
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByLabelText<HTMLInputElement>("Education Finance").type,
    ).toBe("checkbox");
  });
});
