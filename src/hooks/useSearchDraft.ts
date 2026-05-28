import { useEffect, useState } from "preact/hooks";
import type { SearchParams } from "@/services/searchParams";

export interface CommittedDraft {
  q: string;
}

export interface SearchDraft {
  draftQ: string;
  setDraftQ: (q: string) => void;
  commitDraft: () => CommittedDraft;
}

// Holds the pending Q edit separately from the URL-backed `params` so sibling
// controls (e.g. SortDropdown, Refine) can commit it on navigation. Year range
// lives in the FilterDrawer now and is committed via its own apply path.
export function useSearchDraft(params: SearchParams): SearchDraft {
  const [draftQ, setDraftQ] = useState(params.q);

  useEffect(() => { setDraftQ(params.q); }, [params.q]);

  function commitDraft(): CommittedDraft {
    return { q: draftQ.trim() };
  }

  return { draftQ, setDraftQ, commitDraft };
}
