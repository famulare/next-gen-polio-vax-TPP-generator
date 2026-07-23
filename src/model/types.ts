export const BIN_COUNT = 16;
export const MICROGRAMS_PER_GRAM = 1_000_000;
export const ROUTINE_DAYS = [42, 70, 98] as const;

export type Bins = number[];
export type ProductId = "sabin2" | "ipv" | "hypothetical";
export type SettingId = "houston" | "matlab" | "up-bihar" | "custom";
export type AnchorSettingId = Exclude<SettingId, "custom">;
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
  routineDays: [...typeof ROUTINE_DAYS];
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
  TihMin: number;
  TihMax: number;
  ThsMin: number;
  ThsMax: number;
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
  sourceSnapshot: {
    cessationStability: { commit: string; trackedDirty: false };
    indiaPolio: { commit: string; trackedDirty: false };
  };
  quadrature: {
    nodes: number[];
    weights: number[];
    susceptibilityWithinBinSd: number;
    sheddingWithinBinSd: number;
    bin0WanedCenter: number;
    bin0WanedSd: number;
  };
  validationBounds: {
    hypothetical: {
      alpha: [number, number];
      beta: [number, number];
      dose: [number, number];
      takeContext: [number, number];
      mu0: [number, number];
    };
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
  success: { calibrationLog10Tolerance: number; horizonExtensionRelativeTolerance: number };
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
  nearestGridPoint: DesignGridPoint | null;
  comparators: ComparatorPoint[];
}

export interface ModelOutputsV1 {
  schemaVersion: "ModelOutputsV1";
  scenario: ScenarioV1;
  metrics: PointMetrics;
  settingSurface: SettingResult[];
  frontier: FrontierResult;
  diagnostics: WithinHostDiagnosticsV1;
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

// Light projection shared by the live (uncommitted) and committed render paths.
// It deliberately excludes `frontier`, so the live path cannot render or export
// the expensive decision grid. `diagnostics.modelIdentity` carries the scientific
// identity used to decide whether the committed frontier is stale.
export type TeachingView = Pick<ModelOutputsV1, "scenario" | "metrics" | "settingSurface" | "diagnostics">;

export interface SettingAnchorRecord extends SettingV1 {
  label: string;
  kind: "published" | "hybrid";
  interval?: { low: number; high: number; unit: string };
  tooltip?: string;
}

export interface SettingManifestV2 {
  schemaVersion: "SettingManifestV2";
  version: string;
  anchors: unknown[];
  matlabInterval: { low: number; high: number; unit: "micrograms/day" };
  defaultDecisionScope: { kind: "named_point"; anchorId: AnchorSettingId };
  surfaceDisplayDomain: {
    linkedExposure: true;
    exposure: { count: number; min: number; max: number; scale: "logarithmic"; unit: "micrograms/exposure"; basis: "per_exposure" };
    contacts: { min: number; max: number; step: number };
    dIh: UnitValueV1;
    dHs: UnitValueV1;
  };
}

export interface FrontierGridManifestV2 {
  schemaVersion: "FrontierGridV2";
  version: string;
  takeContext: { count: number; min: number; max: number; scale: "linear" };
  mu0New: { count: number; min: number; max: number; scale: "linear"; unit: string };
  contour: { threshold: number; tieTolerance: number };
  ordering: string;
}

export interface DiagnosticGridV1 {
  schemaVersion: "DiagnosticGridV1";
  version: string;
  challengeDose: { count: number; min: number; max: number; scale: "logarithmic"; unit: "CID50" };
  timeDays: { min: number; max: number; step: number; unit: "days" };
}

export interface DiagnosticAcquisitionPointV1 {
  doseCID50: number;
  probability: number;
}

export interface DiagnosticSheddingPointV1 {
  day: number;
  survivalProbability: number;
  conditionalConcentrationTCID50PerGram: number;
  expectedInfectiousConcentrationTCID50PerGram: number;
}

export interface WithinHostCohortDiagnosticsV1 {
  id: "naive-reference" | "selected-vaccinated";
  label: string;
  immunityBins: number[];
  acquisitionByDose: DiagnosticAcquisitionPointV1[];
  acquisitionAtReference: number;
  sheddingByDay: DiagnosticSheddingPointV1[];
  integratedConditionalBurdenTCID50DaysPerGram: number;
  sheddingIndexAtReferenceTCID50DaysPerGram: number;
}

export interface WithinHostDiagnosticsV1 {
  schemaVersion: "WithinHostDiagnosticsV1";
  gridVersion: string;
  gridSchemaVersion: "DiagnosticGridV1";
  sourceParameterSchemaVersion: "ParameterManifestV1";
  sourceParameterManifestVersion: string;
  modelIdentity: string;
  challengeUnit: "CID50";
  units: {
    challengeDose: "CID50";
    assessmentAge: "days";
    sheddingTime: "days after WPV acquisition";
    concentration: "TCID50/g";
    dailyBurden: "TCID50/g";
    integratedBurden: "TCID50-days/g";
    sheddingIndex: "TCID50-days/g";
  };
  referenceChallengeDoseCID50: number;
  assessmentAgeDays: number;
  acquisitionCondition: "productive WPV acquisition after oral challenge";
  sheddingCondition: "conditioned on WPV acquisition";
  burdenDefinition: "survival probability times concentration conditional on still shedding";
  reference: WithinHostCohortDiagnosticsV1;
  vaccinated: WithinHostCohortDiagnosticsV1;
  qAcq: number;
  qShed: number;
  qIndex: number;
}
