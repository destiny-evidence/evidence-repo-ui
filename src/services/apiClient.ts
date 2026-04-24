import { api } from "@/api/client";
import type { Reference, SearchResult } from "@/types/models";

export interface SearchFilters {
  page?: number;
  startYear?: number;
  endYear?: number;
  annotation?: string[];
  sort?: string[];
}

export async function searchReferences(
  query: string | undefined,
  filters: SearchFilters = {},
): Promise<SearchResult> {
  const normalizedQuery = query?.trim();
  // Browse-mode shim: empty q would produce "(q) AND ..." on the backend,
  // which is an invalid Lucene query. "*" is match-anything.
  // See destiny-repository/app/domain/references/services/search_service.py:101-102
  const effectiveQuery = normalizedQuery ? normalizedQuery : "*";

  const params = new URLSearchParams();
  params.set("q", effectiveQuery);
  if (filters.page !== undefined) params.set("page", String(filters.page));
  if (filters.startYear !== undefined) params.set("start_year", String(filters.startYear));
  if (filters.endYear !== undefined) params.set("end_year", String(filters.endYear));
  for (const a of filters.annotation ?? []) params.append("annotation", a);
  for (const s of filters.sort ?? []) params.append("sort", s);
  return api.get<SearchResult>(`/v1/references/search/?${params.toString()}`);
}

export async function getReference(id: string): Promise<Reference | null> {
  const results = await api.get<Reference[]>(
    `/v1/references/?identifier=${encodeURIComponent(id)}`,
  );
  return results[0] ?? null;
}
