import { describe, test, expect } from "vitest";
import { groupAppliedConcepts } from "@/services/taxonomyCodesUtils";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";

const TARGET = "https://v/TargetPopulation";
const STUDY = "https://v/StudyDesign";
const COUNTRY = "https://v/Country";

const schemes: ConceptScheme[] = [
  {
    uri: TARGET,
    label: "Target Population",
    topConcepts: [
      {
        uri: "tp:adult",
        label: "Adults",
        narrower: [{ uri: "tp:21plus", label: "21+ years" }],
      },
    ],
  },
  {
    uri: STUDY,
    label: "Study Design Scheme",
    topConcepts: [
      {
        uri: "sd:quant",
        label: "Quantitative",
        narrower: [
          {
            uri: "sd:rct",
            label: "RCT",
            narrower: [{ uri: "sd:crct", label: "Cluster RCT" }],
          },
        ],
      },
    ],
  },
  {
    uri: COUNTRY,
    label: "Country",
    topConcepts: [
      { uri: "c:KE", label: "Kenya" },
      { uri: "c:UG", label: "Uganda" },
    ],
  },
];

const inScheme = new Map<string, string>([
  ["tp:21plus", TARGET],
  ["sd:rct", STUDY],
  ["sd:crct", STUDY],
  ["c:KE", COUNTRY],
  ["c:UG", COUNTRY],
]);

const GEO = [COUNTRY];

const applied = (...uris: string[]) =>
  uris.map((uri) => ({ uri, label: undefined }));

// A single-scheme fixture with `n` leaf codes, for exercising the roll-up threshold.
const schemeWithCodes = (uri: string, label: string, n: number) => {
  const codes = Array.from({ length: n }, (_, i) => `${uri}#${i}`);
  const scheme: ConceptScheme = {
    uri,
    label,
    topConcepts: codes.map((u) => ({ uri: u, label: u })),
  };
  const inScheme = new Map(codes.map((u) => [u, uri] as const));
  return { codes, scheme, inScheme };
};

describe("groupAppliedConcepts", () => {
  test("returns [] for no applied concepts", () => {
    expect(groupAppliedConcepts([], inScheme, schemes, GEO)).toEqual([]);
  });

  test("orders geo first then topical; small groups are not rolled up", () => {
    const g = groupAppliedConcepts(
      applied("tp:21plus", "c:KE", "c:UG"),
      inScheme,
      schemes,
      GEO,
    );
    expect(g.map((x) => x.schemeLabel)).toEqual(["Country", "Target Population"]);
    const country = g[0];
    expect(country.isGeo).toBe(true);
    expect(country.appliedCount).toBe(2);
    expect(country.rolledUp).toBe(false);
    expect(g[1].isGeo).toBe(false);
    expect(g[1].rolledUp).toBe(false);
  });

  test("strips a trailing 'Scheme' from the label", () => {
    expect(
      groupAppliedConcepts(applied("sd:crct"), inScheme, schemes, GEO)[0]
        .schemeLabel,
    ).toBe("Study Design");
  });

  test("nests applied concepts under ancestor sub-headings to depth 2", () => {
    const [study] = groupAppliedConcepts(
      applied("sd:crct"),
      inScheme,
      schemes,
      GEO,
    );
    const quant = study.nodes[0];
    expect(quant).toMatchObject({ label: "Quantitative", applied: false });
    const rct = quant.children[0];
    expect(rct).toMatchObject({ label: "RCT", applied: false });
    expect(rct.children[0]).toMatchObject({
      label: "Cluster RCT",
      applied: true,
      children: [],
    });
  });

  test("marks a parent applied when both it and a descendant are coded", () => {
    const [study] = groupAppliedConcepts(
      applied("sd:rct", "sd:crct"),
      inScheme,
      schemes,
      GEO,
    );
    const rct = study.nodes[0].children[0];
    expect(rct.applied).toBe(true);
    expect(rct.children[0].applied).toBe(true);
  });

  test("unknown-scheme / scheme-level codes go to a trailing 'Other codes' group", () => {
    const g = groupAppliedConcepts(
      applied("tp:21plus", "https://v/mystery/X"),
      inScheme,
      schemes,
      GEO,
    );
    expect(g[g.length - 1]).toMatchObject({
      schemeLabel: "Other codes",
      appliedCount: 1,
    });
  });

  test("rolls up any group with more than 10 applied codes, geo or not", () => {
    const { codes, scheme, inScheme } = schemeWithCodes(
      TARGET,
      "Target Population",
      11,
    );
    const [g] = groupAppliedConcepts(applied(...codes), inScheme, [scheme], GEO);
    expect(g.isGeo).toBe(false);
    expect(g.appliedCount).toBe(11);
    expect(g.rolledUp).toBe(true);
  });

  test("does not roll up a group sitting exactly at the threshold of 10", () => {
    const { codes, scheme, inScheme } = schemeWithCodes(
      TARGET,
      "Target Population",
      10,
    );
    const [g] = groupAppliedConcepts(applied(...codes), inScheme, [scheme], GEO);
    expect(g.appliedCount).toBe(10);
    expect(g.rolledUp).toBe(false);
  });

  test("rolls up the geo Country scheme once it floods past the threshold", () => {
    const { codes, scheme, inScheme } = schemeWithCodes(COUNTRY, "Country", 12);
    const [g] = groupAppliedConcepts(applied(...codes), inScheme, [scheme], GEO);
    expect(g.isGeo).toBe(true);
    expect(g.rolledUp).toBe(true);
  });

  test("never rolls up the 'Other codes' bucket, so drift stays visible", () => {
    const { codes, inScheme } = schemeWithCodes("https://v/unknown", "X", 12);
    const g = groupAppliedConcepts(applied(...codes), inScheme, schemes, GEO);
    const other = g[g.length - 1];
    expect(other.schemeLabel).toBe("Other codes");
    expect(other.appliedCount).toBe(12);
    expect(other.rolledUp).toBe(false);
  });

  test("appends applied concepts absent from the scheme tree as flat nodes", () => {
    const im = new Map(inScheme).set("tp:orphan", TARGET);
    const [tp] = groupAppliedConcepts(
      [{ uri: "tp:orphan", label: "Orphan" }],
      im,
      schemes,
      GEO,
    );
    expect(tp.nodes).toContainEqual({
      uri: "tp:orphan",
      label: "Orphan",
      applied: true,
      children: [],
    });
  });
});
