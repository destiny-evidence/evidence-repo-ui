import { useEffect, useMemo, useState } from "preact/hooks";
import { useCommunity } from "@/community/CommunityContext";
import type { Community } from "@/types/models";
import {
  parseSearchParams,
  toQueryString,
  buildSearchUrl,
  toExportSearchQuery,
  valuesToFacet,
  facetToValues,
  type SortOption,
} from "@/services/searchParams";
import { navigate } from "@/services/navigation";
import { useUrlParams } from "@/hooks/useUrlParams";
import { useCorpusTotal } from "@/hooks/useCorpusTotal";
import { useSearch } from "@/hooks/useSearch";
import { useSearchDraft } from "@/hooks/useSearchDraft";
import { useSearchExport, type ExportStatus } from "@/hooks/useSearchExport";
import { useVocabulary } from "@/hooks/useVocabulary";
import { EXPORT_VOCABULARY_URL } from "@/config";
import { SearchBar } from "@/components/search/SearchBar";
import { SortDropdown } from "@/components/search/SortDropdown";
import { ExportButton } from "@/components/search/ExportButton";
import { FacetCombobox } from "@/components/search/FacetCombobox";
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

// 10k is destiny-repository's max_result_window; deep pagination + exports
// past that are explicitly out of scope. Mirrors the search backend cap.
const EXPORT_MAX_RESULTS = 10000;

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

  const draft = useSearchDraft(params);

  // Very basic facet picker: two free-text slots that map to params.searchFacets.
  // User types SKOS prefLabels separated by " OR " (e.g. `Journal Article OR
  // Technical Report`). We resolve labels to concept URIs via the loaded
  // vocabulary, then wrap each URI as `linked_data_concepts:"<URI>"` — ES
  // indexes that field as keyword (URIs only), so the resolution has to happen
  // here. Unknown labels pass through verbatim so the user sees zero results
  // (which is the signal that the label doesn't exist in the vocabulary).
  const vocab = useVocabulary(EXPORT_VOCABULARY_URL);
  const uriByLabel = useMemo(() => {
    if (!vocab.labels) return null;
    const m = new Map<string, string>();
    for (const [uri, label] of vocab.labels) m.set(label, uri);
    return m;
  }, [vocab.labels]);

  function fragmentToBoxValue(fragment: string): string {
    const uris = facetToValues(fragment);
    if (uris.length === 0) return fragment;
    return uris.map((u) => vocab.labels?.get(u) ?? u).join(" OR ");
  }

  function boxValueToFragment(input: string): string {
    const tokens = input
      .split(/\s+OR\s+/i)
      .map((s) => s.trim())
      .filter((s) => s !== "");
    if (tokens.length === 0) return "";
    const uris = tokens.map((t) => uriByLabel?.get(t) ?? t);
    return valuesToFacet(uris);
  }

  const [facet1, setFacet1] = useState(() => fragmentToBoxValue(params.searchFacets[0] ?? ""));
  const [facet2, setFacet2] = useState(() => fragmentToBoxValue(params.searchFacets[1] ?? ""));
  // Resync on URL change or when the vocabulary finishes loading (so URIs in
  // the URL can be rendered as friendlier labels once the map is available).
  useEffect(
    () => { setFacet1(fragmentToBoxValue(params.searchFacets[0] ?? "")); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.searchFacets[0], vocab.labels],
  );
  useEffect(
    () => { setFacet2(fragmentToBoxValue(params.searchFacets[1] ?? "")); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.searchFacets[1], vocab.labels],
  );

  function applyFacets() {
    const next = [facet1, facet2]
      .map(boxValueToFragment)
      .filter((s) => s !== "");
    // Skip if nothing changed so blur/Enter/Apply don't push redundant
    // history entries when the boxes already match the URL.
    const unchanged =
      next.length === params.searchFacets.length
      && next.every((v, i) => v === params.searchFacets[i]);
    if (unchanged) return;
    navigate(buildSearchUrl(community.slug, { ...params, searchFacets: next, page: 1 }));
  }

  // Sorted list of every prefLabel in the vocabulary — fed to both
  // FacetComboboxes so the user can browse/filter without retyping URIs.
  const vocabOptions = useMemo(() => {
    if (!vocab.labels) return [];
    return Array.from(vocab.labels.values()).sort();
  }, [vocab.labels]);

  const corpus = useCorpusTotal();
  const results = useSearch(params);
  const exportJob = useSearchExport();

  // Hide the bar on the initial browse-mode load so the skeleton owns the
  // full vertical space; show it as soon as there's anything to put in it.
  const showMetaBar =
    results.results !== null ||
    results.error !== null ||
    params.q !== "" ||
    params.startYear !== undefined ||
    params.endYear !== undefined ||
    params.searchFacets.length > 0;

  // Browse mode skips the summary text to avoid duplicating the hero's corpus count.
  // Facet-only searches still count as a filter — show the result count.
  const showSummary =
    params.q !== "" ||
    params.startYear !== undefined ||
    params.endYear !== undefined ||
    params.searchFacets.length > 0 ||
    results.error !== null;

  function handleSubmit() {
    const committed = draft.commitDraft();
    if (!committed) return;
    navigate(buildSearchUrl(community.slug, { ...params, ...committed, page: 1 }));
  }

  function handlePageChange(page: number) {
    navigate(buildSearchUrl(community.slug, { ...params, page }));
  }

  function handleSortChange(sort: SortOption | undefined) {
    const committed = draft.commitDraft();
    if (!committed) return;
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
    const { query, filters } = toExportSearchQuery(params, community.defaultAnnotations);
    exportJob.start(query, filters, formatExportFilename(community.slug));
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
          draftQ={draft.draftQ}
          draftStart={draft.draftStart}
          draftEnd={draft.draftEnd}
          onDraftQChange={draft.setDraftQ}
          onDraftStartChange={draft.setDraftStart}
          onDraftEndChange={draft.setDraftEnd}
          validationError={draft.validationError}
          onSubmit={handleSubmit}
          disabled={results.loading && results.results !== null}
        />
        <div
          role="group"
          aria-label="Search facets"
          style={{
            marginTop: "0.75rem",
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: "0.85rem" }}>Facets:</span>
          <FacetCombobox
            value={facet1}
            onChange={setFacet1}
            onCommit={applyFacets}
            options={vocabOptions}
            ariaLabel="Facet 1"
            placeholder="Journal Article OR Technical Report"
          />
          <FacetCombobox
            value={facet2}
            onChange={setFacet2}
            onCommit={applyFacets}
            options={vocabOptions}
            ariaLabel="Facet 2"
            placeholder="Randomised Controlled Trial OR Systematic Review"
          />
          <button type="button" onClick={applyFacets}>Apply facets</button>
        </div>
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
                        ? formatResultsSummary(params.q, params.startYear, params.endYear, results.results.total)
                        : null
                : null}
            </span>
            {results.results && (
              <span class="search-results__meta-right">
                {exportJob.status === "error" && (
                  <span
                    class="search-results__export-status"
                    role="alert"
                  >
                    {exportJob.errorMessage ?? "Export failed."}
                  </span>
                )}
                <span
                  class="visually-hidden"
                  role="status"
                  aria-live="polite"
                >
                  {exportAnnouncement}
                </span>
                <ExportButton
                  disabled={exportDisabled}
                  status={exportJob.status}
                  onClick={handleExport}
                  tooltip={exportTooltip}
                />
                <SortDropdown
                  value={params.sort}
                  onChange={handleSortChange}
                  disabled={results.loading}
                />
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
