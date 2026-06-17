import type {
  Reference,
  Enhancement,
  EnhancementContent,
  AbstractContentEnhancement,
  BibliographicMetadataEnhancement,
  LinkedDataEnhancement,
  ExternalIdentifier,
  Pagination,
} from "@/types/models";
import {
  decodeHtmlEntities,
  stripAbstractLabelPrefix,
} from "@/services/textUtils";

export function isDict(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// The investigation node of a linked-data `data` dict: `hasInvestigation` when
// present, else the dict itself (vocabularies that omit the wrapper).
export function getInvestigation(
  data: Record<string, unknown>,
): Record<string, unknown> {
  return isDict(data["hasInvestigation"]) ? data["hasInvestigation"] : data;
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

// Entity decoding + label-prefix strip only. Mojibake from upstream parsers
// (e.g. UTF-8 double-encoded as Latin-1 leaking through the EEF EPPI parser,
// rendering "3–6" as "3â€" 6") renders as-is — the fix belongs upstream in
// the parser, not as silent client-side repair.
function normalizeAbstractContent(
  content: AbstractContentEnhancement,
): AbstractContentEnhancement {
  const abstract = stripAbstractLabelPrefix(
    decodeHtmlEntities(content.abstract),
  );
  return abstract === content.abstract ? content : { ...content, abstract };
}

// Canonical bucket wins first. Within that bucket, longest body wins; equal
// lengths use latest created_at. This avoids the W4411634320 truncated re-ingest.
// Source/process are deliberately ignored so EEF, OpenAlex, and future abstract
// robots all participate by enhancement_type.
export function extractAbstract(
  reference: Reference,
): AbstractContentEnhancement | null {
  type AbstractEnh = Enhancement & { content: AbstractContentEnhancement };
  const canonical: AbstractEnh[] = [];
  const duplicate: AbstractEnh[] = [];
  for (const e of reference.enhancements ?? []) {
    if (e.content.enhancement_type !== "abstract") continue;
    const narrowed = e as AbstractEnh;
    if (e.reference_id === reference.id) canonical.push(narrowed);
    else duplicate.push(narrowed);
  }
  const bucket = canonical.length ? canonical : duplicate;
  if (bucket.length === 0) return null;
  const winner = bucket.reduce((best, e) => {
    const lenDiff = e.content.abstract.length - best.content.abstract.length;
    if (lenDiff > 0) return e;
    if (lenDiff < 0) return best;
    return (e.created_at ?? "") > (best.created_at ?? "") ? e : best;
  });
  return normalizeAbstractContent(winner.content);
}

// Counts are read straight from raw JSON-LD so badges render on first paint
// without waiting on vocabulary resolution. Returns null when the reference
// has no linked-data enhancement, preserving the `—` fallback path.
export function extractFindingsAndEstimatesCount(
  reference: Reference,
): { findings: number; estimates: number } | null {
  const ld = extractLinkedData(reference);
  if (!ld) return null;
  const investigation = getInvestigation(ld.data);
  const rawFindings = Array.isArray(investigation["hasFinding"])
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

// `other`-typed identifiers are distinguished by `other_identifier_name`
// (e.g. "EPPI ItemId"); return the first match's value.
export function extractOtherIdentifier(
  identifiers: ExternalIdentifier[] | null,
  otherIdentifierName: string,
): string | number | null {
  if (!identifiers) return null;
  const match = identifiers.find(
    (i) =>
      i.identifier_type === "other" &&
      i.other_identifier_name === otherIdentifierName,
  );
  return match?.identifier ?? null;
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
