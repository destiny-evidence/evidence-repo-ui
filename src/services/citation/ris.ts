/**
 * Minimal RIS parser + projection to {@link ApaReferenceInput}.
 *
 * RIS is the tagged citation format reference managers consume: each record is a
 * run of `TAG  - value` lines starting at `TY` and ending at `ER`. We parse the
 * subset our backend emits so the bibliography PDF is built from the *same* RIS the
 * user can download — one source of bibliographic truth.
 */

import type { ApaReferenceInput } from "@/services/citation/apa";

/** Tag → ordered values (most tags are single-valued; AU/UR/SN repeat). */
export type RisRecord = Record<string, string[]>;

// Backend lines are `TAG  - value`; tolerate variable spacing around the dash.
// The two-character tag is anchored to the line start so a dash inside a value
// (e.g. a hyphenated title) is captured, not treated as a delimiter.
const RIS_LINE = /^([A-Z][A-Z0-9])\s*-\s?(.*)$/;

export function parseRis(text: string): RisRecord[] {
  const records: RisRecord[] = [];
  let current: RisRecord | null = null;

  for (const rawLine of text.split(/\r\n|\r|\n/)) {
    const match = rawLine.match(RIS_LINE);
    if (!match) continue;
    const tag = match[1];
    const value = match[2].trimEnd();

    if (tag === "TY") {
      current = {};
      records.push(current);
      current[tag] = [value];
    } else if (tag === "ER") {
      current = null;
    } else if (current) {
      (current[tag] ??= []).push(value);
    }
  }
  return records;
}

function first(record: RisRecord, tag: string): string | null {
  const value = record[tag]?.find((v) => v !== "");
  return value ?? null;
}

// `DA` is rendered YYYY/MM/DD; fall back to its year when `PY` is absent.
function yearOf(record: RisRecord): number | null {
  const py = first(record, "PY");
  if (py && /^\d{4}/.test(py)) return Number(py.slice(0, 4));
  const da = first(record, "DA");
  if (da && /^\d{4}/.test(da)) return Number(da.slice(0, 4));
  return null;
}

/** Project one parsed RIS record onto the APA formatter's input. */
export function risToApaInput(record: RisRecord): ApaReferenceInput {
  return {
    authors: record["AU"] ?? [],
    year: yearOf(record),
    title: first(record, "TI"),
    journal: first(record, "T2"),
    volume: first(record, "VL"),
    issue: first(record, "IS"),
    firstPage: first(record, "SP"),
    lastPage: first(record, "EP"),
    publisher: first(record, "PB"),
    doi: first(record, "DO"),
  };
}
