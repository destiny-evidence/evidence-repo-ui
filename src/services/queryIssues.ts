export interface QueryIssue {
  title: string;
  body: string;
}

/** For a query the search backend rejected that no check explains. */
export const UNREADABLE_QUERY: QueryIssue = {
  title: "This query couldn’t be read",
  body: "Check the operators, brackets and quotation marks, then search again.",
};

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
const endsWithOperator = (op: string): QueryIssue => ({
  title: `The query ends with ${op}`,
  body: `Every operator needs a term after it. Add a term after ${op}, or drop it.`,
});
const startsWithOperator = (op: string): QueryIssue => ({
  title: `The query starts with ${op}`,
  body: `${op} needs a term on both sides. NOT is the only operator that can open a query.`,
});
const adjacentOperators = (a: string, b: string): QueryIssue => ({
  title: "Two operators sit next to each other",
  body: `“${a} ${b}” has no term between them. Keep one, or put a term in the middle.`,
});
const COLON: QueryIssue = {
  title: "A colon can’t be searched here",
  body: "Remove the colon or put the whole title in quotes.",
};
const slashInTerm = (term: string): QueryIssue => ({
  title: `${term} can’t be searched with a slash in it`,
  body: "Put the term in quotes so it is read as one phrase.",
});

// The parser treats lowercase and/or/not as ordinary words.
const joinsTerms = (token: string | undefined): token is string =>
  token === "AND" || token === "OR";
const isOperator = (token: string | undefined): token is string =>
  joinsTerms(token) || token === "NOT";

// The parser skips only these; a no-break space joins its neighbours into one term.
const SPACE = " \\t\\n\\r\\u3000";
const TOKEN = new RegExp(`[()]|[^${SPACE}()]+`, "g");
const TERM_BOUNDARY = new RegExp(`[${SPACE}()]`);
const TRAILING_SPACE = new RegExp(`[${SPACE}]+$`);
const SPACE_ONLY = new RegExp(`^[${SPACE}]*$`);

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

  const tokens = masked.match(TOKEN) ?? [];
  const last = tokens.at(-1);
  if (isOperator(last)) return endsWithOperator(last);
  const first = tokens[0];
  if (joinsTerms(first)) return startsWithOperator(first);
  for (let t = 1; t < tokens.length; t++) {
    const a = tokens[t - 1];
    const b = tokens[t];
    if (isOperator(a) && joinsTerms(b)) return adjacentOperators(a, b);
  }

  for (let k = masked.indexOf(":"); k !== -1; k = masked.indexOf(":", k + 1)) {
    const wordBefore = masked.slice(0, k).replace(TRAILING_SPACE, "").split(TERM_BOUNDARY).pop();
    if (!wordBefore || isOperator(wordBefore) || SPACE_ONLY.test(masked.slice(k + 1))) return COLON;
  }

  // Masking leaves only an unclosed slash, at its index in q.
  const slash = masked.indexOf("/");
  if (slash !== -1) {
    const before = masked.slice(0, slash).split(TERM_BOUNDARY).pop() ?? "";
    const after = masked.slice(slash + 1).split(TERM_BOUNDARY)[0];
    // Read q, not the mask: an escaped character beside the slash is not a letter.
    if (/[\p{L}\p{N}]$/u.test(q.slice(0, slash)) || /^[\p{L}\p{N}]/u.test(q.slice(slash + 1))) {
      return slashInTerm(q.slice(slash - before.length, slash + 1 + after.length));
    }
  }
  return null;
}
