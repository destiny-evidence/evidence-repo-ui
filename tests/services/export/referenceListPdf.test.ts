import { describe, test, expect } from "vitest";
import { buildReferenceListPdf } from "@/services/export/referenceListPdf";
import type { ApaReferenceInput } from "@/services/citation/apa";
import { useDiskFonts } from "./diskFonts";

function makeInputs(n: number): ApaReferenceInput[] {
  return Array.from({ length: n }, (_, i) => ({
    authors: [`Given${i} Family${i}`],
    year: 2000 + i,
    title: `A study number ${i}`,
    journal: "The Journal",
    volume: String(i),
    doi: `10.1/${i}`,
  }));
}

describe("buildReferenceListPdf", () => {
  useDiskFonts();

  test("renders many entries across pages, embeds the font and the search link", async () => {
    const doc = await buildReferenceListPdf(makeInputs(40), {
      title: "Reference list",
      subtitle: "Search: phonics",
      originUrl: "/esea?q=phonics",
    });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    const pdf = new TextDecoder("latin1").decode(
      new Uint8Array(doc.output("arraybuffer") as ArrayBuffer),
    );
    expect(pdf).toContain("/FontFile2"); // embedded TrueType face
    expect(pdf).toContain("/esea?q=phonics"); // header "this search" link
  });

  test("renders the empty state without throwing", async () => {
    const doc = await buildReferenceListPdf([], { title: "Reference list" });
    expect(doc.getNumberOfPages()).toBe(1);
  });
});
