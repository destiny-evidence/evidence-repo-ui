import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/preact";
import { GeographicHeatMapPage } from "@/pages/GeographicHeatMapPage";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";
import type { FacetTotals } from "@/types/models";
import type { GeographicHeatMapProps } from "@/components/visualise/GeographicHeatMap";
import { makeCommunity } from "../fixtures";

const {
  mockUseCommunity,
  mockUseUrlParams,
  mockUseSearchFacets,
  mockUseVocabulary,
  mockNavigate,
  mockSearchReferences,
} = vi.hoisted(() => ({
  mockUseCommunity: vi.fn(),
  mockUseUrlParams: vi.fn(),
  mockUseSearchFacets: vi.fn(),
  mockUseVocabulary: vi.fn(),
  mockNavigate: vi.fn(),
  mockSearchReferences: vi.fn(),
}));

vi.mock("@/community/CommunityContext", () => ({ useCommunity: mockUseCommunity }));
vi.mock("@/hooks/useUrlParams", () => ({ useUrlParams: mockUseUrlParams }));
vi.mock("@/hooks/useSearchFacets", () => ({ useSearchFacets: mockUseSearchFacets }));
vi.mock("@/hooks/useVocabulary", () => ({ useVocabulary: mockUseVocabulary }));
vi.mock("@/services/apiClient", () => ({ searchReferences: mockSearchReferences }));
vi.mock("@/services/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/navigation")>();
  return { ...actual, navigate: mockNavigate };
});
vi.mock("@/components/visualise/GeographicHeatMap", () => ({
  GeographicHeatMap: ({ counts, label, total, viewHref, onSelect, onView }: GeographicHeatMapProps) => (
    <div data-testid="map" aria-label={label} data-total={total}>
      {counts ? JSON.stringify([...counts]) : "no counts"}
      {[...(counts ?? [])].map(([countryCode]) => (
        <span key={countryCode}>
          <button onClick={() => onSelect?.(countryCode)}>Select {countryCode}</button>
          <a href={viewHref(countryCode)} onClick={(e) => onView(countryCode, e)}>
            View {countryCode}
          </a>
        </span>
      ))}
    </div>
  ),
}));

const SCHEMES: ConceptScheme[] = [
  {
    uri: "scheme:level",
    label: "Education Level Scheme",
    topConcepts: [
      { uri: "level:primary", label: "Primary" },
      { uri: "level:secondary", label: "Secondary" },
    ],
  },
];

const enabled = makeCommunity({
  copy: { countNoun: "investigations" },
});

function totals(search: number, mapped?: number): FacetTotals {
  return {
    search: { count: search, is_lower_bound: false },
    ...(mapped === undefined ? {} : { mapped: { count: mapped, is_lower_bound: false } }),
  };
}

function facets(
  countries: [string, number][],
  t: FacetTotals | null = totals(40, 30),
  { loading = false, error = null }: { loading?: boolean; error?: Error | null } = {},
) {
  mockUseSearchFacets.mockReturnValue({
    counts: error ? null : { concepts: new Map(), countries: new Map(countries) },
    totals: error ? null : t,
    loading,
    error,
  });
}

function renderAt(search: string) {
  mockUseUrlParams.mockReturnValue(search);
  return render(<GeographicHeatMapPage />);
}

function events(action: string) {
  return (window._paq ?? []).filter((e) => e[1] === "GeographicHeatMap" && e[2] === action);
}

beforeEach(() => {
  vi.clearAllMocks();
  window._paq = [];
  mockUseCommunity.mockReturnValue(enabled);
  mockUseVocabulary.mockReturnValue({
    labels: new Map(),
    schemes: SCHEMES,
    loading: false,
    error: null,
  });
  facets([["KE", 12], ["FR", 30]]);
});

afterEach(() => {
  delete window._paq;
});

describe("GeographicHeatMapPage", () => {
  test("404s when the community can't search by country", () => {
    mockUseCommunity.mockReturnValue(
      makeCommunity({ features: { countrySearchable: false } }),
    );
    renderAt("");
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(mockUseSearchFacets).not.toHaveBeenCalled();
  });

  test("counts countries for the search in the URL, scoped to references with one", () => {
    renderAt("?q=heat&country=KE");
    const [params, requested, options] = mockUseSearchFacets.mock.calls[0];
    expect(params).toMatchObject({ q: "heat", countryCodes: ["KE"] });
    expect(requested).toEqual(["countries"]);
    expect(options).toEqual({
      mapAxes: [{ kind: "literal", token: "countries" }],
      totals: true,
    });
    expect(screen.getByTestId("map")).toHaveAccessibleName(
      "World map of investigations by country",
    );
  });

  test("only shades the countries the URL filters to", () => {
    renderAt("?q=heat&country=KE");
    expect(screen.getByTestId("map")).toHaveTextContent('[["KE",12]]');
  });

  test("summarises the mapped total and the countries with references", () => {
    facets([["KE", 12], ["FR", 30], ["DE", 0]], totals(40, 35));
    renderAt("?q=heat");
    expect(screen.getByText(/unique investigations across/)).toHaveTextContent(
      "35 unique investigations across 2 countries",
    );
  });

  test("the info button can be focused and describes where counts come from", () => {
    renderAt("?q=heat");
    const info = screen.getByRole("button", { name: "About investigation setting" });
    info.focus();
    expect(info).toHaveFocus();
    expect(info).toHaveAccessibleDescription(
      "Counts come from where each investigation took place.",
    );
  });

  test("warns that some aren't on the map until dismissed", () => {
    facets([["KE", 12]], totals(40, 12));
    renderAt("?q=heat");
    expect(screen.getByText(/only those with a country coded/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText(/only those with a country coded/i)).toBeNull();
  });

  test("doesn't warn when every match is on the map", () => {
    facets([["KE", 12]], totals(12, 12));
    renderAt("?q=heat");
    expect(screen.queryByText(/only those with a country coded/i)).toBeNull();
  });

  test("offers to reset the filters when nothing matches", () => {
    facets([], totals(0, 0));
    renderAt("?q=heat&country=KE&start_year=2020");
    mockNavigate.mockClear();

    const banner = screen.getByText(/no investigations match/i).parentElement!;
    fireEvent.click(within(banner).getByRole("button", { name: "Reset all" }));

    expect(mockNavigate).toHaveBeenCalledWith("/test/visualise/geographic?q=heat");
    expect(events("Reset All").map((e) => e[3])).toEqual(["banner"]);
  });

  test("explains when matches exist but none have a country", () => {
    facets([], totals(7, 0));
    renderAt("?q=heat");
    expect(screen.getByRole("status")).toHaveTextContent(
      "7 investigations match your filters, but none have a country coded",
    );
    expect(screen.queryByText(/unique investigations across/)).toBeNull();
  });

  test("shows an error when the counts fail to load", () => {
    facets([], null, { error: new Error("boom") });
    renderAt("?q=heat");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn’t load the geographic heat map.",
    );
    expect(screen.queryByTestId("map")).not.toBeInTheDocument();
  });

  test("dims the previous summary and counts while new ones load", () => {
    facets([["KE", 12]], totals(12, 12), { loading: true });
    renderAt("?q=heat");
    const card = screen.getByTestId("map").parentElement!;
    expect(card).toHaveClass("is-updating");
    expect(card).toHaveAttribute("aria-busy", "true");
    expect(card).toContainElement(screen.getByText(/unique investigations across/));
  });

  test("rewrites the URL into its canonical form", () => {
    renderAt("?q=heat&page=3&sort=newest");
    expect(mockNavigate).toHaveBeenCalledWith("/test/visualise/geographic?q=heat", {
      mode: "replace",
    });
  });

  test("leaves a canonical URL alone", () => {
    renderAt("?q=heat&country=KE");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("links to the matching investigations in search", () => {
    renderAt("?q=heat&country=KE");
    expect(screen.getByRole("link", { name: /view investigations/i })).toHaveAttribute(
      "href",
      "/test?q=heat&country=KE",
    );
  });

  test("hints at clicking a country once one has references", () => {
    renderAt("?q=heat");
    expect(screen.getByText("Click a country to view matching investigations")).toBeInTheDocument();
  });

  test("doesn't hint at clicking a country when none have references", () => {
    facets([["KE", 0]], totals(5, 0));
    renderAt("?q=heat");
    expect(screen.queryByText(/click a country/i)).not.toBeInTheDocument();
  });

  test("measures each country's share against the references on the map", () => {
    renderAt("?q=heat");
    expect(screen.getByTestId("map")).toHaveAttribute("data-total", "30");
  });

  test("a country opens search narrowed to it, with the rest of the search kept", () => {
    renderAt("?q=heat&country=FR%2CKE");
    expect(screen.getByRole("link", { name: "View KE" })).toHaveAttribute(
      "href",
      "/test?q=heat&country=KE",
    );
  });

  test("going through to a country lets search return to the map as it was", () => {
    renderAt("?q=heat&country=FR%2CKE");
    fireEvent.click(screen.getByRole("link", { name: "View KE" }));
    expect(mockNavigate).toHaveBeenCalledWith("/test?q=heat&country=KE", {
      state: { backToVisualise: "/test/visualise/geographic?q=heat&country=FR%2CKE" },
    });
  });

  test("reports selecting a country and going through to it", () => {
    renderAt("?q=heat");
    fireEvent.click(screen.getByRole("button", { name: "Select KE" }));
    fireEvent.click(screen.getByRole("link", { name: "View KE" }));
    expect(events("Country Selected").map((e) => e[3])).toEqual(["Kenya"]);
    expect(events("Country Clickthrough").map((e) => e[3])).toEqual(["Kenya"]);
  });

  test("leaves a modified click to the browser but still reports it", () => {
    renderAt("?q=heat");
    const view = screen.getByRole("link", { name: "View KE" });
    view.addEventListener("click", (e) => e.preventDefault());
    fireEvent.click(view, { metaKey: true });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(events("Country Clickthrough").map((e) => e[3])).toEqual(["Kenya"]);
  });

  test("applying the panel's filters puts them in the heat map URL", () => {
    renderAt("?q=heat&concept=level%3Asecondary");
    fireEvent.click(screen.getByLabelText("Secondary"));
    fireEvent.click(screen.getByRole("button", { name: "Show results" }));
    expect(mockNavigate).toHaveBeenCalledWith("/test/visualise/geographic?q=heat");
  });

  test("an edited search keeps the filters", async () => {
    mockSearchReferences.mockResolvedValue({ total: { count: 3, is_lower_bound: false } });
    renderAt("?q=heat&country=KE");
    fireEvent.click(screen.getByRole("button", { name: /search.*heat/i }));
    const field = screen.getByLabelText("Search to map");
    fireEvent.input(field, { target: { value: "flood" } });
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        "/test/visualise/geographic?q=flood&country=KE",
      ),
    );
    expect(events("Search Changed").map((e) => e[3])).toEqual(["updated"]);
  });

  test("reports each view once, with its filters", () => {
    const { rerender } = renderAt("?q=heat&country=KE");
    rerender(<GeographicHeatMapPage />);
    expect(events("Map Viewed")).toHaveLength(1);
    expect(events("Filter Applied").map((e) => e[3])).toEqual(["Kenya"]);
    expect(events("Filter Category Applied").map((e) => e[3])).toEqual(["Country"]);
  });

  test("waits for the counts before reporting a view", () => {
    facets([], totals(1, 1), { loading: true });
    renderAt("?q=heat");
    expect(events("Map Viewed")).toHaveLength(0);
  });

  test.each([
    ["over-filtered", totals(0, 0)],
    ["no-coverage", totals(5, 0)],
  ])("reports %s as no coverage", (name, t) => {
    facets([], t);
    renderAt("?q=heat");
    expect(events("No Coverage").map((e) => e[3])).toEqual([name]);
  });

  test("folds the panel into a Show filters rail", () => {
    renderAt("?q=heat&country=KE");
    fireEvent.click(screen.getByRole("button", { name: "Hide panel" }));
    expect(
      screen.getByRole("button", { name: "Show filters, 1 filter applied" }),
    ).toBeInTheDocument();
    expect(events("Panel Toggled").map((e) => e[3])).toEqual(["hidden"]);
  });
});
