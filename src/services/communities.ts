import type { Community } from "@/types/models";

function requireEnv(name: string, value: string | undefined): string {
  if (typeof value !== "string" || value === "") {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        "Set it in the build environment or your .env file.",
    );
  }
  return value;
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
    filterExcludedSchemes: ["esea:ImplementationDescriptionScheme"],
  },
];

export function findCommunity(slug: string): Community | undefined {
  return COMMUNITIES.find((c) => c.slug === slug);
}
