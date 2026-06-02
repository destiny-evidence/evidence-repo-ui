import type {
  CodingInstitutionConfig,
  Enhancement,
  OtherEnhancement,
  Reference,
} from "@/types/models";
import { extractLatestEnhancement } from "@/services/referenceUtils";

// Derives the coder label by matching tokens (first match wins) in a
// reference's raw-enhancement `source`. Patterns use non-letter boundaries
// because real values are convoluted, e.g. "ad_hoc_ingestors.iiie_ingestor@1.0".
export function rawSourcePatterns(
  patterns: ReadonlyArray<readonly [RegExp, string]>,
): CodingInstitutionConfig {
  function resolve(source: string | null | undefined): string | null {
    if (!source) return null;
    const lower = source.toLowerCase();
    for (const [pattern, label] of patterns) {
      if (pattern.test(lower)) return label;
    }
    return null;
  }

  return {
    // Temporary: roll back once references are deduplicated.
    fromReference(reference: Reference): string | null {
      const raw = extractLatestEnhancement<OtherEnhancement>(reference, "raw");
      return resolve(raw?.source);
    },

    fromLinkedData(reference: Reference, lde: Enhancement): string | null {
      if (!lde.derived_from?.length) return null;
      if (!reference.enhancements) return null;
      const derivedIds = new Set(lde.derived_from);
      const raw = reference.enhancements.find(
        (e) =>
          e.content.enhancement_type === "raw" &&
          e.id !== null &&
          derivedIds.has(e.id),
      );
      return resolve(raw?.source);
    },
  };
}
