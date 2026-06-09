import { Fragment } from "preact";
import { useRef } from "preact/hooks";
import type { PaperMeta, SummaryBlock } from "@/services/summariser";

const EXT_ICON = (
  <svg
    width="11"
    height="11"
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M4 2H2v8h8V8" />
    <path d="M7 2h3v3" />
    <path d="M10 2 6 6" />
  </svg>
);

function citation(papers: PaperMeta[], paperId: string): string {
  const paper = papers.find((p) => p.paper === paperId);
  if (!paper) return paperId;
  const lead = paper.authors[0] ?? paper.title ?? paperId;
  const etAl = paper.authors.length > 1 ? " et al." : "";
  const year = paper.year ? ` (${paper.year})` : "";
  return `${lead}${etAl}${year}`;
}

interface SummaryBodyProps {
  summary: SummaryBlock;
  papers: PaperMeta[];
}

/**
 * Renders the narrative prose with footnote markers linking to a numbered
 * "Claims & sources" list. Clicking a footnote scrolls to and flashes its claim.
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
              {claim.quotes.map((quote, qi) => {
                const paper = papers.find((p) => p.paper === quote.paper);
                return (
                  <div key={qi} class="ai-claim__source">
                    <p class="ai-quote">“{quote.quote}”</p>
                    <div class="ai-cite">
                      <span>{citation(papers, quote.paper)}</span>
                      {paper?.doi && (
                        <a
                          class="ai-cite__doi"
                          href={`https://doi.org/${paper.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          DOI {EXT_ICON}
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
