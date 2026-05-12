/**
 * Browser entry point for the Excel export pipeline. Fetches the JSONL of
 * references from a signed URL, fetches the SKOS vocabulary TTL, hands
 * both to `generateWorkbook`, and triggers a browser download of the
 * resulting `.xlsx`.
 *
 * Plays the role the Node CLI wrapper (`bin/generate.ts` in the original
 * port) plays on the server side: a thin shell around `generateWorkbook`
 * that handles I/O and delivery.
 */

import { proxyVocabUrl } from "@/config";

import { generateWorkbook, workbookToArrayBuffer } from "./generate.ts";
import { streamJsonlFromUrl } from "./jsonl-stream.ts";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Normalise a vocabulary URL to its `.ttl` form: strip any existing
 * format extension and trailing slash, then append `.ttl`. Mirrors the
 * `toJsonLdUrl` helper in `vocabularyService.ts` so the TTL endpoint
 * lives next to the JSON-LD endpoint on the same host.
 */
function toTtlUrl(vocabularyUrl: string): string {
  const url = new URL(vocabularyUrl);
  url.pathname =
    url.pathname.replace(/\/+$/, "").replace(/\.(jsonld|json|ttl|rdf|xml)$/, "") +
    ".ttl";
  return url.toString();
}

async function fetchVocabularyTtl(vocabularyUrl: string): Promise<string> {
  const url = proxyVocabUrl(toTtlUrl(vocabularyUrl));
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch vocabulary TTL: HTTP ${response.status} ${response.statusText} (${url})`,
    );
  }
  return response.text();
}

/**
 * Trigger a browser download of `data` as a file named `filename`. Uses a
 * transient object URL and a hidden anchor click; revokes the URL once
 * the click has been dispatched.
 */
function triggerDownload(data: ArrayBuffer, filename: string): void {
  const blob = new Blob([data], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Stream the JSONL at `jsonlUrl`, parse it against the vocabulary at
 * `vocabularyUrl`, build the three-tab workbook, and prompt the user to
 * download it as `filename`.
 */
export async function exportReferencesToExcel(
  jsonlUrl: string,
  vocabularyUrl: string,
  filename: string,
): Promise<void> {
  const references = streamJsonlFromUrl(jsonlUrl);
  const vocabularyTtl = await fetchVocabularyTtl(vocabularyUrl);
  const wb = await generateWorkbook(references, vocabularyTtl);
  triggerDownload(workbookToArrayBuffer(wb), filename);
}
