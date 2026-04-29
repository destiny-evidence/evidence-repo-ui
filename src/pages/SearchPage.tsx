import { useEffect } from "preact/hooks";
import { useCommunity } from "@/community/CommunityContext";
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
}

// ES caps deep pagination at 10k; when the true count exceeds that, the
// backend returns is_lower_bound=true and count=10000. Render "10,000+" so
// the UI doesn't understate the corpus size.
function formatTotal(total: { count: number; is_lower_bound: boolean }): string {
  return `${total.count.toLocaleString()}${total.is_lower_bound ? "+" : ""}`;
}

function formatYearClause(start: number | undefined, end: number | undefined): string {
  if (start !== undefined && end !== undefined) return ` from ${start} to ${end}`;
  if (start !== undefined) return ` from ${start}`;
  if (end !== undefined) return ` to ${end}`;
  return "";
}

function formatResultsSummary(
  q: string,
  startYear: number | undefined,
  endYear: number | undefined,
  total: { count: number; is_lower_bound: boolean },
) {
  const qClause = q !== "" ? ` for “${q}”` : "";
  // Wrapping span keeps the count + tail as a single anonymous flex item
  // inside the meta bar so the gap rule doesn't separate them.
  return (
    <span class="search-results__meta-summary">
      <span class="search-results__meta-count">{formatTotal(total)}</span>
      {` results${qClause}${formatYearClause(startYear, endYear)}`}
    </span>
  );
}

export function SearchPage(_props: SearchPageProps) {
  const community = useCommunity();
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

  // Meta-bar appears whenever the user has narrowed from browse mode (a query
  // or a year filter), or whenever an error needs surfacing. Empty q + no
  // year filters = browse mode, where the hero subtitle already carries the
  // corpus count.
  const showMetaBar =
    params.q !== "" ||
    params.startYear !== undefined ||
    params.endYear !== undefined ||
    results.error !== null;

  function handleSubmit(q: string, startYear: number | undefined, endYear: number | undefined) {
    const nextParams = { q, page: 1, startYear, endYear };
    navigate(buildSearchUrl(community.slug, nextParams));
  }

  function handlePageChange(page: number) {
    navigate(buildSearchUrl(community.slug, { ...params, page }));
  }

  // Page size comes from the API response (page.count) so the UI stays in
  // sync if the backend ever changes its fixed page size. Math.max guards
  // against page.count = 0 to avoid divide-by-zero / Infinity totalPages.
  const totalPages = results.results
    ? Math.max(
        1,
        Math.ceil(results.results.total.count / Math.max(1, results.results.page.count)),
      )
    : 1;

  return (
    <div class="search-page">
      <section class="search-hero">
        <h1 class="search-hero__title">Search the evidence</h1>
        <p class="search-hero__subtitle">
          {corpus.total
            ? `${formatTotal(corpus.total)} investigations across ${community.name.toLowerCase()} research`
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
                    ? formatResultsSummary(params.q, params.startYear, params.endYear, results.results.total)
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
