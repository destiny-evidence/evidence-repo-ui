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
  row: string;
  column: string;
  vocabularyUrl?: string;
}

function axisToken(axis: CrossFacetAxis): string {
  return axis.kind === "literal" ? axis.token : axis.schemeUri;
}

export function axisPairToParams(
  pair: CrossFacetAxisPair,
  vocabularyUrl: string,
): CrossFacetQueryAxes {
  const axes: CrossFacetQueryAxes = {
    row: axisToken(pair.row),
    column: axisToken(pair.column),
  };
  if (pair.row.kind === "scheme" || pair.column.kind === "scheme") {
    axes.vocabularyUrl = vocabularyUrl;
  }
  return axes;
}
