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
