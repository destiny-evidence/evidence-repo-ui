import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/preact";
import { SearchPage } from "@/pages/SearchPage";
import type { SearchResult } from "@/types/models";

vi.mock("@/services/apiClient", () => ({
  searchReferences: vi.fn(),
}));

import { searchReferences } from "@/services/apiClient";
const mockSearch = vi.mocked(searchReferences);

function makeResult(count: number, ids: string[] = []): SearchResult {
  return {
    total: { count, is_lower_bound: false },
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
  history.replaceState(null, "", "/esea");
});

describe("SearchPage", () => {
  test("browse mode on mount: hero shows corpus count, rows render, meta-bar hidden", async () => {
    // Browse mode: corpus and search fetches are identical (both q=undefined),
    // so corpus defaults to mirror results.
    mockBoth({ results: makeResult(5721, ["r1", "r2", "r3"]) });
    render(<SearchPage community="esea" />);

    await waitFor(() => expect(screen.getByText("Title r1")).toBeInTheDocument());
    expect(screen.getByText(/5,721 investigations/i)).toBeInTheDocument();
    expect(screen.getByText(/Education/)).toBeInTheDocument();
    expect(screen.queryByText(/results for/i)).not.toBeInTheDocument();
  });

  test("year-only filter (no query) keeps meta-bar hidden", async () => {
    history.replaceState(null, "", "/esea?start_year=2015");
    mockBoth({ results: makeResult(120, ["r1"]) });
    render(<SearchPage community="esea" />);

    await waitFor(() => expect(screen.getByText("Title r1")).toBeInTheDocument());
    expect(screen.queryByText(/results for/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/filtered/i)).not.toBeInTheDocument();
  });

  test("URL params on mount drive the fetch", async () => {
    history.replaceState(null, "", "/esea?q=phonics&start_year=2015&page=2");
    mockBoth({ results: makeResult(47, ["r1"]) });
    render(<SearchPage community="esea" />);

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

    render(<SearchPage community="esea" />);
    await waitFor(() => expect(screen.getByText("Title r1")).toBeInTheDocument());
    expect(screen.getByText(/5,721 investigations/i)).toBeInTheDocument();

    postSubmitResponse = makeResult(3, ["r2"]);
    fireEvent.input(screen.getByRole("searchbox"), { target: { value: "phonics" } });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));

    await waitFor(() => expect(screen.getByText(/3 results for/i)).toBeInTheDocument());
    expect(window.location.search).toBe("?q=phonics");
    // Corpus subtitle is unchanged throughout the transition.
    expect(screen.getByText(/5,721 investigations/i)).toBeInTheDocument();
  });

  test("invalid URL params canonicalize via replaceState exactly once", async () => {
    const replaceSpy = vi.spyOn(history, "replaceState");
    history.replaceState(null, "", "/esea?q=%20phonics%20&page=abc");
    replaceSpy.mockClear();
    mockBoth({ results: makeResult(1, []) });

    render(<SearchPage community="esea" />);
    await waitFor(() => {
      expect(window.location.search).toBe("?q=phonics");
    });
    expect(replaceSpy).toHaveBeenCalledTimes(1);
    replaceSpy.mockRestore();
  });

  test("unknown community renders NotFoundPage", () => {
    render(<SearchPage community="unknown-slug" />);
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
    render(<SearchPage community="esea" />);

    await waitFor(() => expect(screen.getByText("Title r1")).toBeInTheDocument());
    expect(screen.getByText(/Education/)).toBeInTheDocument();
    expect(screen.queryByText(/investigations across/i)).not.toBeInTheDocument();
  });

  test("search failure: renders retry, retry refetches without URL change", async () => {
    history.replaceState(null, "", "/esea?q=phonics");
    const pushSpy = vi.spyOn(history, "pushState");
    mockSearch.mockRejectedValue(new Error("search failed"));
    render(<SearchPage community="esea" />);

    await waitFor(() => expect(screen.getByText(/couldn't load results/i)).toBeInTheDocument());
    const retryButton = screen.getByRole("button", { name: /try again/i });

    pushSpy.mockClear();
    mockSearch.mockResolvedValue(makeResult(1, ["r1"]));
    fireEvent.click(retryButton);

    await waitFor(() => expect(screen.getByText("Title r1")).toBeInTheDocument());
    expect(pushSpy).not.toHaveBeenCalled();
    pushSpy.mockRestore();
  });
});
