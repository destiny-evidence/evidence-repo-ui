import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { track } from "@/analytics/matomo";
import { type SearchFilters } from "@/services/apiClient";
import type { ExportFormat } from "@/services/export/exportFormats";
import { exportReferencesToExcel } from "@/services/export/export";
import {
  runReferenceExportToCompletion,
  runSearchExportToCompletion,
} from "@/services/export/searchExportJob";
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

export interface StartExportOptions {
  format: ExportFormat;
  filename: string;
  /** The format's display label, reported as the analytics event name. */
  formatLabel: string;
  /** References the export covers; reported as the analytics event value. */
  resultCount: number;
  // The reference source. `resolveReferenceIds`, when set, exports exactly
  // those ids (resolved inside the run so it's abortable); otherwise the
  // query + filters are exported.
  query?: string;
  filters?: Omit<SearchFilters, "page">;
  resolveReferenceIds?: (signal: AbortSignal) => Promise<string[]>;
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
    case "excel": {
      if (!options.variant) {
        throw new Error("Excel export requires community.exportVariant");
      }
      await exportReferencesToExcel(
        resultUrl,
        options.vocabularyUrl!,
        options.contextUrl!,
        options.filename,
        options.variant,
        options.codingInstitution,
        options.pinnedFilters,
      );
      return;
    }
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

    const analytics = {
      name: options.formatLabel,
      value: options.resultCount,
    };
    track({ category: "Export", action: "Requested", ...analytics });

    const serverFormat = serverFormatFor(options.format);
    const runOptions = {
      signal: controller.signal,
      onPolling: () => {
        if (isCurrentRun()) setStatus("polling");
      },
    };

    (async () => {
      const resultUrl = options.resolveReferenceIds
        ? await runReferenceExportToCompletion(
            await options.resolveReferenceIds(controller.signal),
            serverFormat,
            runOptions,
          )
        : await runSearchExportToCompletion(
            options.query ?? "*",
            options.filters ?? {},
            serverFormat,
            runOptions,
          );
      if (!isCurrentRun()) return;
      setStatus("downloading");
      await downloadForFormat(resultUrl, options);
      if (!isCurrentRun()) return;
      setStatus("done");
      track({ category: "Export", action: "Completed", ...analytics });
    })().catch((err: unknown) => {
      if (controller.signal.aborted || !isCurrentRun()) return;
      setErrorMessage(
        err instanceof Error ? err.message : "The export failed.",
      );
      setStatus("error");
      track({ category: "Export", action: "Error", ...analytics });
    });
  }, []);

  return { status, errorMessage, start, reset };
}
