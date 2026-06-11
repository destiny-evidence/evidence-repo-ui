import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Toggled per-test; name starts with "mock" so vitest's hoisting allows it.
let mockBase: string | undefined;
vi.mock("@/config", () => ({
  get SUMMARISER_BASE() {
    return mockBase;
  },
}));

import { requestSummary } from "@/services/summariserClient";
import { MOCK_SUMMARY } from "@/services/summariserMock";
import type { SummaryRequest } from "@/services/summariser";

const fetchMock = vi.fn();

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const request: SummaryRequest = {
  referenceIds: ["id-1", "id-2"],
  terms: [
    { name: "Health workers" },
    { name: "Cost", description: "value for money" },
  ],
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  mockBase = undefined;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("requestSummary", () => {
  test("returns placeholder data without hitting the network when no base is set", async () => {
    vi.useFakeTimers();
    const pending = requestSummary(request);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(pending).resolves.toBe(MOCK_SUMMARY);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe("with SUMMARISER_BASE configured", () => {
    beforeEach(() => {
      mockBase = "https://sum.test/api";
    });

    test("submits reference_ids and terms as form fields and returns a cached 200 result", async () => {
      fetchMock.mockResolvedValue(response(MOCK_SUMMARY, 200));

      const result = await requestSummary(request);
      expect(result).toEqual(MOCK_SUMMARY);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://sum.test/api/summarise");
      expect(init.method).toBe("POST");
      const headers = init.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
      expect(headers["Authorization"]).toBe("Bearer test-token");

      const body = init.body as URLSearchParams;
      expect(body.getAll("reference_ids")).toEqual(["id-1", "id-2"]);
      // A term with a description is encoded as "name:description".
      expect(body.getAll("terms")).toEqual([
        "Health workers",
        "Cost:value for money",
      ]);
    });

    test("polls the job until it is done on a 202", async () => {
      vi.useFakeTimers();
      fetchMock
        .mockResolvedValueOnce(response({ job_id: "job-9", status: "running" }, 202))
        .mockResolvedValueOnce(response({ status: "running" }, 200))
        .mockResolvedValueOnce(response({ status: "done", result: MOCK_SUMMARY }, 200));

      const pending = requestSummary(request);
      await vi.advanceTimersByTimeAsync(11000); // two 5s poll intervals

      await expect(pending).resolves.toEqual(MOCK_SUMMARY);
      expect(fetchMock.mock.calls[1][0]).toBe("https://sum.test/api/jobs/job-9");
    });

    test("rejects when the job fails", async () => {
      vi.useFakeTimers();
      fetchMock
        .mockResolvedValueOnce(response({ job_id: "job-9", status: "running" }, 202))
        .mockResolvedValueOnce(response({ status: "failed", error: "boom" }, 200));

      const pending = requestSummary(request);
      const assertion = expect(pending).rejects.toThrow("boom");
      await vi.advanceTimersByTimeAsync(6000);
      await assertion;
    });

    test("throws when the submit is rejected (e.g. a reference has no full text)", async () => {
      fetchMock.mockResolvedValue(response({ detail: "no_full_text" }, 422));
      await expect(requestSummary(request)).rejects.toThrow(/422/);
    });
  });
});
