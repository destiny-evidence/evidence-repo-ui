import { useEffect, useState } from "preact/hooks";
import { crossFacets } from "@/services/apiClient";
import { useCommunity } from "@/community/CommunityContext";
import { toTurtleUrl } from "@/services/vocabulary/vocabularyService";
import {
  axisPairToParams,
  type CrossFacetAxisPair,
} from "@/services/crossFacets";
import type { SearchParams } from "@/services/searchParams";
import type { ReferenceCrossFacetResult } from "@/types/models";

function paramsKey(
  params: SearchParams,
  axes: CrossFacetAxisPair,
  slug: string,
  annotations: string[],
): string {
  return [
    `q=${params.q}`,
    `start=${params.startYear ?? ""}`,
    `end=${params.endYear ?? ""}`,
    `slug=${slug}`,
    `ann=${JSON.stringify(annotations)}`,
    `countries=${JSON.stringify(params.countryCodes)}`,
    `concepts=${JSON.stringify(params.conceptFilters)}`,
    `row=${JSON.stringify(axes.row)}`,
    `column=${JSON.stringify(axes.column)}`,
  ].join("&");
}

export function useCrossFacets(
  params: SearchParams,
  axes: CrossFacetAxisPair,
): {
  result: ReferenceCrossFacetResult | null;
  // The axes and params the current `result` was fetched for. While a refetch is in flight
  // these stay on the previous axes (with `result`), so a caller resolving cell
  // values never pairs stale cells with the new axes' label functions.
  resultAxes: CrossFacetAxisPair | null;
  resultParams: SearchParams | null;
  loading: boolean;
  error: Error | null;
} {
  const community = useCommunity();
  const key = paramsKey(
    params,
    axes,
    community?.slug ?? "",
    community?.defaultAnnotations ?? [],
  );
  // result and the query it came from move together so they can't drift apart
  // mid-fetch.
  const [data, setData] = useState<{
    result: ReferenceCrossFacetResult;
    axes: CrossFacetAxisPair;
    params: SearchParams;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!community) return;
    let cancelled = false;

    setError(null);
    setLoading(true);

    crossFacets(
      params.q || undefined,
      {
        startYear: params.startYear,
        endYear: params.endYear,
        annotation: community.defaultAnnotations,
        conceptFilters: params.conceptFilters,
        countryCodes: params.countryCodes,
      },
      axisPairToParams(axes, toTurtleUrl(community.vocabularyUrl)),
    )
      .then((r) => {
        if (!cancelled) setData({ result: r, axes, params });
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e);
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!community)
    return {
      result: null,
      resultAxes: null,
      resultParams: null,
      loading: false,
      error: null,
    };

  return {
    result: data?.result ?? null,
    resultAxes: data?.axes ?? null,
    resultParams: data?.params ?? null,
    loading,
    error,
  };
}
