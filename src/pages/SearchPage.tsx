import { useEffect, useMemo, useState } from "preact/hooks";
import { useCommunity } from "@/community/CommunityContext";
import { useAuth } from "@/auth/AuthContext";
import type { Community } from "@/types/models";
import {
  parseSearchParams,
  toQueryString,
  buildSearchUrl,
  toUnpaginatedSearchQuery,
  sortKey,
  type SortOption,
} from "@/services/searchParams";
import { navigate } from "@/services/navigation";
import { track } from "@/analytics/matomo";
import { backToVisualiseUrl } from "@/services/evidenceMap";
import { useUrlParams } from "@/hooks/useUrlParams";
import { useHistoryState } from "@/hooks/useHistoryState";
import { useCorpusTotal } from "@/hooks/useCorpusTotal";
import { useSearch } from "@/hooks/useSearch";
import { useSearchDraft } from "@/hooks/useSearchDraft";
import {
  useSearchExport,
  type ExportStatus,
  type ExportFormat,
} from "@/hooks/useSearchExport";
import { useVocabulary } from "@/hooks/useVocabulary";
import { SearchBar } from "@/components/search/SearchBar";
import { SortDropdown } from "@/components/search/SortDropdown";
import { ExportMenu, type ExportScope } from "@/components/search/ExportMenu";
import { RefineButton } from "@/components/search/RefineButton";
import { ResultRow } from "@/components/search/ResultRow";
import { Pagination } from "@/components/common/Pagination";
import { FilterDrawer, type AppliedFilters } from "@/components/filters/FilterDrawer";
import { AiSummaryButton } from "@/components/ai-summary/AiSummaryButton";
import { useAiSummaryContext } from "@/components/ai-summary/AiSummaryProvider";
import { aiSummariesEnabled } from "@/components/ai-summary/aiSummariesEnabled";
import { SelectionHeader } from "@/components/search/SelectionHeader";
import { selectionEnabled } from "@/components/search/selectionEnabled";
import { useSelectionContext } from "@/components/search/SelectionProvider";
import { resolveSelectedReferenceIds } from "@/services/referenceSelection";
import { deriveSummaryTerms } from "@/components/ai-summary/summaryTerms";
import { formatTotal } from "@/utils/searchTotal";
import { totalSelectedCount } from "@/components/filters/conceptSchemeFilterState";
import { totalSelectedCount as totalSelectedCountryCount } from "@/components/filters/countryFilterState";
import { totalSelectedCount as totalSelectedYearCount } from "@/components/filters/yearRangeFilterState";
import { NotFoundPage } from "./NotFoundPage";
import "./SearchPage.css";

interface SearchPageProps {
  path?: string;
}

// 10k is destiny-repository's max_result_window; deep pagination + exports
// past that are explicitly out of scope. Mirrors the search backend cap.
const EXPORT_MAX_RESULTS = 10000;

// The summariser accepts at most 50 references per request (1–50).
const MAX_SUMMARY_REFERENCES = 50;

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

// `evidence-repository-<stem>-<slug>-YYYYMMDD.<ext>`. UTC so the same
// wall-clock click in different timezones produces the same filename — easier
// to diff/dedupe across users.
function formatExportFilename(
  stem: string,
  slug: string,
  ext: string,
  now: Date = new Date(),
): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `evidence-repository-${stem}-${slug}-${y}${m}${d}.${ext}`;
}

const EXPORT_FILE: Record<ExportFormat, { stem: string; ext: string }> = {
  excel: { stem: "export", ext: "xlsx" },
  ris: { stem: "references", ext: "ris" },
  "reference-list": { stem: "references", ext: "pdf" },
};

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

function formatResultsSummary(total: { count: number; is_lower_bound: boolean }) {
  // Wrapping span keeps the count + tail as one flex item so the row's gap
  // rule doesn't separate them.
  return (
    <span>
      <span class="search-results__meta-count">{formatTotal(total)}</span>
      {" results"}
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

  // Set when a map cell deep-linked here (see VisualisePage). Confined to this
  // community's visualise route so a stale state entry can't render a bad link.
  const backUrl = backToVisualiseUrl(useHistoryState());
  // Match the route exactly, then the query string — not a `startsWith` prefix,
  // which would also accept sibling routes like `/{slug}/visualise-elsewhere`.
  const visualisePath = `/${community.slug}/visualise`;
  const visualiseBackUrl =
    backUrl === visualisePath || backUrl?.startsWith(`${visualisePath}?`)
      ? backUrl
      : null;

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
  const ai = useAiSummaryContext();

  // Identity keyed on the canonical query minus page/sort, so paging/sorting
  // keeps the selection while a new community/query/filter clears it.
  const selection = useSelectionContext();
  const selectionIdentity = `${community.slug}?${toQueryString({
    ...params,
    page: 1,
    sort: undefined,
  })}`;
  const { syncSearchIdentity } = selection;
  useEffect(() => {
    syncSearchIdentity(selectionIdentity);
  }, [syncSearchIdentity, selectionIdentity]);

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
    track({ category: "Search", action: "Sort Changed", name: sortKey(sort) });
    const committed = draft.commitDraft();
    navigate(buildSearchUrl(community.slug, { ...params, ...committed, sort, page: 1 }));
  }

  const hasResults = results.results !== null && results.results.references.length > 0;

  // The AI-summary entry point. Requires a configured summariser so users never
  // see placeholder data: unset VITE_SUMMARISER_BASE ⇒ the feature stays hidden
  // (VITE_SUMMARISER_MOCK also enables it for local dev). The ai_summary.writer
  // role gates it per-user (#145).
  const { aiSummaryWriter } = useAuth();
  const aiEnabled = aiSummariesEnabled(community, aiSummaryWriter);

  // Row selection is only offered when a consumer (export or AI summary) can
  // act on it, and the community has opted in via the feature flag.
  const selectable = selectionEnabled(community, aiSummaryWriter);
  const selectionTotal = results.results?.total ?? { count: 0, is_lower_bound: false };
  const selectionCount = selection.count(selectionTotal.count);
  // Checked once everything is selected (via select-all or by ticking every row).
  const allSelected = selectionCount > 0 && selectionCount === selectionTotal.count;
  const someSelected = selectionCount > 0 && !allSelected;
  const selectionStatusLabel = allSelected
    ? `All ${formatTotal(selectionTotal)} selected`
    : `${selectionCount.toLocaleString()} selected`;
  // Any active selection clears; only an empty one selects all (Gmail-style).
  function handleToggleAll() {
    if (selectionCount > 0) selection.clear();
    else selection.selectAll();
  }

  const overCap =
    results.results !== null
    && results.results.total.is_lower_bound
    && results.results.total.count >= EXPORT_MAX_RESULTS;
  const exportBusy =
    exportJob.status === "requesting"
    || exportJob.status === "polling"
    || exportJob.status === "downloading";
  const allExportAvailable = hasResults && !overCap;
  const selectionEnumerable =
    selection.mode === "include" || !selectionTotal.is_lower_bound;
  const selectedExportAvailable =
    selectionCount > 0 && selectionCount <= EXPORT_MAX_RESULTS && selectionEnumerable;
  const capReason = `Over the ${EXPORT_MAX_RESULTS.toLocaleString()} export limit.`;
  // Only offer the scope chooser where selection is available; otherwise the
  // menu exports the whole result set, as before.
  const exportScopes = selectable && hasResults
    ? [
        {
          value: "selected" as const,
          label: `Selected (${selectionCount.toLocaleString()})`,
          available: selectedExportAvailable,
          reason: selectionCount === 0
            ? "Select references to export just those."
            : capReason,
        },
        {
          value: "all" as const,
          label: `All results (${formatTotal(selectionTotal)})`,
          available: allExportAvailable,
          reason: overCap ? capReason : undefined,
        },
      ]
    : undefined;
  const anyScopeAvailable = exportScopes
    ? exportScopes.some((s) => s.available)
    : allExportAvailable;
  // Gate on results.loading too: useSearch keeps prior results visible while
  // a new fetch is in flight, so counts would otherwise reflect the previous
  // search and let an export through against stale state.
  const exportDisabled = exportBusy || results.loading || !anyScopeAvailable;
  const exportTooltip = ((): string | undefined => {
    // Suppress while refetching: would otherwise assert a stale count.
    if (results.loading || anyScopeAvailable) return undefined;
    if (!hasResults) return "No results to export.";
    return `Refine your search — exports are limited to ${EXPORT_MAX_RESULTS.toLocaleString()} references.`;
  })();
  const exportCapNote = exportScopes
    ? `Exports are limited to ${EXPORT_MAX_RESULTS.toLocaleString()} references.`
    : undefined;
  const exportAnnouncement = exportAnnouncementFor(exportJob.status);

  function handleExport(format: ExportFormat, scope: ExportScope) {
    const { query, filters } = toUnpaginatedSearchQuery(
      params,
      community.defaultAnnotations,
    );
    const { stem, ext } = EXPORT_FILE[format];
    const filename = formatExportFilename(stem, community.slug, ext);
    const selected = scope === "selected";
    const request = selection.toRequest();
    const source = selected
      ? {
          resolveReferenceIds: (signal: AbortSignal) =>
            resolveSelectedReferenceIds(request, query, filters, signal),
        }
      : { query, filters };
    if (format === "excel") {
      exportJob.start({
        format,
        filename,
        ...source,
        vocabularyUrl: community.vocabularyUrl,
        contextUrl: community.contextUrl,
        variant: community.exportVariant,
        codingInstitution: community.codingInstitution,
        pinnedFilters: community.pinnedFilters,
      });
      return;
    }
    const fromSearch = params.q ? ` from search "${params.q}"` : "";
    const subtitle = selected
      ? `${selectionCount.toLocaleString()} selected references${fromSearch}`
      : params.q ? `Search: ${params.q}` : null;
    exportJob.start({
      format,
      filename,
      ...source,
      referenceListMeta: {
        title: "Reference list",
        subtitle,
        originUrl: buildSearchUrl(community.slug, params),
      },
    });
  }

  // Terms framing the summary: the free-text query plus any applied concept
  // filters (a map cell arrives here with those filters pre-applied).
  const aiTerms = deriveSummaryTerms(params, vocab.labels);
  const aiTotal = results.results?.total ?? { count: 0, is_lower_bound: false };
  // An active selection scopes the summary to it; otherwise the whole set.
  const summariseSelection = selectionCount > 0;
  const aiEffectiveCount = summariseSelection ? selectionCount : aiTotal.count;
  // One summary at a time: while one is parked in the background (generating or
  // unread) the button stays disabled and the indicator is the only way back.
  // The rest mirror the summariser's limits — one term minimum, 1–50 references.
  const aiDisabledReason =
    ai.status === "generating"
      ? "A summary's still processing - open it to follow along or cancel."
      : ai.minimized
        ? "Your summary's ready - open it from the indicator to read it."
        : aiTerms.length === 0
          ? "Search or filter by a term to summarise."
          : aiEffectiveCount > MAX_SUMMARY_REFERENCES
            ? summariseSelection
              ? `Your selection has ${selectionCount.toLocaleString()} references; AI summaries cover up to ${MAX_SUMMARY_REFERENCES}. Deselect some, or export instead.`
              : selectable
                ? `AI summaries cover up to ${MAX_SUMMARY_REFERENCES} references - refine your search, or select up to ${MAX_SUMMARY_REFERENCES} to summarise.`
                : `AI summaries cover up to ${MAX_SUMMARY_REFERENCES} references - please refine your search.`
            : undefined;
  // A persistent note (below the results) when a too-large selection is why the
  // button is disabled.
  const summarySelectionNote =
    aiEnabled && summariseSelection && selectionCount > MAX_SUMMARY_REFERENCES
      ? `${selectionCount.toLocaleString()} references selected — AI summaries cover up to ${MAX_SUMMARY_REFERENCES}. Narrow your selection, or export instead.`
      : null;

  function handleGenerateSummary() {
    const { query, filters } = toUnpaginatedSearchQuery(
      params,
      community.defaultAnnotations,
    );
    // Snapshot the display context now so a later search can't make it drift.
    ai.generate({
      query,
      filters,
      selection: summariseSelection ? selection.toRequest() : undefined,
      context: {
        terms: aiTerms,
        count: summariseSelection
          ? { count: selectionCount, is_lower_bound: false }
          : aiTotal,
        countNoun: community.copy.countNoun,
      },
      originUrl: buildSearchUrl(community.slug, params),
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

  // Null on a single page so the grid cell / bottom wrapper don't render empty.
  const paginationEl = results.results && totalPages > 1 ? (
    <Pagination
      currentPage={params.page}
      totalPages={totalPages}
      onPageChange={handlePageChange}
      disabled={results.loading}
    />
  ) : null;

  return (
    <div class="search-page">
      {visualiseBackUrl && (
        <a class="search-page__back" href={visualiseBackUrl}>
          <span class="search-page__back-arrow" aria-hidden="true">
            ←
          </span>
          Back to Visualise
        </a>
      )}
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

      {(showSummary || results.results) && (
        <div class="search-results__pagerow">
          <span class="search-results__count" aria-live="polite">
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
                      ? formatResultsSummary(results.results.total)
                      : null
              : null}
          </span>
          {paginationEl}
        </div>
      )}

      <section class="search-results">
        {showMetaBar && (
          <div class="search-results__meta">
            <span class="search-results__meta-left">
              {selectable && hasResults && (
                <SelectionHeader
                  checked={allSelected}
                  indeterminate={someSelected}
                  onToggle={handleToggleAll}
                  countLabel={selectionCount > 0 ? selectionStatusLabel : ""}
                />
              )}
              {selectable
                && hasResults
                && (aiEnabled || community.features.exportExcel) && (
                  <span class="search-results__meta-div" aria-hidden="true" />
                )}
              {aiEnabled && hasResults && (
                <AiSummaryButton
                  onClick={handleGenerateSummary}
                  disabled={aiDisabledReason !== undefined}
                  disabledReason={aiDisabledReason}
                />
              )}
              {results.results && exportJob.status === "error" && (
                <span class="search-results__export-status" role="alert">
                  {exportJob.errorMessage ?? "Export failed."}
                </span>
              )}
              {results.results && (
                <span class="visually-hidden" role="status" aria-live="polite">
                  {exportAnnouncement}
                </span>
              )}
              {results.results && community.features.exportExcel && (
                <ExportMenu
                  disabled={exportDisabled}
                  status={exportJob.status}
                  onExport={handleExport}
                  disabledReason={exportTooltip}
                  scopes={exportScopes}
                  capNote={exportCapNote}
                />
              )}
            </span>
            {(refine || results.results) && (
              <span class="search-results__meta-right">
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
              findingsAndEstimates={community.features.findingsAndEstimates}
              pillExcludedSchemes={community.pillExcludedSchemes}
              selectable={selectable}
              selected={selection.isSelected(ref.id)}
              onToggle={() => selection.toggle(ref.id)}
            />
          ))}
        </div>
      </section>

      {summarySelectionNote && (
        <p class="search-results__selection-note" role="status">
          {summarySelectionNote}
        </p>
      )}

      {paginationEl && (
        <div class="search-results__pager">{paginationEl}</div>
      )}

      {filterableSchemes.length > 0 && (
        <FilterDrawer
          open={drawerOpen}
          title={community.copy.drawerTitle}
          countNoun={community.copy.countNoun}
          showCountryFacetFilter={community.features.countryFacetFilter}
          pinnedFilters={community.pinnedFilters}
          defaultExpandedFilters={community.defaultExpandedFilters}
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
