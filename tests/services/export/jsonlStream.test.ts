import { describe, test, expect, vi, afterEach } from "vitest";

import {
  streamJsonlFromBody,
  streamJsonlFromUrl,
} from "@/services/export/jsonlStream.ts";

/**
 * Build a `ReadableStream<Uint8Array>` that emits the given byte chunks
 * in order, one per `pull`. Lets tests exercise the streaming decoder
 * against deliberately ugly chunk boundaries (mid-line, mid-UTF-8).
 */
function streamFromChunks(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(chunks[i]!);
        i++;
      } else {
        controller.close();
      }
    },
  });
}

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of iter) out.push(v);
  return out;
}

describe("streamJsonlFromBody", () => {
  test("yields one parsed record per newline-terminated line", async () => {
    const body = streamFromChunks([
      new TextEncoder().encode('{"id":"a"}\n{"id":"b"}\n{"id":"c"}\n'),
    ]);
    const out = await collect(streamJsonlFromBody(body));
    expect(out).toEqual([{ id: "a" }, { id: "b" }, { id: "c" }]);
  });

  test("emits a trailing record that has no final newline", async () => {
    const body = streamFromChunks([
      new TextEncoder().encode('{"id":"a"}\n{"id":"b"}'),
    ]);
    const out = await collect(streamJsonlFromBody(body));
    expect(out).toEqual([{ id: "a" }, { id: "b" }]);
  });

  test("skips blank lines", async () => {
    const body = streamFromChunks([
      new TextEncoder().encode('{"id":"a"}\n\n\n{"id":"b"}\n'),
    ]);
    const out = await collect(streamJsonlFromBody(body));
    expect(out).toEqual([{ id: "a" }, { id: "b" }]);
  });

  test("tolerates CRLF line endings", async () => {
    const body = streamFromChunks([
      new TextEncoder().encode('{"id":"a"}\r\n{"id":"b"}\r\n'),
    ]);
    const out = await collect(streamJsonlFromBody(body));
    expect(out).toEqual([{ id: "a" }, { id: "b" }]);
  });

  test("rejoins JSON records split across chunks", async () => {
    const body = streamFromChunks([
      new TextEncoder().encode('{"id":"first record"}\n{"id":"sec'),
      new TextEncoder().encode('ond record"}\n{"id":"third"}\n'),
    ]);
    const out = await collect(streamJsonlFromBody(body));
    expect(out).toEqual([
      { id: "first record" },
      { id: "second record" },
      { id: "third" },
    ]);
  });

  test("decodes UTF-8 characters split across chunk boundaries", async () => {
    // "café" → 'c' 'a' 'f' 0xC3 0xA9. Split between the two é bytes.
    const full = new TextEncoder().encode('{"name":"café"}\n');
    const splitAt = full.length - 3; // mid-é
    const body = streamFromChunks([full.slice(0, splitAt), full.slice(splitAt)]);
    const out = await collect(streamJsonlFromBody(body));
    expect(out).toEqual([{ name: "café" }]);
  });
});

describe("streamJsonlFromUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("streams from the response body when fetch succeeds", async () => {
    const body = streamFromChunks([
      new TextEncoder().encode('{"id":"a"}\n{"id":"b"}\n'),
    ]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(body, { status: 200 }),
    );
    const out = await collect(streamJsonlFromUrl("https://example.com/refs"));
    expect(out).toEqual([{ id: "a" }, { id: "b" }]);
  });

  test("throws a descriptive error on non-2xx responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 404, statusText: "Not Found" }),
    );
    await expect(
      collect(streamJsonlFromUrl("https://example.com/refs")),
    ).rejects.toThrow(/HTTP 404 Not Found/);
  });

  test("throws when the response has no body stream", async () => {
    // Response with `null` body — simulate by overriding the body getter.
    const resp = new Response("ignored", { status: 200 });
    Object.defineProperty(resp, "body", { value: null });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(resp);
    await expect(
      collect(streamJsonlFromUrl("https://example.com/refs")),
    ).rejects.toThrow(/no body stream/);
  });
});
