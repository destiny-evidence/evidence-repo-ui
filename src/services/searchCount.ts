import { searchReferences } from "@/services/apiClient";
import {
  toUnpaginatedSearchQuery,
  type SearchParams,
} from "@/services/searchParams";

export async function countSearchMatches(
  params: SearchParams,
  annotations: string[] | undefined,
): Promise<number> {
  const { query, filters } = toUnpaginatedSearchQuery(params, annotations);
  return (await searchReferences(query, filters)).total.count;
}
