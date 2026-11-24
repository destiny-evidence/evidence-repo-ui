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

describe("findQueryIssue", () => {
  test.each([
    ["(phonics OR reading", BRACKET_NEVER_CLOSED],
    ["phonics) OR reading", BRACKET_NOTHING_TO_CLOSE],
    [") phonics (", BRACKET_NEVER_CLOSED],
    ["\"reading recovery”", MIXED_QUOTES],
    ["“reading recovery\"", MIXED_QUOTES],
    ["\"reading recovery", QUOTE_UNCLOSED],
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
    "\"a ) b\"",
    "\"say \\\"hi\\\" now\"",
    "\\(phonics",
    "phonics\\)",
    "“curly only”",
  ])("%j gives no note", (q) => {
    expect(findQueryIssue(q)).toBeNull();
  });

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
