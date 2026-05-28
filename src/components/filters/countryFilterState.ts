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

// Sorted by code so the URL is stable across re-renders.
export function selectedCodes(state: CountryFilterState): readonly string[] {
  return Array.from(state).sort();
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
