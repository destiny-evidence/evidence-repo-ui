import { afterEach, describe, expect, it, vi } from "vitest";

// communities.ts reads VITE_ESEA_VOCABULARY_URL and VITE_ESEA_CONTEXT_URL at
// module load time so a misconfigured build fails fast rather than silently
// degrading at export/filter time (issue #63). vi.resetModules is needed so
// each import re-evaluates the module against the current env stubs.

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("communities module-load env validation", () => {
  it("throws when VITE_ESEA_VOCABULARY_URL is missing", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_ESEA_VOCABULARY_URL", "");
    vi.stubEnv("VITE_ESEA_CONTEXT_URL", "https://test.example/context");

    await expect(import("@/services/communities")).rejects.toThrow(
      /VITE_ESEA_VOCABULARY_URL/,
    );
  });

  it("throws when VITE_ESEA_CONTEXT_URL is missing", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_ESEA_VOCABULARY_URL", "https://test.example/vocab");
    vi.stubEnv("VITE_ESEA_CONTEXT_URL", "");

    await expect(import("@/services/communities")).rejects.toThrow(
      /VITE_ESEA_CONTEXT_URL/,
    );
  });

  it("attaches the configured URLs to the esea community", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_ESEA_VOCABULARY_URL", "https://vocab.example/v1");
    vi.stubEnv("VITE_ESEA_CONTEXT_URL", "https://vocab.example/ctx");

    const { findCommunity } = await import("@/services/communities");
    const esea = findCommunity("esea");

    expect(esea?.vocabularyUrl).toBe("https://vocab.example/v1");
    expect(esea?.contextUrl).toBe("https://vocab.example/ctx");
  });
});
