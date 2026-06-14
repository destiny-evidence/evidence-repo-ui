import { FilterCard } from "./FilterCard";
import { ConceptSchemeFilter } from "./ConceptSchemeFilter";
import { CountryFilter } from "./CountryFilter";
import { YearRangeFilter } from "./YearRangeFilter";
import { summary } from "./conceptSchemeFilterState";
import { summary as countrySummary } from "./countryFilterState";
import { summary as yearSummary } from "./yearRangeFilterState";
import { orderFilterItems, type FilterItem } from "./filterOrder";
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
}: FilterCardListProps) {
  const items = orderFilterItems(draft.schemes, {
    pinned: pinnedFilters,
    showCountryFacetFilter,
  });

  return (
    <>
      {draft.facetError && (
        <div class="filter-card-list__notice" role="status">
          Filter counts unavailable.
        </div>
      )}
      {items.map((item) => renderItem(item, draft, countNoun))}
    </>
  );
}

function renderItem(item: FilterItem, draft: FilterDraft, countNoun: string) {
  switch (item.kind) {
    case "year":
      return (
        <FilterCard
          key="year"
          title="Publication year"
          summary={yearSummary(draft.yearDraft)}
          defaultExpanded
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
          defaultExpanded
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
        />
      );
  }
}

function SchemeCard({
  scheme,
  draft,
  countNoun,
}: {
  scheme: ConceptScheme;
  draft: FilterDraft;
  countNoun: string;
}) {
  const state = draft.conceptStateFor(scheme);
  return (
    <FilterCard
      title={schemeDisplayLabel(scheme.label)}
      summary={summary(state)}
    >
      <ConceptSchemeFilter
        scheme={scheme}
        state={state}
        counts={draft.facetCounts?.concepts ?? null}
        countsLoading={draft.facetCountsLoading}
        countNoun={countNoun}
        onChange={(next) => draft.onSchemeChange(scheme, next)}
      />
    </FilterCard>
  );
}
