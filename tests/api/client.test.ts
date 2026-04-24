import { describe, test, expect, vi, beforeEach } from "vitest";
import { api } from "@/api/client";
import { keycloak } from "@/auth/keycloak";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
  vi.mocked(keycloak.updateToken).mockClear();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api client", () => {
  test("refreshes the token before each request", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await api.get("/v1/ping");
    expect(keycloak.updateToken).toHaveBeenCalledWith(30);
  });

  test("attaches Authorization: Bearer header when token is present", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await api.get("/v1/ping");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer test-token",
    );
  });

  test("sets Content-Type on requests with a body", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await api.post("/v1/thing", { hello: "world" });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Authorization"]).toBe("Bearer test-token");
  });

  test("propagates non-OK responses as ApiError", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: "nope" }, 403));
    await expect(api.get("/v1/restricted")).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
    });
  });
});
