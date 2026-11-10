import type { MapCategory } from "@/analytics/events";
import type { CommunityFeatures } from "@/types/models";
import { heatMapEnabled, heatMapPath } from "@/services/geoHeatMap";

export type VisualiseKind = "evidence-map" | "heat-map";

export interface VisualiseViewInfo {
  // Also the nav's "Tab Clicked" analytics name.
  name: string;
  description: string;
  category: MapCategory;
  path: (communitySlug: string) => string;
}

export const VISUALISE_VIEWS: Record<VisualiseKind, VisualiseViewInfo> = {
  "evidence-map": {
    name: "Evidence map",
    description:
      "Compare two dimensions to see where studies cluster and where they are missing.",
    category: "EvidenceMap",
    path: (communitySlug) => `/${communitySlug}/visualise`,
  },
  "heat-map": {
    name: "Geographic heat map",
    description: "See where research took place.",
    category: "GeographicHeatMap",
    path: heatMapPath,
  },
};

// The community's views, in the order they're offered.
export function enabledViews(
  features: Pick<CommunityFeatures, "evidenceMap" | "countrySearchable">,
): VisualiseKind[] {
  const kinds: VisualiseKind[] = [];
  if (features.evidenceMap) kinds.push("evidence-map");
  if (heatMapEnabled(features)) kinds.push("heat-map");
  return kinds;
}
