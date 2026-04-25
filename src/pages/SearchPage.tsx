import { useEffect } from "preact/hooks";
import { findCommunity } from "@/services/communities";
import type { Community } from "@/types/models";
import { parseSearchParams, toQueryString, buildSearchUrl } from "@/services/searchParams";
import { navigate } from "@/services/navigation";
import { useUrlParams } from "@/hooks/useUrlParams";
import { useCorpusTotal } from "@/hooks/useCorpusTotal";
import { useSearch } from "@/hooks/useSearch";
import { SearchBar } from "@/components/search/SearchBar";
import { ResultRow } from "@/components/search/ResultRow";
import { Pagination } from "@/components/Pagination";
import { NotFoundPage } from "./NotFoundPage";
import "./SearchPage.css";

interface SearchPageProps {
  path?: string;
  community?: string;
}

// Mirrors the destiny-repository /v1/references/search/ fixed page size.
// Not a UI knob — changing this here desyncs totalPages math from the
// server's actual paging. If the backend ever exposes a configurable page
// size, switch to reading it off SearchResult.page rather than tuning here.
const BACKEND_PAGE_SIZE = 20;

export function SearchPage({ community: slug }: SearchPageProps) {
  const community = slug ? findCommunity(slug) : undefined;
  if (!community) return <NotFoundPage />;
  return <SearchPageInner community={community} />;
}

function SearchPageInner({ community }: { community: Community }) {
  const search = useUrlParams();
  const params = parseSearchParams(search);
  const canonicalQs = toQueryString(params);

  // Canonicalize once: if URL query string doesn't match the canonical form,
  // silently rewrite via replaceState. Keyed on canonicalQs so it runs per divergence.
  useEffect(() => {
    const current = search.startsWith("?") ? search.slice(1) : search;
    if (current !== canonicalQs) {
      navigate(buildSearchUrl(community.slug, params), { mode: "replace" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonicalQs, community.slug]);

  const corpus = useCorpusTotal(community);
  const results = useSearch(params, community.defaultAnnotations);

  // Meta-bar appears only for a real query, per spec. Year-only filtering is
  // visible via the search-bar inputs themselves; the meta-bar's "for 'q'"
  // framing doesn't fit empty-q. Errors override (always surface failures).
  const showMetaBar = params.q !== "" || results.error !== null;

  function handleSubmit(q: string, startYear: number | undefined, endYear: number | undefined) {
    const nextParams = { q, page: 1, startYear, endYear };
    navigate(buildSearchUrl(community.slug, nextParams));
  }

  function handlePageChange(page: number) {
    navigate(buildSearchUrl(community.slug, { ...params, page }));
  }

  const totalPages = results.results
    ? Math.max(1, Math.ceil(results.results.total.count / BACKEND_PAGE_SIZE))
    : 1;

  return (
    <div class="search-page">
      <section class="search-hero">
        <h1 class="search-hero__title">Search the evidence</h1>
        <p class="search-hero__subtitle">
          {corpus.total
            ? `${corpus.total.count.toLocaleString()} investigations across ${community.name}`
            : corpus.loading
              ? <span class="search-hero__subtitle--placeholder">Loading…</span>
              : community.name}
        </p>
        <SearchBar
          q={params.q}
          startYear={params.startYear}
          endYear={params.endYear}
          onSubmit={handleSubmit}
          disabled={results.loading && results.results !== null}
        />
      </section>

      <section class="search-results">
        {showMetaBar && (
          <div class="search-results__meta" aria-live="polite">
            {results.error
              ? (
                <>
                  <span>Couldn't load results.</span>
                  <button
                    type="button"
                    class="search-results__retry"
                    onClick={() => results.retry()}
                  >
                    Try again
                  </button>
                </>
              )
              : results.loading && results.results === null
                ? "Searching…"
                : results.loading
                  ? "Updating results…"
                  : results.results
                    ? `${results.results.total.count.toLocaleString()} results for '${params.q}'`
                    : null}
          </div>
        )}

        <div
          class={`search-results__list${
            results.loading && results.results !== null ? " is-updating" : ""
          }`}
        >
          {results.results === null && results.loading && (
            <div class="search-results__skeleton" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} class="search-results__skeleton-row" />
              ))}
            </div>
          )}

          {results.results && results.results.references.length === 0 && (
            <div class="search-results__empty">
              No matches. Try a broader query or clear the year range.
            </div>
          )}

          {results.results?.references.map((ref) => (
            <ResultRow key={ref.id} communitySlug={community.slug} reference={ref} />
          ))}
        </div>

        {results.results && (
          <Pagination
            currentPage={params.page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            disabled={results.loading}
          />
        )}
      </section>
    </div>
  );
}
