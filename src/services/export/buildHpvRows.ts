/**
 * Row-building logic for the HPV reference-level workbook: one row per
 * reference, a fixed bibliographic block followed by one column per SKOS
 * scheme. Each scheme cell holds the `; `-joined prefLabels of that
 * reference's applied concepts that fall in the scheme. References with no
 * applied concepts still produce a row (with blank scheme cells).
 */

import {
  extractAbstract,
  extractBibliographic,
  extractDoi,
  extractLinkedDataEnhancement,
  getInvestigation,
} from "@/services/referenceUtils";
import { parseAppliedConcepts } from "@/services/investigationParser";
import {
  compareLabels,
  schemeDisplayLabel,
  type ConceptScheme,
} from "@/services/vocabulary/vocabularyService";
import type { Reference } from "@/types/models";

import type { CellValue, ConceptResolver } from "./types.ts";

export const HPV_SHEET_NAME = "References";

type SheetRow = Record<string, CellValue>;

type ReferenceSource = Iterable<Reference> | AsyncIterable<Reference>;

const BIBLIOGRAPHIC_HEADERS = [
  "reference_id",
  "title",
  "authors",
  "publication_year",
  "journal",
  "doi",
  "abstract",
] as const;

interface SchemeColumn {
  uri: string;
  header: string;
}

// Ordered by label to match the filter drawer / evidence map, not raw @graph
// order. A label clashing with the bibliographic block or another scheme falls
// back to a URI-suffixed form.
function buildSchemeColumns(schemes: ConceptScheme[]): SchemeColumn[] {
  const used = new Set<string>(BIBLIOGRAPHIC_HEADERS);
  return [...schemes].sort(compareLabels).map((scheme) => {
    let header = schemeDisplayLabel(scheme.label);
    if (used.has(header)) header = `${header} (${scheme.uri})`;
    used.add(header);
    return { uri: scheme.uri, header };
  });
}

function buildReferenceRow(
  reference: Reference,
  vocab: ConceptResolver,
  inScheme: Map<string, string>,
  schemeHeaderByUri: Map<string, string>,
  dropped: Set<string>,
): SheetRow {
  const bib = extractBibliographic(reference);
  const authors = bib?.authorship
    ? bib.authorship.map((a) => a.display_name).join("; ")
    : null;
  const row: SheetRow = {
    reference_id: String(reference.id),
    title: bib?.title ?? null,
    authors: authors || null,
    publication_year: bib?.publication_year ?? null,
    journal: bib?.publication_venue?.display_name ?? null,
    doi: extractDoi(reference.identifiers),
    abstract: extractAbstract(reference)?.abstract ?? null,
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
      const header = schemeHeaderByUri.get(inScheme.get(concept.uri) ?? "");
      // No column for this concept's scheme; record it so callers can warn
      // rather than drop it silently.
      if (!header) {
        dropped.add(concept.uri);
        continue;
      }
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
 * Stream references and produce the header list (bibliographic block plus one
 * column per scheme) and one row per reference. Accepts a sync or async
 * iterable; `for await...of` handles both.
 */
export async function buildReferenceRows(
  references: ReferenceSource,
  vocab: ConceptResolver,
): Promise<{ headers: string[]; rows: SheetRow[] }> {
  const schemeColumns = buildSchemeColumns(vocab.schemes ?? []);
  const schemeHeaderByUri = new Map(
    schemeColumns.map((c) => [c.uri, c.header]),
  );
  const inScheme = vocab.inScheme ?? new Map<string, string>();
  const headers = [
    ...BIBLIOGRAPHIC_HEADERS,
    ...schemeColumns.map((c) => c.header),
  ];

  const rows: SheetRow[] = [];
  const dropped = new Set<string>();
  for await (const reference of references) {
    rows.push(
      buildReferenceRow(reference, vocab, inScheme, schemeHeaderByUri, dropped),
    );
  }
  if (dropped.size > 0) {
    console.warn(
      `HPV export: omitted ${dropped.size} applied concept(s) with no matching ` +
        `scheme column: ${[...dropped].join(", ")}`,
    );
  }
  return { headers, rows };
}
