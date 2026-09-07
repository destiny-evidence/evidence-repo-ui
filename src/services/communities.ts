import type {
  Community,
  CommunityCopy,
  CommunityFeatures,
  EvidenceMapRenderLimits,
  IdentifierColumn,
} from "@/types/models";
import { rawSourcePatterns } from "@/services/codingInstitution";

function requireEnv(name: string, value: string | undefined): string {
  if (typeof value !== "string" || value === "") {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        "Set it in the build environment or your .env file.",
    );
  }
  return value;
}

export const DEFAULT_FEATURES: CommunityFeatures = {
  evidenceMap: true,
  aiSummaries: false,
  selfSignup: false,
  findingsAndEstimates: true,
  exportsEnabled: false,
  countryFacetFilter: true,
  // Selection UI still only shows where a consumer (AI summary / selection
  // export) is enabled — see selectionEnabled.
  referenceSelection: true,
  nestedEvidenceMapAxes: false,
};

// Mirrors destiny-repository's current cross-facet bucket ceiling (the API's
// own limit on a facet return), so the UI refuses before the API would.
export const DEFAULT_EVIDENCE_MAP_RENDER_LIMITS: EvidenceMapRenderLimits = {
  maxCells: 50_000,
};

// Every community's reference-concepts export leads with the DOI.
const DOI_IDENTIFIER: IdentifierColumn = { header: "DOI", type: "doi" };

// The HPV geographic ConceptSchemes (country + regional/classification). Full
// scheme URIs to match inScheme. Ordered specific → broad: the country, then its
// classification, then the regional groupings (alphabetical) — the order they
// group in as filter cards.
const HPV_GEO_SCHEMES = [
  "https://vocab.aliveevidence.org/hpv/Country",
  "https://vocab.aliveevidence.org/hpv/CountryClassification",
  "https://vocab.aliveevidence.org/hpv/UNICEFRegion",
  "https://vocab.aliveevidence.org/hpv/WHORegion",
  "https://vocab.aliveevidence.org/hpv/WorldBankRegion",
];

// Shared copy fallbacks; a community overrides only what diverges.
function buildCopy(
  name: string,
  overrides: Partial<CommunityCopy>,
): CommunityCopy {
  return {
    searchPlaceholder: "Search titles and abstracts",
    drawerTitle: "Refine the evidence",
    countNoun: "investigations",
    corpusDescriptor: `${name.toLowerCase()} research`,
    ...overrides,
  };
}

const COMMUNITIES: Community[] = [
  {
    slug: "esea",
    name: "Education",
    defaultAnnotations: ["domain-inclusion/jacobs-education"],
    vocabularyUrl: requireEnv(
      "VITE_ESEA_VOCABULARY_URL",
      import.meta.env.VITE_ESEA_VOCABULARY_URL,
    ),
    contextUrl: requireEnv(
      "VITE_ESEA_CONTEXT_URL",
      import.meta.env.VITE_ESEA_CONTEXT_URL,
    ),
    filterExcludedSchemes: [
      "https://vocab.esea.education/ImplementationDescriptionScheme",
    ],
    pillExcludedSchemes: [],
    geographicSchemes: [],
    features: { ...DEFAULT_FEATURES, exportsEnabled: true },
    defaultEvidenceMapAxes: {
      row: {
        kind: "scheme",
        schemeUri: "https://vocab.esea.education/EducationLevelScheme",
      },
      column: {
        kind: "scheme",
        schemeUri: "https://vocab.esea.education/EducationThemeScheme",
      },
    },
    evidenceMapRenderLimits: DEFAULT_EVIDENCE_MAP_RENDER_LIMITS,
    copy: buildCopy("Education", { }),
    exportVariant: "esea",
    codingInstitution: rawSourcePatterns([
      [/(^|[^a-z])eef([^a-z]|$)/, "EEF"],
      [/(^|[^a-z])iiie([^a-z]|$)/, "IIIE"],
      [/(^|[^a-z])essa([^a-z]|$)/, "ESSA"],
      [/(^|[^a-z])wwhge([^a-z]|$)/, "WWHGE"],
    ]),
    externalResources: [
      {
        title: "Onboarding toolkit",
        description:
          "What to do this month, how the taxonomy works in practice, and what your peers are working on.",
        href: "https://srer-cohort-2026.netlify.app",
      },
    ],
  },
  {
    slug: "hpv",
    name: "HPV Vaccine Delivery",
    defaultAnnotations: ["domain-inclusion/hpv"],
    vocabularyUrl: requireEnv(
      "VITE_HPV_VOCABULARY_URL",
      import.meta.env.VITE_HPV_VOCABULARY_URL,
    ),
    contextUrl: requireEnv(
      "VITE_HPV_CONTEXT_URL",
      import.meta.env.VITE_HPV_CONTEXT_URL,
    ),
    filterExcludedSchemes: [],
    pillExcludedSchemes: HPV_GEO_SCHEMES,
    geographicSchemes: HPV_GEO_SCHEMES,
    pinnedFilters: [
      "https://vocab.aliveevidence.org/hpv/ThematicFocusPrimary",
      "https://vocab.aliveevidence.org/hpv/ThematicFocusSecondary",
      "year",
      ...HPV_GEO_SCHEMES,
    ],
    defaultExpandedFilters: [],
    features: {
      ...DEFAULT_FEATURES,
      aiSummaries: true,
      selfSignup: true,
      findingsAndEstimates: false,
      countryFacetFilter: false,
      exportsEnabled: true,
    },
    defaultEvidenceMapAxes: {
      row: {
        kind: "scheme",
        schemeUri: "https://vocab.aliveevidence.org/hpv/WHORegion",
      },
      column: {
        kind: "scheme",
        schemeUri: "https://vocab.aliveevidence.org/hpv/ThematicFocusPrimary",
      },
    },
    evidenceMapRenderLimits: DEFAULT_EVIDENCE_MAP_RENDER_LIMITS,
    copy: buildCopy("HPV Vaccine Delivery", {
      countNoun: "references",
      corpusDescriptor: "HPV vaccine delivery research",
    }),
    exportVariant: "reference-concepts",
    exportIdentifiers: [
      DOI_IDENTIFIER,
      { header: "EPPI ItemId", type: "other", otherName: "EPPI ItemId" },
    ],
    externalResources: [
      {
        title: "Report v3 June 2026",
        description:
          "Framework, search criteria, and methodology for the Repository.",
        href: "https://aliveevidence.org/wp-content/uploads/HPV-repo-report-v3.0.pdf",
      },
      {
        title: "Protocol v3 June 2026",
        description: "Summary of search results from the Repository dataset.",
        href: "https://aliveevidence.org/wp-content/uploads/HPV-repo-protocol-v3.0.pdf",
      },
      {
        title: "HPV Taxonomy v2.3",
        description: "The taxonomy underpinning the Repository.",
        href: "https://vocab.evidence-repository.org/019d3e6a-04d6-76e9-9f7a-b8b26c1e0976/2.3/",
      },
      {
        title: "Changelog",
        description: "Updates and modifications to the Repository.",
        href: "https://aliveevidence.org/hpv-changelog/",
      },
      {
        title: "Tutorial",
        description:
          "Written tutorials explaining how to use the key features of the Repository.",
        href: "https://docs.google.com/document/d/1MaSLw84RumH8U0hXsyw7opRwYFq8UphJMjYVO9L-e44/edit?usp=sharing",
      },
    ],
  },
  {
    slug: "destiny",
    name: "DESTINY",
    defaultAnnotations: ["domain-inclusion/destiny-prototype"],
    vocabularyUrl: requireEnv(
      "VITE_DESTINY_VOCABULARY_URL",
      import.meta.env.VITE_DESTINY_VOCABULARY_URL,
    ),
    contextUrl: requireEnv(
      "VITE_DESTINY_CONTEXT_URL",
      import.meta.env.VITE_DESTINY_CONTEXT_URL,
    ),
    filterExcludedSchemes: [],
    pillExcludedSchemes: [],
    geographicSchemes: [
      "https://vocab.destiny-evidence.org/geographic-location"
    ],
    features: {
      ...DEFAULT_FEATURES,
      findingsAndEstimates: false,
      countryFacetFilter: false,
      exportsEnabled: true,
      nestedEvidenceMapAxes: true,
    },
    exportVariant: "reference-concepts",
    exportIdentifiers: [
      DOI_IDENTIFIER,
      { header: "OpenAlex ID", type: "open_alex" },
    ],
    defaultExpandedFilters: [],
    defaultEvidenceMapAxes: {
      row: {
        kind: "scheme",
        schemeUri: "https://vocab.destiny-evidence.org/interventions-responses-solutions",
      },
      column: {
        kind: "scheme",
        schemeUri: "https://vocab.destiny-evidence.org/health-outcomes",
      },
    },
    evidenceMapRenderLimits: DEFAULT_EVIDENCE_MAP_RENDER_LIMITS,
    copy: buildCopy("DESTINY", {}),
    externalResources: [],
  }
];

// findCommunity normalises lookups to lowercase, so an uppercase registered slug would be unreachable.
export function assertLowercaseSlugs(communities: readonly Community[]): void {
  for (const { slug } of communities) {
    if (slug !== slug.toLowerCase()) {
      throw new Error(
        `Community slug "${slug}" must be lowercase (findCommunity normalises lookups to lowercase).`,
      );
    }
  }
}
assertLowercaseSlugs(COMMUNITIES);

export function findCommunity(slug: string): Community | undefined {
  // Slugs are acronyms (ESEA, HPV) registered lowercase; normalise input so a user typing /ESEA resolves.
  return COMMUNITIES.find((c) => c.slug === slug.toLowerCase());
}

// Brand link / not-found fallback target while there's no true "/" landing
// page — the router only matches /:community/*.
export const DEFAULT_COMMUNITY = (() => {
  const slug = "hpv";
  const community = findCommunity(slug);
  if (!community) {
    throw new Error(`Default community "${slug}" is not registered.`);
  }
  return community;
})();

export const DEFAULT_COMMUNITY_SLUG = DEFAULT_COMMUNITY.slug;
