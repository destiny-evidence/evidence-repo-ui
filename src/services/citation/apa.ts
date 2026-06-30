/**
 * APA 7th-edition reference formatting.
 *
 * Author names are passed through *as stored*, not inverted to "Last, F.".
 * Upstream author strings are inconsistent, eg some "First Last", some "Last First",
 * some "Last. F", some "F. Last".
 *
 * The formatter returns an array of {@link ApaSegment} (text + italic flag) so a
 * rich renderer (HTML italics) and a plain-text consumer (PDF) can share one
 * source of truth — see {@link apaPlainText}.
 */

export interface ApaReferenceInput {
  /** Author display names, rendered verbatim. */
  authors: string[];
  year?: number | string | null;
  title?: string | null;
  /** Journal / publication-venue display name. Italicised. */
  journal?: string | null;
  volume?: string | null;
  issue?: string | null;
  firstPage?: string | null;
  lastPage?: string | null;
  publisher?: string | null;
  /** Raw DOI ("10.x/y"), a "doi:" string, or a full URL. */
  doi?: string | null;
}

export interface ApaSegment {
  text: string;
  /** Rendered italic (journal name, volume number). */
  italic?: boolean;
}

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function ensureSentencePunctuation(value: string): string {
  return /[.?!]$/.test(value) ? value : `${value}.`;
}

/** Normalise an author display name. Passed through as stored — see file note. */
export function formatAuthorName(displayName: string): string {
  return clean(displayName);
}

/**
 * Join authors (verbatim) per APA 7 author-count rules: an ampersand before the
 * final author for 2–20 authors; for 21+, the first 19 then an ellipsis then
 * the final author (no ampersand).
 */
export function formatAuthorList(authors: string[]): string {
  const names = authors.map(clean).filter(Boolean);
  const n = names.length;
  if (n === 0) return "";
  if (n === 1) return names[0];
  if (n === 2) return `${names[0]}, & ${names[1]}`;
  if (n <= 20) {
    return `${names.slice(0, -1).join(", ")}, & ${names[n - 1]}`;
  }
  return `${names.slice(0, 19).join(", ")}, … ${names[n - 1]}`;
}

function formatPagesRange(first: string, last: string): string {
  if (first && last && first !== last) return `${first}–${last}`; // en dash
  return first || last;
}

function formatDoiUrl(doi: string | null | undefined): string | null {
  const value = clean(doi);
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://doi.org/${value.replace(/^doi:\s*/i, "")}`;
}

/**
 * Format a reference as APA 7th-edition segments.
 */
export function formatApaReference(input: ApaReferenceInput): ApaSegment[] {
  const out: ApaSegment[] = [];
  const text = (t: string) => out.push({ text: t });
  const italic = (t: string) => out.push({ text: t, italic: true });

  const authors = formatAuthorList(input.authors ?? []);
  const yearRaw = input.year == null ? "" : String(input.year).trim();
  const year = yearRaw || "n.d.";
  const title = clean(input.title);
  const journal = clean(input.journal);
  const volume = clean(input.volume);
  const issue = clean(input.issue);
  const pages = formatPagesRange(clean(input.firstPage), clean(input.lastPage));
  const publisher = clean(input.publisher);
  const doiUrl = formatDoiUrl(input.doi);

  // Author–date prefix. With no author, the title takes the author slot.
  if (authors) {
    text(`${authors} (${year}). `);
    if (title) text(`${ensureSentencePunctuation(title)} `);
  } else if (title) {
    text(`${ensureSentencePunctuation(title)} (${year}). `);
  } else {
    text(`(${year}). `);
  }

  if (journal) {
    italic(journal);
    if (volume) {
      text(", ");
      italic(volume);
      if (issue) text(`(${issue})`);
    }
    if (pages) text(`, ${pages}`);
    text(".");
  } else if (publisher) {
    text(`${ensureSentencePunctuation(publisher)}`);
  }

  if (doiUrl) text(` ${doiUrl}`);

  const segments = out.filter((s) => s.text !== "");
  const last = segments[segments.length - 1];
  if (last) last.text = last.text.replace(/\s+$/, "");
  return segments;
}

/** Flatten segments to a single plain-text string (italics dropped). */
export function apaPlainText(segments: ApaSegment[]): string {
  return segments.map((s) => s.text).join("");
}

/**
 * Case-insensitive ordering key. We sort by title rather than author due to
 * upstream data issues (see above), so a
 * surname can't be picked reliably, whereas the title is unambiguous. A leading
 * article is dropped, per APA's rule for alphabetising titles. Falls back to the
 * first author as stored when there's no title.
 */
export function apaSortKey(input: ApaReferenceInput): string {
  const title = clean(input.title)
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, "");
  if (title) return title;
  return ((input.authors ?? []).map(clean).find(Boolean) ?? "").toLowerCase();
}

function yearValue(year: ApaReferenceInput["year"]): number {
  const n = Number(String(year ?? "").slice(0, 4));
  // Undated works sort last within an author group.
  return Number.isFinite(n) && n > 0 ? n : Number.MAX_SAFE_INTEGER;
}

/**
 * Bibliography ordering: alphabetical by title (see apaSortKey), then by year
 * (earliest first) to break ties. Use as an Array#sort comparator.
 */
export function compareApaReferences(
  a: ApaReferenceInput,
  b: ApaReferenceInput,
): number {
  const byName = apaSortKey(a).localeCompare(apaSortKey(b));
  return byName !== 0 ? byName : yearValue(a.year) - yearValue(b.year);
}
