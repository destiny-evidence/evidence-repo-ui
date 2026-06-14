import type { PinnedFilter } from "@/types/models";
import {
  compareLabels,
  schemeDisplayLabel,
  type ConceptScheme,
} from "@/services/vocabulary/vocabularyService";

// One filter card, in render order: the two built-in cards plus one per scheme.
export type FilterItem =
  | { kind: "year" }
  | { kind: "country" }
  | { kind: "scheme"; scheme: ConceptScheme };

// Year, then the country facet. Every scheme follows alphabetically.
export const DEFAULT_PINNED_FILTERS: readonly PinnedFilter[] = ["year", "country"];

interface OrderFilterItemsOptions {
  pinned?: readonly PinnedFilter[];
  // When false the "country" slot renders nothing (facet unavailable).
  showCountryFacetFilter?: boolean;
}

/**
 * Resolve the filter cards to render: the pinned cards in order, then every
 * scheme not already pinned, alphabetized by display label. A scheme pinned by
 * URI is shown once and skipped by the trailing sweep.
 */
export function orderFilterItems(
  schemes: readonly ConceptScheme[],
  {
    pinned = DEFAULT_PINNED_FILTERS,
    showCountryFacetFilter = true,
  }: OrderFilterItemsOptions = {},
): FilterItem[] {
  const byUri = new Map(schemes.map((s) => [s.uri, s]));
  const placed = new Set<string>();
  const items: FilterItem[] = [];

  const pushScheme = (uri: string) => {
    const scheme = byUri.get(uri);
    if (scheme && !placed.has(uri)) {
      placed.add(uri);
      items.push({ kind: "scheme", scheme });
    }
  };

  // Built-in slots dedup on their kind so a config that repeats "year"/"country"
  // can't emit two cards (and a duplicate React key).
  for (const slot of pinned) {
    if (slot === "year") {
      if (!placed.has("year")) {
        placed.add("year");
        items.push({ kind: "year" });
      }
    } else if (slot === "country") {
      if (showCountryFacetFilter && !placed.has("country")) {
        placed.add("country");
        items.push({ kind: "country" });
      }
    } else pushScheme(slot);
  }

  const rest = schemes
    .filter((s) => !placed.has(s.uri))
    .sort((a, b) =>
      compareLabels(
        { label: schemeDisplayLabel(a.label), uri: a.uri },
        { label: schemeDisplayLabel(b.label), uri: b.uri },
      ),
    );
  for (const scheme of rest) pushScheme(scheme.uri);

  return items;
}
