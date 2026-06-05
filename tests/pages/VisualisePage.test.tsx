import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
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

function crossFacetResult(
  total: number,
  cells: [string, string, number][],
): ReferenceCrossFacetResult {
  return {
    total: { count: total, is_lower_bound: false },
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
    render(<VisualisePage />);
    expect(screen.getByText("20")).toBeInTheDocument();
    // Column/row labels resolved via the vocabulary.
    expect(screen.getByRole("columnheader", { name: "Literacy" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Primary" })).toBeInTheDocument();
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

  test("shows only the no-results banner when over-filtered", () => {
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
    // The banner carries no inline reset CTA, and no grid renders — even with
    // schemes available. (The configure panel's own "Reset all" is separate.)
    const banner = container.querySelector(".evidence-map-view__banner");
    expect(banner?.querySelector("button")).toBeNull();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
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
    // References match the filters, but the endpoint returned no cells.
    mockUseCrossFacets.mockReturnValue({
      result: crossFacetResult(7, []),
      loading: false,
      error: null,
    });
    const { container } = render(<VisualisePage />);
    expect(screen.getByText(/none have a value for both/i)).toBeInTheDocument();
    // Not the over-filtered warning — loosening filters wouldn't help.
    expect(container.querySelector(".evidence-map-view__banner")).toBeNull();
    // The grid still renders (greyed) so the chosen axes stay visible.
    expect(
      screen.getByRole("columnheader", { name: "Science" }),
    ).toBeInTheDocument();
  });
});
