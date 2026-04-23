export interface ResolvedConcept {
  uri: string;
  label: string | undefined;
}

export interface CodedAnnotation<T> {
  value: T;
  supportingText?: string;
}

export interface InvestigationData {
  documentType?: CodedAnnotation<ResolvedConcept>;
  isRetracted: boolean;
}
