import type { Community } from "@/types/models";

const COMMUNITIES: Community[] = [
  {
    slug: "esea",
    name: "Education",
    defaultAnnotations: ["domain-inclusion/jacobs-education"],
    vocabBase: "https://vocab.esea.education/",
  },
];

export function findCommunity(slug: string): Community | undefined {
  return COMMUNITIES.find((c) => c.slug === slug);
}
