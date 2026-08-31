import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Community } from "@/types/models";

// Single source for the required variables: the stub, the missing-variable
// cases, and the URL assertions all derive from these entries.
const ENV = {
  VITE_ESEA_VOCABULARY_URL: "https://vocab.example/esea-v1",
  VITE_ESEA_CONTEXT_URL: "https://vocab.example/esea-ctx",
  VITE_HPV_VOCABULARY_URL: "https://vocab.example/hpv-v1",
  VITE_HPV_CONTEXT_URL: "https://vocab.example/hpv-ctx",
  VITE_DESTINY_VOCABULARY_URL: "https://vocab.example/dst-v1",
  VITE_DESTINY_CONTEXT_URL: "https://vocab.example/dst-ctx",
} as const;

function stubValidEnv() {
  for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
}

// communities.ts reads env at module scope, so each case here needs the module
// registry cleared before its dynamic import.
describe("communities env validation", () => {
  beforeEach(() => {
    vi.resetModules();
    stubValidEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(Object.keys(ENV))("throws when %s is missing", async (name) => {
    vi.stubEnv(name, "");
    await expect(import("@/services/communities")).rejects.toThrow(name);
  });
});

describe("community registry", () => {
  let mod: typeof import("@/services/communities");

  beforeAll(async () => {
    vi.resetModules();
    stubValidEnv();
    mod = await import("@/services/communities");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("resolves each community with its URLs and copy", () => {
    const esea = mod.findCommunity("esea");
    const hpv = mod.findCommunity("hpv");
    const destiny = mod.findCommunity("destiny");

    expect(esea?.vocabularyUrl).toBe(ENV.VITE_ESEA_VOCABULARY_URL);
    expect(esea?.contextUrl).toBe(ENV.VITE_ESEA_CONTEXT_URL);
    expect(esea?.copy.countNoun).toBe("investigations");
    expect(esea?.copy.corpusDescriptor).toBe("education research");
    expect(esea?.copy.searchPlaceholder).toBe("Search titles and abstracts");

    expect(hpv?.name).toBe("HPV Vaccine Delivery");
    expect(hpv?.vocabularyUrl).toBe(ENV.VITE_HPV_VOCABULARY_URL);
    expect(hpv?.contextUrl).toBe(ENV.VITE_HPV_CONTEXT_URL);
    expect(hpv?.copy.countNoun).toBe("references");
    expect(hpv?.copy.corpusDescriptor).toBe("HPV vaccine delivery research");
    expect(hpv?.copy.searchPlaceholder).toBe("Search titles and abstracts");
    expect(hpv?.codingInstitution).toBeUndefined();

    expect(destiny?.name).toBe("DESTINY");
    expect(destiny?.vocabularyUrl).toBe(ENV.VITE_DESTINY_VOCABULARY_URL);
    expect(destiny?.contextUrl).toBe(ENV.VITE_DESTINY_CONTEXT_URL);
    expect(destiny?.copy.countNoun).toBe("investigations");
    expect(destiny?.copy.corpusDescriptor).toBe("destiny research");
    expect(destiny?.copy.searchPlaceholder).toBe("Search titles and abstracts");
    expect(destiny?.codingInstitution).toBeUndefined();
  });

  it("resolves community slugs case-insensitively, so uppercase acronym URLs still work", () => {
    expect(mod.findCommunity("ESEA")?.slug).toBe("esea");
    expect(mod.findCommunity("Hpv")?.slug).toBe("hpv");
  });

  it("rejects a registered community slug that is not lowercase", () => {
    expect(() =>
      mod.assertLowercaseSlugs([{ slug: "ESEA" } as Community]),
    ).toThrow(/lowercase/);
  });

  it("defaults to the HPV community", () => {
    expect(mod.DEFAULT_COMMUNITY_SLUG).toBe("hpv");
    expect(mod.DEFAULT_COMMUNITY.name).toBe("HPV Vaccine Delivery");
  });

  it("enables AI summaries only for HPV", () => {
    expect(mod.findCommunity("hpv")?.features.aiSummaries).toBe(true);
    expect(mod.findCommunity("esea")?.features.aiSummaries).toBe(false);
    expect(mod.findCommunity("destiny")?.features.aiSummaries).toBe(false);
  });

  it("opts AI summaries out by default, leaving communities to enable them", () => {
    expect(mod.DEFAULT_FEATURES.aiSummaries).toBe(false);
  });

  it("opts evidence maps in by default, leaving communities to disable them", () => {
    expect(mod.DEFAULT_FEATURES.evidenceMap).toBe(true);
  });

  it("opts Excel export out by default, leaving communities to enable it", () => {
    expect(mod.DEFAULT_FEATURES.exportExcel).toBe(false);
  });

  it("gates findings/estimates per community", () => {
    expect(mod.findCommunity("esea")?.features.findingsAndEstimates).toBe(true);
    expect(mod.findCommunity("hpv")?.features.findingsAndEstimates).toBe(false);
    expect(mod.findCommunity("hpv")?.features.findingsAndEstimates).toBe(false);
  });

  it("enables Excel export for expected communities", () => {
    expect(mod.findCommunity("esea")?.features.exportExcel).toBe(true);
    expect(mod.findCommunity("hpv")?.features.exportExcel).toBe(true);
    expect(mod.findCommunity("destiny")?.features.exportExcel).toBe(false);
  });

  it("selects the per-community export workbook variant", () => {
    expect(mod.findCommunity("esea")?.exportVariant).toBe("esea");
    expect(mod.findCommunity("hpv")?.exportVariant).toBe("hpv");
    expect(mod.findCommunity("destiny")?.exportVariant).toBe("destiny");
  });

  it("gates the facet-backed country filter per community", () => {
    expect(mod.findCommunity("esea")?.features.countryFacetFilter).toBe(true);
    expect(mod.findCommunity("hpv")?.features.countryFacetFilter).toBe(false);
    expect(mod.findCommunity("destiny")?.features.countryFacetFilter).toBe(
      false,
    );
  });

  it("defaults HPV's evidence map to WHO Region rows x Thematic Focus — Primary columns", () => {
    expect(mod.findCommunity("hpv")?.defaultEvidenceMapAxes).toEqual({
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

  it("defaults DESTINY's evidence map to interventions/responses/solutions rows x health outcome columns", () => {
    expect(mod.findCommunity("destiny")?.defaultEvidenceMapAxes).toEqual({
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

  it("declares expected geographic schemes", () => {
    expect(mod.findCommunity("esea")?.geographicSchemes).toEqual([]);
    expect(mod.findCommunity("destiny")?.geographicSchemes).toEqual([
      "https://vocab.destiny-evidence.org/geographic-location"
    ]);
    const hpvGeo = mod.findCommunity("hpv")?.geographicSchemes ?? [];
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

  it("pins HPV's thematic-focus filters above publication year", () => {
    expect(mod.findCommunity("hpv")?.pinnedFilters?.slice(0, 3)).toEqual([
      "https://vocab.aliveevidence.org/hpv/ThematicFocusPrimary",
      "https://vocab.aliveevidence.org/hpv/ThematicFocusSecondary",
      "year",
    ]);
  });

  it("collapses HPV and DESTINYs filters", () => {
    expect(mod.findCommunity("hpv")?.defaultExpandedFilters).toEqual([]);
    expect(mod.findCommunity("destiny")?.defaultExpandedFilters).toEqual([]);
    expect(mod.findCommunity("esea")?.defaultExpandedFilters).toBeUndefined();
  });

  it("excludes the HPV geographic schemes from result-card pills, none for other communities", () => {
    expect(mod.findCommunity("esea")?.pillExcludedSchemes).toEqual([]);
    expect(mod.findCommunity("destiny")?.pillExcludedSchemes).toEqual([]);

    const hpv = mod.findCommunity("hpv");
    // HPV drops its geo schemes from pills; same set as geographicSchemes today,
    // but a distinct field so the pill-exclusion intent is explicit in config.
    expect(hpv?.pillExcludedSchemes).toEqual(hpv?.geographicSchemes);
    expect(hpv?.pillExcludedSchemes).toHaveLength(5);
  });
});
