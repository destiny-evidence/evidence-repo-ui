/**
 * Row-building logic for the reference-concepts workbook: one row per record, a
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
  extractIdentifier,
  extractLinkedDataEnhancement,
  getInvestigation,
} from "@/services/referenceUtils";
import { parseAppliedConcepts } from "@/services/investigationParser";
import {
  schemeDisplayLabel,
  type ConceptScheme,
} from "@/services/vocabulary/vocabularyService";
import type {
  IdentifierColumn,
  PinnedFilter,
  Reference,
} from "@/types/models";

import { truncateForCell } from "./buildRows.ts";
import type { CellValue, ConceptResolver } from "./types.ts";

export const REFERENCE_CONCEPT_SHEET_NAME = "References";

const OTHER_CODES_HEADER = "Other codes";

type SheetRow = Record<string, CellValue>;

type ReferenceSource = Iterable<Reference> | AsyncIterable<Reference>;

// Human-readable to sit alongside the vocabulary-derived scheme columns; the
// esea workbook instead uses technical keys. The community's identifier
// columns are spliced between "DOI" and "Abstract".
const HEADERS_BEFORE_IDENTIFIERS = [
  "Reference ID",
  "Title",
  "Authors",
  "Publication year",
  "Journal",
  "DOI",
] as const;
const HEADERS_AFTER_IDENTIFIERS = ["Abstract"] as const;

export interface ReferenceConceptRowOptions {
  // Orders the scheme columns to match the community's filter drawer.
  pinnedFilters?: PinnedFilter[];
  identifierColumns?: readonly IdentifierColumn[];
}

function bibliographicHeaders(
  identifierColumns: readonly IdentifierColumn[],
): string[] {
  return [
    ...HEADERS_BEFORE_IDENTIFIERS,
    ...identifierColumns.map((c) => c.header),
    ...HEADERS_AFTER_IDENTIFIERS,
  ];
}

interface SchemeColumn {
  uri: string;
  header: string;
}

// Ordered like the filter drawer (orderFilterItems) so columns match the UI
// facets; a label clashing with another column falls back to a URI suffix.
function buildSchemeColumns(
  schemes: ConceptScheme[],
  pinnedFilters: PinnedFilter[] | undefined,
  bibHeaders: readonly string[],
): SchemeColumn[] {
  const ordered = orderFilterItems(schemes, { pinned: pinnedFilters }).flatMap(
    (item) => (item.kind === "scheme" ? [item.scheme] : []),
  );
  const used = new Set<string>([...bibHeaders, OTHER_CODES_HEADER]);
  return ordered.map((scheme) => {
    let header = schemeDisplayLabel(scheme.label);
    if (used.has(header)) header = `${header} (${scheme.uri})`;
    used.add(header);
    return { uri: scheme.uri, header };
  });
}

function buildReferenceConceptRow(
  reference: Reference,
  vocab: ConceptResolver,
  inScheme: Map<string, string>,
  schemeHeaderByUri: Map<string, string>,
  identifierColumns: readonly IdentifierColumn[],
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
    Abstract: abstract ? truncateForCell(abstract) : null,
  };
  for (const column of identifierColumns) {
    row[column.header] = extractIdentifier(reference.identifiers, column);
  }

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
      // A record coded transitively across a deep scheme can join into a cell
      // longer than Excel accepts.
      row[header] = truncateForCell(values.join("; "));
    }
  }

  return row;
}

/**
 * Stream references into a header list and one row per reference.
 */
export async function buildReferenceConceptRows(
  references: ReferenceSource,
  vocab: ConceptResolver,
  { pinnedFilters, identifierColumns = [] }: ReferenceConceptRowOptions = {},
): Promise<{ headers: string[]; rows: SheetRow[] }> {
  const bibHeaders = bibliographicHeaders(identifierColumns);
  const schemeColumns = buildSchemeColumns(
    vocab.schemes ?? [],
    pinnedFilters,
    bibHeaders,
  );
  const schemeHeaderByUri = new Map(
    schemeColumns.map((c) => [c.uri, c.header]),
  );
  const inScheme = vocab.inScheme ?? new Map<string, string>();

  const rows: SheetRow[] = [];
  for await (const reference of references) {
    rows.push(
      buildReferenceConceptRow(
        reference,
        vocab,
        inScheme,
        schemeHeaderByUri,
        identifierColumns,
      ),
    );
  }

  const headers = [...bibHeaders, ...schemeColumns.map((c) => c.header)];
  // Omit the catch-all unless something landed there — usually nothing does.
  if (rows.some((row) => row[OTHER_CODES_HEADER] !== undefined)) {
    headers.push(OTHER_CODES_HEADER);
  }
  return { headers, rows };
}
