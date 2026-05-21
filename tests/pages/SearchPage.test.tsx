import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/preact";
import { SearchPage } from "@/pages/SearchPage";
import { CommunityProvider } from "@/community/CommunityContext";
import type { SearchResult } from "@/types/models";

function renderSearchPage() {
  return render(
    <CommunityProvider>
      <SearchPage />
    </CommunityProvider>,
  );
}

vi.mock("@/services/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/apiClient")>();
  return {
    ...actual,
    searchReferences: vi.fn(),
    requestSearchExport: vi.fn(),
    getSearchExport: vi.fn(),
  };
});

vi.mock("@/services/export/export", () => ({
  exportReferencesToExcel: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config")>();
  return {
    ...actual,
    ESEA_VOCABULARY_URL: "https://test.example/vocab",
    ESEA_CONTEXT_URL: "https://test.example/context",
  };
});

import {
  searchReferences,
  requestSearchExport,
  getSearchExport,
} from "@/services/apiClient";
const mockSearch = vi.mocked(searchReferences);
const mockRequestExport = vi.mocked(requestSearchExport);
const mockGetExport = vi.mocked(getSearchExport);

function makeResult(count: number, ids: string[] = [], isLowerBound = false): SearchResult {
  return {
    total: { count, is_lower_bound: isLowerBound },
    page: { count: ids.length, number: 1 },
    references: ids.map((id) => ({
      id,
      visibility: "public",
      identifiers: null,
      enhancements: [
        {
          id: `e-${id}`, reference_id: id, source: "test",
          visibility: "public", robot_version: null, derived_from: null,
          created_at: "2024-01-01",
          content: {
            enhancement_type: "bibliographic",
            authorship: null, cited_by_count: null,
            created_date: null, updated_date: null,
            publication_date: null, publication_year: 2020,
            publisher: null, title: `Title ${id}`,
            pagination: null, publication_venue: null,
          },
        },
      ],
    })),
  };
}

// Route mock by query: undefined q → corpus fetch, string q → results fetch.
// In browse mode both fetches pass q=undefined, so corpus defaults to mirror
// results (they're the same call semantically; the distinction only matters
// when tests want to diverge them, e.g. the corpus-failure test).
function mockBoth(opts: {
  corpus?: SearchResult | Error;
  results?: SearchResult | Error;
}) {
  const results = opts.results ?? makeResult(5721, ["r1", "r2", "r3"]);
  const corpus = opts.corpus ?? results;
  mockSearch.mockImplementation((q) => {
    const value = q === undefined ? corpus : results;
    return value instanceof Error ? Promise.reject(value) : Promise.resolve(value);
  });
}

beforeEach(() => {
  mockSearch.mockReset();
  mockRequestExport.mockReset();
  mockGetExport.mockReset();
  history.replaceState(null, "", "/esea");
});

describe("SearchPage", () => {
  test("browse mode on mount: hero shows corpus count, rows render, meta-bar shows sort but no summary", async () => {
    // Browse mode: corpus and search fetches are identical (both q=undefined),
    // so corpus defaults to mirror results.
    mockBoth({ results: makeResult(5721, ["r1", "r2", "r3"]) });
    renderSearchPage();

    await waitFor(() => expect(screen.getByText("Title r1")).toBeInTheDocument());
    expect(screen.getByText(/5,721 investigations across education research/i)).toBeInTheDocument();
    // Summary text only renders when narrowed; browse mode shows the bar
    // with just the sort dropdown so users can flip relevance ↔ newest.
    expect(screen.queryByText(/results for/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/sort results/i)).toBeInTheDocument();
  });

  test("sort change navigates to URL with new alias and resets page to 1", async () => {
    history.replaceState(null, "", "/esea?q=phonics&page=3");
    mockBoth({ results: makeResult(47, ["r1"]) });
    renderSearchPage();

    await waitFor(() => expect(screen.getByText("Title r1")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/sort results/i), {
      target: { value: "newest" },
    });

    await waitFor(() => expect(window.location.search).toContain("sort=newest"));
    expect(window.location.search).toContain("q=phonics");
    expect(window.location.search).not.toContain("page=");
  });

  test("sort dropdown reflects current URL sort param", async () => {
    history.replaceState(null, "", "/esea?sort=oldest");
    mockBoth({ results: makeResult(47, ["r1"]) });
    renderSearchPage();

    await waitFor(() => expect(screen.getByText("Title r1")).toBeInTheDocument());
    const select = screen.getByLabelText(/sort results/i) as HTMLSelectElement;
    expect(select.value).toBe("oldest");
  });

  test("clearing sort to Relevance drops the URL param", async () => {
    history.replaceState(null, "", "/esea?q=phonics&sort=newest");
    mockBoth({ results: makeResult(3, ["r1"]) });
    renderSearchPage();

    await waitFor(() => expect(screen.getByText("Title r1")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/sort results/i), {
      target: { value: "" },
    });

    await waitFor(() => expect(window.location.search).not.toContain("sort="));
    expect(window.location.search).toContain("q=phonics");
  });

  test("year-only filter shows meta-bar count without 'for' framing", async () => {
    history.replaceState(null, "", "/esea?start_year=2015");
    mockBoth({ results: makeResult(120, ["r1"]) });
    renderSearchPage();

    await waitFor(() => expect(screen.getByText("Title r1")).toBeInTheDocument());
    expect(screen.getByText(/results from/i)).toHaveTextContent(/120 results from 2015/i);
    expect(screen.queryByText(/results for/i)).not.toBeInTheDocument();
  });

  test("URL params on mount drive the fetch", async () => {
    history.replaceState(null, "", "/esea?q=phonics&start_year=2015&page=2");
    mockBoth({ results: makeResult(47, ["r1"]) });
    renderSearchPage();

    await waitFor(() => {
      const queryCall = mockSearch.mock.calls.find(
        ([q, opts]) => q === "phonics" && opts?.page === 2,
      );
      expect(queryCall).toBeDefined();
      expect(queryCall![1]).toMatchObject({ startYear: 2015, page: 2 });
    });
  });

  test("submitting a query updates URL via pushState and changes meta-bar", async () => {
    // Browse-mode (q=undefined) serves both corpus and initial search,
    // returning the same 5,721-count page with r1 visible. Post-submit
    // search (q="phonics") returns a swapped-in 3-result payload.
    let postSubmitResponse: SearchResult = makeResult(0, []);
    mockSearch.mockImplementation((q) => {
      if (q === undefined) return Promise.resolve(makeResult(5721, ["r1"]));
      return Promise.resolve(postSubmitResponse);
    });

    renderSearchPage();
    await waitFor(() => expect(screen.getByText("Title r1")).toBeInTheDocument());
    expect(screen.getByText(/5,721 investigations/i)).toBeInTheDocument();

    postSubmitResponse = makeResult(3, ["r2"]);
    fireEvent.input(screen.getByRole("searchbox"), { target: { value: "phonics" } });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));

    await waitFor(() =>
      expect(screen.getByText(/results for/i)).toHaveTextContent(/3 results for/i)
    );
    expect(window.location.search).toBe("?q=phonics");
    // Corpus subtitle is unchanged throughout the transition.
    expect(screen.getByText(/5,721 investigations/i)).toBeInTheDocument();
  });

  test("submitting a query preserves an existing sort selection", async () => {
    history.replaceState(null, "", "/esea?sort=newest");
    mockBoth({ results: makeResult(3, ["r1"]) });

    renderSearchPage();
    await waitFor(() => expect(screen.getByText("Title r1")).toBeInTheDocument());

    fireEvent.input(screen.getByRole("searchbox"), { target: { value: "phonics" } });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));

    await waitFor(() => expect(window.location.search).toContain("q=phonics"));
    expect(window.location.search).toContain("sort=newest");
    expect(window.location.search).not.toContain("page=");
  });

  test("invalid URL params canonicalize via replaceState exactly once", async () => {
    const replaceSpy = vi.spyOn(history, "replaceState");
    history.replaceState(null, "", "/esea?q=%20phonics%20&page=abc");
    replaceSpy.mockClear();
    mockBoth({ results: makeResult(1, []) });

    renderSearchPage();
    await waitFor(() => {
      expect(window.location.search).toBe("?q=phonics");
    });
    expect(replaceSpy).toHaveBeenCalledTimes(1);
    replaceSpy.mockRestore();
  });

  test("unknown community renders NotFoundPage", () => {
    history.replaceState(null, "", "/unknown-slug");
    renderSearchPage();
    expect(screen.getByRole("heading", { name: /not found/i })).toBeInTheDocument();
  });

  test("corpus total failure: subtitle falls back to name only (non-browse URL avoids collision)", async () => {
    // Start in a non-browse URL so results-fetch q is "phonics" (success)
    // while corpus-fetch q is undefined (fails). Browse mode would collapse
    // the two fetches into identical calls and the test would be ambiguous.
    history.replaceState(null, "", "/esea?q=phonics");
    mockSearch.mockImplementation((q) => {
      if (q === undefined) return Promise.reject(new Error("corpus failed"));
      return Promise.resolve(makeResult(1, ["r1"]));
    });
    renderSearchPage();

    await waitFor(() => expect(screen.getByText("Title r1")).toBeInTheDocument());
    expect(screen.getByText(/Education/)).toBeInTheDocument();
    expect(screen.queryByText(/investigations across/i)).not.toBeInTheDocument();
  });

  test("corpus subtitle suffixes '+' when total.is_lower_bound is true", async () => {
    mockBoth({ results: makeResult(10000, ["r1"], true) });
    renderSearchPage();

    await waitFor(() => expect(screen.getByText("Title r1")).toBeInTheDocument());
    expect(screen.getByText(/10,000\+ investigations across Education/i)).toBeInTheDocument();
  });

  test("results meta-bar suffixes '+' when total.is_lower_bound is true", async () => {
    history.replaceState(null, "", "/esea?q=education");
    mockBoth({
      corpus: makeResult(5721, ["c1"]),
      results: makeResult(10000, ["r1"], true),
    });
    renderSearchPage();

    await waitFor(() => expect(screen.getByText("Title r1")).toBeInTheDocument());
    expect(screen.getByText(/results for/i)).toHaveTextContent(/10,000\+ results for “education”/i);
  });

  test("changing sort commits unsubmitted draft query and year filters", async () => {
    // Regression: previously the sort dropdown navigated using URL params
    // only, dropping any text/year edits the user hadn't yet submitted.
    mockBoth({ results: makeResult(5721, ["r1"]) });
    renderSearchPage();
    await waitFor(() => expect(screen.getByText("Title r1")).toBeInTheDocument());

    fireEvent.input(screen.getByRole("searchbox"), { target: { value: "literacy" } });
    fireEvent.input(screen.getByLabelText(/start year/i), { target: { value: "2001" } });
    fireEvent.input(screen.getByLabelText(/end year/i), { target: { value: "2010" } });

    fireEvent.change(screen.getByLabelText(/sort results/i), { target: { value: "oldest" } });

    await waitFor(() => expect(window.location.search).toContain("sort=oldest"));
    expect(window.location.search).toContain("q=literacy");
    expect(window.location.search).toContain("start_year=2001");
    expect(window.location.search).toContain("end_year=2010");
  });

  test("invalid year range blocks submit and shows validation message", async () => {
    mockBoth({ results: makeResult(5721, ["r1"]) });
    renderSearchPage();
    await waitFor(() => expect(screen.getByText("Title r1")).toBeInTheDocument());

    fireEvent.input(screen.getByLabelText(/start year/i), { target: { value: "2024" } });
    fireEvent.input(screen.getByLabelText(/end year/i), { target: { value: "2010" } });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/start year must not exceed end year/i);
    expect(window.location.search).toBe("");
  });

  test("validation error clears when user edits a year field", async () => {
    mockBoth({ results: makeResult(5721, ["r1"]) });
    renderSearchPage();
    await waitFor(() => expect(screen.getByText("Title r1")).toBeInTheDocument());

    fireEvent.input(screen.getByLabelText(/start year/i), { target: { value: "2024" } });
    fireEvent.input(screen.getByLabelText(/end year/i), { target: { value: "2010" } });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.input(screen.getByLabelText(/start year/i), { target: { value: "2000" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("drafts resync when the URL changes externally (back/forward)", async () => {
    history.replaceState(null, "", "/esea?q=alpha");
    mockBoth({ results: makeResult(5721, ["r1"]) });
    renderSearchPage();
    await waitFor(() => expect(screen.getByRole("searchbox")).toHaveValue("alpha"));

    history.pushState(null, "", "/esea?q=beta&start_year=2020");
    window.dispatchEvent(new PopStateEvent("popstate"));

    await waitFor(() => expect(screen.getByRole("searchbox")).toHaveValue("beta"));
    expect(screen.getByLabelText(/start year/i)).toHaveValue("2020");
  });

  test("search failure: renders retry, retry refetches without URL change", async () => {
    history.replaceState(null, "", "/esea?q=phonics");
    const pushSpy = vi.spyOn(history, "pushState");
    mockSearch.mockRejectedValue(new Error("search failed"));
    renderSearchPage();

    await waitFor(() => expect(screen.getByText(/couldn't load results/i)).toBeInTheDocument());
    const retryButton = screen.getByRole("button", { name: /try again/i });

    pushSpy.mockClear();
    mockSearch.mockResolvedValue(makeResult(1, ["r1"]));
    fireEvent.click(retryButton);

    await waitFor(() => expect(screen.getByText("Title r1")).toBeInTheDocument());
    expect(pushSpy).not.toHaveBeenCalled();
    pushSpy.mockRestore();
  });

  test("renders summary line when only facets are set (no q, no years)", async () => {
    // Issue #62 regression: a facet-only URL must trigger showSummary/showMetaBar,
    // otherwise filtered results render under the browse-mode hero with no count.
    // Asserts via class scope because the facet-only summary text has no q/year
    // discriminator and the count + " results" text live in sibling elements.
    history.replaceState(null, "", "/esea?q=%2A+AND+%28linked_data_concepts%3A%22EducationLevelScheme%2FC00002%22%29");
    mockBoth({ results: makeResult(7, ["r1"]) });
    const { container } = renderSearchPage();
    await waitFor(() => {
      const summary = container.querySelector(".search-results__meta-summary");
      expect(summary).toBeInTheDocument();
      expect(summary).toHaveTextContent(/7\s*results/);
    });
  });

  describe("export button", () => {
    test("enabled in browse mode; click POSTs with q=* and the community annotation", async () => {
      mockBoth({ results: makeResult(5721, ["r1"]) });
      mockRequestExport.mockResolvedValue({
        id: "job-browse",
        status: "pending",
        truncated: false,
      });
      mockGetExport.mockResolvedValue({
        id: "job-browse",
        status: "pending",
        truncated: false,
      });
      renderSearchPage();
      await waitFor(() => expect(screen.getByText("Title r1")).toBeInTheDocument());

      const btn = screen.getByRole("button", { name: /export to excel/i });
      expect(btn).not.toHaveAttribute("aria-disabled", "true");
      fireEvent.click(btn);
      await waitFor(() => expect(mockRequestExport).toHaveBeenCalledTimes(1));
      expect(mockRequestExport).toHaveBeenCalledWith("*", {
        startYear: undefined,
        endYear: undefined,
        annotation: ["domain-inclusion/jacobs-education"],
      });
    });

    test("enabled in year-only URL; click POSTs with q=* and the year filter", async () => {
      history.replaceState(null, "", "/esea?start_year=2020");
      mockBoth({ results: makeResult(120, ["r1"]) });
      mockRequestExport.mockResolvedValue({
        id: "job-yr",
        status: "pending",
        truncated: false,
      });
      mockGetExport.mockResolvedValue({
        id: "job-yr",
        status: "pending",
        truncated: false,
      });
      renderSearchPage();
      await waitFor(() => expect(screen.getByText("Title r1")).toBeInTheDocument());

      const btn = screen.getByRole("button", { name: /export to excel/i });
      expect(btn).not.toHaveAttribute("aria-disabled", "true");
      fireEvent.click(btn);
      await waitFor(() => expect(mockRequestExport).toHaveBeenCalledTimes(1));
      expect(mockRequestExport).toHaveBeenCalledWith("*", {
        startYear: 2020,
        endYear: undefined,
        annotation: ["domain-inclusion/jacobs-education"],
      });
    });

    test("disabled when result set is empty with explanatory tooltip", async () => {
      history.replaceState(null, "", "/esea?q=phonics");
      mockBoth({ results: makeResult(0, []) });
      renderSearchPage();
      await waitFor(() =>
        expect(screen.getByText(/no matches/i)).toBeInTheDocument(),
      );

      const btn = screen.getByRole("button", { name: /export to excel/i });
      expect(btn).toHaveAttribute("aria-disabled", "true");
      expect(btn.parentElement).toHaveAttribute(
        "data-tooltip",
        expect.stringMatching(/no results to export/i),
      );
    });

    test("disabled while a follow-up search is in flight (stale results, gate before fresh data)", async () => {
      history.replaceState(null, "", "/esea?q=phonics");
      // Route by query so the test isn't sensitive to mock call order:
      // corpus query → 5,721; phonics → 47 results immediately; literacy
      // hangs until we explicitly resolve it, so loading=true while the
      // phonics rows still render.
      let resolveLiteracy: ((value: SearchResult) => void) | undefined;
      mockSearch.mockImplementation((q) => {
        if (q === undefined)
          return Promise.resolve(makeResult(5721, ["corpus-ref"]));
        if (q === "phonics")
          return Promise.resolve(makeResult(47, ["phonics-ref"]));
        if (q === "literacy") {
          return new Promise<SearchResult>((r) => {
            resolveLiteracy = r;
          });
        }
        return Promise.reject(new Error(`unexpected query: ${q}`));
      });
      renderSearchPage();
      await waitFor(() =>
        expect(screen.getByText("Title phonics-ref")).toBeInTheDocument(),
      );
      // First settled state: 47 results → button enabled.
      const btn = screen.getByRole("button", { name: /export to excel/i });
      expect(btn).not.toHaveAttribute("aria-disabled", "true");

      // Submit a new query — keeps phonics-ref visible (dim) while the
      // literacy fetch hangs.
      fireEvent.input(screen.getByRole("searchbox"), {
        target: { value: "literacy" },
      });
      fireEvent.click(screen.getByRole("button", { name: /search/i }));

      // Button is disabled while loading even though stale `results.results`
      // would have said `hasResults && !overCap`.
      await waitFor(() => expect(btn).toHaveAttribute("aria-disabled", "true"));
      // Tooltip is suppressed during loading to avoid asserting a stale count.
      expect(btn.parentElement).not.toHaveAttribute("data-tooltip");

      // Resolve the literacy fetch; button re-enables.
      resolveLiteracy?.(makeResult(12, ["literacy-ref"]));
      await waitFor(() =>
        expect(btn).not.toHaveAttribute("aria-disabled", "true"),
      );
    });

    test("disabled past the 10k cap with tooltip", async () => {
      history.replaceState(null, "", "/esea?q=education");
      mockBoth({ results: makeResult(10000, ["r1"], true) });
      renderSearchPage();
      await waitFor(() => expect(screen.getByText("Title r1")).toBeInTheDocument());

      const btn = screen.getByRole("button", { name: /export to excel/i });
      expect(btn).toHaveAttribute("aria-disabled", "true");
      expect(btn.parentElement).toHaveAttribute(
        "data-tooltip",
        expect.stringMatching(/limited to 10,000 results/i),
      );
    });

    test("click POSTs with current filters and shows preparing status", async () => {
      history.replaceState(null, "", "/esea?q=phonics&start_year=2015");
      mockBoth({ results: makeResult(47, ["r1"]) });
      mockRequestExport.mockResolvedValue({
        id: "job-1",
        status: "pending",
        truncated: false,
      });
      // Keep polling pending forever so the test settles on "Preparing…".
      mockGetExport.mockResolvedValue({
        id: "job-1",
        status: "pending",
        truncated: false,
      });

      renderSearchPage();
      await waitFor(() => expect(screen.getByText("Title r1")).toBeInTheDocument());

      const btn = screen.getByRole("button", { name: /export to excel/i });
      fireEvent.click(btn);

      await waitFor(() => expect(mockRequestExport).toHaveBeenCalledTimes(1));
      expect(mockRequestExport).toHaveBeenCalledWith("phonics", {
        startYear: 2015,
        endYear: undefined,
        annotation: ["domain-inclusion/jacobs-education"],
      });
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /preparing/i }),
        ).toBeInTheDocument(),
      );
    });

    test("facet URL → Export sends fully-qualified URI to requestSearchExport", async () => {
      // SearchPage-layer integration: catches misthreaded community.vocabBase
      // or stale params at the call site, which the unit tests on
      // toExportSearchQuery in isolation cannot.
      history.replaceState(
        null,
        "",
        "/esea?q=%28phonics%29+AND+%28linked_data_concepts%3A%22EducationLevelScheme%2FC00002%22%29",
      );
      mockBoth({ results: makeResult(7, ["r1"]) });
      mockRequestExport.mockResolvedValue({ id: "job-facet", status: "pending", truncated: false });
      mockGetExport.mockResolvedValue({ id: "job-facet", status: "pending", truncated: false });
      renderSearchPage();
      await waitFor(() => expect(screen.getByText("Title r1")).toBeInTheDocument());

      fireEvent.click(screen.getByRole("button", { name: /export to excel/i }));
      await waitFor(() => expect(mockRequestExport).toHaveBeenCalledTimes(1));
      expect(mockRequestExport).toHaveBeenCalledWith(
        '(phonics) AND (linked_data_concepts:"https://vocab.esea.education/EducationLevelScheme/C00002")',
        {
          startYear: undefined,
          endYear: undefined,
          annotation: ["domain-inclusion/jacobs-education"],
        },
      );
    });
  });
});
