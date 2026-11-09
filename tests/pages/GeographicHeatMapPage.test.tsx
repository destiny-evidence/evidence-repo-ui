import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/preact";
import { GeographicHeatMapPage } from "@/pages/GeographicHeatMapPage";
import { makeCommunity } from "../fixtures";

const { mockUseCommunity, mockUseUrlParams, mockUseSearchFacets } = vi.hoisted(() => ({
  mockUseCommunity: vi.fn(),
  mockUseUrlParams: vi.fn(),
  mockUseSearchFacets: vi.fn(),
}));

vi.mock("@/community/CommunityContext", () => ({ useCommunity: mockUseCommunity }));
vi.mock("@/hooks/useUrlParams", () => ({ useUrlParams: mockUseUrlParams }));
vi.mock("@/hooks/useSearchFacets", () => ({ useSearchFacets: mockUseSearchFacets }));
vi.mock("@/components/visualise/GeographicHeatMap", () => ({
  GeographicHeatMap: ({ counts, label }: { counts?: ReadonlyMap<string, number>; label: string }) => (
    <div data-testid="map" aria-label={label}>
      {counts ? JSON.stringify([...counts]) : "no counts"}
    </div>
  ),
}));

const enabled = makeCommunity({ features: { geographicHeatMap: true } });

beforeEach(() => {
  vi.clearAllMocks();
  mockUseCommunity.mockReturnValue(enabled);
  mockUseUrlParams.mockReturnValue("?q=heat&country=KE");
  mockUseSearchFacets.mockReturnValue({
    counts: { countries: new Map([["KE", 12]]) },
    loading: false,
    error: null,
  });
});

describe("GeographicHeatMapPage", () => {
  test("404s when the flag is off", () => {
    mockUseCommunity.mockReturnValue(makeCommunity());
    render(<GeographicHeatMapPage />);
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(mockUseSearchFacets).not.toHaveBeenCalled();
  });

  test("shades the map from the country facet for the search in the URL", () => {
    render(<GeographicHeatMapPage />);
    const [params, facets] = mockUseSearchFacets.mock.calls[0];
    expect(params).toMatchObject({ q: "heat", countryCodes: ["KE"] });
    expect(facets).toEqual(["countries"]);
    expect(screen.getByTestId("map")).toHaveTextContent('[["KE",12]]');
    expect(screen.getByTestId("map")).toHaveAccessibleName("World map of results by country");
  });

  test("passes no counts until the first response", () => {
    mockUseSearchFacets.mockReturnValue({ counts: null, loading: true, error: null });
    render(<GeographicHeatMapPage />);
    expect(screen.getByTestId("map")).toHaveTextContent("no counts");
  });

  test("shows an error when the counts fail to load", () => {
    mockUseSearchFacets.mockReturnValue({ counts: null, loading: false, error: new Error("boom") });
    render(<GeographicHeatMapPage />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn’t load country counts.");
    expect(screen.queryByTestId("map")).not.toBeInTheDocument();
  });
});
