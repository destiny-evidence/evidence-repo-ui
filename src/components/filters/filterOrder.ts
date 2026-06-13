import type { FilterSlot } from "@/types/models";
import {
  schemeDisplayLabel,
  type ConceptScheme,
} from "@/services/vocabulary/vocabularyService";

export type { FilterSlot };

// One filter card, in render order: the two built-in cards plus one per scheme.
export type FilterItem =
  | { kind: "year" }
  | { kind: "country" }
  | { kind: "scheme"; scheme: ConceptScheme };

// Year first, then the country facet, then every scheme alphabetically.
export const DEFAULT_FILTER_ORDER: readonly FilterSlot[] = [
  "year",
  "country",
  "otherSchemes",
];

interface OrderFilterItemsOptions {
  order?: readonly FilterSlot[];
  // Scheme URIs grouped by the "geographicSchemes" slot, in this order.
  geographicSchemes?: readonly string[];
  // When false the "country" slot renders nothing (facet unavailable).
  showCountryFacetFilter?: boolean;
}

/**
 * Resolve a community's {@link FilterSlot} order into the concrete list of
 * filter cards to render (#149). Each scheme appears exactly once: a slot naming
 * its URI, or the "geographicSchemes"/"otherSchemes" group that claims it first,
 * wins. A trailing "otherSchemes" sweep is always applied so no scheme is
 * silently dropped, even if the configured order omits it.
 */
export function orderFilterItems(
  schemes: readonly ConceptScheme[],
  {
    order = DEFAULT_FILTER_ORDER,
    geographicSchemes = [],
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

  const slots = order.includes("otherSchemes")
    ? order
    : [...order, "otherSchemes"];

  for (const slot of slots) {
    switch (slot) {
      case "year":
        items.push({ kind: "year" });
        break;
      case "country":
        if (showCountryFacetFilter) items.push({ kind: "country" });
        break;
      case "geographicSchemes":
        for (const uri of geographicSchemes) pushScheme(uri);
        break;
      case "otherSchemes":
        for (const scheme of schemes
          .filter((s) => !placed.has(s.uri))
          .sort((a, b) =>
            schemeDisplayLabel(a.label).localeCompare(
              schemeDisplayLabel(b.label),
            ),
          )) {
          pushScheme(scheme.uri);
        }
        break;
      default:
        pushScheme(slot);
    }
  }

  return items;
}
