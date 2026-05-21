import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, test, expect } from "vitest";
import { findCommunity } from "@/services/communities";

const CONTEXT_FIXTURE_PATH = resolve(
  __dirname,
  "./export/fixtures/context.jsonld",
);

describe("Community.vocabBase drift guard", () => {
  // Compact-URI expansion at the search/export boundary relies on
  // Community.vocabBase matching the JSON-LD @context prefix served by the
  // backend. If they drift, expanded URIs silently target the wrong vocab.
  test("esea Community.vocabBase agrees with the JSON-LD context fixture's `esea` prefix", () => {
    const base = findCommunity("esea")!.vocabBase;
    const ctx = JSON.parse(readFileSync(CONTEXT_FIXTURE_PATH, "utf-8")) as {
      "@context": Record<string, string>;
    };
    expect(ctx["@context"].esea).toBe(base);
  });
});
