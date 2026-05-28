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

// COUNTRIES-order, not insertion-order — keeps the URL stable across renders.
export function selectedCodes(state: CountryFilterState): readonly string[] {
  const codes: string[] = [];
  for (const country of COUNTRIES) {
    if (state.has(country.code)) codes.push(country.code);
  }
  return codes;
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

export function totalSelectedCount(codes: readonly string[]): number {
  return codes.length;
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
