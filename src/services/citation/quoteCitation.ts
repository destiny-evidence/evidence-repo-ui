import type { PaperMeta } from "@/services/summariser";

/**
 * Author-year citation for a quote's source paper, shared by the summary drawer
 * and the PDF export so the two never drift.
 *
 * Takes the resolved paper rather than looking it up, because callers need the
 * same lookup to decide whether the paper links to a record at all.
 */
export function quoteCitation(
  paper: PaperMeta | undefined,
  paperId: string,
): string {
  if (!paper) return paperId;
  const lead = paper.authors[0] ?? paper.title ?? paperId;
  const etAl = paper.authors.length > 1 ? " et al." : "";
  const year = paper.year ? ` (${paper.year})` : "";
  return `${lead}${etAl}${year}`;
}
