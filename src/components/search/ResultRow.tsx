import type { Reference } from "@/types/models";
import { extractBibliographic, extractDoi, formatPagination } from "@/services/referenceUtils";
import { extractReferenceCodingInstitution } from "@/services/codingInstitution";
import "./ResultRow.css";

interface ResultRowProps {
  communitySlug: string;
  reference: Reference;
}

const MAX_AUTHORS_SHOWN = 3;

function formatAuthors(authors: { display_name: string }[]): string {
  if (authors.length === 0) return "";
  if (authors.length <= MAX_AUTHORS_SHOWN) {
    return authors.map((a) => a.display_name).join(", ");
  }
  const head = authors.slice(0, MAX_AUTHORS_SHOWN).map((a) => a.display_name).join(", ");
  return `${head}, +${authors.length - MAX_AUTHORS_SHOWN} more`;
}

function findAbstract(reference: Reference): string | null {
  const abs = reference.enhancements?.find(
    (e) => e.content.enhancement_type === "abstract",
  );
  return abs && abs.content.enhancement_type === "abstract" ? abs.content.abstract : null;
}

export function ResultRow({ communitySlug, reference }: ResultRowProps) {
  const bib = extractBibliographic(reference);
  const doi = extractDoi(reference.identifiers);
  const abstract = findAbstract(reference);

  const title = bib?.title ?? reference.id;
  const authors = bib?.authorship ? formatAuthors(bib.authorship) : "";
  const venue = bib?.publication_venue?.display_name ?? "";
  const pagination = formatPagination(bib?.pagination ?? null);
  const year = bib?.publication_year !== null && bib?.publication_year !== undefined
    ? String(bib.publication_year)
    : "";
  const codingInstitution = extractReferenceCodingInstitution(reference);

  // Stretched-link pattern: the .row-link <a> wraps left-column content, and
  // its ::before extends a transparent overlay across the whole .result-row
  // (the positioned ancestor). Sibling DOI link uses z-index: 2 to stay
  // clickable above the overlay; .row-right and stat-badges deliberately
  // stay un-positioned so their clicks fall through to the row link.
  return (
    <article class="result-row">
      <a
        class="row-link"
        href={`/${communitySlug}/references/${reference.id}`}
        aria-label={title}
      >
        <div class="row-title">
          {title}
          {year && <span class="year"> ({year})</span>}
        </div>
        {authors && <div class="row-authors">{authors}</div>}
        {(venue || pagination) && (
          <div class="row-venue">
            {venue}
            {venue && pagination ? ", " : ""}
            {pagination}
          </div>
        )}
        {abstract && <div class="row-abstract">{abstract}</div>}
      </a>
      <div class="row-right">
        {doi && (
          <a
            class="doi-link"
            href={`https://doi.org/${doi}`}
            aria-label={`DOI: ${doi}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            DOI ↗
          </a>
        )}
        <span class="stat-badge">
          <span class="stat-num">—</span> findings
        </span>
        <span class="stat-badge">
          <span class="stat-num">—</span> estimates
        </span>
        {codingInstitution && (
          <span class="row-coder" data-testid="coder-text">
            {codingInstitution}
          </span>
        )}
      </div>
    </article>
  );
}
