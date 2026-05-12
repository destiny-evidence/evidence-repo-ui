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

/**
 * Return the highest-priority enhancement of the given type on a
 * reference, or null.
 *
 * Search-result references arrive with enhancements from the canonical
 * reference (`enhancement.reference_id === reference.id`) alongside any
 * deduplicated duplicates. Canonical data wins even when a duplicate
 * was created more recently. Within the chosen bucket the most recent
 * enhancement by `created_at` wins. We only fall back to the duplicate
 * bucket when the canonical reference has no enhancement of this type
 * at all.
 */
export function extractLatestEnhancement<T extends EnhancementContent>(
  reference: Reference,
  enhancementType: T["enhancement_type"],
): (Enhancement & { content: T }) | null {
  type Narrowed = Enhancement & { content: T };
  const canonical: Narrowed[] = [];
  const duplicate: Narrowed[] = [];
  for (const e of reference.enhancements ?? []) {
    if (e.content.enhancement_type !== enhancementType) continue;
    const narrowed = e as Narrowed;
    if (e.reference_id === reference.id) canonical.push(narrowed);
    else duplicate.push(narrowed);
  }
  const bucket = canonical.length ? canonical : duplicate;
  if (bucket.length === 0) return null;
  // created_at is an ISO-8601 timestamp; lexical sort matches chronological.
  return bucket.reduce((best, e) =>
    (e.created_at ?? "") > (best.created_at ?? "") ? e : best,
  );
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

export function extractOpenAlexId(
  identifiers: ExternalIdentifier[] | null,
): string | null {
  if (!identifiers) return null;
  const openAlex = identifiers.find(
    (i) => i.identifier_type === "open_alex",
  );
  return typeof openAlex?.identifier === "string" ? openAlex.identifier : null;
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
