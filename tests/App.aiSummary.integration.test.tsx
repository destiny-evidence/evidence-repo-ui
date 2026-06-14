import { render, screen, fireEvent, waitFor, act } from "@testing-library/preact";
import { vi, test, expect, beforeEach } from "vitest";
import type { SearchResult } from "@/types/models";
import { makeReference, makeVocabResult } from "./fixtures";

// Feature gate forced on: these tests cover the summary's lifecycle across
// navigation, not the enablement rules (summariser config + writer role).
vi.mock("@/components/ai-summary/aiSummariesEnabled", () => ({
  aiSummariesEnabled: () => true,
}));

// Mock at the service boundary so generation timing is ours to control — hold
// it "generating", then resolve when the test wants the done state.
vi.mock("@/services/apiClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/apiClient")>()),
  searchReferences: vi.fn(),
  searchReferenceIds: vi.fn(),
}));

vi.mock("@/services/summariserClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/summariserClient")>()),
  requestSummary: vi.fn(),
}));

vi.mock("@/hooks/useVocabulary", () => ({ useVocabulary: vi.fn() }));

// The same-community route hop lands on the record detail page; stub its data
// so it renders a loading shell rather than firing a real fetch.
vi.mock("@/hooks/useReference", () => ({
  useReference: () => ({ reference: null, loading: true, error: null }),
}));

import { App } from "@/App";
import { searchReferences, searchReferenceIds } from "@/services/apiClient";
import { requestSummary } from "@/services/summariserClient";
import { useVocabulary } from "@/hooks/useVocabulary";
import { MOCK_SUMMARY } from "@/services/summariserMock";
import { navigate } from "@/services/navigation";

const mockSearch = vi.mocked(searchReferences);
const mockSearchIds = vi.mocked(searchReferenceIds);
const mockRequestSummary = vi.mocked(requestSummary);
const mockVocab = vi.mocked(useVocabulary);

function makeResult(count: number, ids: string[]): SearchResult {
  return {
    total: { count, is_lower_bound: false },
    page: { count: ids.length, number: 1 },
    references: ids.map((id) => makeReference({ id })),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  mockVocab.mockReturnValue(makeVocabResult());
  // ≤ 50 references (so the summariser cap doesn't gate the button) with at
  // least one present (so the button renders).
  mockSearch.mockResolvedValue(makeResult(3, ["r1", "r2", "r3"]));
  mockSearchIds.mockResolvedValue({
    total: { count: 3, is_lower_bound: false },
    reference_ids: ["r1", "r2", "r3"],
  });
});

// Generate a summary, then send the in-flight job to the background chip.
async function generateAndBackground() {
  fireEvent.click(
    await screen.findByRole("button", { name: /generate ai summary/i }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: /run in background/i }),
  );
  await screen.findByText(/summarising/i);
}

test("keeps a background summary across same-community routes and blocks a new run until viewed", async () => {
  const job = deferred<typeof MOCK_SUMMARY>();
  mockRequestSummary.mockReturnValue(job.promise);

  history.pushState({}, "", "/esea?q=malaria");
  render(<App />);

  await generateAndBackground();

  // Let it finish in the background → "Summary ready".
  await act(async () => {
    job.resolve(MOCK_SUMMARY);
  });
  await screen.findByText(/summary ready/i);

  // Hop to another route in the same community and back — the chip survives.
  await act(async () => {
    navigate("/esea/references/r1");
  });
  expect(screen.getByText(/summary ready/i)).toBeInTheDocument();

  await act(async () => {
    navigate("/esea?q=malaria");
  });
  await screen.findByText(/summary ready/i);

  // A finished-but-unread summary blocks a new run...
  expect(
    await screen.findByRole("button", { name: /generate ai summary/i }),
  ).toBeDisabled();

  // ...until it's viewed via the indicator, which reopens the drawer.
  fireEvent.click(screen.getByRole("button", { name: /^view$/i }));
  await screen.findByText(/ai-generated from the papers/i);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: /generate ai summary/i }),
    ).toBeEnabled(),
  );
});

test("drops the active summary when the user changes community", async () => {
  // Never resolves: the summary is still generating when the community changes.
  mockRequestSummary.mockReturnValue(deferred<typeof MOCK_SUMMARY>().promise);

  history.pushState({}, "", "/esea?q=malaria");
  render(<App />);

  await generateAndBackground();

  await act(async () => {
    navigate("/hpv?q=malaria");
  });

  await waitFor(() =>
    expect(screen.queryByText(/summarising/i)).not.toBeInTheDocument(),
  );
});
