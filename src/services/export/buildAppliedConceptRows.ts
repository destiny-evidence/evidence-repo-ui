/**
 * Row-building logic for the applied-concept workbook: one row per record, a
 * fixed bibliographic block followed by one column per SKOS scheme and an
 * "Other codes" catch-all. Each scheme cell holds the `; `-joined prefLabels of
 * that record's `hasAppliedConcept` entries that fall in the scheme; concepts
 * in no listed scheme land in "Other codes". References with no applied
 * concepts still produce a row (with blank concept cells).
 */

import { orderFilterItems } from "@/components/filters/filterOrder";
import {
  extractAbstract,
  extractBibliographic,
  extractDoi,
  extractLinkedDataEnhancement,
  extractOtherIdentifier,
  getInvestigation,
} from "@/services/referenceUtils";
import { parseAppliedConcepts } from "@/services/investigationParser";
import {
  schemeDisplayLabel,
  type ConceptScheme,
} from "@/services/vocabulary/vocabularyService";
import type { PinnedFilter, Reference } from "@/types/models";

import { truncateForCell } from "./buildRows.ts";
import type { CellValue, ConceptResolver } from "./types.ts";

export const APPLIED_CONCEPT_SHEET_NAME = "References";

const OTHER_CODES_HEADER = "Other codes";

type SheetRow = Record<string, CellValue>;

type ReferenceSource = Iterable<Reference> | AsyncIterable<Reference>;

// Human-readable to sit alongside the vocabulary-derived scheme columns; the
// esea workbook instead uses technical keys.
const BIBLIOGRAPHIC_HEADERS = [
  "Reference ID",
  "Title",
  "Authors",
  "Publication year",
  "Journal",
  "DOI",
  "EPPI ItemId",
  "Abstract",
] as const;

interface SchemeColumn {
  uri: string;
  header: string;
}

// Ordered like the filter drawer (orderFilterItems) so columns match the UI
// facets; a label clashing with another column falls back to a URI suffix.
function buildSchemeColumns(
  schemes: ConceptScheme[],
  pinnedFilters: PinnedFilter[] | undefined,
): SchemeColumn[] {
  const ordered = orderFilterItems(schemes, { pinned: pinnedFilters }).flatMap(
    (item) => (item.kind === "scheme" ? [item.scheme] : []),
  );
  const used = new Set<string>([...BIBLIOGRAPHIC_HEADERS, OTHER_CODES_HEADER]);
  return ordered.map((scheme) => {
    let header = schemeDisplayLabel(scheme.label);
    if (used.has(header)) header = `${header} (${scheme.uri})`;
    used.add(header);
    return { uri: scheme.uri, header };
  });
}

function buildAppliedConceptRow(
  reference: Reference,
  vocab: ConceptResolver,
  inScheme: Map<string, string>,
  schemeHeaderByUri: Map<string, string>,
): SheetRow {
  const bib = extractBibliographic(reference);
  const authors = bib?.authorship
    ? bib.authorship.map((a) => a.display_name).join("; ")
    : null;
  const abstract = extractAbstract(reference)?.abstract;
  const row: SheetRow = {
    "Reference ID": String(reference.id),
    Title: bib?.title ?? null,
    Authors: authors || null,
    "Publication year": bib?.publication_year ?? null,
    Journal: bib?.publication_venue?.display_name ?? null,
    DOI: extractDoi(reference.identifiers),
    "EPPI ItemId": extractOtherIdentifier(reference.identifiers, "EPPI ItemId"),
    Abstract: abstract ? truncateForCell(abstract) : null,
  };

  const linked = extractLinkedDataEnhancement(reference);
  if (linked) {
    const appliedConcepts = parseAppliedConcepts(
      getInvestigation(linked.content.data),
      vocab.prefixes,
      vocab.labels,
    );
    const buckets = new Map<string, string[]>();
    for (const concept of appliedConcepts) {
      const header =
        schemeHeaderByUri.get(inScheme.get(concept.uri) ?? "") ??
        OTHER_CODES_HEADER;
      const value = concept.label ?? concept.uri;
      const bucket = buckets.get(header);
      if (bucket) bucket.push(value);
      else buckets.set(header, [value]);
    }
    for (const [header, values] of buckets) {
      row[header] = values.join("; ");
    }
  }

  return row;
}

/**
 * Stream references into a header list and one row per reference. `pinnedFilters`
 * orders the scheme columns to match the community's filter drawer.
 */
export async function buildAppliedConceptRows(
  references: ReferenceSource,
  vocab: ConceptResolver,
  pinnedFilters?: PinnedFilter[],
): Promise<{ headers: string[]; rows: SheetRow[] }> {
  const schemeColumns = buildSchemeColumns(vocab.schemes ?? [], pinnedFilters);
  const schemeHeaderByUri = new Map(
    schemeColumns.map((c) => [c.uri, c.header]),
  );
  const inScheme = vocab.inScheme ?? new Map<string, string>();

  const rows: SheetRow[] = [];
  for await (const reference of references) {
    rows.push(
      buildAppliedConceptRow(reference, vocab, inScheme, schemeHeaderByUri),
    );
  }

  const headers = [
    ...BIBLIOGRAPHIC_HEADERS,
    ...schemeColumns.map((c) => c.header),
  ];
  // Omit the catch-all unless something landed there — usually nothing does.
  if (rows.some((row) => row[OTHER_CODES_HEADER] !== undefined)) {
    headers.push(OTHER_CODES_HEADER);
  }
  return { headers, rows };
}
