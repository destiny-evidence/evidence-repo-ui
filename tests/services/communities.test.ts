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
    expect(esea?.copy.searchPlaceholder).toBe("Search titles and abstracts");
    expect(typeof esea?.features.evidenceMap).toBe("boolean");

    expect(hpv?.name).toBe("HPV Vaccine Delivery");
    expect(hpv?.vocabularyUrl).toBe("https://vocab.example/hpv-v1");
    expect(hpv?.copy.countNoun).toBe("references");
    expect(hpv?.copy.corpusDescriptor).toBe("HPV vaccine delivery research");
    expect(hpv?.copy.searchPlaceholder).toBe("Search titles and abstracts");
    expect(typeof hpv?.features.evidenceMap).toBe("boolean");
    expect(hpv?.codingInstitution).toBeUndefined();
  });

  it("defaults to the HPV community", async () => {
    const { DEFAULT_COMMUNITY, DEFAULT_COMMUNITY_SLUG } = await import(
      "@/services/communities"
    );
    expect(DEFAULT_COMMUNITY_SLUG).toBe("hpv");
    expect(DEFAULT_COMMUNITY.name).toBe("HPV Vaccine Delivery");
  });

  it("enables AI summaries only for HPV", async () => {
    const { findCommunity } = await import("@/services/communities");
    expect(findCommunity("hpv")?.features.aiSummaries).toBe(true);
    expect(findCommunity("esea")?.features.aiSummaries).toBe(false);
  });

  it("opts evidence-map and AI summaries out by default, leaving communities to enable them", async () => {
    const { DEFAULT_FEATURES } = await import("@/services/communities");
    expect(DEFAULT_FEATURES.evidenceMap).toBe(false);
    expect(DEFAULT_FEATURES.aiSummaries).toBe(false);
  });

  it("opts Excel export out by default, leaving communities to enable it", async () => {
    const { DEFAULT_FEATURES } = await import("@/services/communities");
    expect(DEFAULT_FEATURES.exportExcel).toBe(false);
  });

  it("gates findings/estimates per community (ESEA on, HPV off)", async () => {
    const { findCommunity } = await import("@/services/communities");
    expect(findCommunity("esea")?.features.findingsAndEstimates).toBe(true);
    expect(findCommunity("hpv")?.features.findingsAndEstimates).toBe(false);
  });

  it("gates Excel export per community (ESEA on, HPV off until #127)", async () => {
    const { findCommunity } = await import("@/services/communities");
    expect(findCommunity("esea")?.features.exportExcel).toBe(true);
    expect(findCommunity("hpv")?.features.exportExcel).toBe(false);
  });

  it("gates the facet-backed country filter per community (ESEA on, HPV off)", async () => {
    const { findCommunity } = await import("@/services/communities");
    expect(findCommunity("esea")?.features.countryFacetFilter).toBe(true);
    expect(findCommunity("hpv")?.features.countryFacetFilter).toBe(false);
  });

  it("defaults HPV's evidence map to WHO Region rows x Thematic Focus — Primary columns", async () => {
    const { findCommunity } = await import("@/services/communities");
    expect(findCommunity("hpv")?.defaultEvidenceMapAxes).toEqual({
      row: {
        kind: "scheme",
        schemeUri: "https://vocab.aliveevidence.org/hpv/WHORegion",
      },
      column: {
        kind: "scheme",
        schemeUri: "https://vocab.aliveevidence.org/hpv/ThematicFocusPrimary",
      },
    });
  });

  it("declares exactly the 5 HPV geographic schemes, none for ESEA", async () => {
    const { findCommunity } = await import("@/services/communities");
    expect(findCommunity("esea")?.geographicSchemes).toEqual([]);
    const hpvGeo = findCommunity("hpv")?.geographicSchemes ?? [];
    expect(hpvGeo).toHaveLength(5);
    expect(hpvGeo).toEqual(
      expect.arrayContaining([
        "https://vocab.aliveevidence.org/hpv/Country",
        "https://vocab.aliveevidence.org/hpv/CountryClassification",
        "https://vocab.aliveevidence.org/hpv/UNICEFRegion",
        "https://vocab.aliveevidence.org/hpv/WorldBankRegion",
        "https://vocab.aliveevidence.org/hpv/WHORegion",
      ]),
    );
  });

  it("excludes the HPV geographic schemes from result-card pills, none for ESEA", async () => {
    const { findCommunity } = await import("@/services/communities");
    expect(findCommunity("esea")?.pillExcludedSchemes).toEqual([]);
    const hpv = findCommunity("hpv");
    // HPV drops its geo schemes from pills; same set as geographicSchemes today,
    // but a distinct field so the pill-exclusion intent is explicit in config.
    expect(hpv?.pillExcludedSchemes).toEqual(hpv?.geographicSchemes);
    expect(hpv?.pillExcludedSchemes).toHaveLength(5);
  });
});
