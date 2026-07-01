/**
 * Shared jsPDF setup for the client-side PDF exports (AI summary, reference
 * list). Embeds the DejaVu family (sans / serif-italic / mono) so Greek, maths
 * and other non-Latin-1 symbols render faithfully — jsPDF's built-in fonts are
 * WinAnsi-only and would corrupt them into plausible-but-wrong glyphs. DejaVu is
 * permissively licensed for embedding (unlike our Klim brand faces). The TTFs
 * load on demand alongside the lazy jsPDF chunk, so they cost nothing until a
 * user exports.
 *
 * Note there is no sans-italic face: italic runs use the serif-italic face (the
 * only italic registered), matching how the summary renders its quotes.
 */

import type { jsPDF as JsPdfDoc } from "jspdf";
import type { ApaSegment } from "@/services/citation/apa";
import sansUrl from "./fonts/DejaVuSans.ttf?url";
import sansBoldUrl from "./fonts/DejaVuSans-Bold.ttf?url";
import serifItalicUrl from "./fonts/DejaVuSerif-Italic.ttf?url";
import monoUrl from "./fonts/DejaVuSansMono.ttf?url";

export type RGB = readonly [number, number, number];
export type PdfFont = "DejaVuSans" | "DejaVuSerif" | "DejaVuSansMono";
export type FontStyle = "normal" | "bold" | "italic";

export const FONT_SANS: PdfFont = "DejaVuSans"; // body, titles, links
export const FONT_SERIF: PdfFont = "DejaVuSerif"; // italic runs (quotes, journal)
export const FONT_MONO: PdfFont = "DejaVuSansMono"; // section labels

// App design tokens (variables.css), duplicated since jsPDF can't read CSS vars.
export const TEXT_PRIMARY: RGB = [22, 27, 34];
export const TEXT_SECONDARY: RGB = [66, 74, 83];
export const TEXT_TERTIARY: RGB = [110, 119, 129];
export const TEXT_QUOTE: RGB = [92, 100, 110];
export const ACCENT: RGB = [36, 57, 107];
export const WARNING_TEXT: RGB = [122, 90, 0];
export const WARNING_LIGHT: RGB = [254, 243, 199];
export const WARNING_BORDER: RGB = [255, 193, 7];
export const BORDER: RGB = [216, 220, 226];
export const WHITE: RGB = [255, 255, 255];

// jsPDF embeds one TTF per (family, style); these are every face the layouts use.
const FONT_FACES: ReadonlyArray<{
  url: string;
  file: string;
  family: PdfFont;
  style: FontStyle;
}> = [
  { url: sansUrl, file: "DejaVuSans.ttf", family: FONT_SANS, style: "normal" },
  { url: sansBoldUrl, file: "DejaVuSans-Bold.ttf", family: FONT_SANS, style: "bold" },
  { url: serifItalicUrl, file: "DejaVuSerif-Italic.ttf", family: FONT_SERIF, style: "italic" },
  { url: monoUrl, file: "DejaVuSansMono.ttf", family: FONT_MONO, style: "normal" },
];

/** Base64-encode an ArrayBuffer in chunks (sidesteps the arg limit on btoa). */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Fetch the TTF assets and register every face with the document. */
export async function registerFonts(doc: JsPdfDoc): Promise<void> {
  await Promise.all(
    FONT_FACES.map(async (face) => {
      const buffer = await fetch(face.url).then((r) => r.arrayBuffer());
      doc.addFileToVFS(face.file, arrayBufferToBase64(buffer));
      doc.addFont(face.file, face.family, face.style);
    }),
  );
}

export interface ApaEntryLayout {
  /** Left edge of the entry; continuation lines hang in from here. */
  x: number;
  rightEdge: number;
  /** y to reset to after a page break. */
  topMargin: number;
  /** Largest y a line may start at before we page-break. */
  bottomLimit: number;
  /** Current top cursor. */
  y: number;
  size: number;
  lineFactor: number;
  hangingIndent: number;
  color: RGB;
}

/**
 * Render one APA reference as a hanging-indent paragraph, switching to the
 * serif-italic face for italic segments (journal, volume). Wraps word-by-word so
 * italic runs stay inline; a token wider than a line (e.g. a long DOI) is
 * hard-wrapped by character. Returns the y cursor below the entry.
 */
export function renderApaEntry(
  doc: JsPdfDoc,
  segments: ApaSegment[],
  layout: ApaEntryLayout,
): number {
  const { x: x0, rightEdge, topMargin, bottomLimit, size, lineFactor, hangingIndent, color } = layout;
  const lineHeight = size * lineFactor;
  doc.setTextColor(color[0], color[1], color[2]);
  let y = layout.y;
  let lineStart = x0;
  let x = x0;

  if (y + lineHeight > bottomLimit) {
    doc.addPage();
    y = topMargin;
  }

  const newline = () => {
    y += lineHeight;
    if (y + lineHeight > bottomLimit) {
      doc.addPage();
      y = topMargin;
    }
    lineStart = x0 + hangingIndent;
    x = lineStart;
  };

  const fullLineWidth = rightEdge - (x0 + hangingIndent);

  const drawWord = (word: string, italic: boolean, pendingSpace: boolean) => {
    doc.setFont(italic ? FONT_SERIF : FONT_SANS, italic ? "italic" : "normal");
    doc.setFontSize(size);
    const width = doc.getTextWidth(word);

    if (width > fullLineWidth && word.length > 1) {
      const chunks = doc.splitTextToSize(word, fullLineWidth) as string[];
      chunks.forEach((chunk, i) => {
        if (i > 0 || x > lineStart) newline();
        doc.text(chunk, x, y, { baseline: "top" });
        x += doc.getTextWidth(chunk);
      });
      return;
    }

    const space = pendingSpace && x > lineStart ? doc.getTextWidth(" ") : 0;
    if (x + space + width > rightEdge && x > lineStart) {
      newline();
      doc.text(word, x, y, { baseline: "top" });
      x += width;
    } else {
      const drawX = x + space;
      doc.text(word, drawX, y, { baseline: "top" });
      x = drawX + width;
    }
  };

  let pendingSpace = false;
  for (const seg of segments) {
    for (const part of seg.text.split(/(\s+)/)) {
      if (part === "") continue;
      if (/^\s+$/.test(part)) {
        pendingSpace = true;
        continue;
      }
      drawWord(part, !!seg.italic, pendingSpace);
      pendingSpace = false;
    }
  }
  return y + lineHeight;
}
