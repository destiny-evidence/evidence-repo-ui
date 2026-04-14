/** Vocabulary label resolver — the public interface for consumers. */
export interface VocabularyResolver {
  /** Look up the prefLabel for a full concept URI. */
  getLabel(fullUri: string): string | undefined;
}
