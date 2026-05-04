import type { Enhancement, OtherEnhancement, Reference } from "@/types/models";
import { extractLatestEnhancement } from "@/services/referenceUtils";

// Match institution tokens with non-letter boundaries: real source values are
// more convoluted (e.g. "eef-eppi-review", "ad_hoc_ingestors.iiie_ingestor@1.0").
const INSTITUTION_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/(^|[^a-z])eef([^a-z]|$)/, "EEF"],
  [/(^|[^a-z])iiie([^a-z]|$)/, "IIIE"],
  [/(^|[^a-z])essa([^a-z]|$)/, "ESSA"],
  [/(^|[^a-z])wwhge([^a-z]|$)/, "WWHGE"],
];

export function resolveCodingInstitution(
  source: string | null | undefined,
): string | null {
  if (!source) return null;
  const lower = source.toLowerCase();
  for (const [pattern, label] of INSTITUTION_PATTERNS) {
    if (pattern.test(lower)) return label;
  }
  return null;
}

// Temporary: roll back once references are deduplicated.
export function extractReferenceCodingInstitution(
  reference: Reference,
): string | null {
  const raw = extractLatestEnhancement<OtherEnhancement>(reference, "raw");
  return resolveCodingInstitution(raw?.source);
}

export function extractLinkedDataCodingInstitution(
  reference: Reference,
  lde: Enhancement,
): string | null {
  if (!lde.derived_from?.length) return null;
  if (!reference.enhancements) return null;
  const derivedIds = new Set(lde.derived_from);
  const raw = reference.enhancements.find(
    (e) =>
      e.content.enhancement_type === "raw" &&
      e.id !== null &&
      derivedIds.has(e.id),
  );
  return resolveCodingInstitution(raw?.source);
}
