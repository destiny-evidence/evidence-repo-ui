import { describe, test, expect } from "vitest";
import { quoteCitation } from "@/services/citation/quoteCitation";
import { MOCK_SUMMARY } from "@/services/summariserMock";
import type { PaperMeta } from "@/services/summariser";

describe("quoteCitation", () => {
  test("single author with year", () => {
    const paper = MOCK_SUMMARY.papers[1];
    expect(quoteCitation(paper, paper.paper)).toBe("Canfell Karen (2020)");
  });

  test("multiple authors collapse to et al.", () => {
    const paper: PaperMeta = {
      paper: "p1",
      authors: ["First A", "Second B"],
      affiliations: [],
      year: 2021,
    };
    expect(quoteCitation(paper, "p1")).toBe("First A et al. (2021)");
  });

  test("falls back to the title when there are no authors", () => {
    const paper: PaperMeta = {
      paper: "p1",
      authors: [],
      affiliations: [],
      title: "A study",
      year: 2020,
    };
    expect(quoteCitation(paper, "p1")).toBe("A study (2020)");
  });

  test("omits the year when absent", () => {
    const paper: PaperMeta = { paper: "p1", authors: ["Solo S"], affiliations: [] };
    expect(quoteCitation(paper, "p1")).toBe("Solo S");
  });

  test("falls back to the paper id when the paper is unknown", () => {
    expect(quoteCitation(undefined, "missing-id")).toBe("missing-id");
  });
});
