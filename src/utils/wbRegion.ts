// IDs match destiny-repository's world_bank_regions.py; names follow the World
// Bank's "The world by income and region" classification.
export const WB_REGIONS = [
  { id: "EAS", name: "East Asia & Pacific" },
  { id: "ECS", name: "Europe & Central Asia" },
  { id: "LCN", name: "Latin America & Caribbean" },
  { id: "MEA", name: "Middle East, North Africa, Afghanistan & Pakistan" },
  { id: "NAC", name: "North America" },
  { id: "SAS", name: "South Asia" },
  { id: "SSF", name: "Sub-Saharan Africa" },
] as const;

export type WbRegionId = (typeof WB_REGIONS)[number]["id"];

const NAME_BY_ID: ReadonlyMap<string, string> = new Map(
  WB_REGIONS.map((r) => [r.id, r.name]),
);

export function isWbRegionId(value: string): value is WbRegionId {
  return NAME_BY_ID.has(value);
}

export function wbRegionName(id: string): string {
  return NAME_BY_ID.get(id) ?? id;
}
