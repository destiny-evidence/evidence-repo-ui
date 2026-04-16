import type { VocabularyResolver } from "./types";
import { getCachedVocabulary } from "./vocabularyService";
import { extractConceptUris } from "./enhancementParser";

export type { VocabularyResolver } from "./types";
export { extractConceptUris } from "./enhancementParser";

/** Create a VocabularyResolver backed by a fetched vocabulary. */
export async function createVocabularyResolver(
  vocabularyUrl: string,
): Promise<VocabularyResolver> {
  const labels = await getCachedVocabulary(vocabularyUrl);
  return {
    getLabel(fullUri: string): string | undefined {
      return labels.get(fullUri);
    },
  };
}

/** Cached resolver — deduplication is handled by getCachedVocabulary. */
export function getVocabularyResolver(
  vocabularyUrl: string,
): Promise<VocabularyResolver> {
  return createVocabularyResolver(vocabularyUrl);
}

/**
 * Parse enhancement data and resolve all coded concept URIs to labels.
 * Returns a map of concept URI → human-readable label.
 */
export function resolveEnhancementLabels(
  data: object,
  resolver: VocabularyResolver,
): Map<string, string> {
  const conceptUris = extractConceptUris(data);
  const resolved = new Map<string, string>();
  for (const uri of conceptUris) {
    const label = resolver.getLabel(uri);
    if (label !== undefined) {
      resolved.set(uri, label);
    }
  }
  return resolved;
}
