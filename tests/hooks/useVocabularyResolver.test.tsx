import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/preact";
import { useVocabulary } from "@/hooks/useVocabularyResolver";

const SAMPLE_VOCABULARY_JSONLD = JSON.stringify({
  "@context": {
    skos: "http://www.w3.org/2004/02/skos/core#",
    esea: "https://vocab.esea.education/",
  },
  "@graph": [
    {
      "@id": "https://vocab.esea.education/DocumentTypeScheme/C00008",
      "@type": ["skos:Concept", "esea:DocumentTypeConcept"],
      "skos:prefLabel": "Journal Article",
    },
  ],
});

function TestComponent({ vocabularyUrl }: { vocabularyUrl: string | undefined }) {
  const { labels, loading, error } = useVocabulary(vocabularyUrl);
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="error">{error?.message ?? "none"}</span>
      <span data-testid="label">
        {labels?.get("https://vocab.esea.education/DocumentTypeScheme/C00008") ??
          "unresolved"}
      </span>
    </div>
  );
}

describe("useVocabulary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches vocabulary and provides label map", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(SAMPLE_VOCABULARY_JSONLD, { status: 200 }),
    );

    const { getByTestId } = render(
      <TestComponent vocabularyUrl="https://vocab.example.org/v1" />,
    );

    await waitFor(() => {
      expect(getByTestId("label").textContent).toBe("Journal Article");
    });

    expect(getByTestId("loading").textContent).toBe("false");
    expect(getByTestId("error").textContent).toBe("none");
  });

  it("skips fetch when URL is undefined", () => {
    vi.spyOn(globalThis, "fetch");

    const { getByTestId } = render(<TestComponent vocabularyUrl={undefined} />);

    expect(getByTestId("loading").textContent).toBe("false");
    expect(getByTestId("label").textContent).toBe("unresolved");
    expect(fetch).not.toHaveBeenCalled();
  });
});
