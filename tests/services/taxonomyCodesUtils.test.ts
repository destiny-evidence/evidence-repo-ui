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

describe("groupAppliedConcepts", () => {
  test("returns [] for no applied concepts", () => {
    expect(groupAppliedConcepts([], inScheme, schemes, GEO)).toEqual([]);
  });

  test("orders topical first then geo; geo is collapsedByDefault with a count", () => {
    const g = groupAppliedConcepts(
      applied("tp:21plus", "c:KE", "c:UG"),
      inScheme,
      schemes,
      GEO,
    );
    expect(g.map((x) => x.schemeLabel)).toEqual(["Target Population", "Country"]);
    const country = g[1];
    expect(country.isGeo).toBe(true);
    expect(country.collapsedByDefault).toBe(true);
    expect(country.appliedCount).toBe(2);
    expect(g[0].collapsedByDefault).toBe(false);
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
