export interface SearchParams {
  q: string;
  page: number;
  startYear: number | undefined;
  endYear: number | undefined;
}

// Strict: plain decimal digits only. Rejects "1e3", "0x10", "2.5", "-5", etc.
// Anything JS's Number() accepts-but-surprises gets dropped instead of canonicalized.
// Also rejects values that overflow Number.MAX_SAFE_INTEGER (e.g. 100 nines)
// so callers never receive Infinity.
function parseDecimalInt(raw: string | null): number | undefined {
  if (raw === null || !/^\d+$/.test(raw)) return undefined;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : undefined;
}

export function parseSearchParams(search: string): SearchParams {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );

  const q = (params.get("q") ?? "").trim();

  const pageRaw = parseDecimalInt(params.get("page"));
  const page = pageRaw !== undefined && pageRaw >= 1 ? pageRaw : 1;

  // Years must be positive integers — 0 is invalid (matches SearchBar's year > 0 rule).
  let startYear = parseDecimalInt(params.get("start_year"));
  let endYear = parseDecimalInt(params.get("end_year"));
  if (startYear === 0) startYear = undefined;
  if (endYear === 0) endYear = undefined;
  if (startYear !== undefined && endYear !== undefined && startYear > endYear) {
    startYear = undefined;
    endYear = undefined;
  }

  return { q, page, startYear, endYear };
}

export function toQueryString(params: SearchParams): string {
  const out = new URLSearchParams();
  if (params.q) out.set("q", params.q);
  if (params.startYear !== undefined) out.set("start_year", String(params.startYear));
  if (params.endYear !== undefined) out.set("end_year", String(params.endYear));
  if (params.page !== 1) out.set("page", String(params.page));
  return out.toString();
}

export function buildSearchUrl(communitySlug: string, params: SearchParams): string {
  const qs = toQueryString(params);
  return qs ? `/${communitySlug}?${qs}` : `/${communitySlug}`;
}
