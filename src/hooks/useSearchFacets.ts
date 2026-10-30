import { useEffect, useState } from "preact/hooks";
import { searchReferenceFacets } from "@/services/apiClient";
import { useCommunity } from "@/community/CommunityContext";
import { toTurtleUrl } from "@/services/vocabulary/vocabularyService";
import type { SearchParams } from "@/services/searchParams";
import { axisPairToParams, type CrossFacetAxisPair } from "@/services/crossFacets";

export interface FacetCounts {
  concepts: ReadonlyMap<string, number>;
  countries: ReadonlyMap<string, number>;
  wbRegions: ReadonlyMap<string, number>;
}

// Omits `page` and `sort` — facet counts are invariant under both.
function paramsKey(
  params: SearchParams,
  slug: string,
  annotations: string[],
  axes: CrossFacetAxisPair | undefined,
): string {
  return [
    `q=${params.q}`,
    `start=${params.startYear ?? ""}`,
    `end=${params.endYear ?? ""}`,
    `slug=${slug}`,
    `ann=${JSON.stringify(annotations)}`,
    `countries=${JSON.stringify(params.countryCodes)}`,
    `regions=${JSON.stringify(params.wbRegionIds)}`,
    `concepts=${JSON.stringify(params.conceptFilters)}`,
    `row=${JSON.stringify(axes?.row)}`,
    `column=${JSON.stringify(axes?.column)}`,
  ].join("&");
}

export function useSearchFacets(params: SearchParams, axes?: CrossFacetAxisPair): {
  counts: FacetCounts | null;
  loading: boolean;
  error: Error | null;
} {
  const community = useCommunity();
  const key = paramsKey(
    params,
    community?.slug ?? "",
    community?.defaultAnnotations ?? [],
    axes,
  );
  const [counts, setCounts] = useState<FacetCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!community) return;
    let cancelled = false;

    // Keep prior counts visible while refetching (dim-while-updating).
    setError(null);
    setLoading(true);
    // Backend wants the Turtle vocab; the env URL is the JSON-LD one.
    const vocabularyUrl = toTurtleUrl(community.vocabularyUrl);

    searchReferenceFacets(
      params.q || undefined,
      {
        startYear: params.startYear,
        endYear: params.endYear,
        annotation: community.defaultAnnotations,
        conceptFilters: params.conceptFilters,
        countryCodes: params.countryCodes,
        wbRegionIds: params.wbRegionIds,
      },
      ["concepts", "countries", "country_wb_regions"],
      axes ? axisPairToParams(axes, vocabularyUrl) : { vocabularyUrl },
    )
      .then((r) => {
        if (cancelled) return;
        const conceptCounts = new Map<string, number>();
        for (const { concept, count } of r.concepts ?? []) {
          conceptCounts.set(concept, count);
        }
        const countryCounts = new Map<string, number>();
        for (const { country, count } of r.countries ?? []) {
          countryCounts.set(country, count);
        }
        const wbRegionCounts = new Map<string, number>();
        for (const { country_wb_region, count } of r.country_wb_regions ?? []) {
          wbRegionCounts.set(country_wb_region, count);
        }
        setCounts({
          concepts: conceptCounts,
          countries: countryCounts,
          wbRegions: wbRegionCounts,
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e);
        setCounts(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!community) return { counts: null, loading: false, error: null };

  return { counts, loading, error };
}
