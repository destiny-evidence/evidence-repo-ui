import type { PaperMeta } from "@/services/summariser";

/**
 * Author-year citation for a quote's source paper.
 *
 * Falls back to paperId if no paper metadata available.
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
