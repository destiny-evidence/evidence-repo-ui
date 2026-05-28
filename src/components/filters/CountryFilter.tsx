import { useMemo, useState } from "preact/hooks";
import { MagnifierIcon } from "@/components/icons";
import {
  filterCountries,
  isSelected,
  toggleCountry,
  type CountryFilterState,
} from "./countryFilterState";
import { COUNTRIES, type Country } from "./countries";
import "./CountryFilter.css";

interface CountryFilterProps {
  state: CountryFilterState;
  counts?: ReadonlyMap<string, number> | null;
  countsLoading?: boolean;
  onChange: (next: CountryFilterState) => void;
}

const countFormatter = new Intl.NumberFormat();

function formatCount(n: number): string {
  return countFormatter.format(n);
}

export function CountryFilter({
  state,
  counts = null,
  countsLoading = false,
  onChange,
}: CountryFilterProps) {
  const [query, setQuery] = useState("");
  // Once counts have loaded, hide 0-count rows but keep selected ones so the
  // user can un-tick them.
  const inAggregation = useMemo<(c: Country) => boolean>(() => {
    if (counts == null) return () => true;
    return (c) => isSelected(state, c.code) || (counts.get(c.code) ?? 0) > 0;
  }, [counts, state]);
  const visible = useMemo(
    () => filterCountries(query, COUNTRIES).filter(inAggregation),
    [query, inAggregation],
  );

  return (
    <div class="country-filter">
      <div class="country-filter__search">
        <span class="country-filter__search-icon" aria-hidden="true">
          <MagnifierIcon />
        </span>
        <input
          class="country-filter__search-input"
          type="search"
          aria-label="Search country"
          placeholder="Search country…"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
      </div>
      <ul class="country-filter__list">
        {visible.map((country) => {
          const rawCount = counts?.get(country.code);
          const count = rawCount ?? (counts != null ? 0 : undefined);
          const selected = isSelected(state, country.code);
          const showCountBadge = count !== undefined && count > 0;
          const countClass = `country-filter__count${
            countsLoading ? " is-updating" : ""
          }`;
          return (
            <li key={country.code} class="country-filter__item">
              <label class="country-filter__row">
                <input
                  class="country-filter__checkbox"
                  type="checkbox"
                  checked={selected}
                  onChange={() => onChange(toggleCountry(state, country.code))}
                />
                <span class="country-filter__label">{country.name}</span>
                {showCountBadge && (
                  <span
                    class={countClass}
                    aria-label={`${formatCount(count)} investigations`}
                  >
                    {formatCount(count)}
                  </span>
                )}
              </label>
            </li>
          );
        })}
        {visible.length === 0 && (
          <li class="country-filter__empty">
            {query.trim() === ""
              ? "No countries match the current filters."
              : `No references for “${query.trim()}”.`}
          </li>
        )}
      </ul>
    </div>
  );
}
