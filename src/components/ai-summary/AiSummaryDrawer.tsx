import { useEffect, useState } from "preact/hooks";
import { Drawer } from "@/components/common/Drawer";
import { Spinner } from "@/components/common/Spinner";
import { DownloadIcon, WarningIcon } from "@/components/common/icons";
import { track } from "@/analytics/matomo";
import { AI_SUMMARY_FLAG_FORM_URL } from "@/config";
import { URL_CHANGE_EVENT } from "@/services/navigation";
import type {
  AiSummaryContext,
  UseAiSummaryResult,
} from "@/hooks/useAiSummary";
import type { SkipReason, SummariseResponse } from "@/services/summariser";
import { buildSummaryFilename, downloadSummaryPdf } from "@/services/export/summaryPdf";
import {
  useReferenceListExport,
  type UseReferenceListExportResult,
} from "@/hooks/useReferenceListExport";
import { formatTotal } from "@/utils/searchTotal";
import { SummaryBody, SummaryReferences } from "./renderSummary";
import "./ai-summary.css";

interface AiSummaryDrawerProps {
  ai: UseAiSummaryResult;
}

const SKIP_REASON_TEXT: Record<SkipReason, string> = {
  no_full_text: "had no full text available",
  not_pdf: "were not in PDF format",
  download_failed: "couldn't be downloaded",
};

export function AiSummaryDrawer({ ai }: AiSummaryDrawerProps) {
  const title =
    ai.status === "generating"
      ? "Generating summary…"
      : ai.status === "error"
        ? "Summary unavailable"
        : "AI summary";

  // Closing should never abort an in-flight job — only the explicit "Cancel"
  // does. While generating, close drops it to the background chip; once there's
  // nothing running, close clears the finished summary.
  const handleClose =
    ai.status === "generating"
      ? () => ai.runInBackground("close")
      : () => ai.dismiss("drawer");
  const context = ai.context;

  // The summary's bibliography: a RIS export of the same reference set.
  // Preloaded alongside generation.
  const references = useReferenceListExport(
    ai.referenceSource,
    ai.status === "generating" || ai.status === "done",
  );

  return (
    <Drawer
      open={ai.drawerOpen}
      block="ai-drawer"
      title={title}
      titleAdornment={<span class="ai-beta">BETA</span>}
      subtitle={context ? <ContextChips context={context} /> : undefined}
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
      footer={<DrawerFooter ai={ai} references={references} />}
      closeOnBackdrop
      onClose={handleClose}
    >
      {ai.status === "generating" && context && (
        <div class="ai-loading">
          <Spinner size={14} class="ai-loading__spinner" />
          <span>
            Summarising {formatTotal(context.count)} {context.countNoun}… this
            can take several minutes. You can keep working — use “Run in
            background”.
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
          <SummaryBody summary={ai.result.summary} papers={ai.result.papers} />
          <CoverageNote result={ai.result} />
          <SummaryReferences references={references} />
        </>
      )}
    </Drawer>
  );
}

// How many references the summary actually drew on, and which were left out.
function CoverageNote({ result }: { result: SummariseResponse }) {
  // Avoid double-counting papers with extraction
  const erroredIds = new Set(result.extraction_errors.map((err) => err.paper));
  const used = result.papers.filter((p) => !erroredIds.has(p.paper)).length;

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

  const leftOut =
    result.skipped_references.length + result.extraction_errors.length;
  const total = used + leftOut;

  return (
    <p class="ai-coverage">
      {leftOut === 0
        ? `Based on ${total} ${total === 1 ? "reference" : "references"}.`
        : `Based on ${used} of ${total} references. ${clauses.join("; ")} — left out of this summary.`}
    </p>
  );
}

function ContextChips({ context }: { context: AiSummaryContext }) {
  return (
    <div class="ai-ctx">
      {context.terms.map((term, i) => (
        <span key={i} class="ai-term">
          {term}
        </span>
      ))}
      <span class="ai-pill">
        {formatTotal(context.count)} {context.countNoun}
      </span>
    </div>
  );
}

function Disclaimer() {
  return (
    <div class="ai-disclaimer">
      <WarningIcon size={16} />
      <span>
        AI-generated from the papers at this intersection. Quotes are extracted
        verbatim — verify against the sources before using in synthesis.
      </span>
    </div>
  );
}

// Reactive path + query, so the footer knows whether we're already on the
// summary's own search page.
function useCurrentUrl(): string {
  const [url, setUrl] = useState(
    () => window.location.pathname + window.location.search,
  );
  useEffect(() => {
    const onChange = () =>
      setUrl(window.location.pathname + window.location.search);
    window.addEventListener("popstate", onChange);
    window.addEventListener(URL_CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener("popstate", onChange);
      window.removeEventListener(URL_CHANGE_EVENT, onChange);
    };
  }, []);
  return url;
}

// Generates the PDF on click and triggers a one-click download
function SavePdfButton({
  result,
  context,
  originUrl,
  references,
}: {
  result: SummariseResponse;
  context: AiSummaryContext;
  originUrl: string | null;
  references: UseReferenceListExportResult;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // Block the download while the references are still loading, so the PDF isn't
  // generated with an empty (silently dropped) References section. A failed load
  // is allowed through — a PDF without references beats no PDF at all.
  const preparing = references.status === "loading";

  async function handleClick() {
    setBusy(true);
    setFailed(false);
    try {
      await downloadSummaryPdf(
        result,
        context,
        buildSummaryFilename(result.summary.narrative[0]?.header),
        originUrl,
        references.inputs,
      );
      // After the await: a failed render never reached the user as a download.
      track({ category: "AISummary", action: "Downloaded" });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      class="ai-btn"
      onClick={handleClick}
      disabled={busy || preparing}
      aria-busy={busy || preparing}
    >
      {!busy && !preparing && <DownloadIcon size={14} />}
      {preparing
        ? "Preparing references…"
        : busy
          ? "Generating…"
          : failed
            ? "Couldn't create PDF — retry"
            : "Download"}
    </button>
  );
}

function DrawerFooter({
  ai,
  references,
}: {
  ai: UseAiSummaryResult;
  references: UseReferenceListExportResult;
}) {
  const currentUrl = useCurrentUrl();
  // Only worth offering "Open this search" from a different page.
  const showOpenSearch = ai.originUrl !== null && ai.originUrl !== currentUrl;

  if (ai.status === "generating") {
    return (
      <footer class="ai-drawer__footer">
        <button
          type="button"
          class="ai-btn"
          onClick={() => ai.dismiss("drawer")}
        >
          Cancel
        </button>
        <button
          type="button"
          class="ai-btn ai-btn--primary ai-btn--push"
          onClick={() => ai.runInBackground("button")}
        >
          Run in background
        </button>
      </footer>
    );
  }

  // The footer only applies to a produced summary — not the error state.
  if (ai.status !== "done") return null;
  return (
    <footer class="ai-drawer__footer">
      {ai.result && ai.context && (
        <SavePdfButton
          result={ai.result}
          context={ai.context}
          originUrl={ai.originUrl}
          references={references}
        />
      )}
      {showOpenSearch && (
        <a
          class="ai-btn"
          href={ai.originUrl ?? undefined}
          onClick={() => track({ category: "AISummary", action: "Search Opened" })}
        >
          Open this search ↗
        </a>
      )}
      {AI_SUMMARY_FLAG_FORM_URL && (
        <a
          class="ai-btn ai-btn--flag ai-btn--push"
          href={AI_SUMMARY_FLAG_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track({ category: "AISummary", action: "Flagged" })}
        >
          ⚑ Flag this summary
        </a>
      )}
    </footer>
  );
}
