import type { Community } from "@/types/models";
import { aiSummariesEnabled } from "@/components/ai-summary/aiSummariesEnabled";

export function selectionEnabled(
  community: Community | null,
  aiSummaryWriter: boolean,
): boolean {
  if (!community?.features.referenceSelection) return false;

  // Without a consumer, selecting references is a dead end,
  // so the whole layer stays hidden.
  return (
    community.features.exportExcel ||
    aiSummariesEnabled(community, aiSummaryWriter)
  );
}
