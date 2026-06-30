/**
 * Client-side reference-list (bibliography) PDF. Built from the APA inputs the
 * RIS export is parsed into (see citation/ris.ts), so the PDF and the raw `.ris`
 * download share one bibliographic projection. Entries are sorted alphabetically
 * by first-author surname and laid out as a hanging-indent APA 7th list, rendered
 * as plain text (no inline italics — the on-screen drawer keeps those). Shares
 * font embedding / design tokens with the AI summary PDF (see pdfShared.ts).
 */

import type { jsPDF as JsPdfDoc } from "jspdf";
import {
  type ApaReferenceInput,
  formatApaReference,
  compareApaReferences,
} from "@/services/citation/apa";
import {
  type RGB,
  FONT_SANS,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
  ACCENT,
  BORDER,
  registerFonts,
  renderApaEntry,
} from "./pdfShared.ts";

const PAGE_MARGIN = 48;
const HANGING_INDENT = 18;
const ENTRY_SIZE = 10;
const ENTRY_LINE_FACTOR = 1.4;
const ENTRY_GAP = 8;

export interface ReferenceListMeta {
  /** Heading line, e.g. "Reference list". */
  title: string;
  /** Optional context line under the title (search terms / community). */
  subtitle?: string | null;
  /** Absolute or relative URL the list was generated from, for the header link. */
  originUrl?: string | null;
}

function resolveOriginUrl(originUrl: string | null | undefined): string | null {
  if (!originUrl) return null;
  try {
    return new URL(originUrl, window.location.href).href;
  } catch {
    return null;
  }
}

/**
 * Build the bibliography PDF and return the jsPDF instance (caller saves it) —
 * split from the download so tests can render and inspect it.
 */
export async function buildReferenceListPdf(
  inputs: ApaReferenceInput[],
  meta: ReferenceListMeta,
): Promise<JsPdfDoc> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await registerFonts(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - PAGE_MARGIN * 2;
  const bottomLimit = pageH - PAGE_MARGIN;
  let y = PAGE_MARGIN;

  const setColor = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

  // A wrapped line block at the left margin (header lines).
  const line = (
    text: string,
    opts: { size: number; color: RGB; gapAfter: number },
  ) => {
    if (!text) return;
    doc.setFont(FONT_SANS, "normal");
    doc.setFontSize(opts.size);
    setColor(opts.color);
    const lineHeight = opts.size * 1.4;
    for (const l of doc.splitTextToSize(text, contentW) as string[]) {
      if (y + lineHeight > bottomLimit) {
        doc.addPage();
        y = PAGE_MARGIN;
      }
      doc.text(l, PAGE_MARGIN, y, { baseline: "top" });
      y += lineHeight;
    }
    y += opts.gapAfter;
  };

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFont(FONT_SANS, "bold");
  doc.setFontSize(20);
  setColor(ACCENT);
  doc.text(meta.title, PAGE_MARGIN, y, { baseline: "top" });
  y += 28;

  if (meta.subtitle) {
    line(meta.subtitle, { size: 9.5, color: TEXT_SECONDARY, gapAfter: 2 });
  }

  const count = inputs.length;
  const countStr = `${count} ${count === 1 ? "reference" : "references"}`;
  const generated = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const origin = resolveOriginUrl(meta.originUrl);
  const metaPrefix = `${countStr}  ·  Generated ${generated}`;
  if (origin) {
    doc.setFont(FONT_SANS, "normal");
    doc.setFontSize(8.5);
    setColor(TEXT_TERTIARY);
    const lh = 8.5 * 1.4;
    if (y + lh > bottomLimit) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
    const prefix = `${metaPrefix} from `;
    doc.text(prefix, PAGE_MARGIN, y, { baseline: "top" });
    const px = PAGE_MARGIN + doc.getTextWidth(prefix);
    setColor(ACCENT);
    doc.text("this search", px, y, { baseline: "top" });
    const lw = doc.getTextWidth("this search");
    doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.setLineWidth(0.4);
    doc.line(px, y + 8.5 * 1.05, px + lw, y + 8.5 * 1.05);
    doc.link(px, y, lw, 8.5 * 1.15, { url: origin });
    y += lh + 14;
  } else {
    line(metaPrefix, { size: 8.5, color: TEXT_TERTIARY, gapAfter: 14 });
  }

  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.5);
  doc.line(PAGE_MARGIN, y, pageW - PAGE_MARGIN, y);
  y += 16;

  if (count === 0) {
    line("No references to list.", {
      size: ENTRY_SIZE,
      color: TEXT_TERTIARY,
      gapAfter: 0,
    });
    return doc;
  }

  // ── Entries (alphabetical by title, then year) ──────────────────────────
  const sorted = [...inputs].sort(compareApaReferences);
  for (const input of sorted) {
    y = renderApaEntry(doc, formatApaReference(input), {
      x: PAGE_MARGIN,
      rightEdge: pageW - PAGE_MARGIN,
      topMargin: PAGE_MARGIN,
      bottomLimit,
      y,
      size: ENTRY_SIZE,
      lineFactor: ENTRY_LINE_FACTOR,
      hangingIndent: HANGING_INDENT,
      color: TEXT_PRIMARY,
    });
    y += ENTRY_GAP;
  }

  return doc;
}
