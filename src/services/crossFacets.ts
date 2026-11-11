import type {
  EvidenceMapAxes,
  MapAxis,
  LiteralAxisToken,
} from "@/types/models";

export const AXIS_COUNTRIES = "countries" satisfies LiteralAxisToken;
export const AXIS_INCOME_GROUPS =
  "country_wb_income_groups" satisfies LiteralAxisToken;

export interface CrossFacetQueryAxes {
  axes: readonly [string, string];
  vocabularyUrl?: string;
}

// The token sent to the cross-facet endpoint, also written to / read from the
// map URL and used as an axis <select> value.
export function axisToken(axis: MapAxis): string {
  return axis.kind === "literal" ? axis.token : axis.schemeUri;
}

export function axisPairToParams(
  pair: EvidenceMapAxes,
  vocabularyUrl: string,
): CrossFacetQueryAxes {
  return {
    axes: [axisToken(pair.row), axisToken(pair.column)],
    vocabularyUrl,
  };
}
