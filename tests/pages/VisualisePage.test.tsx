import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/preact";
import { VisualisePage } from "@/pages/VisualisePage";
import { makeCommunity } from "../fixtures";
import type { EvidenceMapAxes, ReferenceCrossFacetResult } from "@/types/models";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";

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
