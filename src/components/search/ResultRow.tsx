import { useMemo } from "preact/hooks";
import type { Reference } from "@/types/models";
import type {
  CodedAnnotation,
  InvestigationData,
  ResolvedConcept,
} from "@/types/investigation";
import {
  extractBibliographic,
  extractDoi,
  extractFindingsAndEstimatesCount,
  extractLinkedData,
  formatPagination,
} from "@/services/referenceUtils";
import { extractReferenceCodingInstitution } from "@/services/codingInstitution";
import { parseInvestigation } from "@/services/investigationParser";
import { conceptsToTags } from "@/services/conceptLabels";
import { useVocabulary } from "@/hooks/useVocabulary";
import { useContextPrefixes } from "@/hooks/useContextPrefixes";
import { TagGroup } from "@/components/TagGroup";
import "./ResultRow.css";

interface ResultRowProps {
  communitySlug: string;
  reference: Reference;
}

const MAX_AUTHORS_SHOWN = 3;
const PILL_CAP = 8;

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

// Document type first, then per-finding context/intervention/outcome concepts
// and sample features. De-duped by URI; insertion order preserved so the
// document type pill leads.
function aggregatePillConcepts(
  inv: InvestigationData,
): CodedAnnotation<ResolvedConcept>[] {
  const seen = new Set<string>();
  const out: CodedAnnotation<ResolvedConcept>[] = [];
  const add = (a: CodedAnnotation<ResolvedConcept>) => {
    const uri = a.value.uri;
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      out.push(a);
    }
  };
  const addAll = (xs?: CodedAnnotation<ResolvedConcept>[]) => xs?.forEach(add);

  if (inv.documentType) add(inv.documentType);
  for (const f of inv.findings) {
    addAll(f.context?.educationLevels);
    addAll(f.context?.settings);
    addAll(f.intervention?.educationThemes);
    addAll(f.outcome?.outcomes);
    addAll(f.sampleFeatures);
  }
  return out;
}

export function ResultRow({ communitySlug, reference }: ResultRowProps) {
  const bib = extractBibliographic(reference);
  const doi = extractDoi(reference.identifiers);
  const abstract = findAbstract(reference);
  const counts = extractFindingsAndEstimatesCount(reference);

  const linkedData = extractLinkedData(reference);
  const rawContext = linkedData?.data?.["@context"];
  const contextUrl = typeof rawContext === "string" ? rawContext : undefined;

  const { labels, definitions } = useVocabulary(linkedData?.vocabulary_uri);
  const { context } = useContextPrefixes(contextUrl);

  const pillTags = useMemo(() => {
    if (!linkedData?.data || !labels || !context) return null;
    const investigation = parseInvestigation(
      linkedData.data,
      context.prefixes,
      labels,
    );
    const concepts = aggregatePillConcepts(investigation);
    // Search rows render flat pills (no parent breadcrumb) per the prototype,
    // so we pass an empty `broader` map. Definitions still drive the tooltip.
    return conceptsToTags(
      concepts,
      labels,
      new Map(),
      definitions ?? new Map(),
    );
  }, [linkedData, labels, definitions, context]);

  const title = bib?.title ?? reference.id;
  const authors = bib?.authorship ? formatAuthors(bib.authorship) : "";
  const venue = bib?.publication_venue?.display_name ?? "";
  const pagination = formatPagination(bib?.pagination ?? null);
  const year = bib?.publication_year !== null && bib?.publication_year !== undefined
    ? String(bib.publication_year)
    : "";
  const codingInstitution = extractReferenceCodingInstitution(reference);

  const findingsLabel = counts ? String(counts.findings) : "—";
  const estimatesLabel = counts ? String(counts.estimates) : "—";

  const visibleTags = pillTags ? pillTags.slice(0, PILL_CAP) : [];
  const overflow = pillTags ? pillTags.length - visibleTags.length : 0;

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
          <span class="stat-num">{findingsLabel}</span> findings
        </span>
        <span class="stat-badge">
          <span class="stat-num">{estimatesLabel}</span> estimates
        </span>
        {codingInstitution && (
          <span class="row-coder" data-testid="coder-text">
            {codingInstitution}
          </span>
        )}
      </div>
      {pillTags && pillTags.length > 0 && (
        <div class="row-pills">
          <TagGroup tags={visibleTags} />
          {overflow > 0 && (
            <span class="tag-group__tag tag-group__tag--more">
              +{overflow} more
            </span>
          )}
        </div>
      )}
    </article>
  );
}
