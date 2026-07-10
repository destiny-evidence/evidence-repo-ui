import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/preact";
import { App } from "@/App";
import type { SearchResult } from "@/types/models";
import { makeReference, makeVocabResult } from "../fixtures";

vi.mock("@/services/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/apiClient")>();
  return {
    ...actual,
    searchReferences: vi.fn(),
    requestReferenceExport: vi.fn(),
    getReferenceExport: vi.fn(),
  };
});
vi.mock("@/hooks/useVocabulary", () => ({ useVocabulary: vi.fn() }));
vi.mock("@/services/export/export", () => ({
  exportReferencesToExcel: vi.fn().mockResolvedValue(undefined),
}));
// Force the selection gate on so this test doesn't depend on the community's
// consumer flags.
vi.mock("@/components/search/selectionEnabled", () => ({
  selectionEnabled: () => true,
}));

import {
  searchReferences,
  requestReferenceExport,
  getReferenceExport,
} from "@/services/apiClient";
import { useVocabulary } from "@/hooks/useVocabulary";

const mockSearch = vi.mocked(searchReferences);
const mockRefExport = vi.mocked(requestReferenceExport);
const mockRefGet = vi.mocked(getReferenceExport);
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
  // Pagination renders above and below the table; either navigates.
  fireEvent.click(screen.getAllByRole("button", { name: `Page ${n}` })[0]);
  await waitFor(() =>
    expect(screen.getByRole("checkbox", { name: new RegExp(`p${n}-r0$`) })).toBeInTheDocument(),
  );
}

describe("cross-page selection persistence", () => {
  test("a row deselected after 'select all' stays deselected on return", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: /p1-r0$/ })).toBeInTheDocument(),
    );

    // Select every match via the top-left checkbox.
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all references" }));
    expect(screen.getByText("All 40 selected")).toBeInTheDocument();

    // On page 2, deselect a single row.
    await gotoPage(2);
    expect(screen.getByRole("checkbox", { name: "Deselect p2-r0" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Deselect p2-r0" }));
    expect(screen.getByRole("checkbox", { name: "Select p2-r0" })).not.toBeChecked();

    // Away to page 1 and back to page 2 — the deselection must survive.
    await gotoPage(1);
    await gotoPage(2);
    expect(screen.getByRole("checkbox", { name: "Select p2-r0" })).not.toBeChecked();
  });

  test("re-sorting keeps the selection", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: /p1-r0$/ })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all references" }));
    expect(screen.getByText("All 40 selected")).toBeInTheDocument();

    // Changing sort re-navigates but keeps the same result set — selection stays.
    fireEvent.change(screen.getByRole("combobox", { name: "Sort results" }), {
      target: { value: "newest" },
    });
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: /p1-r0$/ })).toBeInTheDocument(),
    );
    expect(screen.getByText("All 40 selected")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Deselect p1-r0" })).toBeChecked();
  });

  test("master checkbox reads checked once every row is ticked individually", async () => {
    // A single page holding the whole result set.
    const refs = ["a", "b", "c"].map((id) =>
      makeReference({ id, bibliographic: { title: id } }),
    );
    mockSearch.mockResolvedValue({
      total: { count: 3, is_lower_bound: false },
      page: { count: 3, number: 1 },
      references: refs,
    });
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Select a" })).toBeInTheDocument(),
    );

    const master = () => screen.getByRole("checkbox", { name: /(Select|Deselect) all references/ }) as HTMLInputElement;
    expect(master().indeterminate).toBe(false);
    expect(master()).not.toBeChecked();

    fireEvent.click(screen.getByRole("checkbox", { name: "Select a" }));
    expect(master().indeterminate).toBe(true); // partial

    fireEvent.click(screen.getByRole("checkbox", { name: "Select b" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select c" }));

    // Every row selected individually — master is checked, not indeterminate.
    expect(master()).toBeChecked();
    expect(master().indeterminate).toBe(false);
    expect(screen.getByText("All 3 selected")).toBeInTheDocument();
  });
});

describe("exporting the selection", () => {
  beforeEach(() => {
    mockSearch.mockResolvedValue({
      total: { count: 3, is_lower_bound: false },
      page: { count: 3, number: 1 },
      references: ["a", "b", "c"].map((id) =>
        makeReference({ id, bibliographic: { title: id } }),
      ),
    });
    mockRefExport.mockResolvedValue({ id: "job", status: "pending" });
    mockRefGet.mockResolvedValue({
      id: "job",
      status: "completed",
      result_url: "https://blob/result.jsonl",
    });
  });

  test("'Selected' export POSTs exactly the ticked ids to the reference export", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Select a" })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Select a" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select b" }));

    fireEvent.click(screen.getByRole("button", { name: /^export$/i }));
    const panel = screen.getByRole("group", { name: /export options/i });
    // Defaults to "Selected" since a selection exists.
    expect(within(panel).getByRole("radio", { name: /selected \(2\)/i })).toBeChecked();
    fireEvent.click(within(panel).getByRole("button", { name: /^export$/i }));

    await waitFor(() =>
      expect(mockRefExport).toHaveBeenCalledWith(["a", "b"], "jsonl"),
    );
  });

  test("'Selected' is disabled with nothing ticked; export falls back to all results", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Select a" })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /^export$/i }));
    const panel = screen.getByRole("group", { name: /export options/i });
    expect(within(panel).getByRole("radio", { name: /selected \(0\)/i })).toBeDisabled();
    expect(within(panel).getByRole("radio", { name: /all results/i })).toBeChecked();
  });
});
