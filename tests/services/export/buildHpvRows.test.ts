import { describe, test, expect } from "vitest";

import { buildReferenceRows } from "@/services/export/buildHpvRows.ts";
import type { ConceptResolver } from "@/services/export/types.ts";
import type {
  BibliographicMetadataEnhancement,
  Enhancement,
  EnhancementContent,
  Reference,
} from "@/types/models";

function makeRef(overrides: Partial<Reference>): Reference {
  return {
    id: "ref-1",
    visibility: "public",
    identifiers: null,
    enhancements: null,
    ...overrides,
  };
}

function makeEnh(
  content: EnhancementContent,
  overrides: Partial<Enhancement> = {},
): Enhancement {
  return {
    id: "enh-1",
    reference_id: "ref-1",
    source: "test",
    visibility: "public",
    robot_version: null,
    derived_from: null,
    created_at: "2024-01-01T00:00:00Z",
    content,
    ...overrides,
  };
}

function makeBibContent(
  overrides: Partial<BibliographicMetadataEnhancement> = {},
): BibliographicMetadataEnhancement {
  return {
    enhancement_type: "bibliographic",
    title: "HPV vaccine uptake in adolescents",
    authorship: [
      { display_name: "Smith J", orcid: null, position: "first" },
      { display_name: "Jones K", orcid: null, position: "middle" },
    ],
    publication_year: 2021,
    cited_by_count: null,
    created_date: null,
    updated_date: null,
    publication_date: null,
    publisher: null,
    pagination: null,
    publication_venue: { display_name: "Vaccine Journal", venue_type: "journal" },
    ...overrides,
  };
}

const NS = "https://vocab.aliveevidence.org/hpv/";
const PREFIXES = new Map([["hpv", NS]]);

const LABELS = new Map([
  [`${NS}c1`, "Nurse"],
  [`${NS}c2`, "Pharmacist"],
  [`${NS}c3`, "Adolescent girls"],
  [`${NS}c4`, "Kenya"],
]);

const IN_SCHEME = new Map([
  [`${NS}c1`, `${NS}DeliveryActor`],
  [`${NS}c2`, `${NS}DeliveryActor`],
  [`${NS}c3`, `${NS}TargetPopulation`],
  [`${NS}c4`, `${NS}Country`],
]);

const SCHEMES = [
  { uri: `${NS}DeliveryActor`, label: "Delivery Actor Scheme", topConcepts: [] },
  { uri: `${NS}TargetPopulation`, label: "Target Population Scheme", topConcepts: [] },
  { uri: `${NS}Country`, label: "Country Scheme", topConcepts: [] },
];

const VOCAB: ConceptResolver = {
  prefixes: PREFIXES,
  labels: LABELS,
  inScheme: IN_SCHEME,
  schemes: SCHEMES,
};

/** A reference with bibliographic, abstract, and linked-data (applied concepts). */
function hpvRef(id: string, conceptCuries: string[]): Reference {
  return makeRef({
    id,
    identifiers: [
      { identifier: `10.1/${id}`, identifier_type: "doi" },
      { identifier: `W-${id}`, identifier_type: "open_alex" },
    ],
    enhancements: [
      makeEnh(makeBibContent(), { id: `bib-${id}`, reference_id: id }),
      makeEnh(
        { enhancement_type: "abstract", process: "test", abstract: `Study summary ${id}` },
        { id: `abs-${id}`, reference_id: id },
      ),
      makeEnh(
        {
          enhancement_type: "linked_data",
          vocabulary_uri: `${NS}v1`,
          data: {
            hasInvestigation: {
              hasAppliedConcept: conceptCuries.map((c) => ({ "@id": c })),
            },
          },
        },
        { id: `ld-${id}`, reference_id: id },
      ),
    ],
  });
}

const BIB_HEADERS = [
  "Reference ID",
  "Title",
  "Authors",
  "Publication year",
  "Journal",
  "DOI",
  "OpenAlex ID",
  "Abstract",
];

describe("buildReferenceRows", () => {
  test("derives one scheme column per scheme, alphabetical, no Other codes when empty", async () => {
    const { headers } = await buildReferenceRows([], VOCAB);
    expect(headers).toEqual([
      ...BIB_HEADERS,
      "Country",
      "Delivery Actor",
      "Target Population",
    ]);
    expect(headers).not.toContain("Other codes");
  });

  test("orders scheme columns by pinnedFilters, then alphabetically", async () => {
    const { headers } = await buildReferenceRows([], VOCAB, [
      `${NS}TargetPopulation`,
      "year",
    ]);
    expect(headers).toEqual([
      ...BIB_HEADERS,
      "Target Population",
      "Country",
      "Delivery Actor",
    ]);
  });

  test("includes geo schemes as columns", async () => {
    const { headers } = await buildReferenceRows([], VOCAB);
    expect(headers).toContain("Country");
  });

  test("emits one row per reference with bibliographic columns populated", async () => {
    const { rows } = await buildReferenceRows(
      [hpvRef("ref-1", [])],
      VOCAB,
    );
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row["Reference ID"]).toBe("ref-1");
    expect(row["Title"]).toBe("HPV vaccine uptake in adolescents");
    expect(row["Authors"]).toBe("Smith J; Jones K");
    expect(row["Publication year"]).toBe(2021);
    expect(row["Journal"]).toBe("Vaccine Journal");
    expect(row["DOI"]).toBe("10.1/ref-1");
    expect(row["OpenAlex ID"]).toBe("W-ref-1");
    expect(row["Abstract"]).toBe("Study summary ref-1");
  });

  test("groups applied concepts into their scheme columns, joined with '; '", async () => {
    const { rows } = await buildReferenceRows(
      [hpvRef("ref-1", ["hpv:c1", "hpv:c2", "hpv:c3", "hpv:c4"])],
      VOCAB,
    );
    const row = rows[0]!;
    expect(row["Delivery Actor"]).toBe("Nurse; Pharmacist");
    expect(row["Target Population"]).toBe("Adolescent girls");
    expect(row["Country"]).toBe("Kenya");
  });

  test("leaves scheme cells blank for a reference with no applied concepts", async () => {
    const { rows } = await buildReferenceRows([hpvRef("ref-1", [])], VOCAB);
    const row = rows[0]!;
    expect(row["Delivery Actor"]).toBeUndefined();
    expect(row["Target Population"]).toBeUndefined();
  });

  test("emits a row even for a reference with no linked-data enhancement", async () => {
    const bibOnly = makeRef({
      id: "ref-bib-only",
      enhancements: [
        makeEnh(makeBibContent({ title: "Bib only" }), {
          id: "bib-x",
          reference_id: "ref-bib-only",
        }),
      ],
    });
    const { rows } = await buildReferenceRows([bibOnly], VOCAB);
    expect(rows).toHaveLength(1);
    expect(rows[0]!["Reference ID"]).toBe("ref-bib-only");
    expect(rows[0]!["Title"]).toBe("Bib only");
    expect(rows[0]!["Delivery Actor"]).toBeUndefined();
  });

  test("accepts an async iterable of references", async () => {
    async function* gen(): AsyncGenerator<Reference> {
      yield hpvRef("ref-1", ["hpv:c1"]);
      yield hpvRef("ref-2", ["hpv:c3"]);
    }
    const { rows } = await buildReferenceRows(gen(), VOCAB);
    expect(rows.map((r) => r["Reference ID"])).toEqual(["ref-1", "ref-2"]);
    expect(rows[0]!["Delivery Actor"]).toBe("Nurse");
    expect(rows[1]!["Target Population"]).toBe("Adolescent girls");
  });

  test("routes concepts with no scheme column into Other codes", async () => {
    // hpv:c9 has a label but no inScheme entry; hpv:c8 is unlabelled too.
    const vocab: ConceptResolver = {
      ...VOCAB,
      labels: new Map([...LABELS, [`${NS}c9`, "Uncoded concept"]]),
    };
    const { headers, rows } = await buildReferenceRows(
      [hpvRef("ref-1", ["hpv:c1", "hpv:c9", "hpv:c8"])],
      vocab,
    );
    expect(headers).toContain("Other codes");
    const row = rows[0]!;
    expect(row["Delivery Actor"]).toBe("Nurse");
    expect(row["Other codes"]).toBe(`Uncoded concept; ${NS}c8`);
  });

  test("URI-suffixes a scheme header that collides with another scheme", async () => {
    const collidingSchemes = [
      { uri: `${NS}DeliveryActorA`, label: "Delivery Actor Scheme", topConcepts: [] },
      { uri: `${NS}DeliveryActorB`, label: "Delivery Actor Scheme", topConcepts: [] },
    ];
    const { headers } = await buildReferenceRows([], {
      ...VOCAB,
      schemes: collidingSchemes,
    });
    expect(headers).toEqual([
      ...BIB_HEADERS,
      "Delivery Actor",
      `Delivery Actor (${NS}DeliveryActorB)`,
    ]);
  });
});
