import { describe, test, expect } from "vitest";
import { parseRis, risToApaInput } from "@/services/citation/ris";

const RECORD = [
  "TY  - JOUR",
  "TI  - Lifetime projections of cervical cancer",
  "AU  - Jane Smith",
  "AU  - Bob Jones",
  "PY  - 2021",
  "DA  - 2021/03/15",
  "T2  - The Lancet",
  "VL  - 397",
  "IS  - 10282",
  "SP  - 1",
  "EP  - 12",
  "DO  - 10.1016/j.lancet.2021.01.001",
  "ER  - ",
].join("\n");

describe("parseRis", () => {
  test("parses a single record's tags", () => {
    const [rec] = parseRis(RECORD);
    expect(rec["TY"]).toEqual(["JOUR"]);
    expect(rec["TI"]).toEqual(["Lifetime projections of cervical cancer"]);
    expect(rec["VL"]).toEqual(["397"]);
  });

  test("collects repeated AU tags in order", () => {
    const [rec] = parseRis(RECORD);
    expect(rec["AU"]).toEqual(["Jane Smith", "Bob Jones"]);
  });

  test("splits multiple records on TY/ER boundaries", () => {
    const two = `${RECORD}\n${RECORD.replace("397", "398")}`;
    const records = parseRis(two);
    expect(records).toHaveLength(2);
    expect(records[1]["VL"]).toEqual(["398"]);
  });

  test("ignores blank lines and stray non-tag lines", () => {
    const noisy = `\n\nleading junk\n${RECORD}\n   \n`;
    expect(parseRis(noisy)).toHaveLength(1);
  });

  test("captures a dash inside a value rather than splitting on it", () => {
    const [rec] = parseRis("TY  - JOUR\nTI  - Cost-effectiveness of X\nER  - ");
    expect(rec["TI"]).toEqual(["Cost-effectiveness of X"]);
  });

  test("tolerates CRLF line endings", () => {
    const [rec] = parseRis("TY  - JOUR\r\nTI  - X\r\nER  - \r\n");
    expect(rec["TI"]).toEqual(["X"]);
  });
});

describe("risToApaInput", () => {
  test("maps the standard journal tags", () => {
    const input = risToApaInput(parseRis(RECORD)[0]);
    expect(input).toEqual({
      authors: ["Jane Smith", "Bob Jones"],
      year: 2021,
      title: "Lifetime projections of cervical cancer",
      journal: "The Lancet",
      volume: "397",
      issue: "10282",
      firstPage: "1",
      lastPage: "12",
      publisher: null,
      doi: "10.1016/j.lancet.2021.01.001",
    });
  });

  test("falls back to the DA year when PY is absent", () => {
    const rec = parseRis("TY  - JOUR\nDA  - 2019/06/01\nER  - ")[0];
    expect(risToApaInput(rec).year).toBe(2019);
  });

  test("has no authors and a null year for a sparse record", () => {
    const input = risToApaInput(parseRis("TY  - GEN\nTI  - Untitled\nER  - ")[0]);
    expect(input.authors).toEqual([]);
    expect(input.year).toBeNull();
  });

  test("end-to-end produces a clean APA string via the formatter", async () => {
    const { formatApaReference, apaPlainText } = await import(
      "@/services/citation/apa"
    );
    const input = risToApaInput(parseRis(RECORD)[0]);
    expect(apaPlainText(formatApaReference(input))).toBe(
      "Jane Smith, & Bob Jones (2021). Lifetime projections of cervical cancer. " +
        "The Lancet, 397(10282), 1–12. https://doi.org/10.1016/j.lancet.2021.01.001",
    );
  });
});
