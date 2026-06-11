import { Drawer } from "@/components/common/Drawer";
import { AI_SUMMARY_FLAG_FORM_URL } from "@/config";
import type { UseAiSummaryResult } from "@/hooks/useAiSummary";
import type { SearchResultTotal } from "@/types/models";
import type { SkipReason, SummariseResponse } from "@/services/summariser";
import { formatTotal } from "@/utils/searchTotal";
import { SummaryBody } from "./renderSummary";
import "./ai-summary.css";

export interface AiSummaryContext {
  /** Intersecting term labels shown as chips. */
  terms: string[];
  /** Papers feeding the summary (the full match total, may be a lower bound). */
  count: SearchResultTotal;
}

interface AiSummaryDrawerProps {
  ai: UseAiSummaryResult;
  context: AiSummaryContext;
}

const SKIP_REASON_TEXT: Record<SkipReason, string> = {
  no_full_text: "had no full text available",
  not_pdf: "were not in PDF format",
  download_failed: "couldn't be downloaded",
};

export function AiSummaryDrawer({ ai, context }: AiSummaryDrawerProps) {
  const title =
    ai.status === "generating"
      ? "Generating summary…"
      : ai.status === "error"
        ? "Summary unavailable"
        : "AI summary";

  // Closing should never abort an in-flight job — only the explicit "Cancel"
  // does. While generating, close drops it to the background chip; once there's
  // nothing running, close clears the finished summary.
  const handleClose = ai.status === "generating" ? ai.runInBackground : ai.dismiss;

  return (
    <Drawer
      open={ai.drawerOpen}
      block="ai-drawer"
      title={title}
      titleAdornment={<span class="ai-beta">BETA</span>}
      subtitle={<ContextChips terms={context.terms} count={context.count} />}
      headerAction={
        <button
          type="button"
          class="ai-iconbtn"
          aria-label="Close"
          title="Close"
          onClick={handleClose}
        >
          ✕
        </button>
      }
      footer={<DrawerFooter ai={ai} />}
      closeOnBackdrop
      onClose={handleClose}
    >
      {ai.status === "generating" && (
        <div class="ai-loading">
          <span class="ai-spinner" />
          <span>
            Summarising {formatTotal(context.count)}{" "}
            {context.count.count === 1 ? "paper" : "papers"}… this can take
            several minutes. You can keep working — use “Run in background”.
          </span>
        </div>
      )}

      {ai.status === "error" && (
        <p class="ai-error" role="alert">
          {ai.errorMessage ?? "Couldn't generate the summary."}
        </p>
      )}

      {ai.status === "done" && ai.result && (
        <>
          <Disclaimer />
          <SummaryBody
            summary={ai.result.summary}
            papers={ai.result.papers}
          />
          <CoverageNote result={ai.result} />
        </>
      )}
    </Drawer>
  );
}

// How many references the summary actually drew on, and which were left out.
function CoverageNote({ result }: { result: SummariseResponse }) {
  const used = result.papers.length;

  const reasonCounts = new Map<SkipReason, number>();
  for (const ref of result.skipped_references) {
    reasonCounts.set(ref.reason, (reasonCounts.get(ref.reason) ?? 0) + 1);
  }
  const clauses = [...reasonCounts].map(
    ([reason, n]) => `${n} ${SKIP_REASON_TEXT[reason]}`,
  );
  if (result.extraction_errors.length > 0) {
    clauses.push(`${result.extraction_errors.length} couldn't be read`);
  }

  const leftOut = result.skipped_references.length + result.extraction_errors.length;
  const total = used + leftOut;

  return (
    <p class="ai-coverage">
      {leftOut === 0
        ? `Based on ${total} ${total === 1 ? "reference" : "references"}.`
        : `Based on ${used} of ${total} references. ${clauses.join("; ")} — left out of this summary.`}
    </p>
  );
}

function ContextChips({ terms, count }: AiSummaryContext) {
  return (
    <div class="ai-ctx">
      {terms.map((term, i) => (
        <span key={i} class="ai-term">
          {term}
        </span>
      ))}
      <span class="ai-pill">
        {formatTotal(count)} {count.count === 1 ? "result" : "results"}
      </span>
    </div>
  );
}

function Disclaimer() {
  return (
    <div class="ai-disclaimer">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M10 2 19 17H1L10 2Z" />
        <rect x="9" y="8" width="2" height="5" fill="#fff" />
        <rect x="9" y="14" width="2" height="2" fill="#fff" />
      </svg>
      <span>
        AI-generated from the papers at this intersection. Quotes are extracted
        verbatim — verify against the sources before using in synthesis.
      </span>
    </div>
  );
}

function DrawerFooter({ ai }: { ai: UseAiSummaryResult }) {
  if (ai.status === "generating") {
    return (
      <footer class="ai-drawer__footer">
        <button type="button" class="ai-btn" onClick={ai.dismiss}>
          Cancel
        </button>
        <button
          type="button"
          class="ai-btn ai-btn--primary ai-btn--push"
          onClick={ai.runInBackground}
        >
          Run in background
        </button>
      </footer>
    );
  }

  // Flagging only applies to a produced summary — not the error state.
  if (ai.status !== "done" || !AI_SUMMARY_FLAG_FORM_URL) return null;
  return (
    <footer class="ai-drawer__footer">
      <a
        class="ai-btn ai-btn--flag ai-btn--push"
        href={AI_SUMMARY_FLAG_FORM_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        ⚑ Flag this summary
      </a>
    </footer>
  );
}
