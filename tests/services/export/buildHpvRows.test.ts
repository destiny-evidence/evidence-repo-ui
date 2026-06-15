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
    identifiers: [{ identifier: `10.1/${id}`, identifier_type: "doi" }],
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
  "reference_id",
  "title",
  "authors",
  "publication_year",
  "journal",
  "doi",
  "abstract",
];

describe("buildReferenceRows", () => {
  test("derives one scheme column per scheme, headed by the display label", async () => {
    const { headers } = await buildReferenceRows([], VOCAB);
    expect(headers).toEqual([
      ...BIB_HEADERS,
      "Delivery Actor",
      "Target Population",
      "Country",
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
    expect(row.reference_id).toBe("ref-1");
    expect(row.title).toBe("HPV vaccine uptake in adolescents");
    expect(row.authors).toBe("Smith J; Jones K");
    expect(row.publication_year).toBe(2021);
    expect(row.journal).toBe("Vaccine Journal");
    expect(row.doi).toBe("10.1/ref-1");
    expect(row.abstract).toBe("Study summary ref-1");
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
    expect(rows[0]!.reference_id).toBe("ref-bib-only");
    expect(rows[0]!.title).toBe("Bib only");
    expect(rows[0]!["Delivery Actor"]).toBeUndefined();
  });

  test("accepts an async iterable of references", async () => {
    async function* gen(): AsyncGenerator<Reference> {
      yield hpvRef("ref-1", ["hpv:c1"]);
      yield hpvRef("ref-2", ["hpv:c3"]);
    }
    const { rows } = await buildReferenceRows(gen(), VOCAB);
    expect(rows.map((r) => r.reference_id)).toEqual(["ref-1", "ref-2"]);
    expect(rows[0]!["Delivery Actor"]).toBe("Nurse");
    expect(rows[1]!["Target Population"]).toBe("Adolescent girls");
  });
});
