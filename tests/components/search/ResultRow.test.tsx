import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/preact";
import { ResultRow } from "@/components/search/ResultRow";
import { makeReference } from "../../fixtures";

const vocabState = {
  labels: null as Map<string, string> | null,
  broader: null as Map<string, string> | null,
  definitions: null as Map<string, string> | null,
};
const contextState = {
  context: null as { prefixes: Map<string, string> } | null,
};

vi.mock("@/hooks/useVocabulary", () => ({
  useVocabulary: () => ({
    labels: vocabState.labels,
    broader: vocabState.broader,
    definitions: vocabState.definitions,
    loading: false,
    error: null,
  }),
}));

vi.mock("@/hooks/useContextPrefixes", () => ({
  useContextPrefixes: () => ({
    context: contextState.context,
    loading: false,
    error: null,
  }),
}));

beforeEach(() => {
  vocabState.labels = null;
  vocabState.broader = null;
  vocabState.definitions = null;
  contextState.context = null;
});

const REF_ID = "ref-1";

function makeRef(opts: Parameters<typeof makeReference>[0] = {}) {
  return makeReference({
    id: REF_ID,
    doi: "10.1000/abc",
    bibliographic: {
      title: "On phonics instruction",
      authors: ["Smith, J.", "Jones, K."],
      year: 2020,
      venue: "Journal of Education",
    },
    abstract: "This is the abstract body text used for the snippet preview.",
    ...opts,
  });
}

describe("ResultRow", () => {
  test("renders title, authors, venue, year", () => {
    render(<ResultRow communitySlug="esea" reference={makeRef()} />);
    expect(screen.getByText("On phonics instruction")).toBeInTheDocument();
    expect(screen.getByText(/Smith, J\./)).toBeInTheDocument();
    expect(screen.getByText(/Journal of Education/)).toBeInTheDocument();
    expect(screen.getByText(/2020/)).toBeInTheDocument();
  });

  test("renders abstract snippet", () => {
    render(<ResultRow communitySlug="esea" reference={makeRef()} />);
    expect(screen.getByText(/abstract body text/)).toBeInTheDocument();
  });

  test("primary content (title, authors, venue, abstract) is all wrapped in the row anchor", () => {
    render(<ResultRow communitySlug="esea" reference={makeRef()} />);
    const rowLink = screen.getByRole("link", {
      name: /on phonics instruction/i,
    });
    expect(rowLink).toHaveAttribute("href", `/esea/references/${REF_ID}`);
    expect(rowLink).toContainElement(
      screen.getByText("On phonics instruction"),
    );
    expect(rowLink).toContainElement(screen.getByText(/Smith, J\./));
    expect(rowLink).toContainElement(screen.getByText(/Journal of Education/));
    expect(rowLink).toContainElement(screen.getByText(/2020/));
    expect(rowLink).toContainElement(screen.getByText(/abstract body text/));
    // DOI is NOT inside the row anchor (would be invalid nested-interactive HTML).
    expect(rowLink.querySelector('a[href^="https://doi.org"]')).toBeNull();
  });

  test("row anchor carries the stretched-link class so CSS can extend its hit area", () => {
    const { container } = render(
      <ResultRow communitySlug="esea" reference={makeRef()} />,
    );
    const link = container.querySelector(".row-link");
    expect(link).not.toBeNull();
    expect(link?.tagName).toBe("A");
  });

  test("DOI link is a sibling to the row anchor, with href = doi.org/<doi>", () => {
    render(<ResultRow communitySlug="esea" reference={makeRef()} />);
    const doi = screen.getByRole("link", { name: /^doi/i });
    expect(doi).toHaveAttribute("href", "https://doi.org/10.1000/abc");
    expect(doi).toHaveAttribute("target", "_blank");
  });

  test("DOI link is not rendered when no DOI identifier present", () => {
    render(
      <ResultRow
        communitySlug="esea"
        reference={makeRef({ doi: undefined })}
      />,
    );
    expect(screen.queryByRole("link", { name: /^doi/i })).toBeNull();
  });

  test("falls back to — for findings/estimates badges when reference has no linked-data", () => {
    const { container } = render(
      <ResultRow communitySlug="esea" reference={makeRef()} />,
    );
    const nums = container.querySelectorAll(".stat-num");
    expect(nums).toHaveLength(2);
    expect(nums[0]).toHaveTextContent("—");
    expect(nums[1]).toHaveTextContent("—");
    expect(container.querySelector(".row-right")).toHaveTextContent(/findings/);
    expect(container.querySelector(".row-right")).toHaveTextContent(
      /estimates/,
    );
    expect(container.querySelector(".row-pills")).toBeNull();
  });

  test("renders real findings/estimates counts from linked-data", () => {
    const ref = makeRef({
      investigation: {
        hasFinding: [
          { hasEffectEstimate: [{}, {}] },
          { hasEffectEstimate: [{}] },
        ],
      },
    });
    const { container } = render(
      <ResultRow communitySlug="esea" reference={ref} />,
    );
    const nums = container.querySelectorAll(".stat-num");
    expect(nums[0]).toHaveTextContent("2"); // 2 findings
    expect(nums[1]).toHaveTextContent("3"); // 3 estimates
  });

  test("counts render even when vocabulary is unresolved (pills wait)", () => {
    // labels/context left null — pills cannot resolve, but counts are
    // derived synchronously from raw JSON-LD.
    const ref = makeRef({
      investigation: { hasFinding: [{ hasEffectEstimate: [{}] }] },
    });
    const { container } = render(
      <ResultRow communitySlug="esea" reference={ref} />,
    );
    const nums = container.querySelectorAll(".stat-num");
    expect(nums[0]).toHaveTextContent("1");
    expect(nums[1]).toHaveTextContent("1");
    expect(container.querySelector(".row-pills")).toBeNull();
  });

  test("renders concept pills under the abstract once vocabulary resolves", () => {
    vocabState.labels = new Map([
      ["http://ex/Trial", "Randomised trial"],
      ["http://ex/Maths", "Mathematics"],
    ]);
    vocabState.broader = new Map();
    vocabState.definitions = new Map();
    contextState.context = { prefixes: new Map() };

    const ref = makeRef({
      investigation: {
        documentType: { codedValue: { "@id": "http://ex/Trial" } },
        hasFinding: [
          {
            evaluates: {
              educationTheme: [{ codedValue: { "@id": "http://ex/Maths" } }],
            },
          },
        ],
      },
    });
    const { container } = render(
      <ResultRow communitySlug="esea" reference={ref} />,
    );
    const pills = container.querySelector(".row-pills");
    expect(pills).not.toBeNull();
    expect(pills).toHaveTextContent("Randomised trial");
    expect(pills).toHaveTextContent("Mathematics");
    expect(pills?.querySelector(".tag-group__tag--more")).toBeNull();
  });

  test("caps pill list at PILL_CAP and renders +N more", () => {
    const labels = new Map<string, string>();
    const findings: unknown[] = [];
    for (let i = 0; i < 12; i++) {
      const uri = `http://ex/concept-${i}`;
      labels.set(uri, `Concept ${i}`);
      findings.push({
        hasOutcome: { outcome: [{ codedValue: { "@id": uri } }] },
      });
    }
    vocabState.labels = labels;
    vocabState.broader = new Map();
    vocabState.definitions = new Map();
    contextState.context = { prefixes: new Map() };

    const ref = makeRef({ investigation: { hasFinding: findings } });
    const { container } = render(
      <ResultRow communitySlug="esea" reference={ref} />,
    );
    const pills = container.querySelector(".row-pills");
    expect(pills).not.toBeNull();
    const tagEls = pills!.querySelectorAll(
      ".tag-group__tag:not(.tag-group__tag--more)",
    );
    expect(tagEls).toHaveLength(8);
    expect(pills!.querySelector(".tag-group__tag--more")).toHaveTextContent(
      "+4 more",
    );
  });

  test("does not render coding institution when no raw enhancement is present", () => {
    render(<ResultRow communitySlug="esea" reference={makeRef()} />);
    expect(screen.queryByTestId("coder-text")).toBeNull();
  });

  test("renders coding institution at the bottom of the right column", () => {
    const ref = makeRef({
      enhancements: [
        {
          id: "raw-1",
          reference_id: "ref-1",
          source: "eef-eppi-review",
          visibility: "public",
          robot_version: null,
          derived_from: null,
          created_at: "2024-01-01",
          content: { enhancement_type: "raw" },
        },
      ],
    });
    const { container } = render(
      <ResultRow communitySlug="esea" reference={ref} />,
    );
    const coder = screen.getByTestId("coder-text");
    expect(coder).toHaveTextContent("EEF");
    const right = container.querySelector(".row-right");
    expect(right?.lastElementChild).toBe(coder);
  });

  test("renders without throwing when bibliographic missing; row-anchor falls back to id", () => {
    const ref = makeRef({ enhancements: [] });
    render(<ResultRow communitySlug="esea" reference={ref} />);
    const rowLink = screen.getByRole("link", { name: new RegExp(REF_ID, "i") });
    expect(rowLink).toHaveAttribute("href", `/esea/references/${REF_ID}`);
  });
});
