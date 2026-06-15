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
} from "@/services/referenceUtils";
import { parseInvestigation } from "@/services/investigationParser";
import {
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

/**
 * Derive one column per scheme, headed by the scheme's display label. Guards
 * against a label colliding with the bibliographic block or another scheme by
 * falling back to the (unique) scheme URI suffix.
 */
function buildSchemeColumns(schemes: ConceptScheme[]): SchemeColumn[] {
  const used = new Set<string>(BIBLIOGRAPHIC_HEADERS);
  return schemes.map((scheme) => {
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
    const { appliedConcepts } = parseInvestigation(
      linked.content.data,
      vocab.prefixes,
      vocab.labels,
    );
    const buckets = new Map<string, string[]>();
    for (const concept of appliedConcepts) {
      const header = schemeHeaderByUri.get(inScheme.get(concept.uri) ?? "");
      if (!header) continue;
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
  for await (const reference of references) {
    rows.push(buildReferenceRow(reference, vocab, inScheme, schemeHeaderByUri));
  }
  return { headers, rows };
}
