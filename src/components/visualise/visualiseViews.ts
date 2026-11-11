import type { ComponentType } from "preact";
import type { MapCategory } from "@/analytics/events";
import type { CommunityFeatures } from "@/types/models";
import { heatMapEnabled, heatMapPath } from "@/services/geoHeatMap";
import { EvidenceMapThumbnail, HeatMapThumbnail } from "./VisualiseThumbnail";

export type VisualiseKind = "evidence-map" | "heat-map";

export interface VisualiseViewInfo {
  // Also the nav's "Tab Clicked" analytics name.
  name: string;
  description: string;
  category: MapCategory;
  path: (communitySlug: string) => string;
  Thumbnail: ComponentType;
}

export const VISUALISE_VIEWS: Record<VisualiseKind, VisualiseViewInfo> = {
  "evidence-map": {
    name: "Evidence map",
    description:
      "Compare two dimensions to see where studies cluster and where they are missing.",
    category: "EvidenceMap",
    path: (communitySlug) => `/${communitySlug}/visualise`,
    Thumbnail: EvidenceMapThumbnail,
  },
  "heat-map": {
    name: "Geographic heat map",
    description: "See where research took place.",
    category: "GeographicHeatMap",
    path: heatMapPath,
    Thumbnail: HeatMapThumbnail,
  },
};

// The community's views, in the order they're offered. Every community has the
// evidence map.
export function enabledViews(
  features: Pick<CommunityFeatures, "countrySearchable">,
): VisualiseKind[] {
  return heatMapEnabled(features) ? ["evidence-map", "heat-map"] : ["evidence-map"];
}
