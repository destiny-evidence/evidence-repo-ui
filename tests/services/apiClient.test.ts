import { vi } from "vitest";
import { api } from "@/api/client";
import { searchReferences, getReference } from "@/services/apiClient";
import type { Reference, SearchResult } from "@/types/models";

vi.mock("@/api/client", () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockedGet = vi.mocked(api.get);

beforeEach(() => {
  mockedGet.mockReset();
});

describe("searchReferences", () => {
  const result: SearchResult = {
    total: { count: 1, is_lower_bound: false },
    page: { count: 10, number: 1 },
    references: [],
  };

  test("calls the correct endpoint with query", async () => {
    mockedGet.mockResolvedValue(result);
    await searchReferences("climate change");
    expect(mockedGet).toHaveBeenCalledWith("/v1/search/?q=climate+change");
  });

  test("appends page filter", async () => {
    mockedGet.mockResolvedValue(result);
    await searchReferences("test", { page: 3 });
    expect(mockedGet).toHaveBeenCalledWith("/v1/search/?q=test&page=3");
  });

  test("appends multiple annotation params", async () => {
    mockedGet.mockResolvedValue(result);
    await searchReferences("test", { annotation: ["foo", "bar"] });
    const url = mockedGet.mock.calls[0][0];
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.getAll("annotation")).toEqual(["foo", "bar"]);
  });

  test("appends multiple sort params", async () => {
    mockedGet.mockResolvedValue(result);
    await searchReferences("test", { sort: ["date", "-relevance"] });
    const url = mockedGet.mock.calls[0][0];
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.getAll("sort")).toEqual(["date", "-relevance"]);
  });

  test("returns the result from api.get", async () => {
    mockedGet.mockResolvedValue(result);
    const res = await searchReferences("test");
    expect(res).toBe(result);
  });
});

describe("getReference", () => {
  test("calls the correct endpoint", async () => {
    const ref = { id: "abc-123" } as Reference;
    mockedGet.mockResolvedValue(ref);
    await getReference("abc-123");
    expect(mockedGet).toHaveBeenCalledWith("/v1/references/abc-123/");
  });

  test("returns the result", async () => {
    const ref = { id: "abc-123" } as Reference;
    mockedGet.mockResolvedValue(ref);
    const res = await getReference("abc-123");
    expect(res).toBe(ref);
  });
});
