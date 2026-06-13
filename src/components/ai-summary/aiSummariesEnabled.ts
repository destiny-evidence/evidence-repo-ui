import { SUMMARISER_BASE, SUMMARISER_MOCK } from "@/config";
import type { Community } from "@/types/models";

/**
 * Whether the AI-summary feature should be offered: the community opts in, a
 * summariser (real or mock) is configured, and the user holds the writer role
 * (#145). Shared by the search-page entry point and the app-wide drawer/chip.
 */
export function aiSummariesEnabled(
  community: Community | null,
  aiSummaryWriter: boolean,
): boolean {
  return Boolean(
    community?.features.aiSummaries &&
      (Boolean(SUMMARISER_BASE) || SUMMARISER_MOCK) &&
      aiSummaryWriter,
  );
}
