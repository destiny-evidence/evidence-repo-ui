import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/preact";
import { RecordDetailPage } from "@/pages/RecordDetailPage";
import type { Reference } from "@/types/models";

vi.mock("@/hooks/useReference");
vi.mock("@/hooks/useVocabulary");
vi.mock("@/hooks/useContextPrefixes");

import { useReference } from "@/hooks/useReference";
import { useVocabulary } from "@/hooks/useVocabulary";
import { useContextPrefixes } from "@/hooks/useContextPrefixes";

const mockUseReference = vi.mocked(useReference);
const mockUseVocabulary = vi.mocked(useVocabulary);
const mockUseContextPrefixes = vi.mocked(useContextPrefixes);

function makeReference(overrides: Partial<Reference> = {}): Reference {
  return {
    id: "abc-123",
    visibility: "public",
    identifiers: [
      { identifier: "10.1234/test", identifier_type: "doi" },
    ],
    enhancements: [
      {
        id: "e1",
        reference_id: "abc-123",
        source: "openalex",
        visibility: "public",
        robot_version: null,
        derived_from: null,
        created_at: null,
        content: {
          enhancement_type: "bibliographic",
          authorship: [
            { display_name: "Smith, J.", orcid: null, position: "first" },
          ],
          cited_by_count: null,
          created_date: null,
          updated_date: null,
          publication_date: null,
          publication_year: 2024,
          publisher: null,
          title: "Test Investigation",
          pagination: null,
          publication_venue: {
            display_name: "Test Journal",
            venue_type: "journal",
          },
        },
      },
      {
        id: "e2",
        reference_id: "abc-123",
        source: "robot",
        visibility: "public",
        robot_version: "0.1.0",
        derived_from: null,
        created_at: null,
        content: {
          enhancement_type: "linked_data",
          vocabulary_uri: "https://vocab.example/v1",
          data: {
            "@context": "https://vocab.example/context.jsonld",
            "@type": "LinkedDataEnhancement",
            hasInvestigation: {
              "@type": "Investigation",
              documentType: {
                "@type": "DocumentTypeCodingAnnotation",
                codedValue: { "@id": "esea:C00008" },
                status: "evrepo:coded",
              },
              hasFinding: [],
            },
          },
        },
      },
    ],
    ...overrides,
  };
}

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
      screen.getByText("Failed to load reference: Network failure"),
    ).toBeDefined();
  });

  test("renders investigation card with full data", () => {
    const ref = makeReference();
    mockUseReference.mockReturnValue({
      reference: ref,
      loading: false,
      error: null,
    });
    mockUseVocabulary.mockReturnValue({
      labels: mockLabels,
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

  test("renders card without linked data", () => {
    const ref = makeReference({
      enhancements: [
        {
          id: "e1",
          reference_id: "abc-123",
          source: "openalex",
          visibility: "public",
          robot_version: null,
          derived_from: null,
        created_at: null,
          content: {
            enhancement_type: "bibliographic",
            authorship: [
              { display_name: "Jones, K.", orcid: null, position: "first" },
            ],
            cited_by_count: null,
            created_date: null,
            updated_date: null,
            publication_date: null,
            publication_year: 2023,
            publisher: null,
            title: "Bibliographic Only",
            pagination: null,
            publication_venue: null,
          },
        },
      ],
    });
    mockUseReference.mockReturnValue({
      reference: ref,
      loading: false,
      error: null,
    });

    render(<RecordDetailPage community="esea" id="abc-123" />);

    expect(screen.getByText("Bibliographic Only")).toBeDefined();
    expect(screen.getByText("Jones, K. (2023)")).toBeDefined();
    expect(screen.queryByText("Doc Type")).toBeNull();
  });
});
