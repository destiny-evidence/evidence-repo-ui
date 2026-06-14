import {
  SUMMARISER_BASE,
  SUMMARISER_MOCK,
  SUMMARISER_MOCK_DELAY_MS,
} from "@/config";
import { keycloak } from "@/auth/keycloak";
import { MOCK_SUMMARY } from "./summariserMock";
import type { SummariseResponse, SummaryRequest } from "./summariser";

export type { SummariseResponse, SummaryRequest } from "./summariser";

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
    let id: ReturnType<typeof setTimeout>;
    const onAbort = () => {
      clearTimeout(id);
      reject(new AbortError());
    };
    id = setTimeout(() => {
      // Drop the listener once the wait resolves, so a long poll loop doesn't
      // accumulate one per interval on the shared signal.
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

// Surface the service's error `detail` (a string, or a {error|message} object)
// so the UI's error state is specific rather than a bare status code.
async function summaryError(res: Response, fallback: string): Promise<Error> {
  const body = await res.json().catch(() => null);
  const detail = body?.detail;
  const message =
    typeof detail === "string" ? detail : (detail?.message ?? detail?.error);
  return new Error(
    message ? `${fallback} (${res.status}): ${message}` : `${fallback} (${res.status}).`,
  );
}

/**
 * Request a summary for the references at an intersection.
 *
 * Requires `VITE_SUMMARISER_BASE`; the UI only surfaces the feature when it's
 * configured, so an unset base here is a programming error rather than a
 * user-facing path.
 */
export async function requestSummary(
  request: SummaryRequest,
  signal?: AbortSignal,
): Promise<SummariseResponse> {
  if (SUMMARISER_MOCK) {
    // Honour the signal so cancel still works; "Run in background" needs no
    // special handling — it only minimises the drawer, leaving this running.
    await wait(SUMMARISER_MOCK_DELAY_MS, signal);
    return MOCK_SUMMARY;
  }
  if (!SUMMARISER_BASE) {
    throw new Error("Summariser is not configured (VITE_SUMMARISER_BASE).");
  }
  return submitAndPoll(request, signal);
}

// POST /summarise takes form fields — repeated `reference_ids` and `terms`
// (each "name" or "name:description") — and returns either a cached result (200)
// or a job to poll (202).
async function submitAndPoll(
  request: SummaryRequest,
  signal?: AbortSignal,
): Promise<SummariseResponse> {
  // The endpoint reads FastAPI Form fields; URLSearchParams form-encodes them,
  // with repeated keys mapping to list fields.
  const body = new URLSearchParams();
  for (const id of request.referenceIds) body.append("reference_ids", id);
  for (const term of request.terms) {
    body.append(
      "terms",
      term.description ? `${term.name}:${term.description}` : term.name,
    );
  }

  const submit = await summariserFetch(
    "/summarise",
    {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    },
    signal,
  );
  if (!submit.ok) throw await summaryError(submit, "Summary request failed");
  const submitJson = await submit.json();
  if (submit.status === 200) return submitJson as SummariseResponse;

  const jobId = submitJson.job_id;
  if (typeof jobId !== "string") {
    throw new Error("Summary job response is missing a job_id.");
  }
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    await wait(POLL_INTERVAL_MS, signal);
    const res = await summariserFetch(`/jobs/${jobId}`, {}, signal);
    if (!res.ok) throw await summaryError(res, "Summary status check failed");
    const job = await res.json();
    if (job.status === "done") return job.result as SummariseResponse;
    if (job.status === "failed")
      throw new Error(job.error || "Summary failed.");
    if (Date.now() > deadline) throw new Error("Summary timed out.");
  }
}

async function summariserFetch(
  path: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<Response> {
  // A failed refresh proceeds with the current token rather than throwing (as
  // api/client does): a stale/expired token just yields a 401, which surfaces
  // as the drawer's error state instead of an unhandled rejection.
  await keycloak.updateToken(30).catch(() => undefined);
  // Attaches the bearer token; callers set Content-Type when they send a body.
  return fetch(`${SUMMARISER_BASE}${path}`, {
    ...init,
    signal,
    headers: {
      ...(keycloak.token ? { Authorization: `Bearer ${keycloak.token}` } : {}),
      ...init.headers,
    },
  });
}
