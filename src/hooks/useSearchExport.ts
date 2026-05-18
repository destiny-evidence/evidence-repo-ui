import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { EXPORT_CONTEXT_URL, EXPORT_VOCABULARY_URL } from "@/config";
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

export function useSearchExport(): UseSearchExportResult {
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Generation counter — bumped on reset/unmount. Callbacks that started under
  // generation N bail if cancelRef.current !== N, so a late poll response from
  // a cancelled run never writes state.
  const cancelRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimeoutRef = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    cancelRef.current += 1;
    clearTimeoutRef();
    setStatus("idle");
    setErrorMessage(null);
  }, [clearTimeoutRef]);

  useEffect(() => {
    return () => {
      cancelRef.current += 1;
      clearTimeoutRef();
    };
  }, [clearTimeoutRef]);

  const start = useCallback(
    (
      query: string,
      filters: Omit<SearchFilters, "page">,
      filename: string,
    ) => {
      cancelRef.current += 1;
      const generation = cancelRef.current;
      clearTimeoutRef();
      setErrorMessage(null);

      // Fail loud-but-friendly when the deploy is missing vocab/context URLs
      // rather than letting fetch("undefined") produce a confusing 404.
      if (!EXPORT_VOCABULARY_URL || !EXPORT_CONTEXT_URL) {
        setErrorMessage(
          "Export is not configured for this deployment. Contact an administrator.",
        );
        setStatus("error");
        return;
      }

      setStatus("requesting");

      const isActive = () => cancelRef.current === generation;

      const handleCompleted = async (job: SearchExportRead) => {
        if (!isActive()) return;
        if (!job.result_url) {
          setErrorMessage("Export finished but no download URL was returned.");
          setStatus("error");
          return;
        }
        setStatus("downloading");
        try {
          await exportReferencesToExcel(
            job.result_url,
            EXPORT_VOCABULARY_URL,
            EXPORT_CONTEXT_URL,
            filename,
          );
        } catch (err) {
          if (!isActive()) return;
          setErrorMessage(
            err instanceof Error ? err.message : "Failed to build the Excel file.",
          );
          setStatus("error");
          return;
        }
        if (!isActive()) return;
        setStatus("done");
      };

      const poll = (jobId: string) => {
        if (!isActive()) return;
        getSearchExport(jobId)
          .then((job) => {
            if (!isActive()) return;
            if (job.status === "completed") {
              void handleCompleted(job);
              return;
            }
            if (job.status === "failed") {
              setErrorMessage(job.error || "The export job failed.");
              setStatus("error");
              return;
            }
            // pending or running — keep polling.
            timeoutRef.current = setTimeout(() => poll(jobId), POLL_INTERVAL_MS);
          })
          .catch((err) => {
            if (!isActive()) return;
            setErrorMessage(
              err instanceof Error
                ? err.message
                : "Lost contact with the export job. Please try again.",
            );
            setStatus("error");
          });
      };

      requestSearchExport(query, filters)
        .then((job) => {
          if (!isActive()) return;
          if (job.status === "completed") {
            void handleCompleted(job);
            return;
          }
          if (job.status === "failed") {
            setErrorMessage(job.error || "The export job failed.");
            setStatus("error");
            return;
          }
          setStatus("polling");
          timeoutRef.current = setTimeout(
            () => poll(job.id),
            POLL_INTERVAL_MS,
          );
        })
        .catch((err) => {
          if (!isActive()) return;
          setErrorMessage(
            err instanceof Error ? err.message : "Failed to start the export.",
          );
          setStatus("error");
        });
    },
    [clearTimeoutRef],
  );

  return { status, errorMessage, start, reset };
}
