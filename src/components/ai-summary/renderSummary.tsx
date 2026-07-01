import { Fragment } from "preact";
import { useRef } from "preact/hooks";
import { ExternalLinkIcon, WarningIcon } from "@/components/common/icons";
import { Spinner } from "@/components/common/Spinner";
import type { PaperMeta, QuoteRef, SummaryBlock } from "@/services/summariser";
import {
  type ApaReferenceInput,
  formatApaReference,
  compareApaReferences,
} from "@/services/citation/apa";
import type { UseReferenceListExportResult } from "@/hooks/useReferenceListExport";

function citation(papers: PaperMeta[], paperId: string): string {
  const paper = papers.find((p) => p.paper === paperId);
  if (!paper) return paperId;
  const lead = paper.authors[0] ?? paper.title ?? paperId;
  const etAl = paper.authors.length > 1 ? " et al." : "";
  const year = paper.year ? ` (${paper.year})` : "";
  return `${lead}${etAl}${year}`;
}

// A verbatim quote with its provenance, shared by claims and contradictions.
function QuoteSource({ quote, papers }: { quote: QuoteRef; papers: PaperMeta[] }) {
  const paper = papers.find((p) => p.paper === quote.paper);
  return (
    <div class="ai-claim__source">
      <p class="ai-quote">“{quote.quote}”</p>
      <div class="ai-cite">
        <span>{citation(papers, quote.paper)}</span>
        {quote.page != null && <span class="ai-cite__page">p. {quote.page}</span>}
        {paper?.doi && (
          <a
            class="ai-cite__doi"
            href={`https://doi.org/${paper.doi}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            DOI <ExternalLinkIcon size={11} />
          </a>
        )}
      </div>
    </div>
  );
}

// One APA reference, italic runs preserved via the formatter's segments.
function ReferenceEntry({ input }: { input: ApaReferenceInput }) {
  return (
    <p class="ai-reference">
      {formatApaReference(input).map((seg, i) =>
        seg.italic ? <i key={i}>{seg.text}</i> : <Fragment key={i}>{seg.text}</Fragment>,
      )}
    </p>
  );
}

/**
 * APA bibliography for the summary's search, loaded from the backend RIS export
 * (the same source as the results-page reference list). Async: shows a loading
 * line while the export runs, an error line if it fails, then the sorted list.
 */
export function SummaryReferences({
  references,
}: {
  references: UseReferenceListExportResult;
}) {
  const { status, inputs, error } = references;
  if (status === "idle") return null;

  return (
    <section class="ai-references">
      <p class="ai-references__head">References</p>
      {status === "loading" && (
        <p class="ai-references__status">
          <Spinner size={12} /> Loading references…
        </p>
      )}
      {status === "error" && (
        <p class="ai-references__status" role="alert">
          {error ?? "Couldn't load references."}
        </p>
      )}
      {status === "ready" &&
        (inputs.length === 0 ? (
          <p class="ai-references__status">No references found.</p>
        ) : (
          [...inputs]
            .sort(compareApaReferences)
            .map((input, i) => <ReferenceEntry key={i} input={input} />)
        ))}
    </section>
  );
}

interface SummaryBodyProps {
  summary: SummaryBlock;
  papers: PaperMeta[];
}

/**
 * Renders the narrative prose with footnote markers linking to a numbered
 * "Claims & sources" list. Clicking a footnote scrolls to and flashes its claim.
 * Contradictions, when present, follow in a distinct "Where papers disagree"
 * section with their own supporting quotes.
 */
export function SummaryBody({ summary, papers }: SummaryBodyProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  function jumpToClaim(n: number) {
    const el = rootRef.current?.querySelector<HTMLElement>(`#aiClaim-${n}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("is-flash");
    setTimeout(() => el.classList.remove("is-flash"), 1300);
  }

  return (
    <div ref={rootRef}>
      {summary.narrative.map((para, i) => (
        <div key={i} class="ai-narrative">
          {para.header && <p class="ai-narrative__header">{para.header}</p>}
          <p class="ai-prose">
            {para.sentences.map((sentence, j) => (
              <Fragment key={j}>
                {j > 0 ? " " : ""}
                {sentence.text}
                {sentence.claims.map((n) => (
                  <a
                    key={n}
                    class="ai-fn"
                    href="#"
                    aria-label={`Jump to claim ${n}`}
                    onClick={(e) => {
                      e.preventDefault();
                      jumpToClaim(n);
                    }}
                  >
                    {n}
                  </a>
                ))}
              </Fragment>
            ))}
          </p>
        </div>
      ))}

      <p class="ai-claims-head">Claims &amp; sources</p>
      {summary.claims.map((claim, idx) => {
        const n = idx + 1;
        return (
          <div key={n} id={`aiClaim-${n}`} class="ai-claim">
            <div class="ai-claim__num">{n}</div>
            <div class="ai-claim__body">
              {claim.quotes.map((quote, qi) => (
                <QuoteSource key={qi} quote={quote} papers={papers} />
              ))}
            </div>
          </div>
        );
      })}

      {summary.contradictions.length > 0 && (
        <>
          <p class="ai-contradictions-head">Where papers disagree</p>
          {summary.contradictions.map((c, idx) => (
            <div key={idx} class="ai-contradiction">
              <div class="ai-contradiction__marker" aria-hidden="true">
                <WarningIcon size={12} />
              </div>
              <div class="ai-claim__body">
                <p class="ai-contradiction__text">{c.contradiction}</p>
                {c.quotes.map((quote, qi) => (
                  <QuoteSource key={qi} quote={quote} papers={papers} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
