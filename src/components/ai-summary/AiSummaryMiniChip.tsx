import type { UseAiSummaryResult } from "@/hooks/useAiSummary";
import "./ai-summary.css";

interface AiSummaryMiniChipProps {
  ai: UseAiSummaryResult;
}

/**
 * Background indicator shown while the drawer is minimized: a working spinner
 * during generation, or a "Summary ready" nudge that reopens the drawer.
 */
export function AiSummaryMiniChip({ ai }: AiSummaryMiniChipProps) {
  if (!ai.minimized) return null;

  if (ai.status === "done") {
    return (
      <div class="ai-mini is-ready">
        <span class="ai-mini__dot-ready" aria-hidden="true">
          ✓
        </span>
        <span>Summary ready</span>
        <span class="ai-mini__sep" aria-hidden="true" />
        <button type="button" class="ai-mini__view" onClick={ai.open}>
          View
        </button>
      </div>
    );
  }

  return (
    <div class="ai-mini">
      <span class="ai-spinner" aria-hidden="true" />
      <span>Summarising…</span>
      <span class="ai-mini__sep" aria-hidden="true" />
      <button type="button" class="ai-mini__cancel" onClick={ai.dismiss}>
        Cancel
      </button>
    </div>
  );
}
