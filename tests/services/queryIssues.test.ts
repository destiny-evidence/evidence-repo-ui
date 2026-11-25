import { describe, test, expect } from "vitest";
import { findQueryIssue } from "@/services/queryIssues";

const BRACKET_NEVER_CLOSED = {
  title: "A bracket isn’t closed",
  body: "Add a ) for each (.",
};
const BRACKET_NOTHING_TO_CLOSE = {
  title: "There’s an extra )",
  body: "Remove it or add a ( earlier.",
};
const MIXED_QUOTES = {
  title: "Use straight quotes (\") at both ends",
  body: "Some apps change them to curly quotes (“ ”).",
};
const QUOTE_UNCLOSED = {
  title: "A phrase is missing its closing quote",
};
const endsWith = (op: string) => ({
  title: `The query can’t end with ${op}`,
  body: "Add a term after it or remove it.",
});
const startsWith = (op: string) => ({
  title: `The query can’t start with ${op}`,
  body: "Only NOT can go first.",
});
const adjacent = (a: string, b: string) => ({
  title: `${a} ${b} needs a term between them`,
  body: "Remove one or add a term.",
});
const COLON = {
  title: "Colons can’t be searched",
  body: "Remove it or put the phrase in quotes.",
};
const slashIn = (term: string) => ({
  title: "Slashes can’t be searched",
  body: `Put "${term}" in quotes to search it as one phrase.`,
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
