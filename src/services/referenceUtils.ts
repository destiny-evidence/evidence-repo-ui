import type {
  Reference,
  Enhancement,
  BibliographicMetadataEnhancement,
  LinkedDataEnhancement,
  ExternalIdentifier,
} from "@/types/models";

export function extractBibliographic(
  reference: Reference,
): BibliographicMetadataEnhancement | null {
  if (!reference.enhancements) return null;
  const matches = reference.enhancements.filter(
    (e): e is Enhancement & { content: BibliographicMetadataEnhancement } =>
      e.content.enhancement_type === "bibliographic",
  );
  if (matches.length === 0) return null;
  return matches[matches.length - 1].content;
}

export function extractLinkedData(
  reference: Reference,
): LinkedDataEnhancement | null {
  if (!reference.enhancements) return null;
  const matches = reference.enhancements.filter(
    (e): e is Enhancement & { content: LinkedDataEnhancement } =>
      e.content.enhancement_type === "linked_data",
  );
  if (matches.length === 0) return null;
  return matches[matches.length - 1].content;
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
