import { api } from "@/api/client";
import type {
  Reference,
  SearchResult,
  Enhancement,
  EnhancementContent,
  BibliographicMetadataEnhancement,
  LinkedDataEnhancement,
} from "@/types/models";

export interface SearchFilters {
  page?: number;
  annotation?: string[];
  sort?: string[];
}

export async function searchReferences(
  query: string,
  filters: SearchFilters = {},
): Promise<SearchResult> {
  const params = new URLSearchParams();
  params.set("q", query);
  if (filters.page !== undefined) {
    params.set("page", String(filters.page));
  }
  if (filters.annotation) {
    for (const a of filters.annotation) {
      params.append("annotation", a);
    }
  }
  if (filters.sort) {
    for (const s of filters.sort) {
      params.append("sort", s);
    }
  }
  return api.get<SearchResult>(`/v1/references/search/?${params.toString()}`);
}

export async function getReference(id: string): Promise<Reference | null> {
  const results = await api.get<Reference[]>(
    `/v1/references/?identifier=${encodeURIComponent(id)}`,
  );
  return results[0] ?? null;
}

function extractEnhancement<T extends EnhancementContent>(
  reference: Reference,
  enhancementType: T["enhancement_type"],
): T | null {
  if (!reference.enhancements) return null;
  const matches = reference.enhancements.filter(
    (e): e is Enhancement & { content: T } =>
      e.content.enhancement_type === enhancementType,
  );
  if (matches.length === 0) return null;
  const sorted = matches.sort((a, b) =>
    (a.created_at ?? "").localeCompare(b.created_at ?? ""),
  );
  return sorted[sorted.length - 1].content;
}

export function extractBibliographic(
  reference: Reference,
): BibliographicMetadataEnhancement | null {
  return extractEnhancement<BibliographicMetadataEnhancement>(
    reference,
    "bibliographic",
  );
}

export function extractLinkedData(
  reference: Reference,
): LinkedDataEnhancement | null {
  return extractEnhancement<LinkedDataEnhancement>(reference, "linked_data");
}
