import { useEffect, useState } from "preact/hooks";
import type { SearchParams } from "@/services/searchParams";
import { parseYear } from "@/utils/year";

export interface CommittedDraft {
  q: string;
  startYear: number | undefined;
  endYear: number | undefined;
}

export interface SearchDraft {
  draftQ: string;
  draftStart: string;
  draftEnd: string;
  setDraftQ: (q: string) => void;
  setDraftStart: (s: string) => void;
  setDraftEnd: (e: string) => void;
  validationError: string | null;
  commitDraft: () => CommittedDraft | null;
}

// Holds pending text/year edits separately from the URL-backed `params` so
// sibling controls (e.g. SortDropdown) can commit them on navigation.
export function useSearchDraft(params: SearchParams): SearchDraft {
  const [draftQ, setDraftQ] = useState(params.q);
  const [draftStart, setDraftStart] = useState(yearToInput(params.startYear));
  const [draftEnd, setDraftEnd] = useState(yearToInput(params.endYear));
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => { setDraftQ(params.q); }, [params.q]);
  useEffect(() => { setDraftStart(yearToInput(params.startYear)); }, [params.startYear]);
  useEffect(() => { setDraftEnd(yearToInput(params.endYear)); }, [params.endYear]);

  function setDraftStartAndClearError(s: string) {
    setDraftStart(s);
    setValidationError(null);
  }

  function setDraftEndAndClearError(e: string) {
    setDraftEnd(e);
    setValidationError(null);
  }

  function commitDraft(): CommittedDraft | null {
    const s = parseYear(draftStart);
    const en = parseYear(draftEnd);
    if (s !== undefined && en !== undefined && s > en) {
      setValidationError("Start year must not exceed end year.");
      return null;
    }
    setValidationError(null);
    return { q: draftQ.trim(), startYear: s, endYear: en };
  }

  return {
    draftQ,
    draftStart,
    draftEnd,
    setDraftQ,
    setDraftStart: setDraftStartAndClearError,
    setDraftEnd: setDraftEndAndClearError,
    validationError,
    commitDraft,
  };
}

function yearToInput(year: number | undefined): string {
  return year !== undefined ? String(year) : "";
}
