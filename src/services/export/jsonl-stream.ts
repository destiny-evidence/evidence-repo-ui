/**
 * Streaming JSONL readers. Used to avoid buffering large reference exports
 * in memory when the workbook is generated client-side from a signed
 * download URL: each newline-terminated record is yielded as soon as its
 * bytes arrive, so the row builders can begin work before the network
 * response has finished.
 *
 * `fetch` and `ReadableStream` are available in modern browsers and in
 * Node 18+, so the same code path runs in both environments.
 */

import type { Reference } from "@/types/models";

/**
 * Yield parsed JSON objects from a `ReadableStream<Uint8Array>` one per
 * newline. Blank lines are skipped. Handles UTF-8 multi-byte boundaries
 * across chunks via `TextDecoder({ stream: true })` and emits a trailing
 * record that lacks a final newline.
 */
export async function* streamJsonlFromBody(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<Reference> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      const trimmed = line.replace(/\r$/, "").trim();
      if (trimmed) yield JSON.parse(trimmed) as Reference;
    }
  }
  buffer += decoder.decode();
  const trailing = buffer.trim();
  if (trailing) yield JSON.parse(trailing) as Reference;
}

/**
 * Fetch a URL and yield its JSONL contents as parsed objects without
 * buffering the whole response. Throws a descriptive error on non-2xx
 * responses.
 */
export async function* streamJsonlFromUrl(
  url: string | URL,
  init?: RequestInit,
): AsyncGenerator<Reference> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status} ${response.statusText}`);
  }
  if (!response.body) {
    throw new Error(`Response for ${url} has no body stream`);
  }
  yield* streamJsonlFromBody(response.body);
}
