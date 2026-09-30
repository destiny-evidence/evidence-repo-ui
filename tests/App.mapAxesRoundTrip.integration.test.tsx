import { render, screen, fireEvent, within, waitFor } from "@testing-library/preact";
import { vi, test, expect, beforeEach } from "vitest";
import { makeReference, makeVocabResult } from "./fixtures";

vi.mock("@/services/apiClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/apiClient")>()),
  searchReferences: vi.fn(),
}));
vi.mock("@/hooks/useVocabulary", () => ({ useVocabulary: vi.fn() }));
vi.mock("@/hooks/useCrossFacets", () => ({
  useCrossFacets: () => ({
    result: {
      totals: {
        search: { count: 0, is_lower_bound: false },
        mapped: { count: 0, is_lower_bound: false },
      },
      cells: [],
    },
    resultAxes: null,
    resultParams: null,
    loading: false,
    error: null,
  }),
}));
vi.mock("@/hooks/useSearchFacets", () => ({
  useSearchFacets: () => ({ counts: null, loading: false, error: null }),
}));

import { App } from "@/App";
import { searchReferences } from "@/services/apiClient";
import { useVocabulary } from "@/hooks/useVocabulary";

const REGION = "https://vocab.aliveevidence.org/hpv/WHORegion";
const FOCUS = "https://vocab.aliveevidence.org/hpv/ThematicFocusPrimary";

beforeEach(() => {
  vi.mocked(useVocabulary).mockReturnValue(
    makeVocabResult({
      labels: new Map(),
      schemes: [
        { uri: REGION, label: "WHO Region", topConcepts: [{ uri: "r:1", label: "Africa" }] },
        { uri: FOCUS, label: "Thematic Focus", topConcepts: [{ uri: "f:1", label: "Uptake" }] },
      ],
    }),
  );
  vi.mocked(searchReferences).mockResolvedValue({
    total: { count: 1, is_lower_bound: false },
    page: { count: 1, number: 1 },
    references: [makeReference({ id: "r1" })],
  });
});

const nav = () => within(screen.getByRole("navigation", { name: "Primary" }));

test("chosen map axes survive a trip through Search with a new query", async () => {
  history.pushState({}, "", "/hpv/visualise");
  const { container } = render(<App />);

  const panel = within(container.querySelector<HTMLElement>(".map-config-panel")!);
  fireEvent.change(panel.getByLabelText("Rows (y)"), { target: { value: FOCUS } });
  fireEvent.change(panel.getByLabelText("Columns (x)"), { target: { value: REGION } });
  fireEvent.click(panel.getByRole("button", { name: "Show results" }));

  fireEvent.click(nav().getByRole("link", { name: "Search" }));
  const box = await screen.findByLabelText("Search query");
  fireEvent.input(box, { target: { value: "uptake" } });
  fireEvent.submit(box.closest("form")!);
  await waitFor(() => expect(window.location.search).toBe("?q=uptake"));

  fireEvent.click(nav().getByRole("link", { name: "Visualise" }));

  await waitFor(() => {
    const params = new URLSearchParams(window.location.search);
    expect(window.location.pathname).toBe("/hpv/visualise");
    expect(params.get("q")).toBe("uptake");
    expect(params.get("row")).toBe(FOCUS);
    expect(params.get("column")).toBe(REGION);
  });
});
