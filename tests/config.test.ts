import { afterEach, describe, expect, test, vi } from "vitest";

const TARGET = "https://acct.blob.core.windows.net";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

// config.ts reads import.meta.env at module-eval, so reload it under a stubbed
// VITE_BLOB_PROXY_TARGET to exercise each branch.
async function loadConfig(blobTarget: string) {
  vi.resetModules();
  vi.stubEnv("VITE_BLOB_PROXY_TARGET", blobTarget);
  return import("@/config");
}

describe("proxyBlobUrl", () => {
  test("returns the URL unchanged when no proxy target is set", async () => {
    const { proxyBlobUrl } = await loadConfig("");
    const url = `${TARGET}/container/file.jsonl?sig=abc`;
    expect(proxyBlobUrl(url)).toBe(url);
  });

  test("rewrites a matching URL through the dev proxy, preserving path + query", async () => {
    const { proxyBlobUrl } = await loadConfig(TARGET);
    expect(proxyBlobUrl(`${TARGET}/container/file.jsonl?sig=abc`)).toBe(
      "/blob-proxy/container/file.jsonl?sig=abc",
    );
  });

  test("leaves a non-matching URL unchanged", async () => {
    const { proxyBlobUrl } = await loadConfig(TARGET);
    const other = "https://other.example/container/file.jsonl?sig=abc";
    expect(proxyBlobUrl(other)).toBe(other);
  });
});
