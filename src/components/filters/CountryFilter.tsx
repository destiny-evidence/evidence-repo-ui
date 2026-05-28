import { useMemo, useState } from "preact/hooks";
import { MagnifierIcon } from "@/components/icons";
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
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function formatCount(n: number): string {
  return countFormatter.format(n);
}

function regionName(code: string): string {
  return regionNames.of(code) ?? code;
}

// Diacritic-insensitive: typing "cote" must match "Côte d'Ivoire". Both sides
// are NFD-normalised so the decomposed accent codepoint can be stripped before
// the substring test.
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

  // The visible list is derived from the aggregation plus any currently-
  // selected codes (so the user can un-tick a selection even if it has no
  // current matches). Pre-load (counts === null) and error states show only
  // selected codes — there's no static country universe to fall back to.
  const rows = useMemo<CountryRow[]>(() => {
    const codes = new Set<string>(state);
    if (counts != null) {
      for (const [code, count] of counts) {
        if (count > 0) codes.add(code);
      }
    }
    const list: CountryRow[] = [];
    for (const code of codes) list.push({ code, name: regionName(code) });
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
