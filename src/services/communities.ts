import type {
  Community,
  CommunityCopy,
  CommunityFeatures,
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
  evidenceMap: false,
  aiSummaries: false,
  selfSignup: false,
  findingsAndEstimates: true,
  // Off until a community's Excel export is built — the export is Education-shaped today.
  exportExcel: false,
  countryFacetFilter: true,
};

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
    searchPlaceholder: "Search the evidence",
    drawerTitle: "Refine the evidence",
    countNoun: "results",
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
    features: { ...DEFAULT_FEATURES, evidenceMap: true, exportExcel: true },
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
    copy: buildCopy("Education", { countNoun: "investigations" }),
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
      "https://vocab.aliveevidence.org/hpv/ConveningTheme",
      "year",
      ...HPV_GEO_SCHEMES,
    ],
    features: {
      ...DEFAULT_FEATURES,
      evidenceMap: true,
      aiSummaries: true,
      selfSignup: true,
      findingsAndEstimates: false,
      countryFacetFilter: false,
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
    copy: buildCopy("HPV Vaccine Delivery", {
      countNoun: "references",
      corpusDescriptor: "HPV vaccine delivery research",
    }),
    externalResources: [
      {
        title: "Report v2.0 May 2026",
        description:
          "Framework, search criteria, and methodology for the Repository.",
        href: "https://aliveevidence.org/wp-content/uploads/HPV-repo-report-v2.0.pdf",
      },
      {
        title: "Protocol v2.0 May 2026",
        description: "Summary of search results from the Repository dataset.",
        href: "https://aliveevidence.org/wp-content/uploads/HPV-repo-protocol-v2.0.pdf",
      },
      {
        title: "HPV Taxonomy v2.2",
        description: "The taxonomy underpinning the Repository.",
        href: "https://vocab.evidence-repository.org/019d3e6a-04d6-76e9-9f7a-b8b26c1e0976/2.2/",
      },
      {
        title: "Taxonomy Change Report",
        description: "All taxonomy changes since v1.0.",
        href: "https://docs.google.com/document/d/1ApI5_ITUSjWB-saAkI80bJkQ4iAtslgU/edit",
      },
      {
        title: "Changelog v2.0",
        description:
          "Updates and modifications to the Repository since v1.0.",
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
];

// Brand link / not-found fallback target while there's no true "/" landing
// page — the router only matches /:community/*.
export const DEFAULT_COMMUNITY_SLUG = COMMUNITIES[0].slug;

export function findCommunity(slug: string): Community | undefined {
  return COMMUNITIES.find((c) => c.slug === slug);
}
