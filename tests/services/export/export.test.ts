import { describe, test, expect, vi, afterEach, beforeEach } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import * as XLSX from "xlsx";

import { exportReferencesToExcel } from "@/services/export/export.ts";
import { _resetContextCache } from "@/services/vocabulary/contextService";
import { _resetVocabularyCache } from "@/services/vocabulary/vocabularyService";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, "fixtures");

const VOCAB_URL = "https://vocab.example.org/v1";
const VOCAB_JSONLD_URL = "https://vocab.example.org/v1.jsonld";
const CONTEXT_URL = "https://vocab.example.org/context.jsonld";
const JSONL_URL = "https://signed.example.com/refs.jsonl?sig=abc";

const VOCAB_JSONLD_BODY = JSON.stringify({
  "@graph": [
    {
      "@id": "https://vocab.esea.education/DocumentTypeScheme/C00008",
      "@type": "skos:Concept",
      "skos:prefLabel": "Journal Article",
    },
  ],
});

const CONTEXT_JSONLD_BODY = JSON.stringify({
  "@context": { esea: "https://vocab.esea.education/" },
});

const JSONL_BODY =
  JSON.stringify({
    id: "ref-1",
    identifiers: [{ identifier_type: "doi", identifier: "10.1/x" }],
    enhancements: [
      {
        id: "ld-1",
        reference_id: "ref-1",
        created_at: "2024-01-02T00:00:00Z",
        content: {
          enhancement_type: "linked_data",
          vocabulary_uri: "https://vocab.esea.education/v1",
          data: {
            hasInvestigation: {
              hasFinding: [
                {
                  evaluates: { "@id": "_:i1", name: "Phonics" },
                  comparedTo: { "@id": "_:c1" },
                  hasOutcome: { name: "Reading" },
                  hasEffectEstimate: [{ pointEstimate: 0.5 }],
                },
              ],
            },
          },
        },
      },
    ],
  }) + "\n";

interface CapturedDownload {
  blob: Blob | null;
  blobBytes: ArrayBuffer | null;
  filename: string | null;
  revoked: boolean;
}

type BodySetting =
  | string
  | { status: number; statusText?: string; body?: string };

function respond(setting: BodySetting): Response {
  if (typeof setting === "string") return new Response(setting, { status: 200 });
  return new Response(setting.body ?? "", {
    status: setting.status,
    statusText: setting.statusText,
  });
}

/**
 * Install fetch + download spies for an export test. Routes fetches by
 * URL: anything containing "context" goes to `contextBody`; anything
 * else containing "vocab" goes to `vocabBody`; everything else goes to
 * `jsonlBody` (streamed through a `ReadableStream` to exercise the
 * incremental parser).
 */
function installSpies(opts: {
  jsonlBody?: BodySetting;
  vocabBody?: BodySetting;
  contextBody?: BodySetting;
  jsonlChunks?: number;
} = {}) {
  const captured: CapturedDownload = {
    blob: null,
    blobBytes: null,
    filename: null,
    revoked: false,
  };

  // jsdom's Blob.arrayBuffer() is missing, so wrap the Blob constructor
  // to snapshot the input bytes when the export wraps its workbook
  // ArrayBuffer in a Blob. The first BlobPart for an export call is
  // always the workbook ArrayBuffer.
  const RealBlob = globalThis.Blob;
  class CapturingBlob extends RealBlob {
    constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
      super(parts, options);
      const first = parts?.[0];
      if (first instanceof ArrayBuffer) captured.blobBytes = first;
      else if (ArrayBuffer.isView(first)) {
        const view = first as ArrayBufferView;
        const buf = view.buffer as ArrayBuffer;
        captured.blobBytes = buf.slice(
          view.byteOffset,
          view.byteOffset + view.byteLength,
        );
      }
    }
  }
  globalThis.Blob = CapturingBlob as unknown as typeof Blob;

  // jsdom doesn't implement these, so stub before spying.
  let objectUrlCounter = 0;
  URL.createObjectURL = vi.fn((blob: Blob) => {
    captured.blob = blob;
    return `blob:mock-${++objectUrlCounter}`;
  });
  URL.revokeObjectURL = vi.fn(() => {
    captured.revoked = true;
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    captured.filename = this.getAttribute("download");
  });

  const jsonlSetting = opts.jsonlBody ?? JSONL_BODY;
  const vocabSetting = opts.vocabBody ?? VOCAB_JSONLD_BODY;
  const contextSetting = opts.contextBody ?? CONTEXT_JSONLD_BODY;
  const jsonlChunks = opts.jsonlChunks ?? 1;

  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
    async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("context")) return respond(contextSetting);
      if (url.includes("vocab")) return respond(vocabSetting);
      if (typeof jsonlSetting !== "string") return respond(jsonlSetting);
      const bytes = new TextEncoder().encode(jsonlSetting);
      const chunkSize = Math.max(1, Math.ceil(bytes.length / jsonlChunks));
      const slices: Uint8Array[] = [];
      for (let i = 0; i < bytes.length; i += chunkSize) {
        slices.push(bytes.slice(i, i + chunkSize));
      }
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          const next = slices.shift();
          if (next) controller.enqueue(next);
          else controller.close();
        },
      });
      return new Response(stream, { status: 200 });
    },
  );

  return { captured, fetchSpy };
}

function resetCaches(): void {
  _resetVocabularyCache();
  _resetContextCache();
}

describe("exportReferencesToExcel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetCaches();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("triggers a download with the given filename and xlsx MIME type", async () => {
    const { captured } = installSpies();
    await exportReferencesToExcel(JSONL_URL, VOCAB_URL, CONTEXT_URL, "out.xlsx");

    expect(captured.filename).toBe("out.xlsx");
    expect(captured.blob).not.toBeNull();
    expect(captured.blob!.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(captured.blob!.size).toBeGreaterThan(0);
    // Revoke is deferred via setTimeout so the browser can read the blob
    // before the URL is invalidated; wait one task for the timer to fire.
    await new Promise((r) => setTimeout(r, 0));
    expect(captured.revoked).toBe(true);
  });

  test("normalises any vocabulary URL form to its .jsonld variant", async () => {
    for (const input of [
      VOCAB_URL,
      VOCAB_JSONLD_URL,
      "https://vocab.example.org/v1.ttl",
      "https://vocab.example.org/v1/",
    ]) {
      const { fetchSpy } = installSpies();
      await exportReferencesToExcel(JSONL_URL, input, CONTEXT_URL, "out.xlsx");
      const vocabCalls = fetchSpy.mock.calls
        .map((c) => (typeof c[0] === "string" ? c[0] : c[0]!.toString()))
        .filter((u) => u.includes("vocab") && !u.includes("context"));
      expect(vocabCalls, `input ${input}`).toContain(VOCAB_JSONLD_URL);
      vi.restoreAllMocks();
      resetCaches();
    }
  });

  test("fetches the vocabulary, context, and JSONL", async () => {
    const { fetchSpy } = installSpies();
    await exportReferencesToExcel(JSONL_URL, VOCAB_URL, CONTEXT_URL, "out.xlsx");
    const urls = fetchSpy.mock.calls.map((c) =>
      typeof c[0] === "string" ? c[0] : c[0]!.toString(),
    );
    expect(urls).toContain(VOCAB_JSONLD_URL);
    expect(urls).toContain(CONTEXT_URL);
    expect(urls).toContain(JSONL_URL);
  });

  test("propagates a descriptive error on vocabulary fetch failure", async () => {
    installSpies({
      vocabBody: { status: 404, statusText: "Not Found", body: "nope" },
    });
    await expect(
      exportReferencesToExcel(JSONL_URL, VOCAB_URL, CONTEXT_URL, "out.xlsx"),
    ).rejects.toThrow(/Failed to fetch vocabulary: 404/);
  });

  test("propagates a descriptive error on context fetch failure", async () => {
    installSpies({
      contextBody: { status: 404, statusText: "Not Found", body: "nope" },
    });
    await expect(
      exportReferencesToExcel(JSONL_URL, VOCAB_URL, CONTEXT_URL, "out.xlsx"),
    ).rejects.toThrow(/Failed to fetch context: 404/);
  });

  test("propagates errors from the JSONL stream", async () => {
    installSpies({
      jsonlBody: { status: 500, statusText: "Server Error", body: "" },
    });
    await expect(
      exportReferencesToExcel(JSONL_URL, VOCAB_URL, CONTEXT_URL, "out.xlsx"),
    ).rejects.toThrow(/HTTP 500/);
  });

  test("succeeds when JSONL bytes are split across multiple stream chunks", async () => {
    const { captured } = installSpies({ jsonlChunks: 8 });
    await exportReferencesToExcel(
      JSONL_URL,
      VOCAB_URL,
      CONTEXT_URL,
      "chunked.xlsx",
    );
    expect(captured.filename).toBe("chunked.xlsx");
    expect(captured.blob!.size).toBeGreaterThan(0);
  });

  test("skips vocab/context fetches when URLs are undefined", async () => {
    // Without the ternary guard, getCachedVocabulary(undefined) ends up at
    // new URL(undefined) and throws. Verify the empty-map branch runs.
    const { captured, fetchSpy } = installSpies();
    await exportReferencesToExcel(JSONL_URL, undefined, undefined, "no-vocab.xlsx");
    const urls = fetchSpy.mock.calls.map((c) =>
      typeof c[0] === "string" ? c[0] : c[0]!.toString(),
    );
    expect(urls).toContain(JSONL_URL);
    expect(urls.some((u) => u.includes("vocab"))).toBe(false);
    expect(urls.some((u) => u.includes("context"))).toBe(false);
    expect(captured.filename).toBe("no-vocab.xlsx");
    expect(captured.blob!.size).toBeGreaterThan(0);
  });
});

type CellValue = string | number | boolean | null;
interface SnapshotSheet {
  name: string;
  rows: CellValue[][];
}
interface Snapshot {
  sheets: SnapshotSheet[];
}

/**
 * Re-shape a worksheet to the same `name + rows` form the snapshot files
 * use: dense 2D array of cell values, empty/missing cells coerced to
 * null so SheetJS's preserved blanks compare equal to the snapshot.
 */
function workbookToSnapshot(wb: XLSX.WorkBook): Snapshot {
  return {
    sheets: wb.SheetNames.map((name) => {
      const ws = wb.Sheets[name]!;
      const refRange = ws["!ref"];
      const rows: CellValue[][] = [];
      if (refRange) {
        const range = XLSX.utils.decode_range(refRange);
        for (let r = range.s.r; r <= range.e.r; r++) {
          const row: CellValue[] = [];
          for (let c = range.s.c; c <= range.e.c; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            const cell = ws[addr] as XLSX.CellObject | undefined;
            const v = cell ? (cell.v ?? null) : null;
            row.push(v === "" ? null : (v as CellValue));
          }
          rows.push(row);
        }
      }
      return { name, rows };
    }),
  };
}

describe.each([
  "music_and_literacy",
  "title_contains_phonics",
] as const)("end-to-end cell parity vs snapshot: %s", (stem) => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetCaches();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("exported workbook matches the committed snapshot cell-for-cell", async () => {
    const [jsonlBody, vocabBody, contextBody, snapshotText] = await Promise.all([
      readFile(resolve(FIXTURES, `${stem}.jsonl`), "utf-8"),
      readFile(resolve(FIXTURES, "vocabulary.jsonld"), "utf-8"),
      readFile(resolve(FIXTURES, "context.jsonld"), "utf-8"),
      readFile(resolve(FIXTURES, `${stem}_expected.json`), "utf-8"),
    ]);
    const expected = JSON.parse(snapshotText) as Snapshot;

    // Multi-chunk delivery exercises the streaming parser as part of the E2E.
    const { captured } = installSpies({
      jsonlBody,
      vocabBody,
      contextBody,
      jsonlChunks: 4,
    });

    await exportReferencesToExcel(
      JSONL_URL,
      VOCAB_URL,
      CONTEXT_URL,
      `${stem}.xlsx`,
    );

    expect(captured.blobBytes).not.toBeNull();
    const wb = XLSX.read(new Uint8Array(captured.blobBytes!), {
      type: "array",
      cellDates: false,
    });
    const actual = workbookToSnapshot(wb);

    expect(actual.sheets.map((s) => s.name)).toEqual(
      expected.sheets.map((s) => s.name),
    );
    for (let i = 0; i < expected.sheets.length; i++) {
      expect(actual.sheets[i]!.rows, `${expected.sheets[i]!.name}`).toEqual(
        expected.sheets[i]!.rows,
      );
    }
  });
});
