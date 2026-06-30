import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { type SearchFilters } from "@/services/apiClient";
import { exportReferencesToExcel } from "@/services/export/export";
import { runSearchExportToCompletion } from "@/services/export/searchExportJob";
import {
  downloadRisExport,
  downloadReferenceListPdf,
} from "@/services/export/risExport";
import type { ReferenceListMeta } from "@/services/export/referenceListPdf";
import type {
  CodingInstitutionConfig,
  ExportVariant,
  PinnedFilter,
} from "@/types/models";

export type ExportStatus =
  | "idle"
  | "requesting"
  | "polling"
  | "downloading"
  | "done"
  | "error";

/**
 * UI export choices. `excel` runs the JSONL → workbook pipeline; `ris` and
 * `reference-list` share one backend RIS job, then either save it verbatim or
 * render it as a bibliography PDF.
 */
export type ExportFormat = "excel" | "ris" | "reference-list";

export interface StartExportOptions {
  format: ExportFormat;
  query: string;
  filters: Omit<SearchFilters, "page">;
  filename: string;
  // Excel only:
  vocabularyUrl?: string;
  contextUrl?: string;
  variant?: ExportVariant;
  codingInstitution?: CodingInstitutionConfig;
  pinnedFilters?: PinnedFilter[];
  // Reference-list PDF only:
  referenceListMeta?: ReferenceListMeta;
}

export interface UseSearchExportResult {
  status: ExportStatus;
  errorMessage: string | null;
  start: (options: StartExportOptions) => void;
  reset: () => void;
}

// excel streams JSONL; the bibliography formats both consume the RIS render.
function serverFormatFor(format: ExportFormat): "jsonl" | "ris" {
  return format === "excel" ? "jsonl" : "ris";
}

async function downloadForFormat(
  resultUrl: string,
  options: StartExportOptions,
): Promise<void> {
  switch (options.format) {
    case "excel":
      await exportReferencesToExcel(
        resultUrl,
        options.vocabularyUrl!,
        options.contextUrl!,
        options.filename,
        options.variant!,
        options.codingInstitution,
        options.pinnedFilters,
      );
      return;
    case "ris":
      await downloadRisExport(resultUrl, options.filename);
      return;
    case "reference-list":
      await downloadReferenceListPdf(
        resultUrl,
        options.filename,
        options.referenceListMeta ?? { title: "Reference list" },
      );
      return;
  }
}

/**
 * Drives the export request → poll → download pipeline for all formats.
 *
 * **Cancellation.** Each `start` bumps `runIdRef` (captured in a closure) and
 * aborts the previous run's controller. The job poller bails on abort; the
 * `isCurrentRun` guard stops a stale callback clobbering a fresh run's state.
 */
export function useSearchExport(): UseSearchExportResult {
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setErrorMessage(null);
  }, []);

  // Cancel any in-flight run on unmount.
  useEffect(() => reset, [reset]);

  const start = useCallback((options: StartExportOptions) => {
    runIdRef.current += 1;
    const runId = runIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setErrorMessage(null);
    setStatus("requesting");

    const isCurrentRun = () => runIdRef.current === runId;

    runSearchExportToCompletion(
      options.query,
      options.filters,
      serverFormatFor(options.format),
      {
        signal: controller.signal,
        onPolling: () => {
          if (isCurrentRun()) setStatus("polling");
        },
      },
    )
      .then(async (resultUrl) => {
        if (!isCurrentRun()) return;
        setStatus("downloading");
        await downloadForFormat(resultUrl, options);
        if (!isCurrentRun()) return;
        setStatus("done");
      })
      .catch((err: unknown) => {
        // A cancelled/superseded run must not overwrite fresh state.
        if (controller.signal.aborted || !isCurrentRun()) return;
        setErrorMessage(
          err instanceof Error ? err.message : "The export failed.",
        );
        setStatus("error");
      });
  }, []);

  return { status, errorMessage, start, reset };
}
