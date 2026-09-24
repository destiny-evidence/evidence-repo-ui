import { describe, test, expect } from "vitest";
import {
  buildSummaryFilename,
  buildSummaryPdf,
  coverageNoteText,
} from "@/services/export/summaryPdf";
import { MOCK_SUMMARY } from "@/services/summariserMock";
import type { SummariseResponse } from "@/services/summariser";
import { useDiskFonts } from "./diskFonts";

const context = {
  terms: ["Afghanistan", "Cost-effectiveness"],
  count: { count: 15, is_lower_bound: false },
  countNoun: "references",
};

describe("coverageNoteText", () => {
  test("reads cleanly at full coverage", () => {
    const result: SummariseResponse = {
      ...MOCK_SUMMARY,
      skipped_references: [],
      extraction_errors: [],
    };
    // MOCK_SUMMARY has 5 papers.
    expect(coverageNoteText(result)).toBe("Based on 5 references.");
  });

  test("singularises a single reference", () => {
    const result: SummariseResponse = {
      ...MOCK_SUMMARY,
      papers: [MOCK_SUMMARY.papers[0]],
      skipped_references: [],
      extraction_errors: [],
    };
    expect(coverageNoteText(result)).toBe("Based on 1 reference.");
  });

  test("groups skip reasons and extraction errors with counts", () => {
    const result: SummariseResponse = {
      ...MOCK_SUMMARY,
      skipped_references: [
        { reference_id: "r1", reason: "no_full_text" },
        { reference_id: "r2", reason: "no_full_text" },
        { reference_id: "r3", reason: "not_pdf" },
      ],
      extraction_errors: [{ paper: "x", error: "unreadable" }],
    };
    // 5 used + 3 skipped + 1 error = 9 total.
    const note = coverageNoteText(result);
    expect(note).toMatch(/^Based on 5 of 9 references\./);
    expect(note).toContain("2 had no full text available");
    expect(note).toContain("1 were not in PDF format");
    expect(note).toContain("1 couldn't be read");
  });
});

describe("buildSummaryFilename", () => {
  // Local-constructed so getFullYear/Month/Date are deterministic regardless of
  // the runner's timezone (the filename now uses the local date).
  const at = new Date(2026, 5, 24, 9, 30);

  test("slugifies the lead narrative header and stamps the local date", () => {
    expect(buildSummaryFilename("Cost-effectiveness in Afghanistan", at)).toBe(
      "ai-summary-cost-effectiveness-in-afghanistan-20260624.pdf",
    );
  });

  test("collapses punctuation and trims stray separators", () => {
    expect(buildSummaryFilename("HPV (vaccine)!", at)).toBe(
      "ai-summary-hpv-vaccine-20260624.pdf",
    );
  });

  test("truncates a long header at a whole-word boundary, never mid-word", () => {
    const long =
      "Cost-effectiveness of bivalent HPV vaccination across multiple adolescent cohorts in Sub-Saharan Africa";
    const name = buildSummaryFilename(long, at);
    const slug = name
      .replace(/^ai-summary-/, "")
      .replace(/-20260624\.pdf$/, "");
    expect(slug).toBe("cost-effectiveness-of-bivalent-hpv-vaccination-across");
    expect(slug.length).toBeLessThanOrEqual(60);
  });

  test("falls back to a dated name when there's no header", () => {
    expect(buildSummaryFilename(undefined, at)).toBe("ai-summary-20260624.pdf");
    expect(buildSummaryFilename("", at)).toBe("ai-summary-20260624.pdf");
  });
});

describe("buildSummaryPdf", () => {
  useDiskFonts();

  test("renders the fixture, embeds the font and clickable links", async () => {
    const doc = await buildSummaryPdf(MOCK_SUMMARY, context, "/hpv?q=hpv");
    const bytes = doc.output("arraybuffer") as ArrayBuffer;
    const pdf = new TextDecoder("latin1").decode(new Uint8Array(bytes));
    // Embedded TrueType faces (the dictionary key is plaintext even if the
    // stream is compressed).
    expect(pdf).toContain("/FontFile2");
    expect(pdf).toContain("DejaVu");
    // Link annotations appear in plaintext (streams are uncompressed).
    expect(pdf).toContain("/URI");
    // A quote's record link, built from the origin URL's community slug. 
    // Must be absolute. 
    expect(pdf).toContain(
      `${window.location.origin}/hpv/references/${MOCK_SUMMARY.papers[0].paper}`,
    );
    expect(pdf).toContain("q=hpv"); // the resolved "this search" link
    expect(pdf).toContain("/Dest"); // inline [n] → claim jumps
  });

  test("omits record links when the origin URL carries no community slug", async () => {
    const doc = await buildSummaryPdf(MOCK_SUMMARY, context, "/");
    const bytes = doc.output("arraybuffer") as ArrayBuffer;
    const pdf = new TextDecoder("latin1").decode(new Uint8Array(bytes));
    expect(pdf).not.toContain("/references/");
  });
});
