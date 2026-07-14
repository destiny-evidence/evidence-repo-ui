/**
 * Promise-based driver for the search-export job lifecycle: request → poll until
 * the job terminates → return the `result_url`. Shared by every export path —
 * the download hook (Excel / RIS / reference-list PDF) and the AI-summary
 * references loader — so the request/poll state machine lives in exactly one
 * place. Abortable via an AbortSignal; `onPolling` lets a caller surface a
 * "preparing" state when the job goes into its poll loop.
 */

import {
  getReferenceExport,
  getSearchExport,
  requestReferenceExport,
  requestSearchExport,
  type ServerExportFormat,
  type SearchFilters,
} from "@/services/apiClient";
import type { SearchExportStatus } from "@/types/models";

const POLL_INTERVAL_MS = 2000;

class AbortError extends DOMException {
  constructor() {
    super("Aborted", "AbortError");
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AbortError());
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new AbortError());
      },
      { once: true },
    );
  });
}

export interface RunExportOptions {
  signal?: AbortSignal;
  /** Called once when the job enters its poll loop (pending/running). */
  onPolling?: () => void;
}

interface ExportJob {
  id: string;
  status: SearchExportStatus;
  result_url?: string | null;
  error?: string | null;
}

// Shared request → poll → result-url loop for both export flavours.
async function runToCompletion(
  request: () => Promise<ExportJob>,
  poll: (id: string) => Promise<ExportJob>,
  options: RunExportOptions,
): Promise<string> {
  const { signal, onPolling } = options;
  let job = await request();

  let announced = false;
  while (job.status === "pending" || job.status === "running") {
    if (signal?.aborted) throw new AbortError();
    if (!announced) {
      onPolling?.();
      announced = true;
    }
    await delay(POLL_INTERVAL_MS, signal);
    job = await poll(job.id);
  }

  if (job.status === "failed") {
    throw new Error(job.error || "The export job failed.");
  }
  if (job.status !== "completed") {
    throw new Error(`Unexpected export status: ${job.status}`);
  }
  if (!job.result_url) {
    throw new Error("Export finished but no download URL was returned.");
  }
  return job.result_url;
}

/**
 * Queue an export of `query`/`filters` in `exportFormat`, poll until it
 * completes, and resolve with the result blob URL. Rejects with an AbortError
 * if `signal` aborts, or an Error carrying the backend message on failure.
 */
export function runSearchExportToCompletion(
  query: string,
  filters: Omit<SearchFilters, "page">,
  exportFormat: ServerExportFormat,
  options: RunExportOptions = {},
): Promise<string> {
  return runToCompletion(
    () => requestSearchExport(query, filters, exportFormat),
    getSearchExport,
    options,
  );
}

// Same lifecycle as runSearchExportToCompletion, for an explicit id list.
export function runReferenceExportToCompletion(
  referenceIds: string[],
  exportFormat: ServerExportFormat,
  options: RunExportOptions = {},
): Promise<string> {
  return runToCompletion(
    () => requestReferenceExport(referenceIds, exportFormat),
    getReferenceExport,
    options,
  );
}
