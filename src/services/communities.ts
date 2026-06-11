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
  selfSignup: false,
  findingsAndEstimates: true,
  // Off until a community's Excel export is built — the export is Education-shaped today.
  exportExcel: false,
  countryFacetFilter: true,
};

// The HPV geographic ConceptSchemes (country + regional/classification). Full scheme
// URIs to match inScheme.
const HPV_GEO_SCHEMES = [
  "https://vocab.aliveevidence.org/hpv/Country",
  "https://vocab.aliveevidence.org/hpv/CountryClassification",
  "https://vocab.aliveevidence.org/hpv/UNICEFRegion",
  "https://vocab.aliveevidence.org/hpv/WorldBankRegion",
  "https://vocab.aliveevidence.org/hpv/WHORegion",
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
    // TODO: placeholder annotation, pending the backend's HPV domain inclusion.
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
    geographicSchemes: HPV_GEO_SCHEMES,
    features: {
      ...DEFAULT_FEATURES,
      evidenceMap: true,
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
  },
];

// Brand link / not-found fallback target while there's no true "/" landing
// page — the router only matches /:community/*.
export const DEFAULT_COMMUNITY_SLUG = COMMUNITIES[0].slug;

export function findCommunity(slug: string): Community | undefined {
  return COMMUNITIES.find((c) => c.slug === slug);
}
