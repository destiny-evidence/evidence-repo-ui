export interface CommunityFeatures {
  // No UI yet; reserved so the evidence map can ship behind a flag (#103).
  evidenceMap: boolean;
}

// One axis of the evidence map.
export type EvidenceMapAxis =
  | { kind: "scheme"; schemeUri: string }
  | { kind: "countries" };

// A community's evidence-map axis pair: `row` is the y-axis, `column` the x-axis.
export interface EvidenceMapAxes {
  row: EvidenceMapAxis;
  column: EvidenceMapAxis;
}

// See buildCopy() in services/communities.ts for the shared fallbacks.
export interface CommunityCopy {
  searchPlaceholder: string;
  drawerTitle: string;
  // Plural noun for a count of evidence items: "investigations" / "references".
  countNoun: string;
  // Completes "{N} {countNoun} across {corpusDescriptor}", e.g. "education research".
  corpusDescriptor: string;
}

// Two entry points because the coder is read from different shapes: result rows
// carry the raw enhancement inline; the detail page and export resolve it via a
// linked-data enhancement's derived_from chain. See rawSourcePatterns().
export interface CodingInstitutionConfig {
  fromReference(reference: Reference): string | null;
  fromLinkedData(reference: Reference, lde: Enhancement): string | null;
}

export interface ExternalResource {
  title: string;
  description: string;
  href: string;
}

export interface Community {
  slug: string;
  name: string;
  defaultAnnotations: string[];
  vocabularyUrl: string;
  contextUrl: string;
  filterExcludedSchemes: string[];
  features: CommunityFeatures;
  // Default evidence-map axes; absent ⇒ the map shows a "not configured" notice
  // even where features.evidenceMap is on (e.g. before a vocabulary is published).
  defaultEvidenceMapAxes?: EvidenceMapAxes;
  copy: CommunityCopy;
  // Absent ⇒ no coder concept; the "Coded by" pill and export source are hidden.
  codingInstitution?: CodingInstitutionConfig;
  externalResources?: ExternalResource[];
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

export interface ConceptFacetCount {
  concept: string;
  count: number;
}

export interface CountryFacetCount {
  country: string;
  count: number;
}

export interface ReferenceFacetResult {
  concepts?: ConceptFacetCount[];
  countries?: CountryFacetCount[];
}

export interface CrossFacetCell {
  axes: [string, string];
  count: number;
}

export interface ReferenceCrossFacetResult {
  total: SearchResultTotal;
  cells: CrossFacetCell[];
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

export type SearchExportStatus = "pending" | "running" | "completed" | "failed";

export interface SearchExportRead {
  id: string;
  status: SearchExportStatus;
  result_url?: string | null;
  n_references?: number | null;
  truncated: boolean;
  error?: string | null;
}
