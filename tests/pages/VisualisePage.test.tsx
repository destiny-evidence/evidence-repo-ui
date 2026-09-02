import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/preact";
import { VisualisePage } from "@/pages/VisualisePage";
import { parseSearchParams } from "@/services/searchParams";
import { makeCommunity } from "../fixtures";
import type { EvidenceMapAxes, ReferenceCrossFacetResult } from "@/types/models";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";
import {
  AXIS_COUNTRIES,
  type CrossFacetAxisPair,
} from "@/services/crossFacets";

const { mockUseCommunity, mockUseCrossFacets, mockUseVocabulary, mockUseUrlParams, mockNavigate } =
  vi.hoisted(() => ({
    mockUseCommunity: vi.fn(),
    mockUseCrossFacets: vi.fn(),
    mockUseVocabulary: vi.fn(),
    mockUseUrlParams: vi.fn(),
    mockNavigate: vi.fn(),
  }));

vi.mock("@/community/CommunityContext", () => ({
  useCommunity: mockUseCommunity,
}));
vi.mock("@/hooks/useCrossFacets", () => ({ useCrossFacets: mockUseCrossFacets }));
vi.mock("@/hooks/useVocabulary", () => ({ useVocabulary: mockUseVocabulary }));
vi.mock("@/hooks/useUrlParams", () => ({ useUrlParams: mockUseUrlParams }));
// The config panel previews the draft via useSearchFacets; keep it inert so
// these tests don't fire real facet-count fetches.
vi.mock("@/hooks/useSearchFacets", () => ({
  useSearchFacets: vi.fn(() => ({ counts: null, loading: false, error: null })),
}));
vi.mock("@/services/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/navigation")>();
  return { ...actual, navigate: mockNavigate };
});

const AXES: EvidenceMapAxes = {
  row: { kind: "scheme", schemeUri: "scheme:level" },
  column: { kind: "scheme", schemeUri: "scheme:theme" },
};

const CROSS_AXES: CrossFacetAxisPair = {
  row: { kind: "scheme", schemeUri: "scheme:level" },
  column: { kind: "scheme", schemeUri: "scheme:theme" },
};

const TOPIC_CROSS_AXES: CrossFacetAxisPair = {
  row: CROSS_AXES.row,
  column: { kind: "scheme", schemeUri: "scheme:topic" },
};

function mappedCommunity(overrides = {}) {
  return makeCommunity({
    features: { evidenceMap: true },
    defaultEvidenceMapAxes: AXES,
    ...overrides,
  });
}

const LABELS = new Map<string, string>([
  ["level:primary", "Primary"],
  ["theme:literacy", "Literacy"],
  ["theme:numeracy", "Numeracy"],
]);

// Schemes matching AXES so the grid can enumerate zero-hit categories.
const SCHEMES: ConceptScheme[] = [
  {
    uri: "scheme:level",
    label: "Education Level Scheme",
    topConcepts: [
      { uri: "level:primary", label: "Primary" },
      { uri: "level:secondary", label: "Secondary" },
    ],
  },
  {
    uri: "scheme:theme",
    label: "Education Theme Scheme",
    topConcepts: [
      { uri: "theme:literacy", label: "Literacy" },
      { uri: "theme:numeracy", label: "Numeracy" },
      { uri: "theme:science", label: "Science" },
    ],
  },
];

// The theme scheme with Literacy nested under Learning, so a reported value can
// be told apart from a bare leaf label.
const NESTED_SCHEMES: ConceptScheme[] = [
  SCHEMES[0],
  {
    uri: "scheme:theme",
    label: "Education Theme Scheme",
    topConcepts: [
      {
        uri: "theme:learning",
        label: "Learning",
        narrower: [{ uri: "theme:literacy", label: "Literacy" }],
      },
    ],
  },
];

const PAGE_NESTED_SCHEMES: ConceptScheme[] = [
  {
    uri: "scheme:level",
    label: "Education Level Scheme",
    topConcepts: [
      {
        uri: "level:education",
        label: "Education",
        narrower: [
          {
            uri: "level:primary",
            label: "Primary",
            narrower: [
              { uri: "level:lower-primary", label: "Lower primary" },
              { uri: "level:upper-primary", label: "Upper primary" },
            ],
          },
          { uri: "level:secondary", label: "Secondary" },
        ],
      },
    ],
  },
  {
    uri: "scheme:theme",
    label: "Education Theme Scheme",
    topConcepts: [
      {
        uri: "theme:themes",
        label: "Themes",
        narrower: [
          {
            uri: "theme:literacy",
            label: "Literacy",
            narrower: [
              { uri: "theme:reading", label: "Reading" },
              { uri: "theme:writing", label: "Writing" },
            ],
          },
          { uri: "theme:numeracy", label: "Numeracy" },
        ],
      },
    ],
  },
  {
    uri: "scheme:topic",
    label: "Education Topic Scheme",
    topConcepts: [
      {
        uri: "topic:topics",
        label: "Topics",
        narrower: [
          {
            uri: "topic:access",
            label: "Access",
            narrower: [
              { uri: "topic:school", label: "School access" },
              { uri: "topic:home", label: "Home access" },
            ],
          },
          { uri: "topic:quality", label: "Quality" },
        ],
      },
    ],
  },
];

const PAGE_NESTED_CELLS: [string, string, number][] = [
  ["level:education", "theme:themes", 90],
  ["level:primary", "theme:literacy", 40],
  ["level:primary", "theme:reading", 24],
  ["level:primary", "theme:writing", 16],
  ["level:primary", "theme:numeracy", 20],
  ["level:lower-primary", "theme:literacy", 22],
  ["level:upper-primary", "theme:literacy", 18],
  ["level:secondary", "theme:literacy", 10],
  ["level:secondary", "theme:numeracy", 20],
];

function nestedVocabulary() {
  mockUseVocabulary.mockReturnValue({
    labels: LABELS,
    broader: null,
    definitions: null,
    schemes: PAGE_NESTED_SCHEMES,
    loading: false,
    error: null,
  });
}

function nestedAxesCommunity() {
  mockUseCommunity.mockReturnValue(
    mappedCommunity({
      features: { evidenceMap: true, nestedEvidenceMapAxes: true },
    }),
  );
  nestedVocabulary();
}

// `mapped` is the count plotted on the map; `search` (defaulting to it) the
// count matching the filters, which is larger when references miss an axis.
function crossFacetResult(
  mapped: number,
  cells: [string, string, number][],
  search: number = mapped,
): ReferenceCrossFacetResult {
  return {
    totals: {
      search: { count: search, is_lower_bound: false },
      mapped: { count: mapped, is_lower_bound: false },
    },
    cells: cells.map(([row, column, count]) => ({ axes: [row, column], count })),
  };
}

beforeEach(() => {
  mockUseCommunity.mockReset();
  mockUseCrossFacets.mockReset();
  mockUseVocabulary.mockReset();
  mockUseUrlParams.mockReset();
  mockNavigate.mockReset();
  // Sensible defaults; individual tests override useCrossFacets.
  mockUseUrlParams.mockReturnValue("");
  mockUseVocabulary.mockReturnValue({
    labels: LABELS,
    broader: null,
    definitions: null,
    schemes: null,
    loading: false,
    error: null,
  });
  mockUseCrossFacets.mockReturnValue({ result: null, loading: false, error: null });
});

describe("VisualisePage gating", () => {
  test("renders not found when the evidence-map flag is off", () => {
    mockUseCommunity.mockReturnValue(makeCommunity({ features: { evidenceMap: false } }));
    render(<VisualisePage />);
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });

  test("renders not found when there is no community", () => {
    mockUseCommunity.mockReturnValue(null);
    render(<VisualisePage />);
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });

  test("shows a notice when the flag is on but no axes are configured", () => {
    mockUseCommunity.mockReturnValue(
      makeCommunity({ features: { evidenceMap: true } }),
    );
    render(<VisualisePage />);
    expect(screen.getByRole("heading", { name: /evidence map/i })).toBeInTheDocument();
    expect(screen.getByText(/isn’t configured/i)).toBeInTheDocument();
  });
});

describe("VisualisePage map", () => {
  beforeEach(() => mockUseCommunity.mockReturnValue(mappedCommunity()));

  test("shows a loading state before the first result", () => {
    mockUseCrossFacets.mockReturnValue({ result: null, loading: true, error: null });
    render(<VisualisePage />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  test("shows an error state when the fetch fails", () => {
    mockUseCrossFacets.mockReturnValue({
      result: null,
      loading: false,
      error: new Error("boom"),
    });
    render(<VisualisePage />);
    expect(screen.getByRole("alert")).toHaveTextContent(/Couldn’t load/i);
  });

  test("renders the grid and total when data arrives", () => {
    mockUseCrossFacets.mockReturnValue({
      result: crossFacetResult(20, [
        ["level:primary", "theme:literacy", 5],
        ["level:primary", "theme:numeracy", 3],
      ]),
      loading: false,
      error: null,
    });
    const { container } = render(<VisualisePage />);
    // The corner reports what's on the map, not what matched the filters.
    expect(container.querySelector(".evidence-map__total")?.textContent).toBe(
      "20 unique results",
    );
    // Column/row labels resolved via the vocabulary.
    expect(screen.getByRole("columnheader", { name: "Literacy" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Primary" })).toBeInTheDocument();
    // The "click a cell" hint accompanies a grid with clickable cells.
    expect(
      screen.getByText(/click a cell to view matching/i),
    ).toBeInTheDocument();
  });

  test("corner counts the mapped subset, not everything matching the filters", () => {
    mockUseCrossFacets.mockReturnValue({
      result: crossFacetResult(
        1332,
        [["level:primary", "theme:literacy", 5]],
        1961,
      ),
      loading: false,
      error: null,
    });
    const { container } = render(<VisualisePage />);
    expect(container.querySelector(".evidence-map__total")?.textContent).toBe(
      "1,332 unique results",
    );
  });

  test("renders zero-hit rows and columns from the vocabulary", () => {
    mockUseVocabulary.mockReturnValue({
      labels: LABELS,
      broader: null,
      definitions: null,
      schemes: SCHEMES,
      loading: false,
      error: null,
    });
    mockUseCrossFacets.mockReturnValue({
      result: crossFacetResult(5, [["level:primary", "theme:literacy", 5]]),
      loading: false,
      error: null,
    });
    render(<VisualisePage />);
    // Science (column) and Secondary (row) have no cells but still render.
    expect(
      screen.getByRole("columnheader", { name: "Science" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("rowheader", { name: "Secondary" }),
    ).toBeInTheDocument();
  });

  test("clicking a cell deep-links into Search with the cell's filters + a back-to-map state", () => {
    mockUseCrossFacets.mockReturnValue({
      result: crossFacetResult(9, [["level:primary", "theme:literacy", 6]]),
      loading: false,
      error: null,
    });
    const { container } = render(<VisualisePage />);
    const cellButton = container.querySelector<HTMLButtonElement>(
      ".evidence-map__cell-button",
    );
    expect(cellButton).not.toBeNull();
    fireEvent.click(cellButton!);
    expect(mockNavigate).toHaveBeenCalledWith(
      "/test?concept=level%3Aprimary&concept=theme%3Aliteracy",
      {
        state: {
          backToVisualise:
            "/test/visualise?row=scheme%3Alevel&column=scheme%3Atheme",
        },
      },
    );
  });

  test("toggling to the table view shows counts as text", () => {
    mockUseCrossFacets.mockReturnValue({
      result: crossFacetResult(8, [["level:primary", "theme:literacy", 5]]),
      loading: false,
      error: null,
    });
    const { container } = render(<VisualisePage />);
    // Bubble view by default: legend is present.
    expect(container.querySelector(".evidence-map__legend")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    expect(container.querySelector(".evidence-map__legend")).toBeNull();
    // The count is rendered as text only in table view.
    expect(container.querySelector(".evidence-map__count")?.textContent).toBe(
      "5",
    );
  });

  test("over-filtered: warns with an inline Reset all and still renders the greyed grid", () => {
    mockUseVocabulary.mockReturnValue({
      labels: LABELS,
      broader: null,
      definitions: null,
      schemes: SCHEMES,
      loading: false,
      error: null,
    });
    mockUseCrossFacets.mockReturnValue({
      result: crossFacetResult(0, []),
      loading: false,
      error: null,
    });
    const { container } = render(<VisualisePage />);
    expect(screen.getByText(/No results match the current filters/i)).toBeInTheDocument();
    // The greyed-out grid still renders so the chosen axes stay visible, with a 0 total.
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Science" }),
    ).toBeInTheDocument();
    expect(container.querySelector(".evidence-map.is-dimmed")).not.toBeNull();
    // No clickable cells, so no hint.
    expect(
      screen.queryByText(/click a cell to view matching/i),
    ).not.toBeInTheDocument();

    // The banner carries an inline "Reset all" (distinct from the panel's own).
    const banner = container.querySelector<HTMLElement>(
      ".evidence-map-view__banner",
    )!;
    const reset = within(banner).getByRole("button", { name: "Reset all" });
    mockNavigate.mockClear();
    fireEvent.click(reset);
    // One click clears filters and restores the default axes.
    expect(mockNavigate).toHaveBeenCalledWith(
      "/test/visualise?row=scheme%3Alevel&column=scheme%3Atheme",
    );
  });

  test("distinguishes 'no map coverage' (results exist but none on both axes) from over-filtered", () => {
    mockUseVocabulary.mockReturnValue({
      labels: LABELS,
      broader: null,
      definitions: null,
      schemes: SCHEMES,
      loading: false,
      error: null,
    });
    // References match the filters, but none carry a value on both axes.
    mockUseCrossFacets.mockReturnValue({
      result: crossFacetResult(0, [], 7),
      loading: false,
      error: null,
    });
    const { container } = render(<VisualisePage />);
    expect(screen.getByText(/none have a value for both/i)).toBeInTheDocument();
    // The note counts what matched the filters; the corner what's on the map.
    expect(
      container.querySelector(".evidence-map-view__note-count")?.textContent,
    ).toBe("7");
    expect(container.querySelector(".evidence-map__total")?.textContent).toBe(
      "0 unique results",
    );
    // Not the over-filtered warning — loosening filters wouldn't help.
    expect(container.querySelector(".evidence-map-view__banner")).toBeNull();
    // The grid still renders (greyed) so the chosen axes stay visible.
    expect(
      screen.getByRole("columnheader", { name: "Science" }),
    ).toBeInTheDocument();
    // ...but with no clickable cells, so no hint.
    expect(
      screen.queryByText(/click a cell to view matching/i),
    ).not.toBeInTheDocument();
  });
});

describe("VisualisePage nested-axis state", () => {
  beforeEach(nestedAxesCommunity);

  function nestedResultState(
    overrides: Partial<ReturnType<typeof mockUseCrossFacets>> = {},
  ) {
    return {
      result: crossFacetResult(90, PAGE_NESTED_CELLS),
      resultAxes: CROSS_AXES,
      resultParams: parseSearchParams(""),
      loading: false,
      error: null,
      ...overrides,
    };
  }

  test("opens hierarchical axes one level while a flag-off map stays flat", () => {
    mockUseCrossFacets.mockReturnValue(nestedResultState());
    const first = render(<VisualisePage />);
    const table = within(screen.getByRole("table"));

    expect(
      table.getByRole("button", { name: "Collapse Education" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      table.getByRole("button", { name: "Collapse Themes" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      table.getByRole("button", { name: "Expand Primary" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      table.getByRole("button", { name: "Expand Literacy" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(table.queryByText("Lower primary")).not.toBeInTheDocument();
    expect(table.queryByText("Reading")).not.toBeInTheDocument();
    first.unmount();

    mockUseCommunity.mockReturnValue(mappedCommunity());
    render(<VisualisePage />);
    expect(
      screen.queryByRole("button", { name: "Collapse Education" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Collapse all" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Lower primary" }))
      .toBeInTheDocument();
  });

  test("expansion and Collapse all change both local layouts without navigating", () => {
    mockUseCrossFacets.mockReturnValue(nestedResultState());
    render(<VisualisePage />);

    fireEvent.click(screen.getByRole("button", { name: "Collapse Education" }));
    expect(screen.getByRole("button", { name: "Expand Education" }))
      .toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expand Education" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand Primary" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand Literacy" }));
    expect(screen.getByRole("rowheader", { name: "Lower primary" }))
      .toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Reading" }))
      .toBeInTheDocument();

    mockNavigate.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));

    expect(
      screen.getByRole("button", { name: "Expand Education" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("button", { name: "Expand Themes" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Collapse all" }))
      .toBeDisabled();
    const collapsedCell = screen.getByRole("button", {
      name: "Education, Themes: 90 results. View matching results.",
    });
    expect(mockNavigate).not.toHaveBeenCalled();

    fireEvent.click(collapsedCell);
    expect(mockNavigate).toHaveBeenCalledWith(
      "/test?concept=level%3Aeducation&concept=theme%3Athemes",
      {
        state: {
          backToVisualise:
            "/test/visualise?row=scheme%3Alevel&column=scheme%3Atheme",
        },
      },
    );
  });

  test("Bubble/Table and filter-only results preserve expansion on both axes", () => {
    mockUseCrossFacets.mockReturnValue(nestedResultState());
    const { rerender } = render(<VisualisePage />);
    fireEvent.click(screen.getByRole("button", { name: "Expand Primary" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand Literacy" }));

    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    expect(screen.getByRole("button", { name: "Collapse Primary" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse Literacy" }))
      .toBeInTheDocument();

    const filtered =
      "?concept=level%3Asecondary&row=scheme%3Alevel&column=scheme%3Atheme";
    mockUseUrlParams.mockReturnValue(filtered);
    mockUseCrossFacets.mockReturnValue(
      nestedResultState({ loading: true }),
    );
    rerender(<VisualisePage />);
    expect(screen.getByRole("button", { name: "Collapse Primary" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse Literacy" }))
      .toBeInTheDocument();

    mockUseCrossFacets.mockReturnValue(
      nestedResultState({ resultParams: parseSearchParams(filtered) }),
    );
    rerender(<VisualisePage />);
    expect(screen.getByRole("button", { name: "Collapse Primary" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse Literacy" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Table" }))
      .toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Bubble" }));
    expect(screen.getByRole("button", { name: "Collapse Primary" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse Literacy" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bubble" }))
      .toHaveAttribute("aria-pressed", "true");
  });

  test("accepting a one-axis change resets only that axis", () => {
    mockUseCrossFacets.mockReturnValue(nestedResultState());
    const { rerender, container } = render(<VisualisePage />);
    fireEvent.click(screen.getByRole("button", { name: "Expand Primary" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand Literacy" }));

    mockUseUrlParams.mockReturnValue(
      "?row=scheme%3Alevel&column=scheme%3Atopic",
    );
    // This is the render before useCrossFacets' effect flips loading to true.
    // The result snapshot already proves the old grid is stale.
    mockUseCrossFacets.mockReturnValue(nestedResultState({ loading: false }));
    rerender(<VisualisePage />);

    const pendingTable = within(screen.getByRole("table"));
    expect(pendingTable.getByRole("button", { name: "Collapse Literacy" }))
      .toBeInTheDocument();
    expect(pendingTable.queryByText("Topics")).not.toBeInTheDocument();
    expect(
      pendingTable.queryByRole("button", {
        name: "Reading: view matching results.",
      }),
    ).not.toBeInTheDocument();
    expect(container.querySelector(".evidence-map.is-updating"))
      .not.toBeNull();
    const panel = container.querySelector<HTMLElement>(".map-config-panel")!;
    expect(
      (within(panel).getByLabelText("Columns (x)") as HTMLSelectElement).value,
    ).toBe("scheme:topic");

    mockUseCrossFacets.mockReturnValue({
      ...nestedResultState(),
      result: crossFacetResult(30, [
        ["level:lower-primary", "topic:access", 12],
        ["level:upper-primary", "topic:access", 8],
        ["level:secondary", "topic:quality", 10],
      ]),
      resultAxes: TOPIC_CROSS_AXES,
    });
    rerender(<VisualisePage />);

    const acceptedTable = within(screen.getByRole("table"));
    expect(acceptedTable.getByRole("button", { name: "Collapse Primary" }))
      .toBeInTheDocument();
    expect(acceptedTable.getByText("Lower primary")).toBeInTheDocument();
    expect(acceptedTable.getByRole("button", { name: "Collapse Topics" }))
      .toBeInTheDocument();
    expect(acceptedTable.getByRole("button", { name: "Expand Access" }))
      .toBeInTheDocument();
    expect(acceptedTable.queryByText("Literacy")).not.toBeInTheDocument();
  });

  test("preserves a fully collapsed axis when only the other axis changes", () => {
    mockUseCrossFacets.mockReturnValue(nestedResultState());
    const { rerender } = render(<VisualisePage />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse Education" }));

    mockUseUrlParams.mockReturnValue(
      "?row=scheme%3Alevel&column=scheme%3Atopic",
    );
    mockUseCrossFacets.mockReturnValue({
      ...nestedResultState(),
      result: crossFacetResult(30, [
        ["level:education", "topic:access", 20],
        ["level:education", "topic:quality", 10],
      ]),
      resultAxes: TOPIC_CROSS_AXES,
    });
    rerender(<VisualisePage />);

    const table = within(screen.getByRole("table"));
    expect(table.getByRole("button", { name: "Expand Education" }))
      .toBeInTheDocument();
    expect(table.queryByText("Primary")).not.toBeInTheDocument();
    expect(table.getByRole("button", { name: "Collapse Topics" }))
      .toBeInTheDocument();
  });

  test("keeps a scheme axis nested when the other changes to Countries", () => {
    mockUseCrossFacets.mockReturnValue(nestedResultState());
    const { rerender } = render(<VisualisePage />);
    fireEvent.click(screen.getByRole("button", { name: "Expand Primary" }));

    mockUseUrlParams.mockReturnValue(
      `?row=scheme%3Alevel&column=${AXIS_COUNTRIES}`,
    );
    mockUseCrossFacets.mockReturnValue({
      ...nestedResultState(),
      result: crossFacetResult(30, [
        ["level:lower-primary", "AU", 12],
        ["level:upper-primary", "NZ", 8],
        ["level:secondary", "AU", 10],
      ]),
      resultAxes: {
        row: CROSS_AXES.row,
        column: { kind: "literal", token: AXIS_COUNTRIES },
      },
    });
    rerender(<VisualisePage />);

    const table = within(screen.getByRole("table"));
    expect(table.getByRole("button", { name: "Collapse Primary" }))
      .toBeInTheDocument();
    expect(table.getByRole("columnheader", { name: "Australia" }))
      .toBeInTheDocument();
    expect(table.getByRole("columnheader", { name: "New Zealand" }))
      .toBeInTheDocument();
    expect(table.queryByRole("button", { name: /Expand Australia/ }))
      .not.toBeInTheDocument();
  });

  test("falls back to flat cell values when an applied scheme is unknown", () => {
    mockUseUrlParams.mockReturnValue(
      "?row=scheme%3Alevel&column=scheme%3Aunknown",
    );
    mockUseCrossFacets.mockReturnValue({
      ...nestedResultState(),
      result: crossFacetResult(12, [
        ["level:primary", "unknown:value", 12],
      ]),
      resultAxes: {
        row: CROSS_AXES.row,
        column: { kind: "scheme", schemeUri: "scheme:unknown" },
      },
    });
    render(<VisualisePage />);

    const table = within(screen.getByRole("table"));
    expect(table.getByRole("button", { name: "Collapse Education" }))
      .toBeInTheDocument();
    expect(table.getByRole("columnheader", { name: "unknown:value" }))
      .toBeInTheDocument();
    expect(table.queryByRole("button", { name: /Expand unknown:value/ }))
      .not.toBeInTheDocument();
  });

  test("an axis swap resets both hierarchies instead of transposing state", () => {
    mockUseCrossFacets.mockReturnValue(nestedResultState());
    const { rerender } = render(<VisualisePage />);
    fireEvent.click(screen.getByRole("button", { name: "Expand Primary" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand Literacy" }));

    mockUseUrlParams.mockReturnValue(
      "?row=scheme%3Atheme&column=scheme%3Alevel",
    );
    mockUseCrossFacets.mockReturnValue({
      ...nestedResultState(),
      result: crossFacetResult(30, [
        ["theme:literacy", "level:primary", 20],
        ["theme:numeracy", "level:secondary", 10],
      ]),
      resultAxes: {
        row: CROSS_AXES.column,
        column: CROSS_AXES.row,
      },
    });
    rerender(<VisualisePage />);

    const table = within(screen.getByRole("table"));
    expect(table.getByRole("button", { name: "Expand Literacy" }))
      .toBeInTheDocument();
    expect(table.getByRole("button", { name: "Expand Primary" }))
      .toBeInTheDocument();
    expect(table.queryByText("Reading")).not.toBeInTheDocument();
    expect(table.queryByText("Lower primary")).not.toBeInTheDocument();
  });

  test("keeps row and column expansion independent for the same scheme", () => {
    mockUseUrlParams.mockReturnValue(
      "?row=scheme%3Alevel&column=scheme%3Alevel",
    );
    mockUseCrossFacets.mockReturnValue({
      ...nestedResultState(),
      result: crossFacetResult(20, [
        ["level:primary", "level:primary", 12],
        ["level:secondary", "level:secondary", 8],
      ]),
      resultAxes: { row: CROSS_AXES.row, column: CROSS_AXES.row },
    });
    render(<VisualisePage />);

    const expandPrimary = screen.getAllByRole("button", {
      name: "Expand Primary",
    });
    expect(expandPrimary).toHaveLength(2);
    fireEvent.click(expandPrimary[0]);
    expect(screen.getAllByRole("button", { name: "Collapse Primary" }))
      .toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Expand Primary" }))
      .toHaveLength(1);
  });

  test("adopts the default hierarchy when vocabulary arrives after the result", () => {
    mockUseVocabulary.mockReturnValue({
      labels: LABELS,
      broader: null,
      definitions: null,
      schemes: null,
      loading: true,
      error: null,
    });
    mockUseCrossFacets.mockReturnValue(nestedResultState());
    const { rerender } = render(<VisualisePage />);
    expect(screen.queryByRole("button", { name: "Collapse Education" }))
      .not.toBeInTheDocument();

    nestedVocabulary();
    rerender(<VisualisePage />);
    expect(screen.getByRole("button", { name: "Collapse Education" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand Primary" }))
      .toBeInTheDocument();
  });

  test("opens only the applied axis scheme cards, including during an axis request", () => {
    mockUseCommunity.mockReturnValue(
      mappedCommunity({
        features: { evidenceMap: true, nestedEvidenceMapAxes: true },
        defaultExpandedFilters: ["year", "scheme:topic"],
      }),
    );
    mockUseCrossFacets.mockReturnValue(nestedResultState());
    const { container, rerender } = render(<VisualisePage />);
    const panel = () =>
      within(container.querySelector<HTMLElement>(".map-config-panel")!);

    expect(panel().getByRole("button", { name: "Education Level" }))
      .toHaveAttribute("aria-expanded", "true");
    expect(panel().getByRole("button", { name: "Education Theme" }))
      .toHaveAttribute("aria-expanded", "true");
    expect(panel().getByRole("button", { name: "Education Topic" }))
      .toHaveAttribute("aria-expanded", "false");
    expect(panel().getByRole("button", { name: "Publication year" }))
      .toHaveAttribute("aria-expanded", "true");

    fireEvent.change(panel().getByLabelText("Columns (x)"), {
      target: { value: "scheme:topic" },
    });
    expect(within(screen.getByRole("table")).getByText("Literacy"))
      .toBeInTheDocument();
    expect(within(screen.getByRole("table")).queryByText("Topics"))
      .not.toBeInTheDocument();

    mockUseUrlParams.mockReturnValue(
      "?row=scheme%3Alevel&column=scheme%3Atopic",
    );
    mockUseCrossFacets.mockReturnValue(nestedResultState({ loading: true }));
    rerender(<VisualisePage />);

    expect(panel().getByRole("button", { name: "Education Level" }))
      .toHaveAttribute("aria-expanded", "true");
    expect(panel().getByRole("button", { name: "Education Theme" }))
      .toHaveAttribute("aria-expanded", "false");
    expect(panel().getByRole("button", { name: "Education Topic" }))
      .toHaveAttribute("aria-expanded", "true");
    expect(within(screen.getByRole("table")).getByText("Literacy"))
      .toBeInTheDocument();
  });
});

describe("VisualisePage analytics", () => {
  // An empty queue is what `track()` reads as "analytics enabled".
  beforeEach(() => {
    window._paq = [];
    mockUseCommunity.mockReturnValue(mappedCommunity());
    mockUseVocabulary.mockReturnValue({
      labels: LABELS,
      broader: null,
      definitions: null,
      schemes: SCHEMES,
      loading: false,
      error: null,
    });
  });
  afterEach(() => {
    window._paq = undefined;
  });

  function mapEvents(action?: string) {
    return (window._paq ?? []).filter(
      (e) =>
        e[0] === "trackEvent" &&
        e[1] === "EvidenceMap" &&
        (action === undefined || e[2] === action),
    );
  }

  const FILTERED =
    "?concept=level%3Aprimary&country=KE&row=scheme%3Alevel&column=scheme%3Atheme";

  test("tracks the axis pair and every active filter once per distinct view", () => {
    mockUseUrlParams.mockReturnValue(FILTERED);
    mockUseCrossFacets.mockReturnValue({
      result: crossFacetResult(4, [["level:primary", "theme:literacy", 4]]),
      resultParams: parseSearchParams(FILTERED),
      loading: false,
      error: null,
    });
    const { rerender } = render(<VisualisePage />);

    expect(mapEvents()).toEqual([
      ["trackEvent", "EvidenceMap", "Map Viewed", "Education Level × Education Theme", undefined],
      ["trackEvent", "EvidenceMap", "Filter Applied", "Primary", undefined],
      ["trackEvent", "EvidenceMap", "Filter Applied", "Kenya", undefined],
      ["trackEvent", "EvidenceMap", "Filter Category Applied", "Education Level", undefined],
      ["trackEvent", "EvidenceMap", "Filter Category Applied", "Country", undefined],
    ]);

    // Same view re-rendered: no re-count.
    rerender(<VisualisePage />);
    expect(mapEvents()).toHaveLength(5);
  });

  test("tracks the view on screen, not one still being fetched", () => {
    // The URL has moved on to Secondary; the rendered map is still Primary's.
    mockUseUrlParams.mockReturnValue(
      "?concept=level%3Asecondary&row=scheme%3Alevel&column=scheme%3Atheme",
    );
    mockUseCrossFacets.mockReturnValue({
      result: crossFacetResult(4, [["level:primary", "theme:literacy", 4]]),
      resultParams: parseSearchParams(FILTERED),
      loading: true,
      error: null,
    });
    render(<VisualisePage />);

    expect(mapEvents("Filter Applied").map((e) => e[3])).toEqual([
      "Primary",
      "Kenya",
    ]);
  });

  test("names the two empty states apart, and fires neither on a populated map", () => {
    mockUseUrlParams.mockReturnValue("");
    // Nothing matches the filters at all.
    mockUseCrossFacets.mockReturnValue({
      result: crossFacetResult(0, []),
      resultParams: parseSearchParams(""),
      loading: false,
      error: null,
    });
    const { unmount } = render(<VisualisePage />);
    expect(mapEvents("No Coverage").map((e) => e[3])).toEqual(["over-filtered"]);
    unmount();

    // References match, but none carry a value on both axes.
    window._paq = [];
    mockUseCrossFacets.mockReturnValue({
      result: crossFacetResult(0, [], 7),
      resultParams: parseSearchParams(""),
      loading: false,
      error: null,
    });
    const second = render(<VisualisePage />);
    expect(mapEvents("No Coverage").map((e) => e[3])).toEqual(["no-coverage"]);
    second.unmount();

    window._paq = [];
    mockUseCrossFacets.mockReturnValue({
      result: crossFacetResult(4, [["level:primary", "theme:literacy", 4]]),
      resultParams: parseSearchParams(""),
      loading: false,
      error: null,
    });
    render(<VisualisePage />);
    expect(mapEvents("No Coverage")).toEqual([]);
  });

  test("tracks the view toggle, cell and header clicks", () => {
    mockUseUrlParams.mockReturnValue("");
    mockUseCrossFacets.mockReturnValue({
      result: crossFacetResult(9, [["level:primary", "theme:literacy", 6]]),
      resultParams: parseSearchParams(""),
      loading: false,
      error: null,
    });
    const { container } = render(<VisualisePage />);

    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Literacy: view matching results." }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Primary: view matching results." }),
    );
    fireEvent.click(
      container.querySelector<HTMLButtonElement>(".evidence-map__cell-button")!,
    );

    expect(mapEvents("View Toggled").map((e) => e[3])).toEqual(["table"]);
    expect(mapEvents("Column Clicked").map((e) => e[3])).toEqual(["Literacy"]);
    expect(mapEvents("Row Clicked").map((e) => e[3])).toEqual(["Primary"]);
    expect(mapEvents("Cell Clicked").map((e) => e[3])).toEqual([
      "Primary × Literacy",
    ]);
  });

  test("does not count local hierarchy changes as new map views", () => {
    nestedAxesCommunity();
    mockUseCrossFacets.mockReturnValue({
      result: crossFacetResult(90, PAGE_NESTED_CELLS),
      resultAxes: CROSS_AXES,
      resultParams: parseSearchParams(""),
      loading: false,
      error: null,
    });
    render(<VisualisePage />);
    expect(mapEvents("Map Viewed")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Expand Primary" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand Literacy" }));
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));

    expect(mapEvents("Map Viewed")).toHaveLength(1);
    expect(mapEvents("Axes Changed")).toEqual([]);
    expect(mapEvents("View Toggled")).toEqual([]);
  });

  test("a clicked value carries its branch, the way a filter on it would", () => {
    mockUseUrlParams.mockReturnValue("");
    mockUseVocabulary.mockReturnValue({
      labels: LABELS,
      broader: null,
      definitions: null,
      schemes: NESTED_SCHEMES,
      loading: false,
      error: null,
    });
    mockUseCrossFacets.mockReturnValue({
      result: crossFacetResult(6, [["level:primary", "theme:literacy", 6]]),
      resultParams: parseSearchParams(""),
      loading: false,
      error: null,
    });
    render(<VisualisePage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Literacy: view matching results." }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Primary, Literacy:/ }));

    expect(mapEvents("Column Clicked").map((e) => e[3])).toEqual([
      "Learning > Literacy",
    ]);
    expect(mapEvents("Cell Clicked").map((e) => e[3])).toEqual([
      "Primary × Learning > Literacy",
    ]);
  });

  test("counts a deliberate axis change apart from the views it produces", () => {
    // The map is on a swapped (non-default) pair, so resetting is a real change.
    mockUseUrlParams.mockReturnValue(
      "?row=scheme%3Atheme&column=scheme%3Alevel",
    );
    mockUseCrossFacets.mockReturnValue({
      result: crossFacetResult(0, []),
      resultParams: parseSearchParams(""),
      loading: false,
      error: null,
    });
    const { container } = render(<VisualisePage />);

    // Landing on the swapped pair is a view, not a choice.
    expect(mapEvents("Axes Changed")).toEqual([]);

    const banner = container.querySelector<HTMLElement>(
      ".evidence-map-view__banner",
    )!;
    fireEvent.click(within(banner).getByRole("button", { name: "Reset all" }));
    expect(mapEvents("Axes Changed").map((e) => e[3])).toEqual([
      "Education Level × Education Theme",
    ]);
  });

  test("does not count an axis change when only the filters moved", () => {
    // Already on the default pair: resetting clears filters but not axes.
    mockUseUrlParams.mockReturnValue("?concept=level%3Aprimary");
    mockUseCrossFacets.mockReturnValue({
      result: crossFacetResult(0, []),
      resultParams: parseSearchParams("?concept=level%3Aprimary"),
      loading: false,
      error: null,
    });
    const { container } = render(<VisualisePage />);

    const banner = container.querySelector<HTMLElement>(
      ".evidence-map-view__banner",
    )!;
    fireEvent.click(within(banner).getByRole("button", { name: "Reset all" }));
    expect(mapEvents("Axes Changed")).toEqual([]);
  });

  test("distinguishes the banner's one-click reset from the panel's draft reset", () => {
    mockUseUrlParams.mockReturnValue("");
    mockUseCrossFacets.mockReturnValue({
      result: crossFacetResult(0, []),
      resultParams: parseSearchParams(""),
      loading: false,
      error: null,
    });
    const { container } = render(<VisualisePage />);

    const banner = container.querySelector<HTMLElement>(
      ".evidence-map-view__banner",
    )!;
    fireEvent.click(within(banner).getByRole("button", { name: "Reset all" }));
    const panel = container.querySelector<HTMLElement>(".map-config-panel")!;
    fireEvent.click(within(panel).getByRole("button", { name: "Reset all" }));

    expect(mapEvents("Reset All").map((e) => e[3])).toEqual([
      "banner",
      "panel",
    ]);
  });
});
