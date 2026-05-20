import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { ESEA_CONTEXT_URL, ESEA_VOCABULARY_URL } from "@/config";
import {
  getSearchExport,
  requestSearchExport,
  type SearchFilters,
} from "@/services/apiClient";
import { exportReferencesToExcel } from "@/services/export/export";
import type { SearchExportRead } from "@/types/models";

export type ExportStatus =
  | "idle"
  | "requesting"
  | "polling"
  | "downloading"
  | "done"
  | "error";

export interface UseSearchExportResult {
  status: ExportStatus;
  errorMessage: string | null;
  start: (
    query: string,
    filters: Omit<SearchFilters, "page">,
    filename: string,
  ) => void;
  reset: () => void;
}

const POLL_INTERVAL_MS = 2000;

/**
 * Drives the export request → polling → download pipeline.
 *
 * **Cancellation.** Each call to `start` increments `runIdRef` and captures
 * the new id in a closure. Every async callback compares its captured id
 * against the live ref via `isCurrentRun()` and bails if they differ —
 * meaning the user called `start` again, `reset`, or unmounted. Without the
 * guard, a stale callback from a cancelled run could clobber the current
 * run's state machine.
 */
export function useSearchExport(): UseSearchExportResult {
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runIdRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearScheduledPoll = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    clearScheduledPoll();
    setStatus("idle");
    setErrorMessage(null);
  }, [clearScheduledPoll]);

  // Cancel any in-flight run on unmount. The setStatus/setErrorMessage
  // inside reset() are no-ops on the unmounted component.
  useEffect(() => reset, [reset]);

  const start = useCallback(
    (query: string, filters: Omit<SearchFilters, "page">, filename: string) => {
      runIdRef.current += 1;
      const runId = runIdRef.current;
      clearScheduledPoll();
      setErrorMessage(null);

      // The workbook falls back to raw CURIEs when Vocab/context URLs are missing.
      // Warn so misconfiguration is visible in devtools without surfacing a user-facing error.
      if (!ESEA_VOCABULARY_URL || !ESEA_CONTEXT_URL) {
        console.warn(
          "Export vocab/context URLs not configured; concept cells will contain raw CURIEs.",
          { ESEA_VOCABULARY_URL, ESEA_CONTEXT_URL },
        );
      }

      setStatus("requesting");

      const isCurrentRun = () => runIdRef.current === runId;

      // Drop the run into the error state, but only if it's still the
      // current one — cancelled runs must not overwrite a fresh run's state.
      const fail = (message: string) => {
        if (!isCurrentRun()) return;
        setErrorMessage(message);
        setStatus("error");
      };

      const handleCompleted = async (job: SearchExportRead) => {
        if (!isCurrentRun()) return;
        if (!job.result_url) {
          fail("Export finished but no download URL was returned.");
          return;
        }
        setStatus("downloading");
        try {
          await exportReferencesToExcel(
            job.result_url,
            ESEA_VOCABULARY_URL,
            ESEA_CONTEXT_URL,
            filename,
          );
        } catch (err) {
          fail(
            err instanceof Error
              ? err.message
              : "Failed to build the Excel file.",
          );
          return;
        }
        if (!isCurrentRun()) return;
        setStatus("done");
      };

      const schedulePoll = (jobId: string) => {
        timeoutRef.current = setTimeout(() => poll(jobId), POLL_INTERVAL_MS);
      };

      const handleStatus = (job: SearchExportRead) => {
        if (job.status === "completed") {
          handleCompleted(job);
          return;
        }
        if (job.status === "failed") {
          fail(job.error || "The export job failed.");
          return;
        }
        // pending or running — keep polling. setStatus is idempotent on the
        // second-and-later passes; Preact bails on same-value state writes.
        setStatus("polling");
        schedulePoll(job.id);
      };

      const poll = (jobId: string) => {
        if (!isCurrentRun()) return;
        getSearchExport(jobId)
          .then((job) => {
            if (!isCurrentRun()) return;
            handleStatus(job);
          })
          .catch((err) => {
            fail(
              err instanceof Error
                ? err.message
                : "Lost contact with the export job. Please try again.",
            );
          });
      };

      requestSearchExport(query, filters)
        .then((job) => {
          if (!isCurrentRun()) return;
          handleStatus(job);
        })
        .catch((err) => {
          fail(
            err instanceof Error ? err.message : "Failed to start the export.",
          );
        });
    },
    [clearScheduledPoll],
  );

  return { status, errorMessage, start, reset };
}
