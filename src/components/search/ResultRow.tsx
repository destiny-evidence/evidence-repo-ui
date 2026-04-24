import type { Reference } from "@/types/models";
import { extractBibliographic, extractDoi } from "@/services/referenceUtils";
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
  const year = bib?.publication_year !== null && bib?.publication_year !== undefined
    ? String(bib.publication_year)
    : "";

  // Primary content (title, meta, abstract) wraps in one anchor via the
  // stretched-link CSS pattern, so clicking anywhere in that content area
  // routes to the detail page. DOI and stats are sibling elements with
  // raised z-index, staying independently interactive. Nested interactive
  // HTML is avoided (the DOI <a> never lives inside the row <a>).
  return (
    <article class="result-row">
      <a
        class="result-row__link"
        href={`/${communitySlug}/references/${reference.id}`}
        aria-label={title}
      >
        <span class="result-row__title">{title}</span>
        <span class="result-row__meta">
          {authors && <span class="result-row__authors">{authors}</span>}
          {(authors && (venue || year)) && <span class="result-row__sep"> · </span>}
          {venue && <span class="result-row__venue">{venue}</span>}
          {venue && year && <span class="result-row__sep"> · </span>}
          {year && <span class="result-row__year">{year}</span>}
        </span>
        {abstract && <span class="result-row__abstract">{abstract}</span>}
      </a>
      {doi && (
        <a
          class="result-row__doi"
          href={`https://doi.org/${doi}`}
          aria-label={`DOI: ${doi}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          DOI
        </a>
      )}
      <div class="result-row__stats">—</div>
    </article>
  );
}
