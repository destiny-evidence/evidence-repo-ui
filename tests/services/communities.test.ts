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

  it.each([
    {
      slug: "esea",
      name: "Education",
      vocabularyUrl: ENV.VITE_ESEA_VOCABULARY_URL,
      contextUrl: ENV.VITE_ESEA_CONTEXT_URL,
      countNoun: "investigations",
      corpusDescriptor: "education research",
    },
    {
      slug: "hpv",
      name: "HPV Vaccine Delivery",
      vocabularyUrl: ENV.VITE_HPV_VOCABULARY_URL,
      contextUrl: ENV.VITE_HPV_CONTEXT_URL,
      countNoun: "references",
      corpusDescriptor: "HPV vaccine delivery research",
    },
    {
      slug: "destiny",
      name: "DESTINY",
      vocabularyUrl: ENV.VITE_DESTINY_VOCABULARY_URL,
      contextUrl: ENV.VITE_DESTINY_CONTEXT_URL,
      countNoun: "investigations",
      corpusDescriptor: "destiny research",
    },
  ])(
    "resolves $slug with its URLs and copy",
    ({ slug, countNoun, corpusDescriptor, ...identity }) => {
      expect(mod.findCommunity(slug)).toMatchObject({
        ...identity,
        copy: {
          countNoun,
          corpusDescriptor,
          searchPlaceholder: "Search titles and abstracts",
        },
      });
    },
  );

  it("resolves a coding institution for ESEA only", () => {
    expect(mod.findCommunity("esea")?.codingInstitution).toBeDefined();
    expect(mod.findCommunity("hpv")?.codingInstitution).toBeUndefined();
    expect(mod.findCommunity("destiny")?.codingInstitution).toBeUndefined();
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

  it("defaults features to evidence maps, findings/estimates, the country facet and reference selection", () => {
    expect(mod.DEFAULT_FEATURES).toEqual({
      evidenceMap: true,
      aiSummaries: false,
      selfSignup: false,
      findingsAndEstimates: true,
      exportExcel: false,
      countryFacetFilter: true,
      referenceSelection: true,
      nestedEvidenceMapAxes: false,
    });
  });

  it.each([
    {
      slug: "esea",
      aiSummaries: false,
      selfSignup: false,
      findingsAndEstimates: true,
      exportExcel: true,
      countryFacetFilter: true,
      nestedEvidenceMapAxes: false,
    },
    {
      slug: "hpv",
      aiSummaries: true,
      selfSignup: true,
      findingsAndEstimates: false,
      exportExcel: true,
      countryFacetFilter: false,
      nestedEvidenceMapAxes: false,
    },
    {
      slug: "destiny",
      aiSummaries: false,
      selfSignup: false,
      findingsAndEstimates: false,
      exportExcel: false,
      countryFacetFilter: false,
      nestedEvidenceMapAxes: true,
    },
  ])("gates features for $slug", ({ slug, ...features }) => {
    expect(mod.findCommunity(slug)?.features).toMatchObject(features);
  });

  it("selects the per-community export workbook variant", () => {
    expect(mod.findCommunity("esea")?.exportVariant).toBe("esea");
    expect(mod.findCommunity("hpv")?.exportVariant).toBe("hpv");
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
