import { useMemo } from "preact/hooks";
import { useCommunity } from "@/community/CommunityContext";
import {
  extractAbstract,
  extractBibliographic,
  extractLinkedData,
  extractLinkedDataEnhancement,
  extractDoi,
} from "@/services/referenceUtils";
import {
  parseInvestigation,
  extractIsRetracted,
} from "@/services/investigationParser";
import { useReference } from "@/hooks/useReference";
import { useVocabulary } from "@/hooks/useVocabulary";
import { useContextPrefixes } from "@/hooks/useContextPrefixes";
import { InvestigationCard } from "@/components/investigation/InvestigationCard";
import { FindingsSection } from "@/components/investigation/FindingsSection";
import { TaxonomyCodesCard } from "@/components/investigation/TaxonomyCodesCard";
import { groupAppliedConcepts } from "@/services/taxonomyCodesUtils";
import { isFindingRenderable } from "@/services/findingGroups";
import { NotFoundPage } from "./NotFoundPage";
import "./RecordDetailPage.css";

interface RecordDetailPageProps {
  path?: string;
  id?: string;
}

export function RecordDetailPage({ id }: RecordDetailPageProps) {
  const community = useCommunity();

  const { reference, loading: refLoading, error: refError } = useReference(id);
  const bibliographic = reference ? extractBibliographic(reference) : null;
  const linkedData = reference ? extractLinkedData(reference) : null;

  const {
    labels,
    broader,
    definitions,
    inScheme,
    schemes,
    loading: vocabLoading,
    error: vocabError,
  } = useVocabulary(linkedData?.vocabulary_uri);
  const rawContext = linkedData?.data?.["@context"];
  const contextUrl = typeof rawContext === "string" ? rawContext : undefined;
  const {
    context,
    loading: ctxLoading,
    error: ctxError,
  } = useContextPrefixes(contextUrl);

  // Parse with empty-map fallbacks when vocab/context resolution fails so the
  // findings still render (with raw URIs as labels). The vocabUnavailable
  // flag surfaces the degraded state to the user.
  const investigation = useMemo(() => {
    if (!linkedData?.data) return null;
    const prefixes = context?.prefixes ?? new Map<string, string>();
    const ls = labels ?? new Map<string, string>();
    return parseInvestigation(linkedData.data, prefixes, ls);
  }, [linkedData, context, labels]);

  // Applied concepts grouped by scheme for the HPV Taxonomy codes card.
  // Data-gated downstream on length > 0, so ESEA (no applied concepts) is untouched.
  const taxonomyGroups = useMemo(
    () =>
      groupAppliedConcepts(
        investigation?.appliedConcepts ?? [],
        inScheme ?? new Map(),
        schemes ?? [],
        community?.geographicSchemes ?? [],
      ),
    [investigation, inScheme, schemes, community],
  );

  // isRetracted is extracted directly from the data dict so it's available
  // even when vocabulary/context resolution fails
  const isRetracted = linkedData?.data
    ? extractIsRetracted(linkedData.data)
    : false;

  const hasLinkedData = linkedData !== null;
  // Don't read a transient load state as a failure.
  const resolutionSettled = hasLinkedData && !vocabLoading && !ctxLoading;

  // Full-URI concepts (HPV: hpv/Country/KE) resolve from the SKOS vocab alone, so
  // only a vocab fetch failure leaves them unlabelled.
  const vocabUnavailable = resolutionSettled && !!vocabError;

  // CURIE-prefixed concepts (ESEA: esea:C00008) ALSO need the @context to expand
  // the prefix before the vocab can label them, so a context failure breaks them
  // on top of everything vocabUnavailable already covers.
  const curieLabelsUnavailable =
    vocabUnavailable || (resolutionSettled && !!ctxError);

  if (!community) return <NotFoundPage />;

  const loading = refLoading || vocabLoading || ctxLoading;

  if (loading) {
    return (
      <div class="record-detail-page">
        <div class="record-detail-page__container">Loading…</div>
      </div>
    );
  }

  if (refError) {
    return (
      <div class="record-detail-page">
        <div class="record-detail-page__container">
          <p>We couldn't load this reference.</p>
        </div>
      </div>
    );
  }

  if (!reference) return <NotFoundPage />;

  const doi = extractDoi(reference.identifiers);
  const lde = extractLinkedDataEnhancement(reference);
  const codingInstitution = lde
    ? (community.codingInstitution?.fromLinkedData(reference, lde) ?? null)
    : null;
  const abstract = extractAbstract(reference);

  return (
    <div class="record-detail-page">
      <div class="record-detail-page__container">
        <InvestigationCard
          title={bibliographic?.title ?? null}
          authors={bibliographic?.authorship ?? null}
          venue={bibliographic?.publication_venue ?? null}
          pagination={bibliographic?.pagination ?? null}
          doi={doi}
          abstract={abstract}
          publicationYear={bibliographic?.publication_year ?? null}
          documentTypes={investigation?.documentTypes ?? []}
          studyDesigns={investigation?.studyDesigns ?? []}
          codingInstitution={codingInstitution}
          isRetracted={isRetracted}
          hasInvestigation={hasLinkedData}
          vocabUnavailable={curieLabelsUnavailable}
        />
        {taxonomyGroups.length > 0 && (
          <TaxonomyCodesCard
            groups={taxonomyGroups}
            vocabUnavailable={vocabUnavailable}
          />
        )}
        {investigation && investigation.findings.some(isFindingRenderable) && (
          <>
            {curieLabelsUnavailable && (
              <p class="record-detail-page__vocab-banner" role="status">
                Vocabulary unavailable — concept labels couldn't be loaded.
                Findings below show raw concept identifiers in place of readable
                names.
              </p>
            )}
            <FindingsSection
              findings={investigation.findings}
              labels={labels ?? new Map()}
              broader={broader ?? new Map()}
              definitions={definitions ?? new Map()}
              retracted={isRetracted}
            />
          </>
        )}
      </div>
    </div>
  );
}
