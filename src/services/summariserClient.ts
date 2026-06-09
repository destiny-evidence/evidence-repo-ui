import { SUMMARISER_BASE } from "@/config";
import { keycloak } from "@/auth/keycloak";
import type { SummariseResponse, SummaryRequest } from "./summariser";
import { MOCK_SUMMARY } from "./summariserMock";

export type { SummariseResponse, SummaryRequest } from "./summariser";

// Stand-in latency so the loading and run-in-background states are exercised
// while the service returns placeholder data.
const MOCK_DELAY_MS = 2500;

// How often to poll a running job, and how long before giving up.
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 20 * 60 * 1000;

class AbortError extends DOMException {
  constructor() {
    super("Aborted", "AbortError");
  }
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AbortError());
    const id = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(id);
      reject(new AbortError());
    });
  });
}

/**
 * Request a summary for the references at an intersection.
 *
 * Without `VITE_SUMMARISER_BASE` configured (the current default), this resolves
 * to placeholder data after a short delay. Once the service is deployed, set the
 * base URL to exercise the real submit-and-poll path below.
 */
export async function requestSummary(
  request: SummaryRequest,
  signal?: AbortSignal,
): Promise<SummariseResponse> {
  if (!SUMMARISER_BASE) {
    await wait(MOCK_DELAY_MS, signal);
    return MOCK_SUMMARY;
  }
  return submitAndPoll(request, signal);
}

// Provisional: the reference-id request contract is finalised in
// futureevidence/ai-evidence-summariser#1. Guarded by SUMMARISER_BASE so it
// stays inert until the service is live.
async function submitAndPoll(
  request: SummaryRequest,
  signal?: AbortSignal,
): Promise<SummariseResponse> {
  const submit = await summariserFetch(
    "/summarise",
    { method: "POST", body: JSON.stringify(request) },
    signal,
  );
  if (!submit.ok) throw new Error(`Summary request failed (${submit.status}).`);
  const submitJson = await submit.json();
  if (submit.status === 200) return submitJson as SummariseResponse;

  const jobId: string = submitJson.job_id;
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    await wait(POLL_INTERVAL_MS, signal);
    const res = await summariserFetch(`/jobs/${jobId}`, {}, signal);
    if (!res.ok) throw new Error(`Summary status check failed (${res.status}).`);
    const job = await res.json();
    if (job.status === "done") return job.result as SummariseResponse;
    if (job.status === "failed") throw new Error(job.error || "Summary failed.");
    if (Date.now() > deadline) throw new Error("Summary timed out.");
  }
}

async function summariserFetch(
  path: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<Response> {
  await keycloak.updateToken(30).catch(() => undefined);
  return fetch(`${SUMMARISER_BASE}${path}`, {
    ...init,
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(keycloak.token ? { Authorization: `Bearer ${keycloak.token}` } : {}),
      ...init.headers,
    },
  });
}
