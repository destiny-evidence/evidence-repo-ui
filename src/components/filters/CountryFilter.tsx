import { useMemo, useState } from "preact/hooks";
import { MagnifierIcon } from "@/components/icons";
import {
  filterCountries,
  isSelected,
  toggleCountry,
  type CountryFilterState,
} from "./countryFilterState";
import { COUNTRIES } from "./countries";
import "./CountryFilter.css";

interface CountryFilterProps {
  state: CountryFilterState;
  onChange: (next: CountryFilterState) => void;
}

export function CountryFilter({ state, onChange }: CountryFilterProps) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => filterCountries(query, COUNTRIES), [query]);

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
        {visible.map((country) => (
          <li key={country.code} class="country-filter__item">
            <label class="country-filter__row">
              <input
                class="country-filter__checkbox"
                type="checkbox"
                checked={isSelected(state, country.code)}
                onChange={() => onChange(toggleCountry(state, country.code))}
              />
              <span class="country-filter__label">{country.name}</span>
            </label>
          </li>
        ))}
        {visible.length === 0 && (
          <li class="country-filter__empty">No countries match.</li>
        )}
      </ul>
    </div>
  );
}
