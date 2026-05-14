import { describe, test, expect } from "vitest";
import * as XLSX from "xlsx";

import {
  generateWorkbook,
  parseJsonl,
  workbookToArrayBuffer,
} from "@/services/export/generate.ts";
import type { ConceptResolver } from "@/services/export/types.ts";
import type { Authorship, Reference } from "@/types/models";

const MINIMAL_VOCAB: ConceptResolver = {
  prefixes: new Map([["esea", "https://vocab.esea.education/"]]),
  labels: new Map([
    ["https://vocab.esea.education/DocumentTypeScheme/C00008", "Journal Article"],
  ]),
};

/**
 * Build a Reference with a `linked_data` enhancement containing one
 * finding. Enough structure to drive `generateWorkbook` end-to-end
 * without bringing in the heavy fixtures.
 */
function syntheticReference(id: string): Reference {
  const author: Authorship = {
    display_name: "Smith J",
    orcid: null,
    position: "first",
  };
  return {
    id,
    visibility: "public",
    identifiers: [{ identifier: `10.1/${id}`, identifier_type: "doi" }],
    enhancements: [
      {
        id: `bib-${id}`,
        reference_id: id,
        source: "test",
        visibility: "public",
        robot_version: null,
        derived_from: null,
        created_at: "2024-01-01T00:00:00Z",
        content: {
          enhancement_type: "bibliographic",
          title: `Title ${id}`,
          authorship: [author],
          publication_year: 2020,
          cited_by_count: null,
          created_date: null,
          updated_date: null,
          publication_date: null,
          publisher: null,
          pagination: null,
          publication_venue: null,
        },
      },
      {
        id: `ld-${id}`,
        reference_id: id,
        source: "test",
        visibility: "public",
        robot_version: null,
        derived_from: null,
        created_at: "2024-01-02T00:00:00Z",
        content: {
          enhancement_type: "linked_data",
          vocabulary_uri: "https://vocab.esea.education/v1",
          data: {
            hasInvestigation: {
              documentType: {
                codedValue: { "@id": "esea:DocumentTypeScheme/C00008" },
              },
              hasFinding: [
                {
                  evaluates: { "@id": `_:i-${id}`, name: "Intervention" },
                  comparedTo: { "@id": `_:c-${id}` },
                  hasOutcome: { name: "Reading score" },
                  hasEffectEstimate: [{ pointEstimate: 0.5 }],
                },
              ],
            },
          },
        },
      },
    ],
  };
}

describe("parseJsonl", () => {
  test("parses each non-blank line into a Reference object", () => {
    const text = '{"id":"a"}\n\n{"id":"b"}\n';
    expect(parseJsonl(text)).toEqual([{ id: "a" }, { id: "b" }]);
  });

  test("handles CRLF line endings", () => {
    const text = '{"id":"a"}\r\n{"id":"b"}\r\n';
    expect(parseJsonl(text)).toEqual([{ id: "a" }, { id: "b" }]);
  });

  test("throws on malformed JSON", () => {
    expect(() => parseJsonl("{bad")).toThrow();
  });
});

describe("generateWorkbook", () => {
  test("produces the three expected sheets in the documented order", async () => {
    const wb = await generateWorkbook(
      [syntheticReference("ref-1")],
      MINIMAL_VOCAB,
    );
    expect(wb.SheetNames).toEqual([
      "Investigation Details",
      "Investigation Arms",
      "Outcomes",
    ]);
  });

  test("skips references that have no linked_data enhancement", async () => {
    // A reference with bibliographic but no linked_data — the skip path.
    const skipRef = syntheticReference("ref-skip");
    const noLinked: Reference = {
      ...skipRef,
      enhancements:
        skipRef.enhancements?.filter(
          (e) => e.content.enhancement_type !== "linked_data",
        ) ?? null,
    };
    const wb = await generateWorkbook(
      [noLinked, syntheticReference("ref-keep")],
      MINIMAL_VOCAB,
    );
    const inv = wb.Sheets["Investigation Details"]!;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(inv);
    // Header row excluded by sheet_to_json; exactly one body row.
    expect(rows).toHaveLength(1);
    expect(rows[0]!.reference_id).toBe("ref-keep");
  });

  test("accepts an async iterable of references", async () => {
    async function* gen(): AsyncGenerator<Reference> {
      yield syntheticReference("ref-1");
      yield syntheticReference("ref-2");
    }
    const wb = await generateWorkbook(gen(), MINIMAL_VOCAB);
    const inv = wb.Sheets["Investigation Details"]!;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(inv);
    expect(rows.map((r) => r.reference_id)).toEqual(["ref-1", "ref-2"]);
  });
});

describe("workbookToArrayBuffer", () => {
  test("returns an ArrayBuffer that XLSX.read round-trips", async () => {
    const wb = await generateWorkbook(
      [syntheticReference("ref-1")],
      MINIMAL_VOCAB,
    );
    const buf = workbookToArrayBuffer(wb);
    expect(buf).toBeInstanceOf(ArrayBuffer);

    const reparsed = XLSX.read(new Uint8Array(buf), { type: "array" });
    expect(reparsed.SheetNames).toEqual(wb.SheetNames);
  });
});
