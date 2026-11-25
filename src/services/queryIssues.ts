export interface QueryIssue {
  title: string;
  body?: string;
}

/** The note as one announcement; the stop gives screen readers a pause after the title. */
export function spokenIssue(issue: QueryIssue): string {
  return issue.body ? `${issue.title}. ${issue.body}` : issue.title;
}

/** For a query the search backend rejected that no check explains. */
export const UNREADABLE_QUERY: QueryIssue = {
  title: "Part of this query can’t be searched",
  body: "Check the operators, brackets and quotes.",
};

const BRACKET_NEVER_CLOSED: QueryIssue = {
  title: "A bracket isn’t closed",
  body: "Add a ) for each (.",
};
const BRACKET_NOTHING_TO_CLOSE: QueryIssue = {
  title: "There’s an extra )",
  body: "Remove it or add a ( earlier.",
};
const MIXED_QUOTES: QueryIssue = {
  title: "Use straight quotes (\") at both ends",
  body: "Some apps change them to curly quotes (“ ”).",
};
const QUOTE_UNCLOSED: QueryIssue = {
  title: "A phrase is missing its closing quote",
};
const endsWithOperator = (op: string): QueryIssue => ({
  title: `The query can’t end with ${op}`,
  body: "Add a term after it or remove it.",
});
const startsWithOperator = (op: string): QueryIssue => ({
  title: `The query can’t start with ${op}`,
  body: "Only NOT can go first.",
});
const adjacentOperators = (a: string, b: string): QueryIssue => ({
  title: `${a} ${b} needs a term between them`,
  body: "Remove one or add a term.",
});
const COLON: QueryIssue = {
  title: "Colons can’t be searched",
  body: "Remove it or put the phrase in quotes.",
};
const slashInTerm = (term: string): QueryIssue => ({
  title: "Slashes can’t be searched",
  body: `Put "${term}" in quotes to search it as one phrase.`,
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
const ENDS_IN_WORD = /[\p{L}\p{N}]$/u;

// Literal text becomes filler letters: it still reads as one term, but none
// of its characters count as syntax.
const FILLER = "x";

function bracketIssue(masked: string): QueryIssue | null {
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
  return strayClose ? BRACKET_NOTHING_TO_CLOSE : null;
}

// Lucene rejects a regex whose brackets or straight quotes don't pair.
function breaksRegex(body: string): boolean {
  const { masked } = mask(body);
  return bracketIssue(masked) !== null || masked.includes('"');
}

// The run of q around a slash, bounded where text has a space or bracket.
function termAround(text: string, q: string, slash: number): string {
  const before = text.slice(0, slash).split(TERM_BOUNDARY).pop() ?? "";
  const after = text.slice(slash + 1).split(TERM_BOUNDARY)[0];
  return q.slice(slash - before.length, slash + 1 + after.length);
}

function mask(q: string): { masked: string; brokenRegexSlash: number } {
  let masked = "";
  let brokenRegexSlash = -1;
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
        // Opened mid-word, the user meant a term like HIV/AIDS, not a regex.
        if (c === "/" && ENDS_IN_WORD.test(q.slice(0, i)) && breaksRegex(q.slice(i + 1, close))) brokenRegexSlash = i;
        masked += FILLER.repeat(close - i + 1);
        i = close + 1;
        continue;
      }
    }
    masked += c;
    i += 1;
  }
  return { masked, brokenRegexSlash };
}

/** The first problem in q that the search parser rejects, in check order, or null. */
export function findQueryIssue(q: string): QueryIssue | null {
  const { masked, brokenRegexSlash } = mask(q);
  // Ahead of the bracket and quote checks: the regex hid the user's pairs from them.
  if (brokenRegexSlash !== -1) return slashInTerm(termAround(q, q, brokenRegexSlash));

  const bracket = bracketIssue(masked);
  if (bracket) return bracket;

  // Masking leaves only the unclosed straight quote. A curly mark mixes with it
  // only by opening the phrase before it or closing it after.
  const quote = masked.indexOf('"');
  if (quote !== -1) {
    const before = masked.slice(0, quote);
    const curlyOpens = before.lastIndexOf("“") > before.lastIndexOf("”");
    return curlyOpens || masked.includes("”", quote) ? MIXED_QUOTES : QUOTE_UNCLOSED;
  }

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
  // Read q, not the mask: an escaped character beside the slash is not a letter.
  if (slash !== -1 && (ENDS_IN_WORD.test(q.slice(0, slash)) || /^[\p{L}\p{N}]/u.test(q.slice(slash + 1)))) {
    return slashInTerm(termAround(masked, q, slash));
  }
  return null;
}
