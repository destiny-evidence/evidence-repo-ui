import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/preact";
import { useContextPrefixes } from "@/hooks/useContextPrefixes";

const MOCK_CONTEXT_DOC = JSON.stringify({
  "@context": {
    evrepo: "https://vocab.evidence-repository.org/",
    esea: "https://vocab.esea.education/",
  },
});

function TestComponent({ contextUrl }: { contextUrl: string | undefined }) {
  const { context, loading, error } = useContextPrefixes(contextUrl);
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="error">{error?.message ?? "none"}</span>
      <span data-testid="prefix">
        {context?.prefixes.get("esea") ?? "unresolved"}
      </span>
    </div>
  );
}

describe("useContextPrefixes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches context and provides prefix map", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(MOCK_CONTEXT_DOC, { status: 200 }),
    );

    const { getByTestId } = render(
      <TestComponent contextUrl="https://vocab.esea.education/context/v1.jsonld" />,
    );

    await waitFor(() => {
      expect(getByTestId("prefix").textContent).toBe(
        "https://vocab.esea.education/",
      );
    });

    expect(getByTestId("loading").textContent).toBe("false");
    expect(getByTestId("error").textContent).toBe("none");
  });

  it("skips fetch when URL is undefined", () => {
    vi.spyOn(globalThis, "fetch");

    const { getByTestId } = render(<TestComponent contextUrl={undefined} />);

    expect(getByTestId("loading").textContent).toBe("false");
    expect(getByTestId("prefix").textContent).toBe("unresolved");
    expect(fetch).not.toHaveBeenCalled();
  });
});
