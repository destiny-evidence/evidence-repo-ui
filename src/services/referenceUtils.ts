import type {
  Reference,
  Enhancement,
  EnhancementContent,
  BibliographicMetadataEnhancement,
  LinkedDataEnhancement,
  ExternalIdentifier,
} from "@/types/models";

function extractEnhancement<T extends EnhancementContent>(
  reference: Reference,
  enhancementType: T["enhancement_type"],
): T | null {
  if (!reference.enhancements) return null;
  const matches = reference.enhancements.filter(
    (e): e is Enhancement & { content: T } =>
      e.content.enhancement_type === enhancementType,
  );
  if (matches.length === 0) return null;
  const sorted = matches.sort((a, b) =>
    (a.created_at ?? "").localeCompare(b.created_at ?? ""),
  );
  return sorted[sorted.length - 1].content;
}

export function extractBibliographic(
  reference: Reference,
): BibliographicMetadataEnhancement | null {
  return extractEnhancement<BibliographicMetadataEnhancement>(
    reference,
    "bibliographic",
  );
}

export function extractLinkedData(
  reference: Reference,
): LinkedDataEnhancement | null {
  return extractEnhancement<LinkedDataEnhancement>(reference, "linked_data");
}

export function extractDoi(
  identifiers: ExternalIdentifier[] | null,
): string | null {
  if (!identifiers) return null;
  const doi = identifiers.find(
    (i) => i.identifier_type === "doi",
  );
  return typeof doi?.identifier === "string" ? doi.identifier : null;
}
