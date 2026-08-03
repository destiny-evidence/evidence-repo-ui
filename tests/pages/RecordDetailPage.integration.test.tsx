import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/preact";
import { RecordDetailPage } from "@/pages/RecordDetailPage";
import { CommunityProvider } from "@/community/CommunityContext";
import { makeReference, makeVocabResult } from "../fixtures";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";

function renderRecordDetail(id: string) {
  return render(
    <CommunityProvider>
      <RecordDetailPage id={id} />
    </CommunityProvider>,
  );
}

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

const HPV_COUNTRY = "https://vocab.aliveevidence.org/hpv/Country";
// A non-geographic (topical) scheme. Deliberately a placeholder, not a real HPV
// scheme, so it can't read as standing in for a specific concept or map axis.
const NON_GEO_SCHEME = "https://vocab.aliveevidence.org/hpv/NonGeoScheme";

beforeEach(() => {
  vi.clearAllMocks();
  history.replaceState(null, "", "/esea");
  mockUseVocabulary.mockReturnValue(makeVocabResult());
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
    history.replaceState(null, "", "/banana");
    renderRecordDetail("abc");
    expect(screen.getByText("Page not found")).toBeDefined();
  });

  test("shows loading state", () => {
    mockUseReference.mockReturnValue({
      reference: null,
      loading: true,
      error: null,
    });
    renderRecordDetail("abc");
    expect(screen.getByText("Loading…")).toBeDefined();
  });

  test("shows error state", () => {
    mockUseReference.mockReturnValue({
      reference: null,
      loading: false,
      error: new Error("Network failure"),
    });
    renderRecordDetail("abc");
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
    mockUseVocabulary.mockReturnValue(makeVocabResult({ labels: mockLabels }));
    mockUseContextPrefixes.mockReturnValue({
      context: { prefixes: PREFIXES },
      loading: false,
      error: null,
    });

    renderRecordDetail("abc-123");

    expect(screen.getByText("Test Investigation")).toBeDefined();
    expect(screen.getByText("Smith, J. (2024)")).toBeDefined();
    expect(screen.getByText("Test Journal")).toBeDefined();
    expect(screen.getByText("10.1234/test")).toBeDefined();
    expect(screen.getByText("Journal Article")).toBeDefined();
  });

  test("renders AbstractSection when an abstract enhancement is present", () => {
    mockUseReference.mockReturnValue({
      reference: makeReference({
        bibliographic: { title: "Ref with abstract" },
        abstract: "Abstract This is the rendered abstract body with &gt; sign.",
      }),
      loading: false,
      error: null,
    });
    renderRecordDetail("abc");
    expect(
      screen.getByRole("heading", { name: "Abstract" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This is the rendered abstract body with > sign."),
    ).toBeInTheDocument();
  });

  test("does not render an Abstract heading when no abstract enhancement is present", () => {
    mockUseReference.mockReturnValue({
      reference: makeReference({
        bibliographic: { title: "Ref without abstract" },
      }),
      loading: false,
      error: null,
    });
    renderRecordDetail("abc");
    expect(screen.getByText("Ref without abstract")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Abstract" })).toBeNull();
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
    mockUseVocabulary.mockReturnValue(
      makeVocabResult({ error: new Error("Network failure") }),
    );
    mockUseContextPrefixes.mockReturnValue({
      context: null,
      loading: false,
      error: new Error("Network failure"),
    });

    const { container } = renderRecordDetail("abc-123");

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

    renderRecordDetail("abc-123");

    expect(screen.getByText("Bibliographic Only")).toBeDefined();
    expect(screen.getByText("Jones, K. (2023)")).toBeDefined();
    expect(screen.queryByText("Doc Type")).toBeNull();
  });

  test("HPV record renders the Taxonomy codes card, geo first and expanded, no findings", () => {
    history.replaceState(null, "", "/hpv");
    mockUseReference.mockReturnValue({
      reference: makeReference({
        bibliographic: { title: "HPV ref" },
        investigation: {
          hasAppliedConcept: [
            { "@id": NON_GEO_SCHEME + "/concept" },
            { "@id": HPV_COUNTRY + "/KE" },
          ],
        },
      }),
      loading: false,
      error: null,
    });
    const schemes: ConceptScheme[] = [
      {
        uri: NON_GEO_SCHEME,
        label: "Topical Focus",
        topConcepts: [{ uri: NON_GEO_SCHEME + "/concept", label: "Sample Concept" }],
      },
      {
        uri: HPV_COUNTRY,
        label: "Country",
        topConcepts: [{ uri: HPV_COUNTRY + "/KE", label: "Kenya" }],
      },
    ];
    mockUseVocabulary.mockReturnValue(
      makeVocabResult({
        labels: new Map([
          [NON_GEO_SCHEME + "/concept", "Sample Concept"],
          [HPV_COUNTRY + "/KE", "Kenya"],
        ]),
        inScheme: new Map([
          [NON_GEO_SCHEME + "/concept", NON_GEO_SCHEME],
          [HPV_COUNTRY + "/KE", HPV_COUNTRY],
        ]),
        schemes,
      }),
    );
    mockUseContextPrefixes.mockReturnValue({
      context: { prefixes: new Map() },
      loading: false,
      error: null,
    });

    renderRecordDetail("abc");
    expect(
      screen.getByRole("heading", { name: "Taxonomy codes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Topical Focus" }),
    ).toBeInTheDocument(); // topical
    expect(
      screen.getByRole("heading", { name: "Country" }),
    ).toBeInTheDocument(); // geo, expanded (1 code, below roll-up threshold)
    expect(screen.getByText("Kenya")).toBeInTheDocument(); // geo member listed, not rolled up
    expect(screen.getByText("Sample Concept")).toBeInTheDocument(); // topical member
    expect(screen.queryByText("Finding 1")).toBeNull();
  });

  test("ESEA record (no appliedConcepts) renders no Taxonomy codes card", () => {
    history.replaceState(null, "", "/esea");
    mockUseReference.mockReturnValue({
      reference: makeReference({
        bibliographic: { title: "ESEA ref" },
        investigation: { hasFinding: [] },
      }),
      loading: false,
      error: null,
    });
    renderRecordDetail("abc");
    expect(screen.getByText("ESEA ref")).toBeInTheDocument();
    expect(screen.queryByText("Taxonomy codes")).toBeNull();
  });

  // Data-gated, not community-gated: any community with applied concepts gets the
  // card. ESEA has none today; that's data, not a gate.
  test("ESEA record with appliedConcepts renders the card too (data-gated, not community-gated)", () => {
    history.replaceState(null, "", "/esea");
    const ESEA_SCHEME = "https://vocab.esea.education/EducationTheme";
    mockUseReference.mockReturnValue({
      reference: makeReference({
        bibliographic: { title: "ESEA coded ref" },
        investigation: {
          hasAppliedConcept: [{ "@id": ESEA_SCHEME + "/concept" }],
        },
      }),
      loading: false,
      error: null,
    });
    const schemes: ConceptScheme[] = [
      {
        uri: ESEA_SCHEME,
        label: "Education Theme",
        topConcepts: [{ uri: ESEA_SCHEME + "/concept", label: "Numeracy" }],
      },
    ];
    mockUseVocabulary.mockReturnValue(
      makeVocabResult({
        labels: new Map([[ESEA_SCHEME + "/concept", "Numeracy"]]),
        inScheme: new Map([[ESEA_SCHEME + "/concept", ESEA_SCHEME]]),
        schemes,
      }),
    );
    mockUseContextPrefixes.mockReturnValue({
      context: { prefixes: new Map() },
      loading: false,
      error: null,
    });
    renderRecordDetail("abc");
    expect(
      screen.getByRole("heading", { name: "Taxonomy codes" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Numeracy")).toBeInTheDocument();
  });

  test("HPV bibliographic-only record (no codes) renders no Taxonomy codes card", () => {
    history.replaceState(null, "", "/hpv");
    mockUseReference.mockReturnValue({
      reference: makeReference({ bibliographic: { title: "Shell" } }),
      loading: false,
      error: null,
    });
    renderRecordDetail("abc");
    expect(screen.getByText("Shell")).toBeInTheDocument();
    expect(screen.queryByText("Taxonomy codes")).toBeNull();
  });

  test("HPV record with context-only failure resolves labels and shows no raw-identifier note", () => {
    history.replaceState(null, "", "/hpv");
    mockUseReference.mockReturnValue({
      reference: makeReference({
        bibliographic: { title: "HPV ctx-fail ref" },
        investigation: {
          hasAppliedConcept: [{ "@id": NON_GEO_SCHEME + "/concept" }],
        },
      }),
      loading: false,
      error: null,
    });
    const schemes: ConceptScheme[] = [
      {
        uri: NON_GEO_SCHEME,
        label: "Topical Focus",
        topConcepts: [{ uri: NON_GEO_SCHEME + "/concept", label: "Sample Concept" }],
      },
    ];
    mockUseVocabulary.mockReturnValue(
      makeVocabResult({
        labels: new Map([[NON_GEO_SCHEME + "/concept", "Sample Concept"]]),
        inScheme: new Map([[NON_GEO_SCHEME + "/concept", NON_GEO_SCHEME]]),
        schemes,
        // vocab loaded fine — only context (prefixes) fails below
      }),
    );
    mockUseContextPrefixes.mockReturnValue({
      context: null,
      loading: false,
      error: new Error("context fetch failed"),
    });

    renderRecordDetail("abc");
    // HPV concepts are full URIs, so they resolve without the context/prefixes.
    expect(
      screen.getByRole("heading", { name: "Taxonomy codes" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sample Concept")).toBeInTheDocument();
    // Context-only failure must NOT trip the card's raw-identifier note.
    expect(
      screen.queryByText(/codes are shown as raw identifiers/),
    ).toBeNull();
  });

  test.each([
    ["/esea", true],
    ["/hpv", false],
  ])(
    "%s record offers the request-coding button: %s",
    (path, expected) => {
      history.replaceState(null, "", path);
      mockUseReference.mockReturnValue({
        reference: makeReference({ bibliographic: { title: "A ref" } }),
        loading: false,
        error: null,
      });

      renderRecordDetail("abc");

      const button = screen.queryByRole("button", {
        name: "Request additional coding",
      });
      expect(button !== null).toBe(expected);
    },
  );

  test("ESEA record with ample coding and estimates offers no request-coding button", () => {
    history.replaceState(null, "", "/esea");
    mockUseReference.mockReturnValue({
      reference: makeReference({
        bibliographic: { title: "Well coded ref" },
        investigation: {
          hasAppliedConcept: Array.from({ length: 20 }, (_, i) => ({
            "@id": `esea:C${i}`,
          })),
          hasFinding: [{ hasEffectEstimate: [{ pointEstimate: 0.4 }] }],
        },
      }),
      loading: false,
      error: null,
    });

    renderRecordDetail("abc");

    expect(screen.getByText("Well coded ref")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Request additional coding" }),
    ).toBeNull();
  });
});
