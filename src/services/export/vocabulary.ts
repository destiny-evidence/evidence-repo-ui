/**
 * Build a CURIE-to-prefLabel lookup from a SKOS vocabulary TTL file.
 *
 * Mirrors generate_example_combined_results_effects._build_label_lookup:
 * collects @prefix declarations, then for every <URI> skos:prefLabel "label"
 * triple emits "{prefix}:{rest-of-uri}" -> "label" using the longest matching
 * namespace. URI-form subjects are paired with prefLabel via simple
 * line-state tracking, which is sufficient for the vocabulary TTL we ship.
 */

import type { LabelLookup } from "./types.ts";

const PREFIX_RE = /^@prefix\s+([A-Za-z][\w-]*):\s*<([^>]+)>\s*\.\s*$/;
const SUBJECT_RE = /^<([^>]+)>/;
const PREF_LABEL_RE = /skos:prefLabel\s+"((?:[^"\\]|\\.)*)"/;

interface Namespace {
  prefix: string;
  uri: string;
}

interface PrefLabelTriple {
  subject: string;
  label: string;
}

/**
 * Decode the TTL string-escape sequences we actually encounter in the
 * vocabulary file (`\n`, `\t`, `\r`, `\\`, `\"`). Unknown escapes fall
 * through to the literal following character to match rdflib's lenient
 * behaviour on the Python side.
 */
function unescapeTtlString(s: string): string {
  return s.replace(/\\(.)/g, (_, ch: string) => {
    switch (ch) {
      case "n": return "\n";
      case "t": return "\t";
      case "r": return "\r";
      case "\\": return "\\";
      case '"': return '"';
      default: return ch;
    }
  });
}

/**
 * Parse a SKOS vocabulary TTL string and return a CURIE-keyed map of
 * prefLabels.
 *
 * The TTL is scanned line by line: `@prefix` declarations are collected,
 * then each non-indented `<URI>` token sets the current subject for the
 * statement that follows. Every `skos:prefLabel "..."` on that statement
 * produces a `(subject, label)` triple. Subjects are finally rewritten
 * into CURIE form using the longest matching namespace prefix.
 */
export function buildLabelLookup(ttlText: string): LabelLookup {
  const namespaces: Namespace[] = [];
  const triples: PrefLabelTriple[] = [];
  let currentSubject: string | null = null;

  for (const rawLine of ttlText.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line) continue;
    const prefixMatch = line.match(PREFIX_RE);
    if (prefixMatch) {
      namespaces.push({ prefix: prefixMatch[1]!, uri: prefixMatch[2]! });
      continue;
    }
    const subjectMatch = line.match(SUBJECT_RE);
    if (subjectMatch && !line.startsWith(" ") && !line.startsWith("\t")) {
      currentSubject = subjectMatch[1]!;
    }
    const labelMatch = line.match(PREF_LABEL_RE);
    if (labelMatch && currentSubject) {
      triples.push({ subject: currentSubject, label: unescapeTtlString(labelMatch[1]!) });
    }
    if (line.endsWith(" .") || line === ".") {
      currentSubject = null;
    }
  }

  namespaces.sort((a, b) => b.uri.length - a.uri.length);
  const lookup: LabelLookup = new Map();
  for (const { subject, label } of triples) {
    for (const { prefix, uri } of namespaces) {
      if (subject.startsWith(uri)) {
        lookup.set(`${prefix}:${subject.slice(uri.length)}`, label);
        break;
      }
    }
  }
  return lookup;
}
