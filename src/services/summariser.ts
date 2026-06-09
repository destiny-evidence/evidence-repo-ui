/**
 * Types for the evidence-summariser service's summary payload.
 *
 * These mirror the `SummariseResponse` shape published by the summariser's
 * FastAPI surface (see futureevidence/ai-evidence-summariser `http/models.py`),
 * so the UI can render against the real response once the service is wired in.
 */

export interface TermInfo {
  name: string;
  description?: string | null;
}

/** A verbatim quote backing a claim, with provenance. */
export interface QuoteRef {
  quote: string;
  /** Identifies the source paper; joins to `PaperMeta.paper`. */
  paper: string;
  page?: number | null;
  /** 1-based indices into the run's `terms` list. */
  terms: number[];
}

export interface Claim {
  claim: string;
  quotes: QuoteRef[];
}

export interface Contradiction {
  contradiction: string;
  quotes: QuoteRef[];
}

export interface NarrativeSentence {
  text: string;
  /** 1-based indices into `SummaryBlock.claims` this sentence draws from. */
  claims: number[];
}

export interface NarrativeParagraph {
  header: string;
  sentences: NarrativeSentence[];
}

export interface SummaryBlock {
  claims: Claim[];
  contradictions: Contradiction[];
  narrative: NarrativeParagraph[];
}

/** Provenance read off the source paper; `paper` is the join key for quotes. */
export interface PaperMeta {
  paper: string;
  title?: string | null;
  authors: string[];
  affiliations: string[];
  journal?: string | null;
  publisher?: string | null;
  doi?: string | null;
  year?: number | null;
}

export interface ExtractionError {
  paper: string;
  error: string;
}

export interface SummariseResponse {
  kind: "summary";
  summary: SummaryBlock;
  papers: PaperMeta[];
  extraction_errors: ExtractionError[];
  terms: TermInfo[];
}

export interface SummaryRequest {
  /** Intersecting terms the summary is framed against. */
  terms: TermInfo[];
  /** Repository reference ids whose full texts feed the summary. */
  referenceIds: string[];
}
