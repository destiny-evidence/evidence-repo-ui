import { useEffect, useMemo, useState } from "preact/hooks";
import { useCommunity } from "@/community/CommunityContext";
import type { Community } from "@/types/models";
import {
  parseSearchParams,
  toQueryString,
  buildSearchUrl,
  toExportSearchQuery,
  type SortOption,
} from "@/services/searchParams";
import { navigate } from "@/services/navigation";
import { useUrlParams } from "@/hooks/useUrlParams";
import { useCorpusTotal } from "@/hooks/useCorpusTotal";
import { useSearch } from "@/hooks/useSearch";
import { useSearchDraft } from "@/hooks/useSearchDraft";
import { useSearchExport, type ExportStatus } from "@/hooks/useSearchExport";
import { useVocabulary } from "@/hooks/useVocabulary";
import { SearchBar } from "@/components/search/SearchBar";
import { SortDropdown } from "@/components/search/SortDropdown";
import { ExportButton } from "@/components/search/ExportButton";
import { RefineButton } from "@/components/search/RefineButton";
import { ResultRow } from "@/components/search/ResultRow";
import { Pagination } from "@/components/shared/Pagination";
import { FilterDrawer, type AppliedFilters } from "@/components/filters/FilterDrawer";
import { totalSelectedCount } from "@/components/filters/conceptSchemeFilterState";
import { totalSelectedCount as totalSelectedCountryCount } from "@/components/filters/countryFilterState";
import { totalSelectedCount as totalSelectedYearCount } from "@/components/filters/yearRangeFilterState";
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

// 10k is destiny-repository's max_result_window; deep pagination + exports
// past that are explicitly out of scope. Mirrors the search backend cap.
const EXPORT_MAX_RESULTS = 10000;

// Maps the useVocabulary() result to the SearchBar `refine` prop. Returns
// undefined when there are no facets to offer (empty schemes) so the Refine
// trigger isn't rendered at all.
function buildRefineConfig(
  vocab: ReturnType<typeof useVocabulary>,
  count: number,
  open: () => void,
):
  | { count: number; disabled: boolean; disabledReason?: string; onClick: () => void }
  | undefined {
  if (vocab.schemes && vocab.schemes.length > 0) {
    return { count, disabled: false, onClick: open };
  }
  if (vocab.error) {
    return { count: 0, disabled: true, disabledReason: "Filters unavailable", onClick: () => {} };
  }
  if (vocab.loading) {
    return { count: 0, disabled: true, disabledReason: "Loading filters…", onClick: () => {} };
  }
  return undefined;
}

function formatExportFilename(slug: string, now: Date = new Date()): string {
  // UTC so the same wall-clock click in different timezones produces the
  // same filename — easier to diff/dedupe across users.
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `destiny-evidence-${slug}-${y}${m}${d}.xlsx`;
}

function exportAnnouncementFor(status: ExportStatus): string {
  switch (status) {
    case "requesting":
    case "polling":
      return "Preparing export…";
    case "downloading":
      return "Downloading export…";
    case "done":
      return "Export downloaded.";
    default:
      return "";
  }
}

function formatResultsSummary(
  q: string,
  total: { count: number; is_lower_bound: boolean },
) {
  const qClause = q !== "" ? ` for “${q}”` : "";
  // Wrapping span keeps the count + tail as a single anonymous flex item
  // inside the meta bar so the gap rule doesn't separate them.
  return (
    <span class="search-results__meta-summary">
      <span class="search-results__meta-count">{formatTotal(total)}</span>
      {` results${qClause}`}
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

  const draft = useSearchDraft(params);

  const corpus = useCorpusTotal();
  const results = useSearch(params);
  const exportJob = useSearchExport();

  // Kick off the vocabulary fetch on page mount (not on drawer open) via the
  // shared cache, so the Refine button is almost always ready by the time
  // the user reaches for it. The drawer itself never renders a loading
  // state — the trigger is the gate.
  const vocab = useVocabulary(community.vocabularyUrl);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Excluded schemes are still kept in the vocabulary cache so labels and
  // definitions resolve on result rows and the record detail page; they're
  // only hidden from the filter UI (drawer + applied-filter count).
  const filterableSchemes = useMemo(
    () =>
      (vocab.schemes ?? []).filter(
        (s) => !community.filterExcludedSchemes.includes(s.uri),
      ),
    [vocab.schemes, community.filterExcludedSchemes],
  );

  // Treat clicking Refine like submitting the search bar: commit any pending
  // Q edit before opening the drawer so the drawer's facet-count fetch and
  // the post-Apply navigation reflect what the user has typed.
  function handleOpenDrawer() {
    const committed = draft.commitDraft();
    if (params.q !== committed.q) {
      navigate(
        buildSearchUrl(community.slug, { ...params, ...committed, page: 1 }),
      );
    }
    setDrawerOpen(true);
  }

  const refine = buildRefineConfig(
    vocab,
    totalSelectedCount(params.conceptFilters, filterableSchemes)
      + totalSelectedCountryCount(params.countryCodes)
      + totalSelectedYearCount(params.startYear, params.endYear),
    handleOpenDrawer,
  );

  function handleApplyFilters(next: AppliedFilters) {
    const committed = draft.commitDraft();
    navigate(
      buildSearchUrl(community.slug, {
        ...params,
        ...committed,
        ...next,
        page: 1,
      }),
    );
    setDrawerOpen(false);
  }

  // Hide the bar on the initial browse-mode load so the skeleton owns the
  // full vertical space; show it as soon as there's anything to put in it.
  // Refine living in the meta bar means we also keep the bar visible whenever
  // a Refine trigger is offered, so it stays reachable before the first result.
  const showMetaBar =
    results.results !== null ||
    results.error !== null ||
    params.q !== "" ||
    params.startYear !== undefined ||
    params.endYear !== undefined ||
    params.countryCodes.length > 0 ||
    params.conceptFilters.length > 0 ||
    refine !== undefined;

  // Browse mode skips the summary text to avoid duplicating the hero's corpus count.
  const showSummary =
    params.q !== "" ||
    params.startYear !== undefined ||
    params.endYear !== undefined ||
    params.countryCodes.length > 0 ||
    params.conceptFilters.length > 0 ||
    results.error !== null;

  function handleSubmit() {
    const committed = draft.commitDraft();
    navigate(buildSearchUrl(community.slug, { ...params, ...committed, page: 1 }));
  }

  function handlePageChange(page: number) {
    navigate(buildSearchUrl(community.slug, { ...params, page }));
  }

  function handleSortChange(sort: SortOption | undefined) {
    const committed = draft.commitDraft();
    navigate(buildSearchUrl(community.slug, { ...params, ...committed, sort, page: 1 }));
  }

  const hasResults = results.results !== null && results.results.references.length > 0;
  const overCap =
    results.results !== null
    && results.results.total.is_lower_bound
    && results.results.total.count >= EXPORT_MAX_RESULTS;
  const exportBusy =
    exportJob.status === "requesting"
    || exportJob.status === "polling"
    || exportJob.status === "downloading";
  // Gate on results.loading too: useSearch keeps prior results visible while
  // a new fetch is in flight, so `hasResults` / `overCap` would otherwise
  // reflect the previous search and let an export through against stale state.
  const exportDisabled =
    !hasResults || overCap || exportBusy || results.loading;
  const exportTooltip = ((): string | undefined => {
    // Suppress while refetching: would otherwise assert a stale count.
    if (results.loading) return undefined;
    if (overCap) {
      return `Refine your search — exports are limited to ${EXPORT_MAX_RESULTS.toLocaleString()} results.`;
    }
    if (!hasResults) return "No results to export.";
    return undefined;
  })();
  const exportAnnouncement = exportAnnouncementFor(exportJob.status);

  function handleExport() {
    const { query, filters } = toExportSearchQuery(
      params,
      community.defaultAnnotations,
    );
    exportJob.start({
      query,
      filters,
      filename: formatExportFilename(community.slug),
      vocabularyUrl: community.vocabularyUrl,
      contextUrl: community.contextUrl,
      codingInstitution: community.codingInstitution,
    });
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
            ? `${formatTotal(corpus.total)} ${community.copy.countNoun} across ${community.copy.corpusDescriptor}`
            : corpus.loading
              ? <span class="search-hero__subtitle--placeholder">Loading…</span>
              : community.name}
        </p>
        <SearchBar
          draftQ={draft.draftQ}
          onDraftQChange={draft.setDraftQ}
          onSubmit={handleSubmit}
          placeholder={community.copy.searchPlaceholder}
          disabled={results.loading && results.results !== null}
        />
      </section>

      <section class="search-results">
        {showMetaBar && (
          <div class="search-results__meta">
            <span class="search-results__meta-left" aria-live="polite">
              {showSummary
                ? results.error
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
                        ? formatResultsSummary(params.q, results.results.total)
                        : null
                : null}
            </span>
            {(refine || results.results) && (
              <span class="search-results__meta-right">
                {results.results && exportJob.status === "error" && (
                  <span
                    class="search-results__export-status"
                    role="alert"
                  >
                    {exportJob.errorMessage ?? "Export failed."}
                  </span>
                )}
                {results.results && (
                  <span
                    class="visually-hidden"
                    role="status"
                    aria-live="polite"
                  >
                    {exportAnnouncement}
                  </span>
                )}
                {results.results && (
                  <ExportButton
                    disabled={exportDisabled}
                    status={exportJob.status}
                    onClick={handleExport}
                    tooltip={exportTooltip}
                  />
                )}
                {refine && (
                  <RefineButton
                    count={refine.count}
                    disabled={refine.disabled}
                    disabledReason={refine.disabledReason}
                    onClick={refine.onClick}
                  />
                )}
                {results.results && (
                  <SortDropdown
                    value={params.sort}
                    onChange={handleSortChange}
                    disabled={results.loading}
                  />
                )}
              </span>
            )}
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
            <ResultRow
              key={ref.id}
              communitySlug={community.slug}
              reference={ref}
              codingInstitution={community.codingInstitution}
            />
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

      {filterableSchemes.length > 0 && (
        <FilterDrawer
          open={drawerOpen}
          title={community.copy.drawerTitle}
          countNoun={community.copy.countNoun}
          schemes={filterableSchemes}
          appliedConceptFilters={params.conceptFilters}
          appliedCountryCodes={params.countryCodes}
          appliedStartYear={params.startYear}
          appliedEndYear={params.endYear}
          params={params}
          onApply={handleApplyFilters}
          onCancel={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}
