// IDs match destiny-repository's world_bank_income_groups.py; names follow the
// World Bank's "The world by income and region" classification.
export const WB_INCOME_GROUPS = [
  { id: "HIC", name: "High income" },
  { id: "UMC", name: "Upper middle income" },
  { id: "LMC", name: "Lower middle income" },
  { id: "LIC", name: "Low income" },
] as const;

export type WbIncomeGroupId = (typeof WB_INCOME_GROUPS)[number]["id"];

const NAME_BY_ID: ReadonlyMap<string, string> = new Map(
  WB_INCOME_GROUPS.map((g) => [g.id, g.name]),
);

export function isWbIncomeGroupId(value: string): value is WbIncomeGroupId {
  return NAME_BY_ID.has(value);
}

export function wbIncomeGroupName(id: string): string {
  return NAME_BY_ID.get(id) ?? id;
}
