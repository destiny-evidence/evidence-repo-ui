import { useMemo, useState } from "preact/hooks";
import { MagnifierIcon } from "@/components/icons";
import { countryName } from "@/utils/country";
import {
  isSelected,
  toggleCountry,
  type CountryFilterState,
} from "./countryFilterState";
import "./CountryFilter.css";

interface CountryFilterProps {
  state: CountryFilterState;
  counts?: ReadonlyMap<string, number> | null;
  countsLoading?: boolean;
  onChange: (next: CountryFilterState) => void;
}

interface CountryRow {
  code: string;
  name: string;
}

const countFormatter = new Intl.NumberFormat();

function formatCount(n: number): string {
  return countFormatter.format(n);
}

// Diacritic-insensitive: typing "cote" matches "Côte d'Ivoire".
function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function CountryFilter({
  state,
  counts = null,
  countsLoading = false,
  onChange,
}: CountryFilterProps) {
  const [query, setQuery] = useState("");

  // Selected codes are always included so the user can un-tick a no-results
  // pick; otherwise we list only codes with non-zero counts.
  const rows = useMemo<CountryRow[]>(() => {
    const codes = new Set<string>(state);
    if (counts != null) {
      for (const [code, count] of counts) {
        if (count > 0) codes.add(code);
      }
    }
    const list: CountryRow[] = [];
    for (const code of codes) list.push({ code, name: countryName(code) });
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [counts, state]);

  const visible = useMemo(() => {
    const needle = fold(query.trim());
    if (needle === "") return rows;
    return rows.filter((r) => fold(r.name).includes(needle));
  }, [rows, query]);

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
          const count = counts?.get(country.code);
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
            {countsLoading
              ? "Loading countries…"
              : query.trim() === ""
                ? "No countries match the current filters."
                : `No references for “${query.trim()}”.`}
          </li>
        )}
      </ul>
    </div>
  );
}
