import { describe, test, expect } from "vitest";
import { findQueryIssue } from "@/services/queryIssues";

const BRACKET_NEVER_CLOSED = {
  title: "A bracket is never closed",
  body: "Every ( needs a matching ). Brackets group terms so the operators apply in the order you intend.",
};
const BRACKET_NOTHING_TO_CLOSE = {
  title: "A closing bracket has nothing to close",
  body: "Remove the extra ) or add an opening ( earlier in the query.",
};
const MIXED_QUOTES = {
  title: "A phrase starts and ends with different quote marks",
  body: "Use straight quotes (\") at both ends of the phrase. Some apps change them to curly quotes (“ ”) when you type.",
};
const QUOTE_UNCLOSED = {
  title: "A quotation mark is unclosed",
  body: "Exact phrases need quotes at both ends.",
};
const endsWith = (op: string) => ({
  title: `The query ends with ${op}`,
  body: `Every operator needs a term after it. Add a term after ${op}, or drop it.`,
});
const startsWith = (op: string) => ({
  title: `The query starts with ${op}`,
  body: `${op} needs a term on both sides. NOT is the only operator that can open a query.`,
});
const adjacent = (a: string, b: string) => ({
  title: "Two operators sit next to each other",
  body: `“${a} ${b}” has no term between them. Keep one, or put a term in the middle.`,
});
const COLON = {
  title: "A colon can’t be searched here",
  body: "Remove the colon or put the whole title in quotes.",
};
const slashIn = (term: string) => ({
  title: `${term} can’t be searched with a slash in it`,
  body: "Put the term in quotes so it is read as one phrase.",
});

describe("findQueryIssue", () => {
  test.each([
    ["(phonics OR reading", BRACKET_NEVER_CLOSED],
    ["phonics) OR reading", BRACKET_NOTHING_TO_CLOSE],
    [") phonics (", BRACKET_NEVER_CLOSED],
    ["\"reading recovery”", MIXED_QUOTES],
    ["“reading recovery\"", MIXED_QUOTES],
    ["\"reading recovery", QUOTE_UNCLOSED],
    ["“reading recovery” \"x", QUOTE_UNCLOSED],
    ["phonics AND", endsWith("AND")],
    ["NOT", endsWith("NOT")],
    ["AND phonics", startsWith("AND")],
    ["OR phonics", startsWith("OR")],
    ["phonics AND OR reading", adjacent("AND", "OR")],
    ["phonics NOT AND reading", adjacent("NOT", "AND")],
    ["phonics (AND OR reading)", adjacent("AND", "OR")],
    ["Survey (EGRA): Final", COLON],
    ["title: ", COLON],
    ["phonics AND :reading", COLON],
    ["title:phonics (EGRA): Final", COLON],
    ["HIV/AIDS", slashIn("HIV/AIDS")],
    ["(HIV/AIDS)", slashIn("HIV/AIDS")],
    ["𝟙/", slashIn("𝟙/")],
    ["/𝟙", slashIn("/𝟙")],
    ["\"a b\"/c", slashIn("\"a b\"/c")],
    ["HIV/AIDS AND (TB/HIV OR malaria)", slashIn("HIV/AIDS")],
    ["HIV/AIDS AND (TB/HIV OR malaria", slashIn("HIV/AIDS")],
    ["HIV/AIDS OR \"HIV/AIDS\"", slashIn("HIV/AIDS")],
    ["\"phonics AND", QUOTE_UNCLOSED],
  ])("%j gives its note", (q, expected) => {
    expect(findQueryIssue(q)).toEqual(expected);
  });

  test.each(["title:phonics", "literac*", "\"exact phrase\"", "spelling~", "NOT phonics"])(
    "the hint's example %j gives no note",
    (q) => {
      expect(findQueryIssue(q)).toBeNull();
    },
  );

  test.each([
    "",
    "\"a (b\"",
    "\"say \\\"hi\\\" now\"",
    "\\(phonics",
    "“curly only”",
    "phonics AND NOT reading",
    "phonics and",
    "\"exact phrase\" OR phonics",
    "word : subtitle",
    "HIV/AIDS AND TB/HIV",
    "HIV/AIDS \"x\" TB/HIV",
    "phonics\u00a0AND",
  ])("%j gives no note", (q) => {
    expect(findQueryIssue(q)).toBeNull();
  });

  test.each(["NOT NOT phonics", "phonics / reading", "\\(/\\)"])(
    "rejected %j is left to the generic message",
    (q) => {
      expect(findQueryIssue(q)).toBeNull();
    },
  );

  test("unclosed quote's tail is still checked", () => {
    expect(findQueryIssue("(phonics \"reading)")).toEqual(QUOTE_UNCLOSED);
  });

  test("curly quotes inside a closed phrase don't count", () => {
    expect(findQueryIssue("\"he said “hi”\" \"reading")).toEqual(QUOTE_UNCLOSED);
  });

  test("brackets inside a closed regex don't count", () => {
    expect(findQueryIssue("/[)]/")).toBeNull();
  });

  test("brackets are checked before quotes", () => {
    expect(findQueryIssue("(phonics \"reading")).toEqual(BRACKET_NEVER_CLOSED);
  });
});
