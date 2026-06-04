export const AXIS_COUNTRIES = "countries";
export const AXIS_REGIONS = "country_wb_regions";

export type LiteralAxisToken = typeof AXIS_COUNTRIES | typeof AXIS_REGIONS;

export type CrossFacetAxis =
  | { kind: "literal"; token: LiteralAxisToken }
  | { kind: "scheme"; schemeUri: string };

export interface CrossFacetAxisPair {
  row: CrossFacetAxis;
  column: CrossFacetAxis;
}

export interface CrossFacetQueryAxes {
  axes: [string, string];
  vocabularyUrl?: string;
}

function axisToken(axis: CrossFacetAxis): string {
  return axis.kind === "literal" ? axis.token : axis.schemeUri;
}

export function axisPairToParams(
  pair: CrossFacetAxisPair,
  vocabularyUrl: string,
): CrossFacetQueryAxes {
  const result: CrossFacetQueryAxes = {
    axes: [axisToken(pair.row), axisToken(pair.column)],
  };
  if (pair.row.kind === "scheme" || pair.column.kind === "scheme") {
    result.vocabularyUrl = vocabularyUrl;
  }
  return result;
}
