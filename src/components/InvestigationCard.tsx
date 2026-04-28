import "./InvestigationCard.css";
import { TagGroup } from "./TagGroup";
import { WarningIcon, ExternalLinkIcon } from "./icons";
import type { Authorship, Pagination, PublicationVenue } from "@/types/models";
import type { CodedAnnotation, ResolvedConcept } from "@/types/investigation";

interface InvestigationCardProps {
  title: string | null;
  authors: Authorship[] | null;
  venue: PublicationVenue | null;
  pagination: Pagination | null;
  doi: string | null;
  publicationYear: number | null;
  documentType?: CodedAnnotation<ResolvedConcept>;
  isRetracted: boolean;
  hasInvestigation: boolean;
  vocabUnavailable: boolean;
}

function formatVenue(
  venue: PublicationVenue | null,
  pagination: Pagination | null,
): string | null {
  const parts: string[] = [];
  if (venue?.display_name) parts.push(venue.display_name);
  if (pagination?.volume) {
    let vol = pagination.volume;
    if (pagination.issue) vol += `(${pagination.issue})`;
    parts.push(vol);
  }
  if (pagination?.first_page) {
    const pages = pagination.last_page
      ? `${pagination.first_page}–${pagination.last_page}`
      : pagination.first_page;
    parts.push(pages);
  }
  return parts.length > 0 ? parts.join(", ") : null;
}

function formatAuthors(
  authors: Authorship[],
  year: number | null,
): string {
  const MAX_AUTHORS = 5;
  const truncated = authors.length > MAX_AUTHORS
    ? [...authors.slice(0, MAX_AUTHORS).map((a) => a.display_name), "et al."]
    : authors.map((a) => a.display_name);
  const names = truncated.join(", ");
  return year ? `${names} (${year})` : names;
}

export function InvestigationCard({
  title,
  authors,
  venue,
  pagination,
  doi,
  publicationYear,
  documentType,
  isRetracted,
  hasInvestigation,
  vocabUnavailable,
}: InvestigationCardProps) {
  const venueText = formatVenue(venue, pagination);
  const hasInvestigationContent = documentType || vocabUnavailable;

  return (
    <>
      {isRetracted && (
        <div class="retracted-banner" role="alert">
          <span class="retracted-banner__icon">
            <WarningIcon />
          </span>
          This investigation has been retracted. Results should not be used in
          evidence synthesis.
        </div>
      )}
      <article
        class={`investigation-card${isRetracted ? " investigation-card--retracted" : ""}`}
      >
        {hasInvestigation && (
          <span class="investigation-card__kicker">Investigation</span>
        )}
        {title && <h1 class="investigation-card__title">{title}</h1>}
        {authors && authors.length > 0 && (
          <p class="investigation-card__authors">{formatAuthors(authors, publicationYear)}</p>
        )}
        {venueText && (
          <p class="investigation-card__venue">{venueText}</p>
        )}
        {doi && (
          <a
            class="investigation-card__doi"
            href={`https://doi.org/${doi}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`DOI: ${doi} (opens in new tab)`}
          >
            <span class="investigation-card__doi-prefix" aria-hidden="true">doi:</span>
            <span class="investigation-card__doi-value">{doi}</span>
            <span class="investigation-card__external-icon">
              <ExternalLinkIcon />
            </span>
          </a>
        )}
        {hasInvestigationContent && (
          <>
            <hr class="investigation-card__divider" />
            {vocabUnavailable && (
              <p class="investigation-card__vocab-error">
                Vocabulary unavailable — some labels could not be resolved.
              </p>
            )}
            {documentType && (
              <TagGroup
                label="Doc Type"
                tags={[documentType.value.label ?? documentType.value.uri]}
              />
            )}
          </>
        )}
      </article>
    </>
  );
}
