/**
 * Browser entry point for the Excel export pipeline. Fetches the JSONL
 * of references from a signed URL, fetches the SKOS vocabulary and
 * JSON-LD @context document via the shared `vocabularyService` /
 * `contextService` (so cached vocab/context loads are reused with the
 * rest of the UI), hands the result to `generateWorkbook`, and
 * triggers a browser download of the resulting `.xlsx`.
 */

import {
  getCachedContext,
  getCachedVocabulary,
} from "@/services/vocabulary";

import { generateWorkbook, workbookToArrayBuffer } from "./generate.ts";
import { streamJsonlFromUrl } from "./jsonlStream.ts";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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
 * Stream the JSONL at `jsonlUrl`, resolve concepts against the JSON-LD
 * vocabulary at `vocabularyUrl` (URI-keyed prefLabels) and the JSON-LD
 * @context at `contextUrl` (prefix → namespace map), build the
 * three-tab workbook, and prompt the user to download it as `filename`.
 */
export async function exportReferencesToExcel(
  jsonlUrl: string,
  vocabularyUrl: string,
  contextUrl: string,
  filename: string,
): Promise<void> {
  const references = streamJsonlFromUrl(jsonlUrl);
  const [{ labels }, { prefixes }] = await Promise.all([
    getCachedVocabulary(vocabularyUrl),
    getCachedContext(contextUrl),
  ]);
  const wb = await generateWorkbook(references, { prefixes, labels });
  triggerDownload(workbookToArrayBuffer(wb), filename);
}
