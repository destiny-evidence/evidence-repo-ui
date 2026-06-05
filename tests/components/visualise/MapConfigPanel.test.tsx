import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/preact";

// Inert facet-count fetch across the suite (the panel previews the draft via it).
vi.mock("@/hooks/useSearchFacets", () => ({
  useSearchFacets: vi.fn(() => ({ counts: null, loading: false, error: null })),
}));

import { MapConfigPanel } from "@/components/visualise/MapConfigPanel";
import { axisToken } from "@/services/evidenceMap";
import { AXIS_COUNTRIES } from "@/services/crossFacets";
import type { ComponentProps } from "preact";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";
import type { EvidenceMapAxes } from "@/types/models";
import { makeSearchParams } from "../../fixtures";
import { OUTCOME_SCHEME_FIXTURE } from "../filters/fixtures";

const URI_JOURNAL = "https://vocab.esea.education/DocumentTypeScheme/C00008";
const DOCUMENT_TYPE_SCHEME: ConceptScheme = {
  uri: "https://vocab.esea.education/DocumentTypeScheme",
  label: "Document type",
  topConcepts: [{ uri: URI_JOURNAL, label: "Journal Article" }],
};

const SCHEMES: ConceptScheme[] = [OUTCOME_SCHEME_FIXTURE, DOCUMENT_TYPE_SCHEME];

// row = Outcome, column = Document type.
const AXES: EvidenceMapAxes = {
  row: { kind: "scheme", schemeUri: OUTCOME_SCHEME_FIXTURE.uri },
  column: { kind: "scheme", schemeUri: DOCUMENT_TYPE_SCHEME.uri },
};

function noop() {}

type PanelProps = ComponentProps<typeof MapConfigPanel>;

const baseProps: PanelProps = {
  schemes: SCHEMES,
  appliedAxes: AXES,
  defaultAxes: AXES,
  appliedConceptFilters: [],
  appliedCountryCodes: [],
  appliedStartYear: undefined,
  appliedEndYear: undefined,
  params: makeSearchParams(),
  countNoun: "investigations",
  onApply: noop,
};

function renderPanel(overrides: Partial<PanelProps> = {}) {
  return render(<MapConfigPanel {...baseProps} {...overrides} />);
}

function rowSelect() {
  return screen.getByLabelText("Rows (y)") as HTMLSelectElement;
}
function columnSelect() {
  return screen.getByLabelText("Columns (x)") as HTMLSelectElement;
}
function showResults() {
  return screen.getByRole("button", { name: "Show results" }) as HTMLButtonElement;
}

describe("MapConfigPanel", () => {
  test("axis dropdowns reflect the applied axes and offer schemes + Countries", () => {
    renderPanel();
    expect(rowSelect().value).toBe(axisToken(AXES.row));
    expect(columnSelect().value).toBe(axisToken(AXES.column));

    // Both scheme labels (display form, "Scheme" stripped) and Countries are
    // present as options in each dropdown.
    const row = within(rowSelect());
    expect(row.getByRole("option", { name: "Outcome" })).toBeInTheDocument();
    expect(row.getByRole("option", { name: "Document type" })).toBeInTheDocument();
    expect(row.getByRole("option", { name: "Countries" })).toBeInTheDocument();
  });

  test("disables the other axis's current value to prevent a same-axis map", () => {
    renderPanel();
    // Column is Document type, so that option is disabled in the Row dropdown.
    const disabled = within(rowSelect()).getByRole("option", {
      name: "Document type",
    }) as HTMLOptionElement;
    expect(disabled.disabled).toBe(true);
    // The Row's own current value (Outcome) stays selectable.
    expect(
      (within(rowSelect()).getByRole("option", { name: "Outcome" }) as HTMLOptionElement)
        .disabled,
    ).toBe(false);
  });

  test("Show results is disabled until something changes", () => {
    renderPanel();
    expect(showResults().disabled).toBe(true);
  });

  test("changing an axis enables Show results", () => {
    renderPanel();
    fireEvent.change(rowSelect(), { target: { value: AXIS_COUNTRIES } });
    expect(rowSelect().value).toBe(AXIS_COUNTRIES);
    expect(showResults().disabled).toBe(false);
  });

  test("toggling a filter enables Show results", () => {
    renderPanel();
    fireEvent.click(screen.getByLabelText("Journal Article"));
    expect(showResults().disabled).toBe(false);
  });

  test("Show results applies the drafted axes and filters together", () => {
    const onApply = vi.fn();
    renderPanel({ onApply });

    fireEvent.change(rowSelect(), { target: { value: AXIS_COUNTRIES } });
    fireEvent.click(screen.getByLabelText("Journal Article"));
    fireEvent.click(showResults());

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0]).toEqual({
      axes: {
        row: { kind: "countries" },
        column: { kind: "scheme", schemeUri: DOCUMENT_TYPE_SCHEME.uri },
      },
      filters: {
        conceptFilters: [[URI_JOURNAL]],
        countryCodes: [],
        startYear: undefined,
        endYear: undefined,
      },
    });
  });

  test("Reset all restores the default axes and clears filter selections", () => {
    renderPanel();
    fireEvent.change(rowSelect(), { target: { value: AXIS_COUNTRIES } });
    fireEvent.click(screen.getByLabelText("Journal Article"));
    expect(
      (screen.getByLabelText("Journal Article") as HTMLInputElement).checked,
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Reset all" }));

    expect(rowSelect().value).toBe(axisToken(AXES.row));
    expect(
      (screen.getByLabelText("Journal Article") as HTMLInputElement).checked,
    ).toBe(false);
    // Back to equal-to-applied → Show results re-greys.
    expect(showResults().disabled).toBe(true);
  });

  test("hydrates the axis drafts from appliedAxes (independent of defaults)", () => {
    renderPanel({
      appliedAxes: {
        row: { kind: "countries" },
        column: { kind: "scheme", schemeUri: OUTCOME_SCHEME_FIXTURE.uri },
      },
    });
    expect(rowSelect().value).toBe(AXIS_COUNTRIES);
    expect(columnSelect().value).toBe(axisToken({
      kind: "scheme",
      schemeUri: OUTCOME_SCHEME_FIXTURE.uri,
    }));
  });
});
