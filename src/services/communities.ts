import type { Community } from "@/types/models";

const COMMUNITIES: Community[] = [
  { slug: "esea", name: "ESEA" },
];

export function findCommunity(slug: string): Community | undefined {
  return COMMUNITIES.find((c) => c.slug === slug);
}
