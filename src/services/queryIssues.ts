export interface QueryIssue {
  title: string;
  body: string;
}

const BRACKET_NEVER_CLOSED: QueryIssue = {
  title: "A bracket is never closed",
  body: "Every ( needs a matching ). Brackets group terms so the operators apply in the order you intend.",
};
const BRACKET_NOTHING_TO_CLOSE: QueryIssue = {
  title: "A closing bracket has nothing to close",
  body: "Remove the extra ) or add an opening ( earlier in the query.",
};
const MIXED_QUOTES: QueryIssue = {
  title: "A phrase starts and ends with different quote marks",
  body: "Use straight quotes (\") at both ends of the phrase. Some apps change them to curly quotes (“ ”) when you type.",
};
const QUOTE_UNCLOSED: QueryIssue = {
  title: "A quotation mark is unclosed",
  body: "Exact phrases need quotes at both ends.",
};

// Literal text becomes filler letters: it still reads as one term, but none
// of its characters count as syntax.
const FILLER = "x";

function mask(q: string): string {
  let masked = "";
  let i = 0;
  while (i < q.length) {
    const c = q[i];
    if (c === "\\") {
      masked += FILLER.repeat(2);
      i += 2;
      continue;
    }
    // The parser reads /…/ as a regex wherever it appears, like a phrase.
    if (c === '"' || c === "/") {
      let close = i + 1;
      while (close < q.length && q[close] !== c) close += q[close] === "\\" ? 2 : 1;
      // An unclosed delimiter masks nothing, so the text after it is still checked.
      if (close < q.length) {
        masked += FILLER.repeat(close - i + 1);
        i = close + 1;
        continue;
      }
    }
    masked += c;
    i += 1;
  }
  return masked;
}

/** The first problem in q that the search parser rejects, in check order, or null. */
export function findQueryIssue(q: string): QueryIssue | null {
  const masked = mask(q);

  let depth = 0;
  let strayClose = false;
  for (const c of masked) {
    if (c === "(") depth++;
    else if (c === ")") {
      if (depth === 0) strayClose = true;
      else depth--;
    }
  }
  if (depth > 0) return BRACKET_NEVER_CLOSED;
  if (strayClose) return BRACKET_NOTHING_TO_CLOSE;

  if (masked.includes('"')) return /[“”]/.test(masked) ? MIXED_QUOTES : QUOTE_UNCLOSED;
  return null;
}
