import { describe, test, expect, vi, beforeEach } from "vitest";
import {
  fetchContext,
  getCachedContext,
  expandCompactUri,
  _resetContextCache,
} from "@/services/vocabulary/contextService";

const MOCK_CONTEXT_DOC = {
  "@context": {
    "@vocab": "https://vocab.evidence-repository.org/",
    evrepo: "https://vocab.evidence-repository.org/",
    esea: "https://vocab.esea.education/",
    skos: "http://www.w3.org/2004/02/skos/core#",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    Investigation: "evrepo:Investigation",
    hasFinding: {
      "@id": "evrepo:hasFinding",
      "@type": "@id",
      "@container": "@set",
    },
    codedValue: { "@id": "evrepo:codedValue" },
  },
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("fetchContext", () => {
  test("fetches and extracts prefix mappings", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(MOCK_CONTEXT_DOC), { status: 200 }),
    );

    const result = await fetchContext("https://vocab.esea.education/context/v1.jsonld");

    expect(result.prefixes.get("esea")).toBe("https://vocab.esea.education/");
    expect(result.prefixes.get("evrepo")).toBe(
      "https://vocab.evidence-repository.org/",
    );
    expect(result.prefixes.get("xsd")).toBe(
      "http://www.w3.org/2001/XMLSchema#",
    );
    // Object-valued entries are not prefixes
    expect(result.prefixes.has("hasFinding")).toBe(false);
    expect(result.prefixes.has("codedValue")).toBe(false);
    // @-prefixed keys are not prefixes
    expect(result.prefixes.has("@vocab")).toBe(false);
  });

  test("throws on HTTP error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Not found", { status: 404 }),
    );

    await expect(fetchContext("https://missing.example/ctx")).rejects.toThrow(
      "Failed to fetch context: 404",
    );
  });
});

describe("getCachedContext", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetContextCache();
  });

  test("deduplicates concurrent requests for the same URL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(MOCK_CONTEXT_DOC), { status: 200 }),
    );

    const [a, b] = await Promise.all([
      getCachedContext("https://vocab.esea.education/context/v1.jsonld"),
      getCachedContext("https://vocab.esea.education/context/v1.jsonld"),
    ]);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });
});

describe("expandCompactUri", () => {
  const prefixes = new Map([
    ["esea", "https://vocab.esea.education/"],
    ["evrepo", "https://vocab.evidence-repository.org/"],
    ["xsd", "http://www.w3.org/2001/XMLSchema#"],
  ]);

  test("expands known prefix", () => {
    expect(expandCompactUri("esea:DocumentTypeScheme/C00008", prefixes)).toBe(
      "https://vocab.esea.education/DocumentTypeScheme/C00008",
    );
  });

  test("expands evrepo prefix", () => {
    expect(expandCompactUri("evrepo:coded", prefixes)).toBe(
      "https://vocab.evidence-repository.org/coded",
    );
  });

  test("returns input unchanged for unknown prefix", () => {
    expect(expandCompactUri("unknown:foo", prefixes)).toBe("unknown:foo");
  });

  test("returns input unchanged for no colon", () => {
    expect(expandCompactUri("nocolon", prefixes)).toBe("nocolon");
  });
});
