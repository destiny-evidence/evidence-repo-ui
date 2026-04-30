import type { Enhancement, OtherEnhancement, Reference } from "@/types/models";
import { extractLatestEnhancement } from "@/services/referenceUtils";

// Substring match: real source values are more convoluted (e.g. "esea-coder-v3").
const INSTITUTION_PATTERNS: ReadonlyArray<readonly [string, string]> = [
  ["eef", "EEF"],
  ["iiie", "IIIE"],
  ["essa", "ESSA"],
  ["wwhge", "WWHGE"],
];

export function resolveCodingInstitution(
  source: string | null | undefined,
): string | null {
  if (!source) return null;
  const lower = source.toLowerCase();
  for (const [pattern, label] of INSTITUTION_PATTERNS) {
    if (lower.includes(pattern)) return label;
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
