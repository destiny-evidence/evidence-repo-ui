// Strict year parser shared between SearchBar (form input) and parseSearchParams
// (URL string). Both consumers want the same shape: trim, decimal digits only,
// safe integer, positive. Rejects "2e3", "0x10", "2.5", "-5", "0", whitespace-only,
// and anything past Number.MAX_SAFE_INTEGER.
export function parseYear(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}
