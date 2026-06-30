import { describe, test, expect } from "vitest";
import {
  formatAuthorName,
  formatAuthorList,
  formatApaReference,
  apaPlainText,
  apaSortKey,
  compareApaReferences,
  type ApaReferenceInput,
} from "@/services/citation/apa";

function plain(input: ApaReferenceInput): string {
  return apaPlainText(formatApaReference(input));
}

describe("formatAuthorName", () => {
  // Pass-through: only whitespace is normalised, every format kept verbatim.
  // "Smith J" in particular must NOT become "J, S." (the old inversion's bug).
  test.each([
    ["First Last", "Jane Smith", "Jane Smith"],
    ["already inverted", "Smith, J. A.", "Smith, J. A."],
    ["initial and surname", "Smith J", "Smith J"],
    ["corporate author", "World Health Organization", "World Health Organization"],
    ["messy whitespace", "  Jane   Smith ", "Jane Smith"],
  ])("keeps %s verbatim", (_label, input, expected) => {
    expect(formatAuthorName(input)).toBe(expected);
  });
});

describe("formatAuthorList", () => {
  test("single author", () => {
    expect(formatAuthorList(["Jane Smith"])).toBe("Jane Smith");
  });

  test("two authors join with an ampersand", () => {
    expect(formatAuthorList(["Jane Smith", "Bob Jones"])).toBe(
      "Jane Smith, & Bob Jones",
    );
  });

  test("three authors: commas then ampersand before last", () => {
    expect(
      formatAuthorList(["Jane Smith", "Bob Jones", "Carol King"]),
    ).toBe("Jane Smith, Bob Jones, & Carol King");
  });

  test("mixed source formats are each preserved", () => {
    expect(formatAuthorList(["Smith, Jane", "Bob Jones"])).toBe(
      "Smith, Jane, & Bob Jones",
    );
  });

  test("exactly 20 authors are all listed with an ampersand", () => {
    const authors = Array.from({ length: 20 }, (_, i) => `Given${i} Family${i}`);
    const result = formatAuthorList(authors);
    expect(result).toContain("& Given19 Family19");
    expect(result).not.toContain("…");
  });

  test("21+ authors use first 19, ellipsis, then final author", () => {
    const authors = Array.from({ length: 25 }, (_, i) => `Given${i} Family${i}`);
    const result = formatAuthorList(authors);
    expect(result).toContain("Given18 Family18");
    expect(result).not.toContain("Given19 Family19");
    expect(result).toContain("… Given24 Family24");
    expect(result).not.toContain("&");
  });

  test("empty author names are dropped", () => {
    expect(formatAuthorList(["", "Jane Smith", "  "])).toBe("Jane Smith");
  });
});

describe("formatApaReference", () => {
  const article: ApaReferenceInput = {
    authors: ["Jane Smith", "Bob Jones"],
    year: 2021,
    title: "Lifetime projections of cervical cancer",
    journal: "The Lancet",
    volume: "397",
    issue: "10282",
    firstPage: "1",
    lastPage: "12",
    doi: "10.1016/j.lancet.2021.01.001",
  };

  test("formats a full journal article", () => {
    expect(plain(article)).toBe(
      "Jane Smith, & Bob Jones (2021). Lifetime projections of cervical cancer. " +
        "The Lancet, 397(10282), 1–12. https://doi.org/10.1016/j.lancet.2021.01.001",
    );
  });

  test("italicises the journal name and volume only", () => {
    const segments = formatApaReference(article);
    const italics = segments.filter((s) => s.italic).map((s) => s.text);
    expect(italics).toEqual(["The Lancet", "397"]);
  });

  test("uses n.d. when the year is missing", () => {
    expect(plain({ ...article, year: null })).toContain("(n.d.).");
  });

  test("moves the title to the author slot when there are no authors", () => {
    const result = plain({ ...article, authors: [] });
    expect(result).toBe(
      "Lifetime projections of cervical cancer. (2021). " +
        "The Lancet, 397(10282), 1–12. https://doi.org/10.1016/j.lancet.2021.01.001",
    );
  });

  test("collapses a single-page range", () => {
    expect(plain({ ...article, lastPage: "1" })).toContain("397(10282), 1.");
  });

  test("omits issue and pages cleanly when absent", () => {
    const result = plain({
      ...article,
      issue: null,
      firstPage: null,
      lastPage: null,
    });
    expect(result).toContain("The Lancet, 397.");
  });

  test("renders publisher when there is no journal", () => {
    const result = plain({
      authors: ["Jane Smith"],
      year: 2019,
      title: "A book about evidence",
      journal: null,
      publisher: "Academic Press",
    });
    expect(result).toBe(
      "Jane Smith (2019). A book about evidence. Academic Press.",
    );
  });

  test("does not double a title's terminal punctuation", () => {
    expect(plain({ ...article, title: "Does this work?" })).toContain(
      "Does this work? The Lancet",
    );
  });

  test("normalises a doi: prefix to a doi.org URL", () => {
    expect(plain({ ...article, doi: "doi:10.5/x" })).toContain(
      "https://doi.org/10.5/x",
    );
  });

  test("leaves a full DOI URL as-is", () => {
    expect(plain({ ...article, doi: "https://doi.org/10.5/x" })).toContain(
      "https://doi.org/10.5/x",
    );
  });

  test("ends without a trailing space when there is no DOI", () => {
    const result = plain({ ...article, doi: null });
    expect(result).toBe(result.trimEnd());
    expect(result.endsWith("1–12.")).toBe(true);
  });
});

describe("apaSortKey", () => {
  test("derives the surname from a 'First Last' name", () => {
    expect(apaSortKey({ authors: ["Jane Smith"], title: "Z" })).toBe("smith");
  });

  test("derives the surname from an inverted 'Last, First' name", () => {
    expect(apaSortKey({ authors: ["Smith, Jane"], title: "Z" })).toBe("smith");
  });

  test("uses the last word for a middle-name form", () => {
    expect(apaSortKey({ authors: ["J. A. Smith"], title: "Z" })).toBe("smith");
  });

  test("falls back to the title when there are no authors", () => {
    expect(apaSortKey({ authors: [], title: "A Study" })).toBe("a study");
  });
});

describe("compareApaReferences", () => {
  const ref = (author: string, year: number | null, title = "") => ({
    authors: [author],
    year,
    title,
  });

  test("orders alphabetically by best-effort surname", () => {
    const list = [ref("Jane Smith", 2020), ref("Bob Adams", 2019)];
    const ordered = [...list].sort(compareApaReferences).map((r) => r.authors[0]);
    expect(ordered).toEqual(["Bob Adams", "Jane Smith"]);
  });

  test("matches inverted and plain forms of the same surname, then tiebreaks by year", () => {
    const list = [ref("Smith, Jane", 2021), ref("Jane Smith", 2018)];
    const ordered = [...list].sort(compareApaReferences).map((r) => r.year);
    // Same surname → earliest year first.
    expect(ordered).toEqual([2018, 2021]);
  });

  test("sorts undated works last within an author group", () => {
    const list = [ref("Smith, J", null), ref("Smith, J", 2000)];
    const ordered = [...list].sort(compareApaReferences).map((r) => r.year);
    expect(ordered).toEqual([2000, null]);
  });
});
