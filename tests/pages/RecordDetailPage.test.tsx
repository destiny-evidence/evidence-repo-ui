import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/preact";
import { RecordDetailPage } from "@/pages/RecordDetailPage";
import { makeReference } from "../fixtures";

vi.mock("@/hooks/useReference");
vi.mock("@/hooks/useVocabulary");
vi.mock("@/hooks/useContextPrefixes");

import { useReference } from "@/hooks/useReference";
import { useVocabulary } from "@/hooks/useVocabulary";
import { useContextPrefixes } from "@/hooks/useContextPrefixes";

const mockUseReference = vi.mocked(useReference);
const mockUseVocabulary = vi.mocked(useVocabulary);
const mockUseContextPrefixes = vi.mocked(useContextPrefixes);

const PREFIXES = new Map([
  ["esea", "https://vocab.esea.education/"],
  ["evrepo", "https://vocab.evidence-repository.org/"],
]);

const mockLabels = new Map([
  ["https://vocab.esea.education/C00008", "Journal Article"],
]);

beforeEach(() => {
  vi.clearAllMocks();
  mockUseVocabulary.mockReturnValue({
    labels: null,
    broader: null,
    definitions: null,
    loading: false,
    error: null,
  });
  mockUseContextPrefixes.mockReturnValue({
    context: null,
    loading: false,
    error: null,
  });
});

describe("RecordDetailPage", () => {
  test("shows not found for invalid community", () => {
    mockUseReference.mockReturnValue({
      reference: null,
      loading: false,
      error: null,
    });
    render(<RecordDetailPage community="banana" id="abc" />);
    expect(screen.getByText("Page not found")).toBeDefined();
  });

  test("shows loading state", () => {
    mockUseReference.mockReturnValue({
      reference: null,
      loading: true,
      error: null,
    });
    render(<RecordDetailPage community="esea" id="abc" />);
    expect(screen.getByText("Loading…")).toBeDefined();
  });

  test("shows error state", () => {
    mockUseReference.mockReturnValue({
      reference: null,
      loading: false,
      error: new Error("Network failure"),
    });
    render(<RecordDetailPage community="esea" id="abc" />);
    expect(
      screen.getByText("We couldn't load this reference."),
    ).toBeDefined();
  });

  test("renders investigation card with full data", () => {
    mockUseReference.mockReturnValue({
      reference: makeReference({
        doi: "10.1234/test",
        bibliographic: {
          title: "Test Investigation",
          authors: ["Smith, J."],
          year: 2024,
          venue: "Test Journal",
        },
        investigation: {
          documentType: {
            "@type": "DocumentTypeCodingAnnotation",
            codedValue: { "@id": "esea:C00008" },
            status: "evrepo:coded",
          },
          hasFinding: [],
        },
      }),
      loading: false,
      error: null,
    });
    mockUseVocabulary.mockReturnValue({
      labels: mockLabels,
      broader: new Map(),
      definitions: new Map(),
      loading: false,
      error: null,
    });
    mockUseContextPrefixes.mockReturnValue({
      context: { prefixes: PREFIXES },
      loading: false,
      error: null,
    });

    render(<RecordDetailPage community="esea" id="abc-123" />);

    expect(screen.getByText("Test Investigation")).toBeDefined();
    expect(screen.getByText("Smith, J. (2024)")).toBeDefined();
    expect(screen.getByText("Test Journal")).toBeDefined();
    expect(screen.getByText("10.1234/test")).toBeDefined();
    expect(screen.getByText("Journal Article")).toBeDefined();
  });

  test("renders findings with raw URIs and a banner when vocab fetch fails", () => {
    mockUseReference.mockReturnValue({
      reference: makeReference({
        bibliographic: { title: "Vocab failure record" },
        investigation: {
          hasFinding: [
            {
              "@type": "Finding",
              evaluates: { "@id": "_:int", "@type": "Intervention", name: "X" },
              comparedTo: { "@id": "_:ctrl", "@type": "ControlCondition" },
              hasContext: { "@id": "_:ctx", "@type": "Context" },
              hasOutcome: { "@type": "Outcome", name: "An outcome" },
            },
          ],
        },
      }),
      loading: false,
      error: null,
    });
    mockUseVocabulary.mockReturnValue({
      labels: null,
      broader: null,
      definitions: null,
      loading: false,
      error: new Error("Network failure"),
    });
    mockUseContextPrefixes.mockReturnValue({
      context: null,
      loading: false,
      error: new Error("Network failure"),
    });

    const { container } = render(
      <RecordDetailPage community="esea" id="abc-123" />,
    );

    // Banner above the findings section explains the degraded state.
    const banner = container.querySelector(".record-detail-page__vocab-banner");
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toMatch(/Vocabulary unavailable/);
    // Findings still render — the section header proves FindingsSection mounted.
    expect(screen.getByText("Finding 1")).toBeDefined();
    expect(screen.getByText("An outcome")).toBeDefined();
  });

  test("renders card without linked data", () => {
    mockUseReference.mockReturnValue({
      reference: makeReference({
        bibliographic: {
          title: "Bibliographic Only",
          authors: ["Jones, K."],
          year: 2023,
        },
      }),
      loading: false,
      error: null,
    });

    render(<RecordDetailPage community="esea" id="abc-123" />);

    expect(screen.getByText("Bibliographic Only")).toBeDefined();
    expect(screen.getByText("Jones, K. (2023)")).toBeDefined();
    expect(screen.queryByText("Doc Type")).toBeNull();
  });
});
