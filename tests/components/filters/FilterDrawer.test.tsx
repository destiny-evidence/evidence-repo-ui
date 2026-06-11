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
import type { ComponentProps } from "preact";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";
import { makeSearchParams } from "../../fixtures";
import {
  DOCUMENT_TYPE_SCHEME,
  OUTCOME_SCHEME_FIXTURE,
  URI_ACCESS,
  URI_JOURNAL,
  URI_LEARNING,
} from "./fixtures";

const mockUseSearchFacets = vi.mocked(useSearchFacets);

const defaultParams = makeSearchParams();

function setCounts({
  concepts = new Map<string, number>(),
  countries = new Map<string, number>(),
  loading = false,
}: {
  concepts?: ReadonlyMap<string, number>;
  countries?: ReadonlyMap<string, number>;
  loading?: boolean;
} = {}) {
  mockUseSearchFacets.mockReturnValue({
    counts: { concepts, countries },
    loading,
    error: null,
  });
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

const TWO_SCHEMES: ConceptScheme[] = [
  OUTCOME_SCHEME_FIXTURE,
  DOCUMENT_TYPE_SCHEME,
];

function noop() {}

type DrawerProps = ComponentProps<typeof FilterDrawer>;

const baseDrawerProps: DrawerProps = {
  open: true,
  schemes: TWO_SCHEMES,
  appliedConceptFilters: [],
  appliedCountryCodes: [],
  appliedStartYear: undefined,
  appliedEndYear: undefined,
  params: defaultParams,
  onApply: noop,
  onCancel: noop,
};

function renderDrawer(overrides: Partial<DrawerProps> = {}) {
  const result = render(<FilterDrawer {...baseDrawerProps} {...overrides} />);
  return {
    ...result,
    rerender: (next: Partial<DrawerProps> = {}) =>
      result.rerender(<FilterDrawer {...baseDrawerProps} {...next} />),
  };
}

describe("FilterDrawer", () => {
  test("renders nothing when closed", () => {
    const { container } = renderDrawer({ open: false });
    expect(container.firstChild).toBeNull();
  });

  test("renders one FilterCard per scheme", () => {
    renderDrawer();
    expect(
      screen.getByRole("button", { name: /^Outcome/ }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: /^Document type/ }),
    ).toBeDefined();
  });

  test("shows the dedicated Country card by default", () => {
    renderDrawer();
    expect(screen.getByText("Country")).toBeInTheDocument();
  });

  test("hides the dedicated Country card when showCountryFacetFilter is false", () => {
    renderDrawer({ showCountryFacetFilter: false });
    expect(screen.queryByText("Country")).toBeNull();
  });

  test("shows a subtitle nudge with the current query when params.q is set", () => {
    const { container } = renderDrawer({
      params: makeSearchParams({ q: "phonics" }),
    });
    // Bind on the class and the query value, not the surrounding wording —
    // the prose around the query is expected to iterate.
    const subtitle = container.querySelector(".filter-drawer__subtitle");
    expect(subtitle).not.toBeNull();
    expect(subtitle?.textContent).toContain("phonics");
  });

  test("hides the subtitle nudge in browse mode (empty q or '*')", () => {
    const { rerender, container } = renderDrawer();
    expect(container.querySelector(".filter-drawer__subtitle")).toBeNull();

    rerender({ params: makeSearchParams({ q: "*" }) });
    expect(container.querySelector(".filter-drawer__subtitle")).toBeNull();
  });

  test("strips a trailing ' Scheme' from the scheme label", () => {
    const scheme: ConceptScheme = {
      uri: "https://vocab.esea.education/EducationLevelScheme",
      label: "Education Level Scheme",
      topConcepts: [{ uri: "x", label: "Primary" }],
    };
    renderDrawer({ schemes: [scheme] });
    expect(
      screen.getByRole("button", { name: /^Education Level/ }),
    ).toBeDefined();
    expect(
      screen.queryByRole("button", { name: /Scheme/ }),
    ).toBeNull();
  });

  test("opens with Show results disabled when nothing is selected", () => {
    renderDrawer();
    const apply = screen.getByRole("button", { name: "Show results" });
    expect((apply as HTMLButtonElement).disabled).toBe(true);
  });

  test("toggling a concept enables Show results", () => {
    renderDrawer();
    fireEvent.click(screen.getByLabelText("Journal Article"));
    const apply = screen.getByRole("button", { name: "Show results" });
    expect((apply as HTMLButtonElement).disabled).toBe(false);
  });

  test("Show results fires onApply with one OR-group per scheme", () => {
    const onApply = vi.fn();
    renderDrawer({ onApply });
    fireEvent.click(screen.getByLabelText("Journal Article"));
    fireEvent.click(screen.getByLabelText("Returns to Education"));
    fireEvent.click(screen.getByRole("button", { name: "Show results" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    const applied = onApply.mock.calls[0][0] as AppliedFilters;
    expect(applied.countryCodes).toEqual([]);
    // Concepts from different schemes → separate groups (AND'd across schemes),
    // in scheme order (Outcome first per TWO_SCHEMES).
    expect(applied.conceptFilters).toEqual([
      ["https://vocab.esea.education/OutcomeScheme/C00130"],
      [URI_JOURNAL],
    ]);
  });

  test("toggling parent concept emits only the parent URI (no cascade)", () => {
    // Toggling a parent adds only the parent URI — no cascade — so children
    // must be clicked individually.
    const onApply = vi.fn();
    renderDrawer({ schemes: [OUTCOME_SCHEME_FIXTURE], onApply });
    fireEvent.click(screen.getByLabelText("Access to Education"));
    fireEvent.click(screen.getByRole("button", { name: "Show results" }));

    const applied = onApply.mock.calls[0][0] as AppliedFilters;
    expect(applied.conceptFilters).toEqual([[URI_ACCESS]]);
  });

  test("Reset clears the draft without closing the drawer", () => {
    const onCancel = vi.fn();
    renderDrawer({ onCancel });
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
    const { container } = renderDrawer({ onCancel });
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(container.querySelector(".filter-drawer__header")?.contains(cancel))
      .toBe(true);
    fireEvent.click(cancel);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test("Escape key fires onCancel", () => {
    const onCancel = vi.fn();
    renderDrawer({ onCancel });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test("backdrop click does NOT fire onCancel", () => {
    const onCancel = vi.fn();
    const { container } = renderDrawer({ onCancel });
    const backdrop = container.querySelector(".filter-drawer__backdrop");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(onCancel).not.toHaveBeenCalled();
  });

  test("focus lands on the dialog panel when opened", () => {
    const { container } = renderDrawer();
    const panel = container.querySelector(".filter-drawer__panel");
    expect(panel).not.toBeNull();
    expect(document.activeElement).toBe(panel);
  });

  test("returns focus to the previously-focused element on close", () => {
    document.body.innerHTML = '<button id="trigger">open</button>';
    const trigger = document.getElementById("trigger") as HTMLButtonElement;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { rerender } = renderDrawer();
    expect(document.activeElement).not.toBe(trigger);

    rerender({ open: false });
    expect(document.activeElement).toBe(trigger);

    // Tidy up so the next test starts with a fresh body.
    cleanup();
    document.body.innerHTML = "";
  });

  test("locks body scroll while open and restores prior value on close", () => {
    document.body.style.overflow = "auto";
    const { rerender } = renderDrawer();
    expect(document.body.style.overflow).toBe("hidden");

    rerender({ open: false });
    expect(document.body.style.overflow).toBe("auto");
  });

  test("hydrates the draft from appliedConceptFilters on open", () => {
    renderDrawer({
      schemes: [OUTCOME_SCHEME_FIXTURE],
      appliedConceptFilters: [[URI_LEARNING]],
    });
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
    renderDrawer({
      schemes: [OUTCOME_SCHEME_FIXTURE],
      appliedConceptFilters: [[URI_LEARNING]],
    });
    fireEvent.click(screen.getByLabelText("Educational Outcomes and Learning"));
    expect(
      (screen.getByRole("button", { name: "Show results" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  test("renders facet counts on schemes that have no selection", () => {
    setCounts({ concepts: new Map([[URI_JOURNAL, 42]]) });
    const { container } = renderDrawer();
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
    // Toggle-semantic counts keep meaningful values for siblings of a
    // selected concept; the drawer no longer suppresses them.
    setCounts({
      concepts: new Map([
        [URI_LEARNING, 100],
        [URI_ACCESS, 50],
        [URI_JOURNAL, 7],
      ]),
    });
    const { container } = renderDrawer({
      appliedConceptFilters: [[URI_LEARNING]],
    });
    // Two badges in the Outcome card: Access (50) + Learning (100, selected).
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
    setCounts({
      concepts: new Map([
        [URI_ACCESS, 50],
        [URI_LEARNING, 100],
        [URI_JOURNAL, 7],
      ]),
    });
    const { container } = renderDrawer();
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

    // After selection, both schemes' counts remain visible.
    expect(
      countNodesInSchemeContaining(container, "Access to Education").length,
    ).toBe(2);
    expect(
      countNodesInSchemeContaining(container, "Journal Article").length,
    ).toBe(1);
  });

  describe("country filter integration", () => {
    test("renders the Country card after Publication year but before any scheme card", () => {
      const { container } = renderDrawer();
      const titles = Array.from(
        container.querySelectorAll(".filter-card__title"),
      ).map((n) => n.textContent);
      expect(titles[0]).toBe("Publication year");
      expect(titles[1]).toBe("Country");
    });

    test("selecting a country and applying emits the code on appliedCountryCodes", () => {
      const onApply = vi.fn();
      setCounts({ countries: new Map([["DE", 230]]) });
      renderDrawer({ schemes: [], onApply });
      fireEvent.click(screen.getByLabelText(/^Germany/));
      fireEvent.click(screen.getByRole("button", { name: "Show results" }));

      expect(onApply).toHaveBeenCalledTimes(1);
      expect(onApply.mock.calls[0][0]).toEqual({
        countryCodes: ["DE"],
        conceptFilters: [],
        startYear: undefined,
        endYear: undefined,
      });
    });

    test("hydrates country selection from appliedCountryCodes", () => {
      renderDrawer({ schemes: [], appliedCountryCodes: ["DE"] });
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
      setCounts({ countries: new Map([["DE", 230]]) });
      renderDrawer();
      fireEvent.click(screen.getByLabelText("Journal Article"));
      fireEvent.click(screen.getByLabelText(/^Germany/));

      fireEvent.click(screen.getByRole("button", { name: "Reset all" }));

      expect(
        (screen.getByLabelText("Journal Article") as HTMLInputElement).checked,
      ).toBe(false);
      expect(
        (screen.getByLabelText(/^Germany/) as HTMLInputElement).checked,
      ).toBe(false);
    });

    test("applies concept and country facets together", () => {
      const onApply = vi.fn();
      setCounts({ countries: new Map([["FR", 12]]) });
      renderDrawer({ schemes: [DOCUMENT_TYPE_SCHEME], onApply });
      fireEvent.click(screen.getByLabelText("Journal Article"));
      fireEvent.click(screen.getByLabelText(/^France/));
      fireEvent.click(screen.getByRole("button", { name: "Show results" }));

      const applied = onApply.mock.calls[0][0] as AppliedFilters;
      expect(applied.countryCodes).toEqual(["FR"]);
      expect(applied.conceptFilters).toEqual([[URI_JOURNAL]]);
    });
  });

  describe("year range integration", () => {
    function startYearInput() {
      return screen.getByLabelText("Start year") as HTMLInputElement;
    }
    function endYearInput() {
      return screen.getByLabelText("End year") as HTMLInputElement;
    }

    test("hydrates the year inputs from appliedStartYear / appliedEndYear", () => {
      renderDrawer({
        schemes: [],
        appliedStartYear: 2010,
        appliedEndYear: 2020,
      });
      expect(startYearInput().value).toBe("2010");
      expect(endYearInput().value).toBe("2020");
      // Hydrated draft equals applied → Show results stays disabled.
      expect(
        (screen.getByRole("button", { name: "Show results" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    });

    test("editing a year enables Show results", () => {
      renderDrawer({ schemes: [] });
      fireEvent.input(startYearInput(), { target: { value: "1990" } });
      expect(
        (screen.getByRole("button", { name: "Show results" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
    });

    test("applying a one-sided range emits undefined for the missing side", () => {
      const onApply = vi.fn();
      renderDrawer({ schemes: [], onApply });
      fireEvent.input(startYearInput(), { target: { value: "1990" } });
      fireEvent.click(screen.getByRole("button", { name: "Show results" }));

      expect(onApply).toHaveBeenCalledTimes(1);
      expect(onApply.mock.calls[0][0]).toEqual({
        countryCodes: [],
        conceptFilters: [],
        startYear: 1990,
        endYear: undefined,
      });
    });

    test("start > end shows inline error and disables Show results", () => {
      renderDrawer({ schemes: [] });
      fireEvent.input(startYearInput(), { target: { value: "2020" } });
      fireEvent.input(endYearInput(), { target: { value: "2010" } });

      expect(screen.getByRole("alert")).toHaveTextContent(
        /start year must not exceed end year/i,
      );
      expect(
        (screen.getByRole("button", { name: "Show results" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    });

    test("non-numeric end year flags an error and blocks Show results", () => {
      renderDrawer({ schemes: [] });
      fireEvent.input(endYearInput(), { target: { value: "abc" } });

      expect(screen.getByRole("alert")).toHaveTextContent(
        /end year must be a 4-digit number/i,
      );
      expect(
        (screen.getByRole("button", { name: "Show results" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    });

    test("Reset clears year inputs alongside facet drafts", () => {
      renderDrawer({
        schemes: [],
        appliedStartYear: 2010,
        appliedEndYear: 2020,
      });
      expect(startYearInput().value).toBe("2010");
      fireEvent.click(screen.getByRole("button", { name: "Reset all" }));
      expect(startYearInput().value).toBe("");
      expect(endYearInput().value).toBe("");
    });

    test("clearing a previously-applied range applies undefined years", () => {
      const onApply = vi.fn();
      renderDrawer({
        schemes: [],
        appliedStartYear: 2010,
        appliedEndYear: 2020,
        onApply,
      });
      fireEvent.input(startYearInput(), { target: { value: "" } });
      fireEvent.input(endYearInput(), { target: { value: "" } });
      fireEvent.click(screen.getByRole("button", { name: "Show results" }));

      expect(onApply.mock.calls[0][0]).toEqual({
        countryCodes: [],
        conceptFilters: [],
        startYear: undefined,
        endYear: undefined,
      });
    });

    test("eager loading: editing a year re-keys the facet hook with the new range", () => {
      renderDrawer({ params: makeSearchParams({ q: "phonics" }) });
      const before = mockUseSearchFacets.mock.calls.at(-1)?.[0];
      expect(before?.startYear).toBeUndefined();

      fireEvent.input(startYearInput(), { target: { value: "2015" } });

      const after = mockUseSearchFacets.mock.calls.at(-1)?.[0];
      expect(after?.startYear).toBe(2015);
      expect(after?.q).toBe("phonics");
    });
  });

  test("re-hydrates when reopened after appliedConceptFilters change", () => {
    const initial: readonly (readonly string[])[] = [[URI_LEARNING]];
    const { rerender } = renderDrawer({
      schemes: [OUTCOME_SCHEME_FIXTURE],
      appliedConceptFilters: initial,
    });
    expect(
      (screen.getByLabelText("Educational Outcomes and Learning") as HTMLInputElement)
        .checked,
    ).toBe(true);

    // Close → URL changes externally → reopen.
    const next: readonly (readonly string[])[] = [[URI_ACCESS]];
    rerender({
      open: false,
      schemes: [OUTCOME_SCHEME_FIXTURE],
      appliedConceptFilters: next,
    });
    rerender({
      schemes: [OUTCOME_SCHEME_FIXTURE],
      appliedConceptFilters: next,
    });

    expect(
      (screen.getByLabelText("Access to Education") as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByLabelText("Educational Outcomes and Learning") as HTMLInputElement)
        .checked,
    ).toBe(false);
  });

  test("eager loading: toggling a concept re-keys the facet hook with the new draft", () => {
    renderDrawer({ params: makeSearchParams({ q: "phonics" }) });
    const before = mockUseSearchFacets.mock.calls.at(-1)?.[0];
    expect(before?.countryCodes).toEqual([]);
    expect(before?.conceptFilters).toEqual([]);
    expect(before?.q).toBe("phonics");

    fireEvent.click(screen.getByLabelText("Journal Article"));

    const after = mockUseSearchFacets.mock.calls.at(-1)?.[0];
    expect(after?.countryCodes).toEqual([]);
    expect(after?.conceptFilters).toEqual([[URI_JOURNAL]]);
    expect(after?.q).toBe("phonics");
  });

  test("eager loading: toggling a country re-keys the facet hook with the new draft", () => {
    setCounts({ countries: new Map([["DE", 230]]) });
    renderDrawer({ params: makeSearchParams({ q: "phonics" }) });
    const before = mockUseSearchFacets.mock.calls.at(-1)?.[0];
    expect(before?.countryCodes).toEqual([]);

    fireEvent.click(screen.getByLabelText(/^Germany/));

    // Post-toggle: the most recent call carries the freshly-drafted country.
    const after = mockUseSearchFacets.mock.calls.at(-1)?.[0];
    expect(after?.countryCodes).toEqual(["DE"]);
    expect(after?.q).toBe("phonics");
  });
});
