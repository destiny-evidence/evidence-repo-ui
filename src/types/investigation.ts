export interface ResolvedConcept {
  uri: string;
  label: string | undefined;
}

export interface CodedAnnotation<T> {
  value: T;
  supportingText?: string;
}

export interface InterventionData {
  name?: string;
  descriptions: string[];
  educationThemes: CodedAnnotation<ResolvedConcept>[];
  duration?: CodedAnnotation<number>;
}

export interface ControlConditionData {
  descriptions: string[];
}

export interface ContextData {
  educationLevels: CodedAnnotation<ResolvedConcept>[];
  settings: CodedAnnotation<ResolvedConcept>[];
  participants: CodedAnnotation<string>[];
  sampleFeatures: CodedAnnotation<ResolvedConcept>[];
  countries: CodedAnnotation<string>[];
}

export interface OutcomeData {
  name?: string;
  description?: string;
  outcomeConcepts: CodedAnnotation<ResolvedConcept>[];
}

export interface ArmData {
  id: string;
  forCondition: "intervention" | "control";
  n?: number;
  mean?: number;
  sd?: number;
}

export interface EffectEstimateData {
  pointEstimate?: number;
  standardError?: number;
  confidenceIntervalLower?: number;
  confidenceIntervalUpper?: number;
  effectSizeMetric?: string;
  baselineAdjusted?: boolean;
  clusteringAdjusted?: string;
  derivedFromIds: string[];
}

export interface FindingData {
  intervention: InterventionData;
  control: ControlConditionData;
  context: ContextData;
  outcome: OutcomeData;
  sampleSize?: CodedAnnotation<number>;
  armData: ArmData[];
  effectEstimates: EffectEstimateData[];
}

export interface InvestigationData {
  documentType?: CodedAnnotation<ResolvedConcept>;
  isRetracted: boolean;
  findings: FindingData[];
}
