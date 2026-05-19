import { describe, test, expect } from "vitest";
import {
  decodeHtmlEntities,
  stripAbstractLabelPrefix,
} from "@/services/textUtils";

describe("decodeHtmlEntities", () => {
  test.each([
    ["", ""],
    ["plain text", "plain text"],
    // Contains "&" but not a recognised entity. Proves the includes("&")
    // fast-path's non-trivial branch (textarea runs) is non-destructive.
    ["AT&T research", "AT&T research"],
  ])("passes through %j unchanged", (input, expected) => {
    expect(decodeHtmlEntities(input)).toBe(expected);
  });

  test.each([
    ["a &gt; b &lt; c", "a > b < c"],
    ["&amp;", "&"],
    ["&quot;hi&quot;", '"hi"'],
    ["a&nbsp;b", "a\u00a0b"],
    ["en&#8211;dash", "en–dash"],
    ["en&#x2013;dash", "en–dash"],
  ])("decodes entities in %j", (input, expected) => {
    expect(decodeHtmlEntities(input)).toBe(expected);
  });

  test("normalises encoded CR/LF entities to a single LF line break", () => {
    // HTML5 spec: <textarea>.innerHTML normalises CR (U+000D) and CRLF to a
    // single LF (U+000A) on set. Observed in W6997086441's "&#13;" data.
    expect(decodeHtmlEntities("line1&#13;&#10;line2")).toBe("line1\nline2");
  });

  test("preserves tags as literal text while decoding entities inside them", () => {
    // Guards the textarea choice over DOMParser: DOMParser would parse <p>
    // and strip the tags silently; textarea's escapable-raw-text content
    // model leaves tags as literal characters.
    expect(decodeHtmlEntities("<p>a &gt; b</p>")).toBe("<p>a > b</p>");
  });
});

describe("stripAbstractLabelPrefix", () => {
  test.each([
    ["Abstract This paper aims to investigate.", "This paper aims to investigate."],
    ["Abstract   The leading whitespace is normalised.", "The leading whitespace is normalised."],
    // Pass-through when the prefix is absent or differently cased.
    ["The paper presents results.", "The paper presents results."],
    ["abstract reasoning improves problem-solving.", "abstract reasoning improves problem-solving."],
    ["ABSTRACT in caps is not stripped.", "ABSTRACT in caps is not stripped."],
    ["", ""],
  ])("normalises %j", (input, expected) => {
    expect(stripAbstractLabelPrefix(input)).toBe(expected);
  });
});
