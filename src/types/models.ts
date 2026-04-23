export interface Community {
  slug: string;
  name: string;
}

export type Visibility = "public" | "restricted" | "hidden";

export interface SearchResultTotal {
  count: number;
  is_lower_bound: boolean;
}

export interface SearchResultPage {
  count: number;
  number: number;
}

export interface SearchResult {
  total: SearchResultTotal;
  page: SearchResultPage;
  references: Reference[];
}

export interface ExternalIdentifier {
  identifier: string | number;
  identifier_type: string | null;
  other_identifier_name?: string | null;
}

export type EnhancementType =
  | "bibliographic"
  | "abstract"
  | "annotation"
  | "location"
  | "reference_association"
  | "linked_data"
  | "raw"
  | "full_text";

export type AuthorPosition = "first" | "middle" | "last";

export interface Authorship {
  display_name: string;
  orcid: string | null;
  position: AuthorPosition;
}

export interface Pagination {
  volume: string | null;
  issue: string | null;
  first_page: string | null;
  last_page: string | null;
}

export type PublicationVenueType =
  | "journal"
  | "repository"
  | "conference"
  | "ebook_platform"
  | "book_series"
  | "other";

export interface PublicationVenue {
  display_name: string | null;
  venue_type: PublicationVenueType | null;
}

export interface BibliographicMetadataEnhancement {
  enhancement_type: "bibliographic";
  authorship: Authorship[] | null;
  cited_by_count: number | null;
  created_date: string | null;
  updated_date: string | null;
  publication_date: string | null;
  publication_year: number | null;
  publisher: string | null;
  title: string | null;
  pagination: Pagination | null;
  publication_venue: PublicationVenue | null;
}

export interface AbstractContentEnhancement {
  enhancement_type: "abstract";
  process: string;
  abstract: string;
}

export interface LinkedDataEnhancement {
  enhancement_type: "linked_data";
  vocabulary_uri: string;
  data: Record<string, unknown>;
}

export interface OtherEnhancement {
  enhancement_type: Exclude<
    EnhancementType,
    "bibliographic" | "abstract" | "linked_data"
  >;
  [key: string]: unknown;
}

export type EnhancementContent =
  | BibliographicMetadataEnhancement
  | AbstractContentEnhancement
  | LinkedDataEnhancement
  | OtherEnhancement;

export interface Enhancement {
  id: string | null;
  reference_id: string;
  source: string;
  visibility: Visibility;
  robot_version: string | null;
  derived_from: string[] | null;
  created_at: string | null;
  content: EnhancementContent;
}

export interface Reference {
  id: string;
  visibility: Visibility;
  identifiers: ExternalIdentifier[] | null;
  enhancements: Enhancement[] | null;
}
