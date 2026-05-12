import { describe, test, expect, vi, afterEach, beforeEach } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import * as XLSX from "xlsx";

import { exportReferencesToExcel } from "@/services/export/export.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, "fixtures");

const TTL_URL = "https://vocab.example.org/v1.ttl";
const JSONL_URL = "https://signed.example.com/refs.jsonl?sig=abc";

const TTL_BODY = `
@prefix esea: <https://vocab.esea.education/> .

<https://vocab.esea.education/DocumentTypeScheme/C00008>
  skos:prefLabel "Journal Article" .
`;

const JSONL_BODY = JSON.stringify({
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

/**
 * Install fetch + download spies for an export test. Routes URLs that
 * look like vocabulary requests (host contains "vocab") to `ttlBody`,
 * everything else to `jsonlBody`. Returns the capture object plus the
 * fetch spy so callers can inspect call args.
 */
function installSpies(opts: {
  jsonlBody?: string | { status: number; statusText?: string; body?: string };
  ttlBody?: string | { status: number; statusText?: string; body?: string };
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
  const ttlSetting = opts.ttlBody ?? TTL_BODY;
  const jsonlChunks = opts.jsonlChunks ?? 1;

  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
    async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("vocab")) {
        if (typeof ttlSetting === "string") return new Response(ttlSetting);
        return new Response(ttlSetting.body ?? "", {
          status: ttlSetting.status,
          statusText: ttlSetting.statusText,
        });
      }
      if (typeof jsonlSetting !== "string") {
        return new Response(jsonlSetting.body ?? "", {
          status: jsonlSetting.status,
          statusText: jsonlSetting.statusText,
        });
      }
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

describe("exportReferencesToExcel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("triggers a download with the given filename and xlsx MIME type", async () => {
    const { captured } = installSpies();
    await exportReferencesToExcel(JSONL_URL, "https://vocab.example.org/v1", "out.xlsx");

    expect(captured.filename).toBe("out.xlsx");
    expect(captured.blob).not.toBeNull();
    expect(captured.blob!.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(captured.blob!.size).toBeGreaterThan(0);
    expect(captured.revoked).toBe(true);
  });

  test("normalises vocabulary URLs to their .ttl form", async () => {
    for (const input of [
      "https://vocab.example.org/v1",
      "https://vocab.example.org/v1.jsonld",
      "https://vocab.example.org/v1.ttl",
      "https://vocab.example.org/v1/",
    ]) {
      const { fetchSpy } = installSpies();
      await exportReferencesToExcel(JSONL_URL, input, "out.xlsx");
      const ttlCalls = fetchSpy.mock.calls
        .map((c) => (typeof c[0] === "string" ? c[0] : c[0]!.toString()))
        .filter((u) => u.includes("vocab"));
      expect(ttlCalls, `input ${input}`).toContain("https://vocab.example.org/v1.ttl");
      vi.restoreAllMocks();
    }
  });

  test("fetches both the TTL and the JSONL", async () => {
    const { fetchSpy } = installSpies();
    await exportReferencesToExcel(JSONL_URL, "https://vocab.example.org/v1", "out.xlsx");
    const urls = fetchSpy.mock.calls.map((c) =>
      typeof c[0] === "string" ? c[0] : c[0]!.toString(),
    );
    expect(urls).toContain(TTL_URL);
    expect(urls).toContain(JSONL_URL);
  });

  test("propagates a descriptive error on TTL fetch failure", async () => {
    installSpies({
      ttlBody: { status: 404, statusText: "Not Found", body: "nope" },
    });
    await expect(
      exportReferencesToExcel(JSONL_URL, "https://vocab.example.org/v1", "out.xlsx"),
    ).rejects.toThrow(/Failed to fetch vocabulary TTL: HTTP 404/);
  });

  test("propagates errors from the JSONL stream", async () => {
    installSpies({
      jsonlBody: { status: 500, statusText: "Server Error", body: "" },
    });
    await expect(
      exportReferencesToExcel(JSONL_URL, "https://vocab.example.org/v1", "out.xlsx"),
    ).rejects.toThrow(/HTTP 500/);
  });

  test("succeeds when JSONL bytes are split across multiple stream chunks", async () => {
    const { captured } = installSpies({ jsonlChunks: 8 });
    await exportReferencesToExcel(JSONL_URL, "https://vocab.example.org/v1", "chunked.xlsx");
    expect(captured.filename).toBe("chunked.xlsx");
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
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("exported workbook matches the committed snapshot cell-for-cell", async () => {
    const [jsonlBody, ttlBody, snapshotText] = await Promise.all([
      readFile(resolve(FIXTURES, `${stem}.jsonl`), "utf-8"),
      readFile(resolve(FIXTURES, "vocabulary.ttl"), "utf-8"),
      readFile(resolve(FIXTURES, `${stem}_expected.json`), "utf-8"),
    ]);
    const expected = JSON.parse(snapshotText) as Snapshot;

    // Multi-chunk delivery exercises the streaming parser as part of the E2E.
    const { captured } = installSpies({
      jsonlBody,
      ttlBody,
      jsonlChunks: 4,
    });

    await exportReferencesToExcel(
      "https://signed.example.com/refs.jsonl?sig=abc",
      "https://vocab.example.org/v1",
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
