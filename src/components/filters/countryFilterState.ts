import { COUNTRIES, type Country } from "./countries";

declare const countryStateBrand: unique symbol;
export type CountryFilterState = ReadonlySet<string> & {
  readonly [countryStateBrand]: true;
};

function brand(set: Set<string>): CountryFilterState {
  return set as unknown as CountryFilterState;
}

export function emptyCountryState(): CountryFilterState {
  return brand(new Set());
}

export function countryStateFromCodes(
  codes: Iterable<string>,
): CountryFilterState {
  return brand(new Set(codes));
}

export function selectedCodes(state: CountryFilterState): readonly string[] {
  return Array.from(state);
}

export function isEmpty(state: CountryFilterState): boolean {
  return state.size === 0;
}

export function selectedCount(state: CountryFilterState): number {
  return state.size;
}

export function isSelected(
  state: CountryFilterState,
  code: string,
): boolean {
  return state.has(code);
}

export function summary(state: CountryFilterState): string {
  return state.size === 0 ? "" : `${state.size} selected`;
}

export function toggleCountry(
  state: CountryFilterState,
  code: string,
): CountryFilterState {
  const next = new Set(state);
  if (next.has(code)) next.delete(code);
  else next.add(code);
  return brand(next);
}

// One SearchParams.searchFacets[] entry: OR-joined `linked_data_countries:XX`
// clauses, ISO-2 codes embedded unquoted (alphanumeric → Lucene-safe).
// Emitted in COUNTRIES order so the URL form is stable across re-renders.
export function toSearchFacet(state: CountryFilterState): string {
  const clauses: string[] = [];
  for (const country of COUNTRIES) {
    if (state.has(country.code)) {
      clauses.push(`linked_data_countries:${country.code}`);
    }
  }
  return clauses.join(" OR ");
}

const FACET_CODE_RE = /linked_data_countries:([A-Za-z]{2})/g;

// Reverse of `toSearchFacet`. Codes are upper-cased on parse to match the
// backend's `.upper().strip()` normalisation, so a hand-edited URL with
// lower-case codes still selects the right rows.
export function parseFacets(
  searchFacets: readonly string[],
): CountryFilterState {
  const set = new Set<string>();
  for (const fragment of searchFacets) {
    for (const match of fragment.matchAll(FACET_CODE_RE)) {
      set.add(match[1].toUpperCase());
    }
  }
  return brand(set);
}

export function totalSelectedCount(
  searchFacets: readonly string[],
): number {
  return selectedCount(parseFacets(searchFacets));
}

// Diacritic-insensitive: typing "cote" must match "Côte d'Ivoire". Both
// sides are NFD-normalised so the decomposed accent codepoint can be
// stripped before the substring test.
function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function filterCountries(
  query: string,
  all: ReadonlyArray<Country> = COUNTRIES,
): ReadonlyArray<Country> {
  const needle = fold(query.trim());
  if (needle === "") return all;
  return all.filter((c) => fold(c.name).includes(needle));
}
