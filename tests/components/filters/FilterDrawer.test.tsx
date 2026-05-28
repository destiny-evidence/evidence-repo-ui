import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/preact";

// Module-level mock so FilterDrawer's internal facet-count fetch is inert
// across the suite; individual tests set the return when they care.
vi.mock("@/hooks/useSearchFacets", () => ({
  useSearchFacets: vi.fn(() => ({
    counts: null,
    loading: false,
    error: null,
  })),
}));

import { FilterDrawer, type AppliedFilters } from "@/components/filters/FilterDrawer";
import { useSearchFacets } from "@/hooks/useSearchFacets";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";
import { makeSearchParams } from "../../fixtures";
import {
  OUTCOME_SCHEME_FIXTURE,
  URI_ACCESS,
  URI_EDUCATION_FINANCE,
  URI_ENROLMENT,
  URI_LEARNING,
} from "./fixtures";

const mockUseSearchFacets = vi.mocked(useSearchFacets);

const defaultParams = makeSearchParams();

function setCounts(counts: ReadonlyMap<string, number> | null, loading = false) {
  mockUseSearchFacets.mockReturnValue({ counts, loading, error: null });
}

beforeEach(() => {
  mockUseSearchFacets.mockReset();
  // Default: no counts. Tests that need counts override via setCounts().
  mockUseSearchFacets.mockReturnValue({
    counts: null,
    loading: false,
    error: null,
  });
});

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
        appliedCountryCodes={[]}
        appliedConceptFilters={[]}
        params={defaultParams}
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
        appliedCountryCodes={[]}
        appliedConceptFilters={[]}
        params={defaultParams}
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

  test("shows a subtitle nudge with the current query when params.q is set", () => {
    const { container } = render(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedCountryCodes={[]}
        appliedConceptFilters={[]}
        params={makeSearchParams({ q: "phonics" })}
        onApply={noop}
        onCancel={noop}
      />,
    );
    // Bind on the class and the query value, not the surrounding wording —
    // the prose around the query is expected to iterate.
    const subtitle = container.querySelector(".filter-drawer__subtitle");
    expect(subtitle).not.toBeNull();
    expect(subtitle?.textContent).toContain("phonics");
  });

  test("hides the subtitle nudge in browse mode (empty q or '*')", () => {
    const { rerender, container } = render(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedCountryCodes={[]}
        appliedConceptFilters={[]}
        params={defaultParams}
        onApply={noop}
        onCancel={noop}
      />,
    );
    expect(container.querySelector(".filter-drawer__subtitle")).toBeNull();

    rerender(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedCountryCodes={[]}
        appliedConceptFilters={[]}
        params={makeSearchParams({ q: "*" })}
        onApply={noop}
        onCancel={noop}
      />,
    );
    expect(container.querySelector(".filter-drawer__subtitle")).toBeNull();
  });

  test("strips a trailing ' Scheme' from the scheme label", () => {
    const scheme: ConceptScheme = {
      uri: "https://vocab.esea.education/EducationLevelScheme",
      label: "Education Level Scheme",
      topConcepts: [{ uri: "x", label: "Primary" }],
    };
    render(
      <FilterDrawer
        open={true}
        schemes={[scheme]}
        appliedCountryCodes={[]}
        appliedConceptFilters={[]}
        params={defaultParams}
        onApply={noop}
        onCancel={noop}
      />,
    );
    expect(
      screen.getByRole("button", { name: /^Education Level/ }),
    ).toBeDefined();
    expect(
      screen.queryByRole("button", { name: /Scheme/ }),
    ).toBeNull();
  });

  test("opens with Show results disabled when nothing is selected", () => {
    render(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedCountryCodes={[]}
        appliedConceptFilters={[]}
        params={defaultParams}
        onApply={noop}
        onCancel={noop}
      />,
    );
    const apply = screen.getByRole("button", { name: "Show results" });
    expect((apply as HTMLButtonElement).disabled).toBe(true);
  });

  test("toggling a concept enables Show results", () => {
    render(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedCountryCodes={[]}
        appliedConceptFilters={[]}
        params={defaultParams}
        onApply={noop}
        onCancel={noop}
      />,
    );
    fireEvent.click(screen.getByLabelText("Journal Article"));
    const apply = screen.getByRole("button", { name: "Show results" });
    expect((apply as HTMLButtonElement).disabled).toBe(false);
  });

  test("Show results fires onApply with one sibling-set group per selection", () => {
    const onApply = vi.fn();
    render(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedCountryCodes={[]}
        appliedConceptFilters={[]}
        params={defaultParams}
        onApply={onApply}
        onCancel={noop}
      />,
    );
    fireEvent.click(screen.getByLabelText("Journal Article"));
    fireEvent.click(screen.getByLabelText("Returns to Education"));
    fireEvent.click(screen.getByRole("button", { name: "Show results" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    const applied = onApply.mock.calls[0][0] as AppliedFilters;
    expect(applied.countryCodes).toEqual([]);
    // Journal Article (DocumentType) and Returns (Outcome) are top concepts
    // of different schemes, so they emit two separate sibling-set groups —
    // emitted in scheme order (Outcome first per TWO_SCHEMES).
    expect(applied.conceptFilters).toEqual([
      ["https://vocab.esea.education/OutcomeScheme/C00130"],
      [URI_JOURNAL],
    ]);
  });

  test("toggling parent concept selects descendants via subtree semantics", () => {
    // Sanity check that the drawer plumbs the scheme through to
    // ConceptSchemeFilter correctly (which owns the subtree toggle), and that
    // the auto-rollup parent + descendants land in disjoint sibling-set groups.
    const onApply = vi.fn();
    render(
      <FilterDrawer
        open={true}
        schemes={[OUTCOME_SCHEME_FIXTURE]}
        appliedCountryCodes={[]}
        appliedConceptFilters={[]}
        params={defaultParams}
        onApply={onApply}
        onCancel={noop}
      />,
    );
    fireEvent.click(screen.getByLabelText("Access to Education"));
    fireEvent.click(screen.getByRole("button", { name: "Show results" }));

    const applied = onApply.mock.calls[0][0] as AppliedFilters;
    expect(applied.conceptFilters).toEqual([
      [URI_ACCESS],
      [URI_EDUCATION_FINANCE, URI_ENROLMENT],
    ]);
  });

  test("Reset clears the draft without closing the drawer", () => {
    const onCancel = vi.fn();
    render(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedCountryCodes={[]}
        appliedConceptFilters={[]}
        params={defaultParams}
        onApply={noop}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByLabelText("Journal Article"));
    expect(
      (screen.getByLabelText("Journal Article") as HTMLInputElement).checked,
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Reset all" }));

    expect(
      (screen.getByLabelText("Journal Article") as HTMLInputElement).checked,
    ).toBe(false);
    // Update Results re-greys because the draft is back to equal-to-applied.
    expect(
      (screen.getByRole("button", { name: "Show results" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    // And Reset does not bubble out to Cancel.
    expect(onCancel).not.toHaveBeenCalled();
  });

  test("Cancel button lives in the drawer header and fires onCancel", () => {
    const onCancel = vi.fn();
    const { container } = render(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedCountryCodes={[]}
        appliedConceptFilters={[]}
        params={defaultParams}
        onApply={noop}
        onCancel={onCancel}
      />,
    );
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(container.querySelector(".filter-drawer__header")?.contains(cancel))
      .toBe(true);
    fireEvent.click(cancel);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test("Escape key fires onCancel", () => {
    const onCancel = vi.fn();
    render(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedCountryCodes={[]}
        appliedConceptFilters={[]}
        params={defaultParams}
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
        appliedCountryCodes={[]}
        appliedConceptFilters={[]}
        params={defaultParams}
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
        appliedCountryCodes={[]}
        appliedConceptFilters={[]}
        params={defaultParams}
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
        appliedCountryCodes={[]}
        appliedConceptFilters={[]}
        params={defaultParams}
        onApply={noop}
        onCancel={noop}
      />,
    );
    expect(document.activeElement).not.toBe(trigger);

    rerender(
      <FilterDrawer
        open={false}
        schemes={TWO_SCHEMES}
        appliedCountryCodes={[]}
        appliedConceptFilters={[]}
        params={defaultParams}
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
        appliedCountryCodes={[]}
        appliedConceptFilters={[]}
        params={defaultParams}
        onApply={noop}
        onCancel={noop}
      />,
    );
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <FilterDrawer
        open={false}
        schemes={TWO_SCHEMES}
        appliedCountryCodes={[]}
        appliedConceptFilters={[]}
        params={defaultParams}
        onApply={noop}
        onCancel={noop}
      />,
    );
    expect(document.body.style.overflow).toBe("auto");
  });

  test("hydrates the draft from appliedConceptFilters on open", () => {
    // appliedConceptFilters carries the URI for "Educational Outcomes and
    // Learning"; the drawer should open with that concept already checked and
    // Show results disabled (draft == applied).
    render(
      <FilterDrawer
        open={true}
        schemes={[OUTCOME_SCHEME_FIXTURE]}
        appliedCountryCodes={[]}
        appliedConceptFilters={[[URI_LEARNING]]}
        params={defaultParams}
        onApply={noop}
        onCancel={noop}
      />,
    );
    expect(
      (screen.getByLabelText("Educational Outcomes and Learning") as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Show results" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  test("toggling away from a hydrated selection enables Show results", () => {
    render(
      <FilterDrawer
        open={true}
        schemes={[OUTCOME_SCHEME_FIXTURE]}
        appliedCountryCodes={[]}
        appliedConceptFilters={[[URI_LEARNING]]}
        params={defaultParams}
        onApply={noop}
        onCancel={noop}
      />,
    );
    fireEvent.click(screen.getByLabelText("Educational Outcomes and Learning"));
    expect(
      (screen.getByRole("button", { name: "Show results" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  test("renders facet counts on schemes that have no selection", () => {
    setCounts(new Map<string, number>([[URI_JOURNAL, 42]]));
    const { container } = render(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedCountryCodes={[]}
        appliedConceptFilters={[]}
        params={defaultParams}
        onApply={noop}
        onCancel={noop}
      />,
    );
    expect(
      container.querySelector(".concept-scheme-filter__count")?.textContent,
    ).toBe("42");
  });

  // Per-scheme count nodes — querying the DOM directly because the count
  // span's aria-label augments the input's accessible name in some
  // testing-library versions but not others, making getByLabelText brittle.
  function countNodesInSchemeContaining(
    container: Element,
    conceptLabel: string,
  ): NodeListOf<Element> {
    // Each FilterCard wraps one scheme. Find the card whose body contains
    // the named concept, then return its count nodes.
    const cards = container.querySelectorAll(".filter-card");
    for (const card of cards) {
      const labels = card.querySelectorAll(".concept-scheme-filter__label");
      for (const label of labels) {
        if (label.textContent === conceptLabel) {
          return card.querySelectorAll(".concept-scheme-filter__count");
        }
      }
    }
    return container.querySelectorAll(":not(*)");
  }

  test("renders sibling counts on a scheme that already has a selection", () => {
    // Backend now returns toggle-semantic counts, so siblings of a selected
    // concept retain meaningful (non-zero) counts. The drawer no longer
    // suppresses them.
    setCounts(new Map<string, number>([
      [URI_LEARNING, 100],
      [URI_ACCESS, 50],
      [URI_JOURNAL, 7],
    ]));
    const { container } = render(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedCountryCodes={[]}
        appliedConceptFilters={[[URI_LEARNING]]}
        params={defaultParams}
        onApply={noop}
        onCancel={noop}
      />,
    );
    // Outcome scheme shows both Access (sibling, unselected, count 50) and
    // Learning (selected, count 100) — two visible count badges in this card.
    expect(
      countNodesInSchemeContaining(container, "Access to Education").length,
    ).toBe(2);
    const journalCounts = countNodesInSchemeContaining(
      container,
      "Journal Article",
    );
    expect(journalCounts.length).toBe(1);
    expect(journalCounts[0].textContent).toBe("7");
  });

  test("counts stay visible after toggling a concept in the same scheme", () => {
    setCounts(new Map<string, number>([
      [URI_ACCESS, 50],
      [URI_LEARNING, 100],
      [URI_JOURNAL, 7],
    ]));
    const { container } = render(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedCountryCodes={[]}
        appliedConceptFilters={[]}
        params={defaultParams}
        onApply={noop}
        onCancel={noop}
      />,
    );
    // Both schemes show their counts initially.
    expect(
      countNodesInSchemeContaining(container, "Access to Education").length,
    ).toBeGreaterThan(0);
    expect(
      countNodesInSchemeContaining(container, "Journal Article").length,
    ).toBe(1);

    // Count's aria-label augments the input's accessible name, so an exact
    // string match no longer hits — match a prefix.
    fireEvent.click(
      screen.getByLabelText(/^Educational Outcomes and Learning/),
    );

    // After selection, both scheme's counts remain visible (Access + Learning
    // in Outcome; Journal in DocumentType).
    expect(
      countNodesInSchemeContaining(container, "Access to Education").length,
    ).toBe(2);
    expect(
      countNodesInSchemeContaining(container, "Journal Article").length,
    ).toBe(1);
  });

  describe("country filter integration", () => {
    test("renders a Country card before any scheme card", () => {
      const { container } = render(
        <FilterDrawer
          open={true}
          schemes={TWO_SCHEMES}
          appliedCountryCodes={[]}
          appliedConceptFilters={[]}
          params={defaultParams}
          onApply={noop}
          onCancel={noop}
        />,
      );
      const titles = Array.from(
        container.querySelectorAll(".filter-card__title"),
      ).map((n) => n.textContent);
      expect(titles[0]).toBe("Country");
    });

    test("selecting a country and applying emits a linked_data_countries facet", () => {
      const onApply = vi.fn();
      render(
        <FilterDrawer
          open={true}
          schemes={[]}
          appliedCountryCodes={[]}
          appliedConceptFilters={[]}
          params={defaultParams}
          onApply={onApply}
          onCancel={noop}
        />,
      );
      // Expand the Country card and pick Germany.
      fireEvent.click(screen.getByRole("button", { name: /Country/ }));
      fireEvent.click(screen.getByLabelText("Germany"));
      fireEvent.click(screen.getByRole("button", { name: "Show results" }));

      expect(onApply).toHaveBeenCalledTimes(1);
      expect(onApply.mock.calls[0][0]).toEqual({
        countryCodes: ["DE"],
        conceptFilters: [],
      });
    });

    test("hydrates country selection from appliedCountryCodes", () => {
      render(
        <FilterDrawer
          open={true}
          schemes={[]}
          appliedCountryCodes={["DE"]}
          appliedConceptFilters={[]}
          params={defaultParams}
          onApply={noop}
          onCancel={noop}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /Country/ }));
      expect(
        (screen.getByLabelText("Germany") as HTMLInputElement).checked,
      ).toBe(true);
      // No change vs applied → Show results stays disabled.
      expect(
        (screen.getByRole("button", { name: "Show results" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    });

    test("Reset clears both scheme and country drafts", () => {
      render(
        <FilterDrawer
          open={true}
          schemes={TWO_SCHEMES}
          appliedCountryCodes={[]}
          appliedConceptFilters={[]}
          params={defaultParams}
          onApply={noop}
          onCancel={noop}
        />,
      );
      fireEvent.click(screen.getByLabelText("Journal Article"));
      fireEvent.click(screen.getByRole("button", { name: /Country/ }));
      fireEvent.click(screen.getByLabelText("Germany"));

      fireEvent.click(screen.getByRole("button", { name: "Reset all" }));

      expect(
        (screen.getByLabelText("Journal Article") as HTMLInputElement).checked,
      ).toBe(false);
      expect(
        (screen.getByLabelText("Germany") as HTMLInputElement).checked,
      ).toBe(false);
    });

    test("applies concept and country facets together", () => {
      const onApply = vi.fn();
      render(
        <FilterDrawer
          open={true}
          schemes={[DOCUMENT_TYPE_SCHEME]}
          appliedCountryCodes={[]}
          appliedConceptFilters={[]}
          params={defaultParams}
          onApply={onApply}
          onCancel={noop}
        />,
      );
      fireEvent.click(screen.getByLabelText("Journal Article"));
      fireEvent.click(screen.getByRole("button", { name: /Country/ }));
      fireEvent.click(screen.getByLabelText("France"));
      fireEvent.click(screen.getByRole("button", { name: "Show results" }));

      const applied = onApply.mock.calls[0][0] as AppliedFilters;
      expect(applied.countryCodes).toEqual(["FR"]);
      expect(applied.conceptFilters).toEqual([[URI_JOURNAL]]);
    });
  });

  test("re-hydrates when reopened after appliedConceptFilters change", () => {
    const initial: readonly (readonly string[])[] = [[URI_LEARNING]];
    const { rerender } = render(
      <FilterDrawer
        open={true}
        schemes={[OUTCOME_SCHEME_FIXTURE]}
        appliedCountryCodes={[]}
        appliedConceptFilters={initial}
        params={defaultParams}
        onApply={noop}
        onCancel={noop}
      />,
    );
    expect(
      (screen.getByLabelText("Educational Outcomes and Learning") as HTMLInputElement)
        .checked,
    ).toBe(true);

    // Close → URL changes externally → reopen.
    const next: readonly (readonly string[])[] = [[URI_ACCESS]];
    rerender(
      <FilterDrawer
        open={false}
        schemes={[OUTCOME_SCHEME_FIXTURE]}
        appliedCountryCodes={[]}
        appliedConceptFilters={next}
        params={defaultParams}
        onApply={noop}
        onCancel={noop}
      />,
    );
    rerender(
      <FilterDrawer
        open={true}
        schemes={[OUTCOME_SCHEME_FIXTURE]}
        appliedCountryCodes={[]}
        appliedConceptFilters={next}
        params={defaultParams}
        onApply={noop}
        onCancel={noop}
      />,
    );

    // toggleConceptSubtree selects the whole subtree under "Access to Education".
    expect(
      (screen.getByLabelText("Access to Education") as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByLabelText("Educational Outcomes and Learning") as HTMLInputElement)
        .checked,
    ).toBe(false);
  });

  test("eager loading: toggling a concept re-keys the facet hook with the new draft", () => {
    render(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedCountryCodes={[]}
        appliedConceptFilters={[]}
        params={makeSearchParams({ q: "phonics" })}
        onApply={noop}
        onCancel={noop}
      />,
    );
    // Pre-toggle: hook fired with empty concept filters and country codes.
    const before = mockUseSearchFacets.mock.calls.at(-1)?.[0];
    expect(before?.countryCodes).toEqual([]);
    expect(before?.conceptFilters).toEqual([]);
    expect(before?.q).toBe("phonics");

    fireEvent.click(screen.getByLabelText("Journal Article"));

    // Post-toggle: the most recent call carries the freshly-drafted concept
    // filter as a structured sibling-set group.
    const after = mockUseSearchFacets.mock.calls.at(-1)?.[0];
    expect(after?.countryCodes).toEqual([]);
    expect(after?.conceptFilters).toEqual([[URI_JOURNAL]]);
    expect(after?.q).toBe("phonics");
  });

  test("eager loading: toggling a country re-keys the facet hook with the new draft", () => {
    render(
      <FilterDrawer
        open={true}
        schemes={TWO_SCHEMES}
        appliedCountryCodes={[]}
        appliedConceptFilters={[]}
        params={makeSearchParams({ q: "phonics" })}
        onApply={noop}
        onCancel={noop}
      />,
    );
    // Pre-toggle: hook fired with no country codes.
    const before = mockUseSearchFacets.mock.calls.at(-1)?.[0];
    expect(before?.countryCodes).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: /Country/ }));
    fireEvent.click(screen.getByLabelText("Germany"));

    // Post-toggle: the most recent call carries the freshly-drafted country.
    const after = mockUseSearchFacets.mock.calls.at(-1)?.[0];
    expect(after?.countryCodes).toEqual(["DE"]);
    expect(after?.q).toBe("phonics");
  });
});
