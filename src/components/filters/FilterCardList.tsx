import { FilterCard } from "./FilterCard";
import { ConceptSchemeFilter } from "./ConceptSchemeFilter";
import { CountryFilter } from "./CountryFilter";
import { FixedListFilter } from "./FixedListFilter";
import { YearRangeFilter } from "./YearRangeFilter";
import { summary } from "./conceptSchemeFilterState";
import { summary as countrySummary } from "./countryFilterState";
import { summary as yearSummary } from "./yearRangeFilterState";
import {
  orderFilterItems,
  type FacetCardOptions,
  type FilterItem,
} from "./filterOrder";
import {
  schemeDisplayLabel,
  type ConceptScheme,
} from "@/services/vocabulary/vocabularyService";
import type { PinnedFilter } from "@/types/models";
import { WB_INCOME_GROUPS } from "@/utils/wbIncomeGroup";
import type { FilterDraft } from "./useFilterDraft";
import "./FilterCardList.css";

// Presentation options for the card stack, passed through by its host.
export interface FilterCardOptions extends FacetCardOptions {
  countNoun?: string;
  // Filter cards pinned to the top; absent ⇒ DEFAULT_PINNED_FILTERS.
  pinnedFilters?: readonly PinnedFilter[];
  // Filter cards that expand on mount
  expandOnMountFilters?: readonly PinnedFilter[];
  // Collapse concept-filter children behind their parents; only for
  // communities with ancestor-closed codings.
  collapsibleConceptFilters?: boolean;
}

interface FilterCardListProps extends FilterCardOptions {
  draft: FilterDraft;
}

/**
 * The stack of filter cards (publication year, country, World Bank income
 * group, one per concept scheme)
 * driven by a {@link FilterDraft}. Shared by the search drawer and the
 * evidence-map config panel so both render filters identically. Pinned cards
 * lead; the remaining schemes follow alphabetically.
 */
export function FilterCardList({
  draft,
  countNoun = "results",
  showCountryFacetFilter,
  pinnedFilters,
  expandOnMountFilters = [],
  collapsibleConceptFilters = false,
}: FilterCardListProps) {
  const items = orderFilterItems(draft.schemes ?? [], {
    pinned: pinnedFilters,
    showCountryFacetFilter,
  });
  const expanded = new Set(expandOnMountFilters);

  return (
    <>
      {draft.schemes === null && (
        <div class="filter-card-list__notice" role="alert">
          Concept filters couldn't be loaded. Those already applied stay in
          place.
        </div>
      )}
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
          expandOnMount={expanded.has("year")}
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
          expandOnMount={expanded.has("country")}
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
    case "wbIncomeGroup":
      return (
        <FilterCard
          key="wbIncomeGroup"
          title="World Bank income group"
          summary={selectionSummary(draft.wbIncomeGroupDraft)}
          expandOnMount={expanded.has("wbIncomeGroup")}
        >
          <FixedListFilter
            options={WB_INCOME_GROUPS}
            selected={draft.wbIncomeGroupDraft}
            counts={draft.facetCounts?.wbIncomeGroups ?? null}
            countsLoading={draft.facetCountsLoading}
            countNoun={countNoun}
            onChange={draft.setWbIncomeGroupDraft}
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
          expandOnMount={expanded.has(item.scheme.uri)}
          collapsible={collapsibleConceptFilters}
        />
      );
  }
}

function selectionSummary(selected: ReadonlySet<string>): string {
  return selected.size === 0 ? "" : `${selected.size} selected`;
}

function SchemeCard({
  scheme,
  draft,
  countNoun,
  expandOnMount,
  collapsible,
}: {
  scheme: ConceptScheme;
  draft: FilterDraft;
  countNoun: string;
  expandOnMount: boolean;
  collapsible: boolean;
}) {
  const state = draft.conceptStateFor(scheme);
  return (
    <FilterCard
      title={schemeDisplayLabel(scheme.label)}
      summary={summary(state)}
      expandOnMount={expandOnMount}
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
