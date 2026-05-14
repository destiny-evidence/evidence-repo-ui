/**
 * Browser-friendly entry point. `generateWorkbook` takes an iterable of
 * Reference objects and a `ConceptResolver` and returns a SheetJS workbook
 * ready to write. Pure with respect to its inputs — no disk or network
 * access — so it runs in the browser as well as Node.
 */

import * as XLSX from "xlsx";

import {
  SHEET_HEADERS,
  assignArmIds,
  buildFindingRows,
  buildInvestigationRow,
  buildOutcomeRows,
} from "./buildRows.ts";
import {
  extractBibliographic,
  extractLinkedDataEnhancement,
  isDict,
} from "@/services/referenceUtils";
import type { Reference } from "@/types/models";

import type {
  ArmRow,
  BuiltRows,
  ConceptResolver,
  Finding,
  Investigation,
  InvestigationRow,
  OutcomeRow,
} from "./types.ts";

const SHEET_NAMES = {
  investigation: "Investigation Details",
  arms: "Investigation Arms",
  outcomes: "Outcomes",
} as const;

type AnyRow = InvestigationRow | ArmRow | OutcomeRow;

type ReferenceSource =
  | Iterable<Reference>
  | AsyncIterable<Reference>;

/**
 * Convert a list of header-keyed row objects into the array-of-arrays
 * shape SheetJS expects: the first inner array is the header row, and
 * each subsequent row contains the values in the same column order, with
 * missing keys filled in as null.
 */
function rowsToAoa<R extends AnyRow>(
  headers: ReadonlyArray<keyof R & string>,
  rows: R[],
): unknown[][] {
  const aoa: unknown[][] = [headers as unknown as string[]];
  for (const row of rows) {
    aoa.push(headers.map((h) => {
      const value = row[h];
      return value === undefined ? null : value;
    }));
  }
  return aoa;
}

/**
 * Compute per-column widths for the worksheet
 * Width is the length of the longest single
 * line in the column (header or any row), padded by 2, then clamped to
 * the range [12, 60].
 * Multi-line cell contents are measured per line so
 * wrapped cells don't blow the column out.
 */
function colWidths<R extends AnyRow>(
  headers: ReadonlyArray<keyof R & string>,
  rows: R[],
): Array<{ wch: number }> {
  return headers.map((header) => {
    let maxLen = String(header).length;
    for (const row of rows) {
      const value = row[header];
      if (value == null) continue;
      const text = String(value);
      const longest = text.split("\n").reduce((m, line) => Math.max(m, line.length), 0);
      if (longest > maxLen) maxLen = longest;
    }
    return { wch: Math.min(Math.max(maxLen + 2, 12), 60) };
  });
}

/**
 * Materialise one tab on the workbook: convert rows to AoA, set column
 * widths, and append the sheet under the given name.
 */
function appendSheet<R extends AnyRow>(
  wb: XLSX.WorkBook,
  name: string,
  headers: ReadonlyArray<keyof R & string>,
  rows: R[],
): void {
  const ws = XLSX.utils.aoa_to_sheet(rowsToAoa(headers, rows));
  ws["!cols"] = colWidths(headers, rows);
  XLSX.utils.book_append_sheet(wb, ws, name);
}

/**
 * Stream references and produce the three lists of header-keyed row
 * dicts. Accepts either a synchronous iterable (e.g. an array) or an
 * async iterable (e.g. the JSONL stream reader); `for await...of`
 * handles both. References without a linked-data enhancement are skipped
 * (no structured investigation to export).
 */
export async function buildAllRows(
  references: ReferenceSource,
  vocab: ConceptResolver,
): Promise<BuiltRows> {
  const investigation: InvestigationRow[] = [];
  const arms: ArmRow[] = [];
  const outcomes: OutcomeRow[] = [];
  for await (const reference of references) {
    const linked = extractLinkedDataEnhancement(reference);
    if (!linked) continue;
    const bibliographic = extractBibliographic(reference);
    const referenceId = String(reference.id);
    const rawInvestigation = linked.content.data["hasInvestigation"];
    const inv: Investigation = isDict(rawInvestigation) ? rawInvestigation : {};
    const findings = (Array.isArray(inv["hasFinding"]) ? inv["hasFinding"] : []) as Finding[];
    const armIds = assignArmIds(findings);
    investigation.push(
      buildInvestigationRow(reference, bibliographic, linked, inv, vocab),
    );
    arms.push(...buildFindingRows(referenceId, findings, armIds, vocab));
    outcomes.push(...buildOutcomeRows(referenceId, findings, armIds, vocab));
  }
  return { investigation, arms, outcomes };
}

/**
 * Top-level export: build rows for every reference and assemble the
 * three-tab workbook (Investigation Details, Investigation Arms,
 * Outcomes). Pure with respect to its inputs — no disk or network
 * access — so it runs in the browser as well as Node.
 *
 * The references argument can be a sync iterable (array) or async
 * iterable (JSONL stream), letting callers either load the whole file or
 * stream it from a signed URL. The `vocab` argument bundles the
 * JSON-LD @context prefix map and the URI-keyed prefLabel map fetched
 * via `vocabularyService` / `contextService`.
 */
export async function generateWorkbook(
  references: ReferenceSource,
  vocab: ConceptResolver,
): Promise<XLSX.WorkBook> {
  const rows = await buildAllRows(references, vocab);
  const wb = XLSX.utils.book_new();
  appendSheet(wb, SHEET_NAMES.investigation, SHEET_HEADERS.investigation, rows.investigation);
  appendSheet(wb, SHEET_NAMES.arms, SHEET_HEADERS.arms, rows.arms);
  appendSheet(wb, SHEET_NAMES.outcomes, SHEET_HEADERS.outcomes, rows.outcomes);
  return wb;
}

/**
 * Serialize a workbook to an `ArrayBuffer` suitable for handing to a
 * browser download (e.g. `new Blob([buf])`).
 */
export function workbookToArrayBuffer(wb: XLSX.WorkBook): ArrayBuffer {
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

/**
 * Parse a JSONL string into an array of Reference objects, skipping blank
 * lines. Throws (via `JSON.parse`) if any non-blank line is malformed.
 */
export function parseJsonl(text: string): Reference[] {
  const out: Reference[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    out.push(JSON.parse(line) as Reference);
  }
  return out;
}
