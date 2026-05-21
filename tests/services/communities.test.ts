import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, test, vi } from "vitest";
import { findCommunity } from "@/services/communities";

const CONTEXT_FIXTURE_PATH = resolve(
  __dirname,
  "./export/fixtures/context.jsonld",
);

describe("Community.vocabBase drift guard", () => {
  // Compact-URI expansion at the search/export boundary relies on
  // Community.vocabBase matching the JSON-LD @context prefix served by the
  // backend. If they drift, expanded URIs silently target the wrong vocab.
  test("esea Community.vocabBase agrees with the JSON-LD context fixture's `esea` prefix", () => {
    const base = findCommunity("esea")!.vocabBase;
    const ctx = JSON.parse(readFileSync(CONTEXT_FIXTURE_PATH, "utf-8")) as {
      "@context": Record<string, string>;
    };
    expect(ctx["@context"].esea).toBe(base);
  });
});

// Each test re-evaluates communities.ts against fresh env stubs, so the module
// registry must be cleared before every dynamic import.
describe("communities env validation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

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
