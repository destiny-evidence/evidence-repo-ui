export interface ContextPrefixes {
  prefixes: Map<string, string>;
}

/**
 * Extract prefix mappings from a JSON-LD context document.
 * String-valued entries are prefix mappings; object-valued entries
 * (property definitions) and @-prefixed keys are skipped.
 */
function extractPrefixes(doc: Record<string, unknown>): Map<string, string> {
  const ctx = doc["@context"];
  if (typeof ctx !== "object" || ctx === null) return new Map();

  const prefixes = new Map<string, string>();
  for (const [key, value] of Object.entries(ctx as Record<string, unknown>)) {
    if (typeof value === "string" && !key.startsWith("@")) {
      prefixes.set(key, value);
    }
  }
  return prefixes;
}

/**
 * Fetch a JSON-LD context document and extract prefix mappings.
 */
import { proxyVocabUrl } from "@/config";

export async function fetchContext(
  contextUrl: string,
): Promise<ContextPrefixes> {
  const response = await fetch(proxyVocabUrl(contextUrl));
  if (!response.ok) {
    throw new Error(
      `Failed to fetch context: ${response.status} ${contextUrl}`,
    );
  }
  const doc = await response.json();
  return { prefixes: extractPrefixes(doc) };
}

const contextCache = new Map<string, Promise<ContextPrefixes>>();

/** @internal Clear the context cache. Exported for testing only. */
export function _resetContextCache(): void {
  contextCache.clear();
}

/** Cached context fetch — deduplicates concurrent requests. */
export function getCachedContext(
  contextUrl: string,
): Promise<ContextPrefixes> {
  let cached = contextCache.get(contextUrl);
  if (!cached) {
    cached = fetchContext(contextUrl).catch((err) => {
      contextCache.delete(contextUrl);
      throw err;
    });
    contextCache.set(contextUrl, cached);
  }
  return cached;
}

/**
 * Expand a compact URI (e.g. "esea:DocumentTypeScheme/C00008") using prefix
 * mappings. Returns the input unchanged if no prefix matches.
 */
export function expandCompactUri(
  compactUri: string,
  prefixes: Map<string, string>,
): string {
  const colonIdx = compactUri.indexOf(":");
  if (colonIdx === -1) return compactUri;

  const prefix = compactUri.slice(0, colonIdx);
  const local = compactUri.slice(colonIdx + 1);
  const base = prefixes.get(prefix);
  if (base) return base + local;

  return compactUri;
}
