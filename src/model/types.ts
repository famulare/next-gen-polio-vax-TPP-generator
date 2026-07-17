export const BIN_COUNT = 16;
export const MICROGRAMS_PER_GRAM = 1_000_000;

export type Bins = number[];
export type ProductId = "sabin2" | "ipv" | "hypothetical";
export type SettingId = "low" | "houston" | "matlab" | "up-bihar" | "global" | "custom";
export type AnchorSettingId = Exclude<SettingId, "global" | "custom">;
export type SuccessRule = "point";

export interface UnitValueV1 {
  value: number;
  unit: string;
  basis: "per_exposure" | "per_day";
}

export interface VaccineV1 {
  id: ProductId;
  label: string;
  live: boolean;
  alpha: number;
  beta: number;
  dose: number;
  takeContext: number;
  formulationMultiplier: number;
  mu0: number;
  sigma0: number;
  gamma: number;
}

export interface ScheduleV1 {
  routineDays: [42, 70, 98];
  boosterAgeYears: 0 | 1 | 2 | 3 | 4;
  assessmentLagDays: 28 | 90;
  productId: ProductId;
}

export interface SettingV1 {
  id: SettingId;
  Tih: UnitValueV1;
  Ths: UnitValueV1;
  dIh: UnitValueV1;
  dHs: UnitValueV1;
  Ns: number;
}

export interface EnvelopeV1 {
  linkedExposure: boolean;
  TMin: number;
  TMax: number;
  NsMin: number;
  NsMax: number;
  dIhMin: number;
  dIhMax: number;
  dHsMin: number;
  dHsMax: number;
}

export interface ScenarioV1 {
  schemaVersion: "ScenarioV1";
  targetId: "WPV1";
  comparatorId: ProductId;
  vaccine: VaccineV1;
  schedule: ScheduleV1;
  setting: SettingV1;
  envelope: EnvelopeV1;
  successRule: SuccessRule;
  indexReferenceExposure: number;
  horizonDays: number;
  parameterManifestVersion: string;
  settingManifestVersion: string;
  frontierGridVersion: string;
  uncertaintyEnsembleVersion: string;
}

export interface ParameterManifestV1 {
  schemaVersion: "ParameterManifestV1";
  manifestVersion: string;
  designContractVersion: string;
  quadrature: {
    nodes: number[];
    weights: number[];
    susceptibilityWithinBinSd: number;
    sheddingWithinBinSd: number;
    bin0WanedCenter: number;
    bin0WanedSd: number;
  };
  numerics: {
    sourceLowDoseLinearRatio: number;
  };
  immunity: { bins: number; maxLog2: number; waningLambda: number };
  wpv1: {
    alpha: number;
    beta: number;
    gamma: number;
    sheddingDuration: { b1: number; b2: number; b3: number };
    boost: { mu0: number; sigma0: number };
  };
  vaccineDefaults: Record<ProductId, { alpha: number; beta: number; dose: number; takeContext: number; mu0: number; sigma0: number }> & { gamma: number; formulationMultiplier: number };
  boosts: { sabin: { mu0: number; sigma0: number }; wpv: { mu0: number; sigma0: number } };
  shedding: {
    age: { aMax: number; aMin: number; tauMonths: number; legacyPlateauUntilMonths: number };
    immunitySuppression: number;
    temporal: { mu: number; sigma: number; kappa: number };
    titerFloor: number;
  };
  transmission: { horizonDays: number; indexReferenceExposure: string; dIh: number; dHs: number };
  success: { tieTolerance: number; calibrationLog10Tolerance: number };
}

export interface ImmuneGroup {
  mass: number;
  everInfected: boolean;
  mucosal: Bins;
  serum: Bins;
}

export interface ImmuneState {
  groups: ImmuneGroup[];
  assessmentAgeDays: number;
  lastDoseDay: number;
  events: number[];
}

export interface SourceCohort {
  infectionDay: number;
  sourceBin: number;
  mass: number;
}

export interface IncidenceCohort extends SourceCohort {
  recipientEverInfected: true;
}

export interface SettingResult {
  Tih: number;
  Ths: number;
  dIh: number;
  dHs: number;
  Ns: number;
  rLoc: number;
}

export interface PointMetrics {
  qAcq: number;
  qShed: number;
  qIndex: number;
  rLocSelectedSetting: number | null;
  rLocEnvelopeMax: number;
  rLocAnchors: Record<AnchorSettingId, number>;
  naiveRLocEnvelopeMax: number;
  effectiveFirstDoseTake: number;
  assessmentAgeDays: number;
  assessmentLagDays: number;
  indexReferenceExposure: number;
}

export interface DesignGridPoint {
  takeContext: number;
  mu0: number;
  qAcq: number;
  qShed: number;
  rLocEnvelopeMax: number;
  passes: boolean;
}

export interface ComparatorPoint {
  productId: Exclude<ProductId, "hypothetical">;
  label: string;
  takeContext: number | null;
  mu0: number | null;
  qAcq: number;
  qShed: number;
  rLocEnvelopeMax: number;
  passes: boolean;
  selected: boolean;
}

export interface FrontierResult {
  familyProductId: "hypothetical";
  takeValues: number[];
  mu0Values: number[];
  points: DesignGridPoint[];
  pareto: DesignGridPoint[];
  selectedDesign: DesignGridPoint | null;
  comparators: ComparatorPoint[];
}

export interface ModelOutputsV1 {
  schemaVersion: "ModelOutputsV1";
  scenario: ScenarioV1;
  metrics: PointMetrics;
  settingSurface: SettingResult[];
  frontier: FrontierResult;
  uncertainty: {
    available: false;
    label: "parameter-uncertainty interval is out of scope for this iteration";
    reason: string;
    rLocMax: null;
  };
  assumptions: string[];
  modelIdentity: string;
  provenance: unknown;
}

export interface SettingAnchorRecord extends SettingV1 {
  label: string;
  kind: "published" | "hybrid";
  interval?: { low: number; high: number; unit: string };
  tooltip?: string;
}

export interface FrontierGridManifestV1 {
  schemaVersion: "FrontierGridV1";
  version: string;
  takeContext: { count: number; min: number; max: number; scale: "linear" };
  mu0New: { count: number; min: number; max: number; scale: "linear"; unit: string };
  settingExposure: { count: number; scale: "logarithmic" };
  settingContacts: { min: number; max: number; step: number };
  contour: { threshold: number; tieTolerance: number };
  ordering: string;
}
