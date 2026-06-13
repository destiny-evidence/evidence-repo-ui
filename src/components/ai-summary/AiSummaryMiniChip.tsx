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
  const done = ai.status === "done";

  // The whole chip reopens the drawer; the trailing action is View (done) or
  // Cancel — the only way to stop a running job.
  return (
    <div class={`ai-mini${done ? " is-ready" : ""}`}>
      <button
        type="button"
        class="ai-mini__reopen"
        onClick={ai.open}
        title="Reopen summary"
      >
        {done ? (
          <span class="ai-mini__dot-ready" aria-hidden="true">
            ✓
          </span>
        ) : (
          <span class="ai-spinner" aria-hidden="true" />
        )}
        <span>{done ? "Summary ready" : "Summarising…"}</span>
      </button>
      <span class="ai-mini__sep" aria-hidden="true" />
      {done ? (
        <button type="button" class="ai-mini__view" onClick={ai.open}>
          View
        </button>
      ) : (
        <button type="button" class="ai-mini__cancel" onClick={ai.dismiss}>
          Cancel
        </button>
      )}
    </div>
  );
}
