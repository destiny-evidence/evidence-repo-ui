import "./InvestigationCard.css";
import { TagGroup } from "./TagGroup";
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
  const names = authors.map((a) => a.display_name).join(", ");
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
}: InvestigationCardProps) {
  const venueText = formatVenue(venue, pagination);

  return (
    <>
      {isRetracted && (
        <div class="retracted-banner" role="alert">
          <svg
            class="retracted-banner__icon"
            viewBox="0 0 20 20"
            fill="currentColor"
            width="16"
            height="16"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clip-rule="evenodd"
            />
          </svg>
          This investigation has been retracted. Results should not be used in
          evidence synthesis.
        </div>
      )}
      <article
        class={`investigation-card${isRetracted ? " investigation-card--retracted" : ""}`}
      >
        <span class="investigation-card__kicker">Investigation</span>
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
          >
            {doi}
            <svg
              class="investigation-card__external-icon"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              width="12"
              height="12"
              aria-hidden="true"
            >
              <path
                d="M3.5 1.5h7v7M10.5 1.5L1.5 10.5"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </a>
        )}
        <hr class="investigation-card__divider" />
        {documentType && (
          <TagGroup
            label="Doc Type"
            tags={[documentType.value.label ?? documentType.value.uri]}
          />
        )}
      </article>
    </>
  );
}
