import { beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Serve the bundled DejaVu TTFs from disk for the suite, so the client PDF
 * builders' font embedding works under jsdom (which can't fetch the `?url`
 * assets) — and the real faces get exercised. Call inside a `describe`.
 */
export function useDiskFonts(): void {
  const fontDir = resolve(process.cwd(), "src/services/export/fonts");
  const realFetch = global.fetch;

  beforeAll(() => {
    global.fetch = (async (input: RequestInfo | URL) => {
      const name = String(input).split("?")[0].split("/").pop()!;
      const buf = readFileSync(resolve(fontDir, name));
      return {
        arrayBuffer: async () =>
          buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      } as Response;
    }) as typeof fetch;
  });

  afterAll(() => {
    global.fetch = realFetch;
  });
}
