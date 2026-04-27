import { useMemo } from "preact/hooks";
import { findCommunity } from "@/services/communities";
import {
  extractBibliographic,
  extractLinkedData,
  extractDoi,
} from "@/services/referenceUtils";
import {
  parseInvestigation,
  extractIsRetracted,
} from "@/services/investigationParser";
import { useReference } from "@/hooks/useReference";
import { useVocabulary } from "@/hooks/useVocabulary";
import { useContextPrefixes } from "@/hooks/useContextPrefixes";
import { InvestigationCard } from "@/components/InvestigationCard";
import { FindingsSection } from "@/components/FindingsSection";
import { NotFoundPage } from "./NotFoundPage";
import "./RecordDetailPage.css";

interface RecordDetailPageProps {
  path?: string;
  community?: string;
  id?: string;
}

export function RecordDetailPage({ community: slug, id }: RecordDetailPageProps) {
  const community = slug ? findCommunity(slug) : undefined;

  const { reference, loading: refLoading, error: refError } = useReference(id);
  const bibliographic = reference ? extractBibliographic(reference) : null;
  const linkedData = reference ? extractLinkedData(reference) : null;

  const { labels, broader, definitions, loading: vocabLoading, error: vocabError } =
    useVocabulary(linkedData?.vocabulary_uri);
  const rawContext = linkedData?.data?.["@context"];
  const contextUrl = typeof rawContext === "string" ? rawContext : undefined;
  const { context, loading: ctxLoading, error: ctxError } =
    useContextPrefixes(contextUrl);

  const investigation = useMemo(() => {
    if (!linkedData?.data || !context || !labels) return null;
    return parseInvestigation(linkedData.data, context.prefixes, labels);
  }, [linkedData, context, labels]);

  // isRetracted is extracted directly from the data dict so it's available
  // even when vocabulary/context resolution fails
  const isRetracted = linkedData?.data
    ? extractIsRetracted(linkedData.data)
    : false;

  const hasLinkedData = linkedData !== null;
  const vocabUnavailable =
    hasLinkedData && !vocabLoading && !ctxLoading && (vocabError || ctxError);

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

  return (
    <div class="record-detail-page">
      <div class="record-detail-page__container">
        <InvestigationCard
          title={bibliographic?.title ?? null}
          authors={bibliographic?.authorship ?? null}
          venue={bibliographic?.publication_venue ?? null}
          pagination={bibliographic?.pagination ?? null}
          doi={doi}
          publicationYear={bibliographic?.publication_year ?? null}
          documentType={investigation?.documentType}
          isRetracted={isRetracted}
          hasInvestigation={hasLinkedData}
          vocabUnavailable={!!vocabUnavailable}
        />
        {investigation && investigation.findings.length > 0 && (
          <FindingsSection
            findings={investigation.findings}
            labels={labels ?? new Map()}
            broader={broader ?? new Map()}
            definitions={definitions ?? new Map()}
            retracted={isRetracted}
          />
        )}
      </div>
    </div>
  );
}
