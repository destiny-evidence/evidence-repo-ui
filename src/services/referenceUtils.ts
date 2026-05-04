import type {
  Reference,
  Enhancement,
  EnhancementContent,
  BibliographicMetadataEnhancement,
  LinkedDataEnhancement,
  ExternalIdentifier,
  Pagination,
} from "@/types/models";
export function isDict(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function extractLatestEnhancement<T extends EnhancementContent>(
  reference: Reference,
  enhancementType: T["enhancement_type"],
): (Enhancement & { content: T }) | null {
  if (!reference.enhancements) return null;
  const matches = reference.enhancements.filter(
    (e): e is Enhancement & { content: T } =>
      e.content.enhancement_type === enhancementType,
  );
  if (matches.length === 0) return null;
  const sorted = matches.sort((a, b) =>
    (a.created_at ?? "").localeCompare(b.created_at ?? ""),
  );
  return sorted[sorted.length - 1];
}

export function extractBibliographic(
  reference: Reference,
): BibliographicMetadataEnhancement | null {
  return (
    extractLatestEnhancement<BibliographicMetadataEnhancement>(
      reference,
      "bibliographic",
    )?.content ?? null
  );
}

// Most callers want the content only — see extractLinkedData.
export function extractLinkedDataEnhancement(
  reference: Reference,
): (Enhancement & { content: LinkedDataEnhancement }) | null {
  return extractLatestEnhancement<LinkedDataEnhancement>(
    reference,
    "linked_data",
  );
}

export function extractLinkedData(
  reference: Reference,
): LinkedDataEnhancement | null {
  return extractLinkedDataEnhancement(reference)?.content ?? null;
}

// Counts are read straight from raw JSON-LD so badges render on first paint
// without waiting on vocabulary resolution. Returns null when the reference
// has no linked-data enhancement, preserving the `—` fallback path.
export function extractFindingsAndEstimatesCount(
  reference: Reference,
): { findings: number; estimates: number } | null {
  const ld = extractLinkedData(reference);
  if (!ld) return null;
  const root = isDict(ld.data) ? ld.data : null;
  const investigation =
    root && isDict(root["hasInvestigation"]) ? root["hasInvestigation"] : root;
  const rawFindings =
    investigation && Array.isArray(investigation["hasFinding"])
      ? investigation["hasFinding"]
      : [];
  let estimates = 0;
  for (const f of rawFindings) {
    if (isDict(f) && Array.isArray(f["hasEffectEstimate"])) {
      estimates += f["hasEffectEstimate"].length;
    }
  }
  return { findings: rawFindings.length, estimates };
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
