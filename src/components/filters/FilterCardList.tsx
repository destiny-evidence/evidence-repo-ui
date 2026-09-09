import { FilterCard } from "./FilterCard";
import { ConceptSchemeFilter } from "./ConceptSchemeFilter";
import { CountryFilter } from "./CountryFilter";
import { YearRangeFilter } from "./YearRangeFilter";
import { summary } from "./conceptSchemeFilterState";
import { summary as countrySummary } from "./countryFilterState";
import { summary as yearSummary } from "./yearRangeFilterState";
import {
  DEFAULT_EXPANDED_FILTERS,
  orderFilterItems,
  type FilterItem,
} from "./filterOrder";
import {
  schemeDisplayLabel,
  type ConceptScheme,
} from "@/services/vocabulary/vocabularyService";
import type { PinnedFilter } from "@/types/models";
import type { FilterDraft } from "./useFilterDraft";
import "./FilterCardList.css";

interface FilterCardListProps {
  draft: FilterDraft;
  countNoun?: string;
  // Show the facet-backed country card; off where the `countries` facet is empty.
  showCountryFacetFilter?: boolean;
  // Filter cards pinned to the top; absent ⇒ DEFAULT_PINNED_FILTERS.
  pinnedFilters?: readonly PinnedFilter[];
  // Filter cards that start expanded; absent ⇒ DEFAULT_EXPANDED_FILTERS.
  defaultExpandedFilters?: readonly PinnedFilter[];
  // Collapse concept-filter children behind their parents; only for
  // communities with ancestor-closed codings.
  collapsibleConceptFilters?: boolean;
}

/**
 * The stack of filter cards (publication year, country, one per concept scheme)
 * driven by a {@link FilterDraft}. Shared by the search drawer and the
 * evidence-map config panel so both render filters identically. Pinned cards
 * lead; the remaining schemes follow alphabetically.
 */
export function FilterCardList({
  draft,
  countNoun = "results",
  showCountryFacetFilter = true,
  pinnedFilters,
  defaultExpandedFilters = DEFAULT_EXPANDED_FILTERS,
  collapsibleConceptFilters = false,
}: FilterCardListProps) {
  const items = orderFilterItems(draft.schemes, {
    pinned: pinnedFilters,
    showCountryFacetFilter,
  });
  const expanded = new Set(defaultExpandedFilters);

  return (
    <>
      {draft.facetError && (
        <div class="filter-card-list__notice" role="status">
          Filter counts unavailable.
        </div>
      )}
      {items.map((item) =>
        renderItem(item, draft, countNoun, expanded, collapsibleConceptFilters),
      )}
    </>
  );
}

function renderItem(
  item: FilterItem,
  draft: FilterDraft,
  countNoun: string,
  expanded: ReadonlySet<string>,
  collapsibleConceptFilters: boolean,
) {
  switch (item.kind) {
    case "year":
      return (
        <FilterCard
          key="year"
          title="Publication year"
          summary={yearSummary(draft.yearDraft)}
          defaultExpanded={expanded.has("year")}
        >
          <YearRangeFilter
            state={draft.yearDraft}
            onChange={draft.setYearDraft}
          />
        </FilterCard>
      );
    case "country":
      return (
        <FilterCard
          key="country"
          title="Country"
          summary={countrySummary(draft.countryDraft)}
          defaultExpanded={expanded.has("country")}
        >
          <CountryFilter
            state={draft.countryDraft}
            counts={draft.facetCounts?.countries ?? null}
            countsLoading={draft.facetCountsLoading}
            countNoun={countNoun}
            onChange={draft.setCountryDraft}
          />
        </FilterCard>
      );
    case "scheme":
      return (
        <SchemeCard
          key={item.scheme.uri}
          scheme={item.scheme}
          draft={draft}
          countNoun={countNoun}
          defaultExpanded={expanded.has(item.scheme.uri)}
          collapsible={collapsibleConceptFilters}
        />
      );
  }
}

function SchemeCard({
  scheme,
  draft,
  countNoun,
  defaultExpanded,
  collapsible,
}: {
  scheme: ConceptScheme;
  draft: FilterDraft;
  countNoun: string;
  defaultExpanded: boolean;
  collapsible: boolean;
}) {
  const state = draft.conceptStateFor(scheme);
  return (
    <FilterCard
      title={schemeDisplayLabel(scheme.label)}
      summary={summary(state)}
      defaultExpanded={defaultExpanded}
    >
      <ConceptSchemeFilter
        scheme={scheme}
        state={state}
        counts={draft.facetCounts?.concepts ?? null}
        countsLoading={draft.facetCountsLoading}
        countNoun={countNoun}
        collapsible={collapsible}
        onChange={(next) => draft.onSchemeChange(scheme, next)}
      />
    </FilterCard>
  );
}
