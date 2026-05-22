import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/preact";
import { FilterDrawer } from "@/components/filters/FilterDrawer";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";
import {
  OUTCOME_SCHEME_FIXTURE,
  URI_ACCESS,
  URI_EDUCATION_FINANCE,
  URI_ENROLMENT,
  URI_LEARNING,
} from "./fixtures";

// A second scheme exercises the multi-scheme rendering and the per-scheme
// draft Map.
const URI_JOURNAL = "https://vocab.esea.education/DocumentTypeScheme/C00008";
const DOCUMENT_TYPE_SCHEME: ConceptScheme = {
  uri: "https://vocab.esea.education/DocumentTypeScheme",
  label: "Document type",
  topConcepts: [{ uri: URI_JOURNAL, label: "Journal Article" }],
};

const TWO_SCHEMES: ConceptScheme[] = [
  OUTCOME_SCHEME_FIXTURE,
  DOCUMENT_TYPE_SCHEME,
];

function noop() {}

describe("FilterDrawer", () => {
  test("renders nothing when closed", () => {
    const { container } = render(
      <FilterDrawer
        open={false}
        schemes={TWO_SCHEMES}
        appliedFacets={[]}
        onApply={noop}
        onCancel={noop}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  test("renders one FilterCard per scheme", () => {
    render(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedFacets={[]}
        onApply={noop}
        onCancel={noop}
      />,
    );
    expect(
      screen.getByRole("button", { name: /^Outcome/ }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: /^Document type/ }),
    ).toBeDefined();
  });

  test("opens with Update Results disabled when nothing is selected", () => {
    render(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedFacets={[]}
        onApply={noop}
        onCancel={noop}
      />,
    );
    const apply = screen.getByRole("button", { name: "Update Results" });
    expect((apply as HTMLButtonElement).disabled).toBe(true);
  });

  test("toggling a concept enables Update Results", () => {
    render(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedFacets={[]}
        onApply={noop}
        onCancel={noop}
      />,
    );
    fireEvent.click(screen.getByLabelText("Journal Article"));
    const apply = screen.getByRole("button", { name: "Update Results" });
    expect((apply as HTMLButtonElement).disabled).toBe(false);
  });

  test("Update Results fires onApply with one facet entry per non-empty scheme", () => {
    const onApply = vi.fn();
    render(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedFacets={[]}
        onApply={onApply}
        onCancel={noop}
      />,
    );
    fireEvent.click(screen.getByLabelText("Journal Article"));
    fireEvent.click(screen.getByLabelText("Returns to Education"));
    fireEvent.click(screen.getByRole("button", { name: "Update Results" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    const facets = onApply.mock.calls[0][0] as string[];
    expect(facets).toHaveLength(2);
    expect(facets).toContain(
      `linked_data_concepts:"https://vocab.esea.education/OutcomeScheme/C00130"`,
    );
    expect(facets).toContain(`linked_data_concepts:"${URI_JOURNAL}"`);
  });

  test("toggling parent concept selects descendants via subtree semantics", () => {
    // Sanity check that the drawer plumbs the scheme through to
    // ConceptSchemeFilter correctly (which owns the subtree toggle).
    const onApply = vi.fn();
    render(
      <FilterDrawer
        open={true}
        schemes={[OUTCOME_SCHEME_FIXTURE]}
        appliedFacets={[]}
        onApply={onApply}
        onCancel={noop}
      />,
    );
    fireEvent.click(screen.getByLabelText("Access to Education"));
    fireEvent.click(screen.getByRole("button", { name: "Update Results" }));

    const facet = (onApply.mock.calls[0][0] as string[])[0];
    expect(facet).toContain(URI_ACCESS);
    expect(facet).toContain(URI_EDUCATION_FINANCE);
    expect(facet).toContain(URI_ENROLMENT);
  });

  test("Reset clears the draft without closing the drawer", () => {
    const onCancel = vi.fn();
    render(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedFacets={[]}
        onApply={noop}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByLabelText("Journal Article"));
    expect(
      (screen.getByLabelText("Journal Article") as HTMLInputElement).checked,
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(
      (screen.getByLabelText("Journal Article") as HTMLInputElement).checked,
    ).toBe(false);
    // Update Results re-greys because the draft is back to equal-to-applied.
    expect(
      (screen.getByRole("button", { name: "Update Results" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    // And Reset does not bubble out to Cancel.
    expect(onCancel).not.toHaveBeenCalled();
  });

  test("Cancel button fires onCancel", () => {
    const onCancel = vi.fn();
    render(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedFacets={[]}
        onApply={noop}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test("Escape key fires onCancel", () => {
    const onCancel = vi.fn();
    render(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedFacets={[]}
        onApply={noop}
        onCancel={onCancel}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test("backdrop click does NOT fire onCancel", () => {
    const onCancel = vi.fn();
    const { container } = render(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedFacets={[]}
        onApply={noop}
        onCancel={onCancel}
      />,
    );
    const backdrop = container.querySelector(".filter-drawer__backdrop");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(onCancel).not.toHaveBeenCalled();
  });

  test("focus lands on the dialog panel when opened", () => {
    const { container } = render(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedFacets={[]}
        onApply={noop}
        onCancel={noop}
      />,
    );
    const panel = container.querySelector(".filter-drawer__panel");
    expect(panel).not.toBeNull();
    expect(document.activeElement).toBe(panel);
  });

  test("returns focus to the previously-focused element on close", () => {
    document.body.innerHTML = '<button id="trigger">open</button>';
    const trigger = document.getElementById("trigger") as HTMLButtonElement;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { rerender } = render(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedFacets={[]}
        onApply={noop}
        onCancel={noop}
      />,
    );
    expect(document.activeElement).not.toBe(trigger);

    rerender(
      <FilterDrawer
        open={false}
        schemes={TWO_SCHEMES}
        appliedFacets={[]}
        onApply={noop}
        onCancel={noop}
      />,
    );
    expect(document.activeElement).toBe(trigger);

    // Tidy up so the next test starts with a fresh body.
    cleanup();
    document.body.innerHTML = "";
  });

  test("locks body scroll while open and restores prior value on close", () => {
    document.body.style.overflow = "auto";
    const { rerender } = render(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedFacets={[]}
        onApply={noop}
        onCancel={noop}
      />,
    );
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <FilterDrawer
        open={false}
        schemes={TWO_SCHEMES}
        appliedFacets={[]}
        onApply={noop}
        onCancel={noop}
      />,
    );
    expect(document.body.style.overflow).toBe("auto");
  });

  test("with a non-empty draft matching appliedFacets, Update Results stays disabled", () => {
    // appliedFacets carries the URI for "Educational Outcomes and Learning".
    // After the user clicks that same concept, the draft now equals applied
    // (one URI in one scheme) so the apply button should remain disabled.
    const appliedFacets = [`linked_data_concepts:"${URI_LEARNING}"`];
    render(
      <FilterDrawer
        open={true}
        schemes={[OUTCOME_SCHEME_FIXTURE]}
        appliedFacets={appliedFacets}
        onApply={noop}
        onCancel={noop}
      />,
    );
    fireEvent.click(screen.getByLabelText("Educational Outcomes and Learning"));
    expect(
      (screen.getByRole("button", { name: "Update Results" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
