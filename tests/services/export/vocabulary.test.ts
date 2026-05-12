import { describe, test, expect } from "vitest";

import { buildLabelLookup } from "@/services/export/vocabulary.ts";

describe("buildLabelLookup", () => {
  test("emits CURIE-keyed entries for each subject with a prefLabel", () => {
    const ttl = `
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix esea: <https://vocab.esea.education/> .

<https://vocab.esea.education/DocumentTypeScheme/C00008>
  a skos:Concept ;
  skos:prefLabel "Journal Article" .

<https://vocab.esea.education/EducationLevelScheme/C00002>
  a skos:Concept ;
  skos:prefLabel "Primary Education" .
`;
    const lookup = buildLabelLookup(ttl);
    expect(lookup.get("esea:DocumentTypeScheme/C00008")).toBe("Journal Article");
    expect(lookup.get("esea:EducationLevelScheme/C00002")).toBe(
      "Primary Education",
    );
  });

  test("picks the longest matching namespace when prefixes overlap", () => {
    const ttl = `
@prefix esea: <https://vocab.esea.education/> .
@prefix doc:  <https://vocab.esea.education/DocumentTypeScheme/> .

<https://vocab.esea.education/DocumentTypeScheme/C00008>
  skos:prefLabel "Journal Article" .
`;
    const lookup = buildLabelLookup(ttl);
    expect(lookup.get("doc:C00008")).toBe("Journal Article");
    expect(lookup.has("esea:DocumentTypeScheme/C00008")).toBe(false);
  });

  test("decodes \\n, \\t, \\\\ and \\\" escape sequences in labels", () => {
    const ttl = `
@prefix esea: <https://vocab.esea.education/> .

<https://vocab.esea.education/A>
  skos:prefLabel "Line1\\nLine2" .

<https://vocab.esea.education/B>
  skos:prefLabel "Quote: \\"hi\\"" .

<https://vocab.esea.education/C>
  skos:prefLabel "Back\\\\slash" .
`;
    const lookup = buildLabelLookup(ttl);
    expect(lookup.get("esea:A")).toBe("Line1\nLine2");
    expect(lookup.get("esea:B")).toBe('Quote: "hi"');
    expect(lookup.get("esea:C")).toBe("Back\\slash");
  });

  test("ignores subjects that have no skos:prefLabel triple", () => {
    const ttl = `
@prefix esea: <https://vocab.esea.education/> .

<https://vocab.esea.education/A>
  a skos:Concept ;
  skos:definition "no prefLabel here" .
`;
    expect(buildLabelLookup(ttl).has("esea:A")).toBe(false);
  });

  test("ignores prefLabel triples for predicates other than skos:prefLabel", () => {
    const ttl = `
@prefix esea: <https://vocab.esea.education/> .
@prefix other: <http://example.org/> .

<https://vocab.esea.education/A>
  other:prefLabel "not skos" .
`;
    expect(buildLabelLookup(ttl).has("esea:A")).toBe(false);
  });

  test("drops subjects with no matching namespace", () => {
    const ttl = `
@prefix esea: <https://vocab.esea.education/> .

<http://elsewhere.example.org/X>
  skos:prefLabel "Orphan" .
`;
    const lookup = buildLabelLookup(ttl);
    expect(lookup.size).toBe(0);
  });
});
