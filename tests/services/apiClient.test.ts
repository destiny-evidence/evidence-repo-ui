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
    expect(mockedGet).toHaveBeenCalledWith(
      "/v1/references/search/?q=climate+change",
    );
  });

  test("appends page filter", async () => {
    mockedGet.mockResolvedValue(result);
    await searchReferences("test", { page: 3 });
    expect(mockedGet).toHaveBeenCalledWith(
      "/v1/references/search/?q=test&page=3",
    );
  });

  test("appends page=0 when explicitly set", async () => {
    mockedGet.mockResolvedValue(result);
    await searchReferences("test", { page: 0 });
    expect(mockedGet).toHaveBeenCalledWith(
      "/v1/references/search/?q=test&page=0",
    );
  });

  test("appends multiple annotation params", async () => {
    mockedGet.mockResolvedValue(result);
    await searchReferences("test", { annotation: ["foo", "bar"] });
    const url = mockedGet.mock.calls[0][0];
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.getAll("annotation")).toEqual(["foo", "bar"]);
  });

  test("returns the result from api.get", async () => {
    mockedGet.mockResolvedValue(result);
    const res = await searchReferences("test");
    expect(res).toBe(result);
  });
});

describe("getReference", () => {
  test("calls the identifier lookup endpoint", async () => {
    const ref = { id: "abc-123" } as Reference;
    mockedGet.mockResolvedValue([ref]);
    await getReference("abc-123");
    expect(mockedGet).toHaveBeenCalledWith(
      "/v1/references/?identifier=abc-123",
    );
  });

  test("returns the first result", async () => {
    const ref = { id: "abc-123" } as Reference;
    mockedGet.mockResolvedValue([ref]);
    const res = await getReference("abc-123");
    expect(res).toBe(ref);
  });

  test("returns null when no results", async () => {
    mockedGet.mockResolvedValue([]);
    const res = await getReference("nonexistent");
    expect(res).toBeNull();
  });

  test("encodes identifier in URL", async () => {
    mockedGet.mockResolvedValue([]);
    await getReference("doi:10.1000/abc123");
    expect(mockedGet).toHaveBeenCalledWith(
      "/v1/references/?identifier=doi%3A10.1000%2Fabc123",
    );
  });
});
