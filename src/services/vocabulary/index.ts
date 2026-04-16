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

const resolverCache = new Map<string, Promise<VocabularyResolver>>();

/** Cached resolver — deduplicates concurrent requests for the same vocabulary. */
export function getVocabularyResolver(
  vocabularyUrl: string,
): Promise<VocabularyResolver> {
  let cached = resolverCache.get(vocabularyUrl);
  if (!cached) {
    cached = createVocabularyResolver(vocabularyUrl).catch((err) => {
      resolverCache.delete(vocabularyUrl);
      throw err;
    });
    resolverCache.set(vocabularyUrl, cached);
  }
  return cached;
}

/**
 * Parse enhancement data and resolve all coded concept URIs to labels.
 * Returns a map of full concept URI → human-readable label.
 */
export async function resolveEnhancementLabels(
  data: object,
  resolver: VocabularyResolver,
): Promise<Map<string, string>> {
  const conceptUris = await extractConceptUris(data);
  const resolved = new Map<string, string>();
  for (const uri of conceptUris) {
    const label = resolver.getLabel(uri);
    if (label !== undefined) {
      resolved.set(uri, label);
    }
  }
  return resolved;
}
