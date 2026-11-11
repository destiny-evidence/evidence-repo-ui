import { useMemo } from "preact/hooks";
import type { Community } from "@/types/models";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";

// Excluded schemes stay in the vocabulary so labels and definitions still
// resolve on result rows and the record page; they're only hidden from
// filtering (and, on the evidence map, from the axis options).
export function useFilterableSchemes(
  community: Community,
  schemes: ConceptScheme[] | null,
): ConceptScheme[] {
  return useMemo(
    () =>
      (schemes ?? []).filter(
        (s) => !community.filterExcludedSchemes.includes(s.uri),
      ),
    [schemes, community.filterExcludedSchemes],
  );
}
