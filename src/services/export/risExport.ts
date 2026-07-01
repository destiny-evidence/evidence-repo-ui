/**
 * Consumers of the `.ris` file the backend produces at an export job's
 * `result_url`. The "RIS" format saves it verbatim for reference managers; the
 * "Reference list" format and the AI-summary references both parse it to APA via
 * {@link fetchRisAsApaInputs}. Sharing the one RIS source keeps every
 * bibliography output identical.
 */

import { proxyBlobUrl } from "@/config";
import type { ApaReferenceInput } from "@/services/citation/apa";
import { parseRis, risToApaInput } from "@/services/citation/ris";
import {
  buildReferenceListPdf,
  type ReferenceListMeta,
} from "./referenceListPdf.ts";

const RIS_MIME = "application/x-research-info-systems";

async function fetchRisText(resultUrl: string): Promise<string> {
  const response = await fetch(proxyBlobUrl(resultUrl));
  if (!response.ok) {
    throw new Error(`Failed to fetch the export (HTTP ${response.status}).`);
  }
  return response.text();
}

/** Fetch the RIS at `resultUrl` and project every record to APA input. */
export async function fetchRisAsApaInputs(
  resultUrl: string,
): Promise<ApaReferenceInput[]> {
  return parseRis(await fetchRisText(resultUrl)).map(risToApaInput);
}

/** Trigger a browser download of `text` as `filename` with the given MIME. */
function triggerDownload(text: string, filename: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Save the backend's RIS file verbatim. */
export async function downloadRisExport(
  resultUrl: string,
  filename: string,
): Promise<void> {
  triggerDownload(await fetchRisText(resultUrl), filename, RIS_MIME);
}

/** Parse the RIS, project to APA, and download a bibliography PDF. */
export async function downloadReferenceListPdf(
  resultUrl: string,
  filename: string,
  meta: ReferenceListMeta,
): Promise<void> {
  const doc = await buildReferenceListPdf(await fetchRisAsApaInputs(resultUrl), meta);
  doc.save(filename);
}
