import { api } from "@/api/client";
import type {
  Reference,
  SearchResult,
  Enhancement,
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
  if (filters.page) {
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
  return api.get<SearchResult>(`/v1/search/?${params.toString()}`);
}

export async function getReference(id: string): Promise<Reference> {
  return api.get<Reference>(`/v1/references/${id}/`);
}

export function extractBibliographic(
  reference: Reference,
): BibliographicMetadataEnhancement | null {
  if (!reference.enhancements) return null;
  const matches = reference.enhancements.filter(
    (e): e is Enhancement & { content: BibliographicMetadataEnhancement } =>
      e.content.enhancement_type === "bibliographic",
  );
  if (matches.length === 0) return null;
  return matches[matches.length - 1].content;
}

export function extractLinkedData(
  reference: Reference,
): LinkedDataEnhancement | null {
  if (!reference.enhancements) return null;
  const matches = reference.enhancements.filter(
    (e): e is Enhancement & { content: LinkedDataEnhancement } =>
      e.content.enhancement_type === "linked_data",
  );
  if (matches.length === 0) return null;
  return matches[matches.length - 1].content;
}
