import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { VisualisePage } from "@/pages/VisualisePage";
import { makeCommunity } from "../fixtures";
import type { EvidenceMapAxes, ReferenceCrossFacetResult } from "@/types/models";

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
    expect(
      screen.getByTitle("Primary · Literacy: 5 results").textContent,
    ).toBe("5");
  });

  test("shows the over-filtered banner and resets on click when there are no results", () => {
    mockUseCrossFacets.mockReturnValue({
      result: crossFacetResult(0, []),
      loading: false,
      error: null,
    });
    render(<VisualisePage />);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText(/No results match/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset all" }));
    expect(mockNavigate).toHaveBeenCalledWith("/test/visualise");
  });
});
