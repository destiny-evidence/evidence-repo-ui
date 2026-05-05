export interface ResolvedConcept {
  uri: string;
  label: string | undefined;
}

export interface CodedAnnotation<T> {
  value: T;
  supportingText?: string;
}

export interface StringAnnotation {
  value: string;
  supportingText?: string;
}

export interface NumericAnnotation {
  value: number;
  supportingText?: string;
}

export interface InterventionData {
  id: string;
  name?: string;
  descriptions?: string[];
  educationThemes?: CodedAnnotation<ResolvedConcept>[];
  duration?: NumericAnnotation;
  implementerType?: CodedAnnotation<ResolvedConcept>;
  implementationFidelity?: CodedAnnotation<ResolvedConcept>;
  implementationName?: StringAnnotation;
  implementationDescriptions?: StringAnnotation[];
  funderIntervention?: StringAnnotation;
}

export interface ControlConditionData {
  id: string;
  description?: string;
}

export interface ContextData {
  id: string;
  educationLevels?: CodedAnnotation<ResolvedConcept>[];
  settings?: CodedAnnotation<ResolvedConcept>[];
  countries?: StringAnnotation[];
  countryLevel1?: StringAnnotation;
  participants?: StringAnnotation[];
}

export interface OutcomeData {
  outcomes?: CodedAnnotation<ResolvedConcept>[];
  name?: string;
  description?: string;
}

export interface ArmData {
  id: string;
  conditionRef?: string;
  n?: number;
  mean?: number;
  sd?: number;
  se?: number;
  preMean?: number;
  preSd?: number;
  clusterCount?: number;
  icc?: number;
  events?: number;
}

export interface EffectEstimateData {
  pointEstimate?: number;
  standardError?: number;
  // Decimal in (0, 1], e.g. 0.95 → "95% CI". Don't assume 95% — the data
  // may omit it, in which case the CI text renders without a percentage.
  confidenceLevel?: number;
  ciLower?: number;
  ciUpper?: number;
  effectSizeMetric?: ResolvedConcept;
  // Provenance, e.g. "Computed from summary statistics".
  estimateSource?: ResolvedConcept;
  baselineAdjusted?: boolean;
  // ESEA context types this as xsd:string with values "yes" / "no".
  clusteringAdjusted?: string;
  derivedFromIds?: string[];
}

export interface FindingData {
  intervention: InterventionData | null;
  interventionRef?: string;
  control: ControlConditionData | null;
  controlRef?: string;
  context: ContextData | null;
  contextRef?: string;
  outcome: OutcomeData | null;
  sampleSize?: NumericAnnotation;
  attrition?: NumericAnnotation;
  cost?: StringAnnotation;
  groupDifferences?: StringAnnotation;
  sampleFeatures?: CodedAnnotation<ResolvedConcept>[];
  effectEstimates?: EffectEstimateData[];
  arms?: ArmData[];
}

export interface InvestigationData {
  documentType?: CodedAnnotation<ResolvedConcept>;
  isRetracted: boolean;
  findings: FindingData[];
}
