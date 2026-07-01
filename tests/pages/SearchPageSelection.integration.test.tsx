import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/preact";
import { App } from "@/App";
import type { SearchResult } from "@/types/models";
import { makeReference, makeVocabResult } from "../fixtures";

vi.mock("@/services/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/apiClient")>();
  return { ...actual, searchReferences: vi.fn() };
});
vi.mock("@/hooks/useVocabulary", () => ({ useVocabulary: vi.fn() }));
// Selection ships dark (referenceSelection defaults off); force the gate on so
// this test exercises the selection UI regardless of the community flag.
vi.mock("@/components/search/selectionEnabled", () => ({
  selectionEnabled: () => true,
}));

import { searchReferences } from "@/services/apiClient";
import { useVocabulary } from "@/hooks/useVocabulary";

const mockSearch = vi.mocked(searchReferences);
const mockVocab = vi.mocked(useVocabulary);

const PAGE_SIZE = 20;
const TOTAL = 40;

function pageResult(page: number): SearchResult {
  const refs = Array.from({ length: PAGE_SIZE }, (_, i) =>
    makeReference({ id: `p${page}-r${i}`, bibliographic: { title: `p${page}-r${i}` } }),
  );
  return {
    total: { count: TOTAL, is_lower_bound: false },
    page: { count: PAGE_SIZE, number: page },
    references: refs,
  };
}

beforeEach(() => {
  mockVocab.mockReturnValue(makeVocabResult());
  mockSearch.mockImplementation((_q, filters) =>
    Promise.resolve(pageResult(filters?.page ?? 1)),
  );
  history.pushState({}, "", "/hpv?q=hpv");
});

async function gotoPage(n: number) {
  fireEvent.click(screen.getByRole("button", { name: `Page ${n}` }));
  await waitFor(() =>
    expect(screen.getByRole("checkbox", { name: new RegExp(`p${n}-r0$`) })).toBeInTheDocument(),
  );
}

describe("cross-page selection persistence", () => {
  test("a page deselected after 'select all' stays deselected on return", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: /p1-r0$/ })).toBeInTheDocument(),
    );

    // Select this page, then escalate to all matches.
    fireEvent.click(screen.getByRole("checkbox", { name: "Select this page" }));
    fireEvent.click(screen.getByRole("button", { name: /select all 40 references/i }));
    expect(screen.getByText("All 40 selected.")).toBeInTheDocument();

    // Go to page 2 (all selected there), deselect the whole page.
    await gotoPage(2);
    expect(screen.getByRole("checkbox", { name: "Deselect p2-r0" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Deselect this page" }));
    expect(screen.getByRole("checkbox", { name: "Select p2-r0" })).not.toBeChecked();

    // Away to page 1 and back to page 2 — the deselection must survive.
    await gotoPage(1);
    await gotoPage(2);
    expect(screen.getByRole("checkbox", { name: "Select p2-r0" })).not.toBeChecked();
  });
});
