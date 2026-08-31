import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Community } from "@/types/models";

function stubValidEnv() {
  vi.stubEnv("VITE_ESEA_VOCABULARY_URL", "https://vocab.example/v1");
  vi.stubEnv("VITE_ESEA_CONTEXT_URL", "https://vocab.example/ctx");
  vi.stubEnv("VITE_HPV_VOCABULARY_URL", "https://vocab.example/hpv-v1");
  vi.stubEnv("VITE_HPV_CONTEXT_URL", "https://vocab.example/hpv-ctx");
  vi.stubEnv("VITE_DESTINY_VOCABULARY_URL", "https://vocab.example/dst-v1");
  vi.stubEnv("VITE_DESTINY_CONTEXT_URL", "https://vocab.example/dst-ctx");
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
    "VITE_DESTINY_VOCABULARY_URL",
    "VITE_DESTINY_CONTEXT_URL"
  ])("throws when %s is missing", async (name) => {
    vi.stubEnv(name, "");
    await expect(import("@/services/communities")).rejects.toThrow(name);
  });

  it("resolves each community with its URLs and copy", async () => {
    const { findCommunity } = await import("@/services/communities");
    const esea = findCommunity("esea");
    const hpv = findCommunity("hpv");
    const destiny = findCommunity("destiny");

    expect(esea?.vocabularyUrl).toBe("https://vocab.example/v1");
    expect(esea?.contextUrl).toBe("https://vocab.example/ctx");
    expect(esea?.copy.countNoun).toBe("investigations");
    expect(esea?.copy.corpusDescriptor).toBe("education research");
    expect(esea?.copy.searchPlaceholder).toBe("Search titles and abstracts");

    expect(hpv?.name).toBe("HPV Vaccine Delivery");
    expect(hpv?.vocabularyUrl).toBe("https://vocab.example/hpv-v1");
    expect(hpv?.contextUrl).toBe("https://vocab.example/hpv-ctx");
    expect(hpv?.copy.countNoun).toBe("references");
    expect(hpv?.copy.corpusDescriptor).toBe("HPV vaccine delivery research");
    expect(hpv?.copy.searchPlaceholder).toBe("Search titles and abstracts");
    expect(hpv?.codingInstitution).toBeUndefined();

    expect(destiny?.name).toBe("DESTINY");
    expect(destiny?.vocabularyUrl).toBe("https://vocab.example/dst-v1");
    expect(destiny?.contextUrl).toBe("https://vocab.example/dst-ctx");
    expect(destiny?.copy.countNoun).toBe("investigations");
    expect(destiny?.copy.corpusDescriptor).toBe("destiny research");
    expect(destiny?.copy.searchPlaceholder).toBe("Search titles and abstracts");
    expect(destiny?.codingInstitution).toBeUndefined();
  });

  it("resolves community slugs case-insensitively, so uppercase acronym URLs still work", async () => {
    const { findCommunity } = await import("@/services/communities");
    expect(findCommunity("ESEA")?.slug).toBe("esea");
    expect(findCommunity("Hpv")?.slug).toBe("hpv");
  });

  it("rejects a registered community slug that is not lowercase", async () => {
    const { assertLowercaseSlugs } = await import("@/services/communities");
    expect(() => assertLowercaseSlugs([{ slug: "ESEA" } as Community])).toThrow(
      /lowercase/,
    );
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
    expect(findCommunity("destiny")?.features.aiSummaries).toBe(false);
  });

  it("opts AI summaries out by default, leaving communities to enable them", async () => {
    const { DEFAULT_FEATURES } = await import("@/services/communities");
    expect(DEFAULT_FEATURES.aiSummaries).toBe(false);
  });

  it("opts evidence maps in by default, leaving communities to disable them", async () => {
    const { DEFAULT_FEATURES } = await import("@/services/communities");
    expect(DEFAULT_FEATURES.evidenceMap).toBe(true);
  });

  it("opts Excel export out by default, leaving communities to enable it", async () => {
    const { DEFAULT_FEATURES } = await import("@/services/communities");
    expect(DEFAULT_FEATURES.exportExcel).toBe(false);
  });

  it("gates findings/estimates per community", async () => {
    const { findCommunity } = await import("@/services/communities");
    expect(findCommunity("esea")?.features.findingsAndEstimates).toBe(true);
    expect(findCommunity("hpv")?.features.findingsAndEstimates).toBe(false);
    expect(findCommunity("hpv")?.features.findingsAndEstimates).toBe(false);
  });

  it("enables Excel export for expected communities", async () => {
    const { findCommunity } = await import("@/services/communities");
    expect(findCommunity("esea")?.features.exportExcel).toBe(true);
    expect(findCommunity("hpv")?.features.exportExcel).toBe(true);
    expect(findCommunity("destiny")?.features.exportExcel).toBe(false);
  });

  it("selects the per-community export workbook variant", async () => {
    const { findCommunity } = await import("@/services/communities");
    expect(findCommunity("esea")?.exportVariant).toBe("esea");
    expect(findCommunity("hpv")?.exportVariant).toBe("hpv");
    expect(findCommunity("destiny")?.exportVariant).toBe("destiny");
  });

  it("gates the facet-backed country filter per community", async () => {
    const { findCommunity } = await import("@/services/communities");
    expect(findCommunity("esea")?.features.countryFacetFilter).toBe(true);
    expect(findCommunity("hpv")?.features.countryFacetFilter).toBe(false);
    expect(findCommunity("destiny")?.features.countryFacetFilter).toBe(false);
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

  it("defaults DESTINY's evidence map to interventions/responses/solutions rows x health outcome columns", async () => {
    const { findCommunity } = await import("@/services/communities");
    expect(findCommunity("destiny")?.defaultEvidenceMapAxes).toEqual({
      row: {
        kind: "scheme",
        schemeUri: "https://vocab.destiny-evidence.org/interventions-responses-solutions",
      },
      column: {
        kind: "scheme",
        schemeUri: "https://vocab.destiny-evidence.org/health-outcomes",
      },
    });
  });

  it("declares expected geographic schemes", async () => {
    const { findCommunity } = await import("@/services/communities");
    expect(findCommunity("esea")?.geographicSchemes).toEqual([]);
    expect(findCommunity("destiny")?.geographicSchemes).toEqual([
      "https://vocab.destiny-evidence.org/geographic-location"
    ]);
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

  it("pins HPV's thematic-focus filters above publication year", async () => {
    const { findCommunity } = await import("@/services/communities");
    expect(findCommunity("hpv")?.pinnedFilters?.slice(0, 3)).toEqual([
      "https://vocab.aliveevidence.org/hpv/ThematicFocusPrimary",
      "https://vocab.aliveevidence.org/hpv/ThematicFocusSecondary",
      "year",
    ]);
  });

  it("collapses HPV and DESTINYs filters", async () => {
    const { findCommunity } = await import("@/services/communities");
    expect(findCommunity("hpv")?.defaultExpandedFilters).toEqual([]);
    expect(findCommunity("destiny")?.defaultExpandedFilters).toEqual([]);
    expect(findCommunity("esea")?.defaultExpandedFilters).toBeUndefined();
  });

  it("excludes the HPV geographic schemes from result-card pills, none for other communities", async () => {
    const { findCommunity } = await import("@/services/communities");
    expect(findCommunity("esea")?.pillExcludedSchemes).toEqual([]);
    expect(findCommunity("destiny")?.pillExcludedSchemes).toEqual([]);

    const hpv = findCommunity("hpv");
    // HPV drops its geo schemes from pills; same set as geographicSchemes today,
    // but a distinct field so the pill-exclusion intent is explicit in config.
    expect(hpv?.pillExcludedSchemes).toEqual(hpv?.geographicSchemes);
    expect(hpv?.pillExcludedSchemes).toHaveLength(5);
  });
});
