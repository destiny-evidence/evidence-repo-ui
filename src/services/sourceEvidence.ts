import type { SourceEvidenceEntry } from "@/components/SourceEvidenceToggle";

/**
 * Collect SourceEvidenceEntry[] from one annotation or an array of annotations,
 * keeping only those with non-empty supportingText. Use the spread operator at
 * the call site to flatten the results from multiple fields.
 */
export function evidenceFrom<T extends { supportingText?: string }>(
  label: string,
  source: T | T[] | undefined,
): SourceEvidenceEntry[] {
  if (!source) return [];
  const items = Array.isArray(source) ? source : [source];
  const entries: SourceEvidenceEntry[] = [];
  for (const item of items) {
    if (item.supportingText) {
      entries.push({ label, text: item.supportingText });
    }
  }
  return entries;
}
