import type {
  Reference,
  Enhancement,
  EnhancementContent,
  BibliographicMetadataEnhancement,
  LinkedDataEnhancement,
  ExternalIdentifier,
  Pagination,
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

// Editorial citation format: `volume(issue), first_page–last_page`.
// Uses en dash (U+2013) for page ranges per typographic convention.
// Returns "" when nothing meaningful to render.
export function formatPagination(pagination: Pagination | null): string {
  if (!pagination) return "";
  const { volume, issue, first_page, last_page } = pagination;

  let volumeIssue = "";
  if (volume && issue) volumeIssue = `${volume}(${issue})`;
  else if (volume) volumeIssue = volume;
  else if (issue) volumeIssue = `(${issue})`;

  let pages = "";
  if (first_page && last_page && last_page !== first_page) {
    pages = `${first_page}–${last_page}`;
  } else if (first_page) {
    pages = first_page;
  } else if (last_page) {
    pages = last_page;
  }

  if (volumeIssue && pages) return `${volumeIssue}, ${pages}`;
  return volumeIssue || pages;
}
