/**
 * Client-side AI-summary PDF. Embeds the DejaVu family (sans / serif / mono) so
 * Greek, maths and other non-Latin-1 symbols render faithfully — jsPDF's built-in
 * fonts are WinAnsi-only and would corrupt them into plausible-but-wrong glyphs.
 * DejaVu is permissively licensed for embedding (unlike our Klim brand faces).
 * The TTFs load on demand alongside the lazy jsPDF chunk, so they cost nothing
 * until a user exports. Layout mirrors the on-screen drawer (renderSummary.tsx).
 */

import type { jsPDF as JsPdfDoc } from "jspdf";
import type { AiSummaryContext } from "@/hooks/useAiSummary";
import type {
  PaperMeta,
  QuoteRef,
  SkipReason,
  SummariseResponse,
} from "@/services/summariser";
import { formatTotal } from "@/utils/searchTotal";
import sansUrl from "./fonts/DejaVuSans.ttf?url";
import sansBoldUrl from "./fonts/DejaVuSans-Bold.ttf?url";
import serifItalicUrl from "./fonts/DejaVuSerif-Italic.ttf?url";
import monoUrl from "./fonts/DejaVuSansMono.ttf?url";

type RGB = readonly [number, number, number];
type PdfFont = "DejaVuSans" | "DejaVuSerif" | "DejaVuSansMono";
type FontStyle = "normal" | "bold" | "italic";

const FONT_SANS: PdfFont = "DejaVuSans"; // body, title, inline markers, links
const FONT_SERIF: PdfFont = "DejaVuSerif"; // quotes (italic)
const FONT_MONO: PdfFont = "DejaVuSansMono"; // section labels

// jsPDF embeds one TTF per (family, style); these are every face the layout uses.
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

// App design tokens (variables.css), duplicated since jsPDF can't read CSS vars.
const TEXT_PRIMARY: RGB = [22, 27, 34];
const TEXT_SECONDARY: RGB = [66, 74, 83];
const TEXT_TERTIARY: RGB = [110, 119, 129];
const TEXT_QUOTE: RGB = [92, 100, 110]; // a touch lighter than secondary, for quotes
const ACCENT: RGB = [36, 57, 107];
const WARNING_TEXT: RGB = [122, 90, 0];
const WARNING_LIGHT: RGB = [254, 243, 199];
const WARNING_BORDER: RGB = [255, 193, 7];
const BORDER: RGB = [216, 220, 226];
const WHITE: RGB = [255, 255, 255];

const SKIP_REASON_TEXT: Record<SkipReason, string> = {
  no_full_text: "had no full text available",
  not_pdf: "were not in PDF format",
  download_failed: "couldn't be downloaded",
};

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
async function registerFonts(doc: JsPdfDoc): Promise<void> {
  await Promise.all(
    FONT_FACES.map(async (face) => {
      const buffer = await fetch(face.url).then((r) => r.arrayBuffer());
      doc.addFileToVFS(face.file, arrayBufferToBase64(buffer));
      doc.addFont(face.file, face.family, face.style);
    }),
  );
}

/** Author-year citation for a quote's source paper. Mirrors renderSummary.tsx. */
export function citation(papers: PaperMeta[], paperId: string): string {
  const paper = papers.find((p) => p.paper === paperId);
  if (!paper) return paperId;
  const lead = paper.authors[0] ?? paper.title ?? paperId;
  const etAl = paper.authors.length > 1 ? " et al." : "";
  const year = paper.year ? ` (${paper.year})` : "";
  return `${lead}${etAl}${year}`;
}

/** The "Based on N of M references…" coverage sentence. Mirrors the drawer. */
export function coverageNoteText(result: SummariseResponse): string {
  const used = result.papers.length;
  const reasonCounts = new Map<SkipReason, number>();
  for (const ref of result.skipped_references) {
    reasonCounts.set(ref.reason, (reasonCounts.get(ref.reason) ?? 0) + 1);
  }
  const clauses = [...reasonCounts].map(
    ([reason, n]) => `${n} ${SKIP_REASON_TEXT[reason]}`,
  );
  if (result.extraction_errors.length > 0) {
    clauses.push(`${result.extraction_errors.length} couldn't be read`);
  }
  const leftOut =
    result.skipped_references.length + result.extraction_errors.length;
  const total = used + leftOut;
  return leftOut === 0
    ? `Based on ${total} ${total === 1 ? "reference" : "references"}.`
    : `Based on ${used} of ${total} references. ${clauses.join("; ")} — left out of this summary.`;
}

// Slugify a headline, keeping only whole words up to `maxLen` so the name is
// never chopped mid-word. Returns "" if nothing usable survives.
function slugifyHeadline(text: string, maxLen = 60): string {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const kept: string[] = [];
  let len = 0;
  for (const word of words) {
    const add = (kept.length ? 1 : 0) + word.length;
    if (len + add > maxLen) break;
    kept.push(word);
    len += add;
  }
  return kept.join("-");
}

/**
 * `ai-summary-<headline>-YYYYMMDD.pdf`, dated in the user's local timezone.
 * `headline` is the summary's lead narrative header (cleaner than concatenated
 * filters); falls back to a plain dated name when absent.
 */
export function buildSummaryFilename(
  headline: string | null | undefined,
  now: Date = new Date(),
): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const slug = headline ? slugifyHeadline(headline) : "";
  const stem = slug ? `ai-summary-${slug}` : "ai-summary";
  return `${stem}-${y}${m}${d}.pdf`;
}

/** Resolve the summary's (possibly relative) origin URL to an absolute href. */
function resolveOriginUrl(originUrl: string | null): string {
  try {
    return new URL(originUrl ?? "", window.location.href).href;
  } catch {
    return window.location.href;
  }
}

const PAGE_MARGIN = 48;

/**
 * Build the PDF and return the jsPDF instance (caller saves it) — split from the
 * download so tests can render and inspect it. Layout is a manual cursor: blocks
 * page-break via ensureSpace, then advance `y`. Text uses baseline "top", so `y`
 * is always the next block's top edge.
 */
export async function buildSummaryPdf(
  result: SummariseResponse,
  context: AiSummaryContext,
  originUrl: string | null = null,
): Promise<JsPdfDoc> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await registerFonts(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - PAGE_MARGIN * 2;
  let y = PAGE_MARGIN;

  // Recorded during layout, then wired to claims as internal jumps in a second
  // pass — the narrative is drawn before the claims it points at.
  type MarkerRect = { page: number; x: number; y: number; w: number; h: number };
  const markerRects: Record<number, MarkerRect[]> = {};
  const claimDest: Record<number, { page: number; top: number }> = {};

  const setColor = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setStroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);

  function ensureSpace(height: number): void {
    if (y + height > pageH - PAGE_MARGIN) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
  }

  interface TextOptions {
    size: number;
    color: RGB;
    font?: PdfFont;
    style?: FontStyle;
    indent?: number;
    gapAfter?: number;
    lineFactor?: number;
    charSpace?: number;
    caps?: boolean;
  }

  function applyFont(opts: TextOptions): void {
    doc.setFont(opts.font ?? FONT_SANS, opts.style ?? "normal");
    doc.setFontSize(opts.size);
    setColor(opts.color);
  }

  function paragraph(text: string, opts: TextOptions): void {
    const clean = opts.caps ? text.toUpperCase() : text;
    if (!clean) return;
    const indent = opts.indent ?? 0;
    const charSpace = opts.charSpace ?? 0;
    const lineFactor = opts.lineFactor ?? 1.4;
    applyFont(opts);
    const lines = doc.splitTextToSize(clean, contentW - indent) as string[];
    const lineHeight = opts.size * lineFactor;
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, PAGE_MARGIN + indent, y, { baseline: "top", charSpace });
      y += lineHeight;
    }
    y += opts.gapAfter ?? 6;
  }

  // Clickable underlined link. Hotspot placed with doc.link() over the glyphs
  // rather than textWithLink, whose hotspot assumes a bottom baseline.
  function drawLink(
    label: string,
    url: string,
    x: number,
    opts: { size: number; font?: PdfFont },
  ): number {
    doc.setFont(opts.font ?? FONT_SANS, "normal");
    doc.setFontSize(opts.size);
    setColor(ACCENT);
    doc.text(label, x, y, { baseline: "top" });
    const w = doc.getTextWidth(label);
    const underlineY = y + opts.size * 1.05;
    setStroke(ACCENT);
    doc.setLineWidth(0.4);
    doc.line(x, underlineY, x + w, underlineY);
    doc.link(x, y, w, opts.size * 1.15, { url });
    return w;
  }

  function hairline(color: RGB = BORDER): void {
    ensureSpace(8);
    setStroke(color);
    doc.setLineWidth(0.5);
    doc.line(PAGE_MARGIN, y, pageW - PAGE_MARGIN, y);
    y += 12;
  }

  // Mono section label, uppercase, lightly tracked, over a rule. `reserve` keeps
  // the heading with its first content so it isn't orphaned at a page foot.
  function sectionHead(label: string, color: RGB, reserve = 84): void {
    ensureSpace(reserve);
    hairline();
    paragraph(label, {
      size: 8,
      color,
      font: FONT_MONO,
      caps: true,
      charSpace: 0.5,
      gapAfter: 12,
    });
  }

  // A filled circle with a centred number/glyph, left of an indented body.
  function marker(glyph: string, fill: RGB, text: RGB): void {
    const r = 8;
    setFill(fill);
    doc.circle(PAGE_MARGIN + r, y + r, r, "F");
    doc.setFont(FONT_SANS, "bold");
    doc.setFontSize(9);
    setColor(text);
    doc.text(glyph, PAGE_MARGIN + r, y + r + 0.5, {
      align: "center",
      baseline: "middle",
    });
  }

  // Manual word-wrap so each inline [n] marker is a positioned, recordable token.
  function narrativeParagraph(
    sentences: { text: string; claims: number[] }[],
    opts: { size: number; color: RGB; lineFactor: number; gapAfter: number },
  ): void {
    const lineHeight = opts.size * opts.lineFactor;
    const rightEdge = pageW - PAGE_MARGIN;
    ensureSpace(lineHeight);
    let x = PAGE_MARGIN;

    const newline = () => {
      y += lineHeight;
      ensureSpace(lineHeight);
      x = PAGE_MARGIN;
    };

    const drawWord = (word: string) => {
      doc.setFont(FONT_SANS, "normal");
      doc.setFontSize(opts.size);
      setColor(opts.color);
      const ww = doc.getTextWidth(word);
      const space = x > PAGE_MARGIN ? doc.getTextWidth(" ") : 0;
      if (x + space + ww > rightEdge && x > PAGE_MARGIN) newline();
      const drawX = x > PAGE_MARGIN ? x + doc.getTextWidth(" ") : x;
      doc.text(word, drawX, y, { baseline: "top" });
      x = drawX + ww;
    };

    // Footnote-style marker (small, accent, lifted); hugs the preceding word.
    const drawMarker = (n: number) => {
      const mSize = opts.size * 0.82;
      const label = `[${n}]`;
      doc.setFont(FONT_SANS, "normal");
      doc.setFontSize(mSize);
      setColor(ACCENT);
      const w = doc.getTextWidth(label);
      if (x + w > rightEdge && x > PAGE_MARGIN) newline();
      const my = y - 1;
      doc.text(label, x, my, { baseline: "top" });
      (markerRects[n] ||= []).push({ page: doc.getNumberOfPages(), x, y: my, w, h: mSize });
      x += w;
    };

    sentences.forEach((s) => {
      s.text
        .split(/\s+/)
        .filter(Boolean)
        .forEach(drawWord);
      s.claims.forEach(drawMarker);
    });
    y += lineHeight + opts.gapAfter;
  }

  // A verbatim quote (serif italic) + its citation line and optional DOI link.
  function quoteBlock(quote: QuoteRef): void {
    paragraph(`"${quote.quote}"`, {
      size: 10.5,
      color: TEXT_QUOTE,
      font: FONT_SERIF,
      style: "italic",
      indent: 28,
      gapAfter: 3,
      lineFactor: 1.5,
    });
    const cite = citation(result.papers, quote.paper);
    const citeLine = quote.page != null ? `${cite} · p. ${quote.page}` : cite;
    paragraph(citeLine, {
      size: 8.5,
      color: TEXT_TERTIARY,
      indent: 28,
      gapAfter: 2,
    });
    const paper = result.papers.find((p) => p.paper === quote.paper);
    if (paper?.doi) {
      const lineHeight = 8.5 * 1.4;
      ensureSpace(lineHeight);
      drawLink(`doi.org/${paper.doi}`, `https://doi.org/${paper.doi}`, PAGE_MARGIN + 28, {
        size: 8.5,
        font: FONT_MONO,
      });
      y += lineHeight + 6;
    } else {
      y += 4;
    }
  }

  // ── Header ────────────────────────────────────────────────────────────
  doc.setFont(FONT_SANS, "bold");
  doc.setFontSize(20);
  setColor(ACCENT);
  doc.text("AI summary", PAGE_MARGIN, y, { baseline: "top" });
  const titleW = doc.getTextWidth("AI summary");
  doc.setFontSize(8);
  const betaW = doc.getTextWidth("BETA") + 8;
  setFill(ACCENT);
  doc.roundedRect(PAGE_MARGIN + titleW + 8, y + 3, betaW, 12, 2, 2, "F");
  setColor(WHITE);
  doc.text("BETA", PAGE_MARGIN + titleW + 8 + 4, y + 5, { baseline: "top" });
  y += 28;

  const termStr = context.terms.join("  ·  ");
  const countStr = `${formatTotal(context.count)} ${context.countNoun}`;
  paragraph(termStr ? `${termStr}  -  ${countStr}` : countStr, {
    size: 9.5,
    color: TEXT_SECONDARY,
    gapAfter: 2,
  });

  const generated = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const genPrefix = `Generated ${generated} from `;
  doc.setFont(FONT_SANS, "normal");
  doc.setFontSize(8.5);
  setColor(TEXT_TERTIARY);
  ensureSpace(8.5 * 1.4);
  doc.text(genPrefix, PAGE_MARGIN, y, { baseline: "top" });
  const prefixW = doc.getTextWidth(genPrefix);
  drawLink("this search", resolveOriginUrl(originUrl), PAGE_MARGIN + prefixW, {
    size: 8.5,
  });
  y += 8.5 * 1.4 + 12;

  // ── Disclaimer banner ─────────────────────────────────────────────────
  const disclaimer =
    "AI-generated from the papers at this intersection. Quotes are extracted verbatim — verify against the sources before using in synthesis.";
  doc.setFont(FONT_SANS, "normal");
  doc.setFontSize(9);
  const padX = 10;
  const padY = 8;
  const discLines = doc.splitTextToSize(disclaimer, contentW - padX * 2) as string[];
  const discLineHeight = 9 * 1.4;
  const boxH = discLines.length * discLineHeight + padY * 2;
  ensureSpace(boxH + 12);
  setFill(WARNING_LIGHT);
  setStroke(WARNING_BORDER);
  doc.setLineWidth(0.75);
  doc.roundedRect(PAGE_MARGIN, y, contentW, boxH, 3, 3, "FD");
  setColor(WARNING_TEXT);
  let dy = y + padY;
  for (const line of discLines) {
    doc.text(line, PAGE_MARGIN + padX, dy, { baseline: "top" });
    dy += discLineHeight;
  }
  y += boxH + 16;

  // ── Narrative ─────────────────────────────────────────────────────────
  for (const para of result.summary.narrative) {
    if (para.header) {
      // Keep the header with at least the opening lines of its prose.
      ensureSpace(54);
      paragraph(para.header, {
        size: 8,
        color: TEXT_TERTIARY,
        font: FONT_MONO,
        caps: true,
        charSpace: 0.5,
        gapAfter: 6,
      });
    }
    narrativeParagraph(para.sentences, {
      size: 10.5,
      color: TEXT_PRIMARY,
      gapAfter: 14,
      lineFactor: 1.6,
    });
  }

  // ── Claims & sources ──────────────────────────────────────────────────
  sectionHead("Claims & sources", TEXT_SECONDARY);
  result.summary.claims.forEach((claim, idx) => {
    ensureSpace(40);
    // Jump target for this claim's [n] markers, a touch above the row.
    claimDest[idx + 1] = {
      page: doc.getNumberOfPages(),
      top: Math.max(0, y - 10),
    };
    marker(String(idx + 1), ACCENT, WHITE);
    claim.quotes.forEach((quote) => quoteBlock(quote));
    y += 6;
  });

  // ── Contradictions ────────────────────────────────────────────────────
  if (result.summary.contradictions.length > 0) {
    sectionHead("Where papers disagree", WARNING_TEXT);
    result.summary.contradictions.forEach((c) => {
      ensureSpace(40);
      marker("!", WARNING_LIGHT, WARNING_TEXT);
      paragraph(c.contradiction, {
        size: 10.5,
        color: TEXT_PRIMARY,
        indent: 28,
        gapAfter: 6,
        lineFactor: 1.45,
      });
      c.quotes.forEach((quote) => quoteBlock(quote));
      y += 6;
    });
  }

  // ── Coverage note ─────────────────────────────────────────────────────
  hairline();
  paragraph(coverageNoteText(result), {
    size: 8.5,
    color: TEXT_TERTIARY,
    gapAfter: 0,
  });

  // Wire each [n] marker to its claim. Links attach to the current page, so
  // switch to the marker's page before adding, then restore.
  const lastPage = doc.getNumberOfPages();
  for (const key of Object.keys(markerRects)) {
    const dest = claimDest[Number(key)];
    if (!dest) continue;
    for (const r of markerRects[Number(key)]) {
      doc.setPage(r.page);
      doc.link(r.x, r.y, r.w, r.h, { pageNumber: dest.page, top: dest.top });
    }
  }
  doc.setPage(lastPage);

  return doc;
}

/** Build the summary PDF and prompt a one-click download named `filename`. */
export async function downloadSummaryPdf(
  result: SummariseResponse,
  context: AiSummaryContext,
  filename: string,
  originUrl: string | null = null,
): Promise<void> {
  const doc = await buildSummaryPdf(result, context, originUrl);
  doc.save(filename);
}
