import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function stubValidEnv() {
  vi.stubEnv("VITE_ESEA_VOCABULARY_URL", "https://vocab.example/v1");
  vi.stubEnv("VITE_ESEA_CONTEXT_URL", "https://vocab.example/ctx");
  vi.stubEnv("VITE_HPV_VOCABULARY_URL", "https://vocab.example/hpv-v1");
  vi.stubEnv("VITE_HPV_CONTEXT_URL", "https://vocab.example/hpv-ctx");
}

// Each test re-evaluates communities.ts against fresh env stubs, so the module
// registry must be cleared before every dynamic import.
describe("communities", () => {
  beforeEach(() => {
    vi.resetModules();
    stubValidEnv();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each([
    "VITE_ESEA_VOCABULARY_URL",
    "VITE_ESEA_CONTEXT_URL",
    "VITE_HPV_VOCABULARY_URL",
    "VITE_HPV_CONTEXT_URL",
  ])("throws when %s is missing", async (name) => {
    vi.stubEnv(name, "");
    await expect(import("@/services/communities")).rejects.toThrow(name);
  });

  it("resolves each community with its URLs, copy, and features", async () => {
    const { findCommunity } = await import("@/services/communities");
    const esea = findCommunity("esea");
    const hpv = findCommunity("hpv");

    expect(esea?.vocabularyUrl).toBe("https://vocab.example/v1");
    expect(esea?.contextUrl).toBe("https://vocab.example/ctx");
    // copy: overridden noun, name-derived corpusDescriptor, shared defaults.
    expect(esea?.copy.countNoun).toBe("investigations");
    expect(esea?.copy.corpusDescriptor).toBe("education research");
    expect(esea?.copy.searchPlaceholder).toBe("Search the evidence");
    expect(typeof esea?.features.evidenceMap).toBe("boolean");

    expect(hpv?.name).toBe("HPV Vaccine Delivery");
    expect(hpv?.vocabularyUrl).toBe("https://vocab.example/hpv-v1");
    expect(hpv?.copy.countNoun).toBe("references");
    expect(hpv?.copy.corpusDescriptor).toBe("HPV vaccine delivery research");
    expect(typeof hpv?.features.evidenceMap).toBe("boolean");
    expect(hpv?.codingInstitution).toBeUndefined();
  });

  it("enables AI summaries only for HPV", async () => {
    const { findCommunity } = await import("@/services/communities");
    expect(findCommunity("hpv")?.features.aiSummaries).toBe(true);
    expect(findCommunity("esea")?.features.aiSummaries).toBe(false);
  });

  it("opts every feature out by default, leaving communities to enable them", async () => {
    const { DEFAULT_FEATURES } = await import("@/services/communities");
    expect(DEFAULT_FEATURES.evidenceMap).toBe(false);
    expect(DEFAULT_FEATURES.aiSummaries).toBe(false);
  });
});
