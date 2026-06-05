import { FilterCard } from "./FilterCard";
import { ConceptSchemeFilter } from "./ConceptSchemeFilter";
import { CountryFilter } from "./CountryFilter";
import { YearRangeFilter } from "./YearRangeFilter";
import { summary } from "./conceptSchemeFilterState";
import { summary as countrySummary } from "./countryFilterState";
import { summary as yearSummary } from "./yearRangeFilterState";
import { schemeDisplayLabel } from "@/services/vocabulary/vocabularyService";
import type { FilterDraft } from "./useFilterDraft";
import "./FilterCardList.css";

interface FilterCardListProps {
  draft: FilterDraft;
  countNoun?: string;
}

/**
 * The stack of filter cards (publication year, country, one per concept scheme)
 * driven by a {@link FilterDraft}. Shared by the search drawer and the
 * evidence-map config panel so both render filters identically.
 */
export function FilterCardList({
  draft,
  countNoun = "results",
}: FilterCardListProps) {
  return (
    <>
      {draft.facetError && (
        <div class="filter-card-list__notice" role="status">
          Filter counts unavailable.
        </div>
      )}
      <FilterCard
        title="Publication year"
        summary={yearSummary(draft.yearDraft)}
        defaultExpanded
      >
        <YearRangeFilter state={draft.yearDraft} onChange={draft.setYearDraft} />
      </FilterCard>
      <FilterCard
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
      {draft.schemes.map((scheme) => {
        const state = draft.conceptStateFor(scheme);
        return (
          <FilterCard
            key={scheme.uri}
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
      })}
    </>
  );
}
