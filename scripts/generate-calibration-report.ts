import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  gaussianCalibrationStateForMean,
  deriveCalibrationVarianceConstraint,
  evaluatePrevalenceMotif,
  type PrevalenceMotifOutput,
  type VarianceConstraint
} from "../src/model/calibration";
import { DEFAULTS, ENVELOPE, PARAMETERS, vaccineDefaults } from "../src/model/parameters";
import { initialImmuneState } from "../src/model/schedule";
import type { ImmuneState, SettingV1 } from "../src/model/types";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const fixturePath = resolve(projectRoot, "reference/fixtures/cessation-calibration-prevalence-v1.json");
const reportPath = resolve(projectRoot, "reference/fixtures/calibration-report-v1.json");
const manifestPath = resolve(projectRoot, "reference/fixtures/manifest-v1.json");
const FIT_GRID_STEP_LOG2 = 0.01;
const FIT_LOG10_TIH_STEP = 0.01;
const INDIA_JOINT_COARSE_MEAN_STEP_LOG2 = 0.25;
const INDIA_JOINT_COARSE_TIH_STEP_LOG10 = 0.05;
const INDIA_JOINT_REFINE_MEAN_STEP_LOG2 = 0.01;
const INDIA_JOINT_REFINE_TIH_STEP_LOG10 = 0.01;
const INDIA_JOINT_REFINE_MEAN_HALF_WIDTH_LOG2 = 0.5;
const INDIA_JOINT_REFINE_TIH_HALF_WIDTH_LOG10 = 0.1;
const INDIA_JOINT_NEAR_OPTIMAL_RMSE_DELTA_LOG10 = 0.005;
const ZERO_PREVALENCE_EPSILON = 1e-12;

type Role = "primary" | "secondary" | "tertiary";
type StateKind = "naive" | "campaign-history-gaussian" | "schedule-calibrated-gaussian";

interface SourceOutput {
  conditionedPrimaryPrevalence: number[];
  conditionedSecondaryPrevalence: number[];
  conditionedTertiaryPrevalence: number[];
  rLoc: number;
}

interface BrowserStateMapping {
  indexState: StateKind;
  indexScheduleDoseDays: number[];
  indexAssessmentAgeDays: number;
  indexMeanLog2NAb: number;
  fitIndexMeanLog2NAb: boolean;
  householdState: StateKind;
  socialState: StateKind;
  contactMeanLog2NAb: number;
  fitTih: boolean;
  fitContactMeanLog2NAb: boolean;
}

interface SourceCalibrationCase {
  id: string;
  label: string;
  targetRoles: Role[];
  horizonDays: number;
  TihGramsPerExposure: number;
  ThsGramsPerExposure: number;
  dIhExposuresPerPersonDay: number;
  dHsExposuresPerPersonDay: number;
  Ns: number;
  primaryAgeMonths: number;
  secondaryAgeMonths: number;
  tertiaryAgeMonths: number;
  browserStateMapping: BrowserStateMapping;
  output: SourceOutput;
}

interface SourceFixture {
  schemaVersion: "SourcePrevalenceCalibrationFixtureV1";
  source: { repository: string; commit: string; runtime: string };
  dayConvention: { sourceOutputDays: number[]; browserElapsedDays: number[]; meaning: string };
  cases: SourceCalibrationCase[];
}

interface RoleDiagnostics {
  role: Role;
  sourceZeroDays: number[];
  modernNonzeroOnSourceZeroDays: number[];
  profileLog10Rmse: number;
  sourceAuc: number;
  modernAuc: number;
  aucLog10Difference: number;
  positiveDays: number;
  passes: boolean;
}

interface EvaluatedCase {
  output: PrevalenceMotifOutput;
  diagnostics: RoleDiagnostics[];
  objectiveMeanSquaredLog10: number;
}

interface JointContactTihFit {
  contactMeanLog2NAb: number;
  tihGramsPerExposure: number;
  evaluated: EvaluatedCase;
  diagnostics: {
    objective: "secondary profile log10 RMSE";
    coarseGrid: {
      meanStepLog2: number;
      tihStepLog10: number;
      candidateCount: number;
      profileByContactMean: Array<{ contactMeanLog2NAb: number; bestTihGramsPerExposure: number; profileLog10Rmse: number }>;
      best: { contactMeanLog2NAb: number; tihGramsPerExposure: number; profileLog10Rmse: number };
    };
    refinementGrid: {
      meanStepLog2: number;
      tihStepLog10: number;
      meanRangeLog2NAb: [number, number];
      log10TihRange: [number, number];
      candidateCount: number;
      nearOptimalRmseDeltaLog10: number;
      nearOptimalCandidateCount: number;
      nearOptimalMeanRangeLog2NAb: [number, number];
      nearOptimalTihRangeGramsPerExposure: [number, number];
    };
  };
}

function sourceProfile(source: SourceOutput, role: Role): number[] {
  if (role === "primary") return source.conditionedPrimaryPrevalence;
  if (role === "secondary") return source.conditionedSecondaryPrevalence;
  return source.conditionedTertiaryPrevalence;
}

function modernProfile(output: PrevalenceMotifOutput, role: Role): number[] {
  return output[`${role}Prevalence`];
}

function settingForCase(sourceCase: SourceCalibrationCase, tihGramsPerExposure: number): SettingV1 {
  return {
    id: "custom",
    Tih: { value: tihGramsPerExposure, unit: "grams/exposure", basis: "per_exposure" },
    Ths: { value: sourceCase.ThsGramsPerExposure, unit: "grams/exposure", basis: "per_exposure" },
    dIh: { value: sourceCase.dIhExposuresPerPersonDay, unit: "exposures/person/day", basis: "per_day" },
    dHs: { value: sourceCase.dHsExposuresPerPersonDay, unit: "exposures/person/day", basis: "per_day" },
    Ns: sourceCase.Ns
  };
}

function indexState(mapping: BrowserStateMapping, meanLog2NAb: number | null, constraint: VarianceConstraint): ImmuneState {
  if (mapping.indexState === "naive") return initialImmuneState();
  if (mapping.indexState === "schedule-calibrated-gaussian") {
    if (meanLog2NAb === null) throw new Error("Schedule-calibrated index state requires a mean");
    return gaussianCalibrationStateForMean(meanLog2NAb, constraint);
  }
  throw new Error(`Unsupported calibration index state: ${mapping.indexState}`);
}

function contactState(kind: StateKind, meanLog2NAb: number, constraint: VarianceConstraint): ImmuneState {
  if (kind === "naive") return initialImmuneState();
  if (kind === "campaign-history-gaussian") {
    return gaussianCalibrationStateForMean(meanLog2NAb, constraint);
  }
  throw new Error(`Unsupported calibration contact state: ${kind}`);
}

function diagnoseRole(role: Role, expected: readonly number[], observed: readonly number[], tolerance: number): RoleDiagnostics {
  if (expected.length !== observed.length) throw new Error(`${role} prevalence length mismatch`);
  const sourceZeroDays: number[] = [];
  const modernNonzeroOnSourceZeroDays: number[] = [];
  let squaredError = 0;
  let positiveDays = 0;
  let sourceAuc = 0;
  let modernAuc = 0;
  for (let index = 0; index < expected.length; index += 1) {
    const sourceValue = expected[index] ?? 0;
    const modernValue = observed[index] ?? 0;
    sourceAuc += sourceValue;
    modernAuc += modernValue;
    if (sourceValue <= ZERO_PREVALENCE_EPSILON) {
      sourceZeroDays.push(index + 1);
      if (modernValue > ZERO_PREVALENCE_EPSILON) modernNonzeroOnSourceZeroDays.push(index + 1);
      continue;
    }
    squaredError += (Math.log10(Math.max(modernValue, Number.MIN_VALUE)) - Math.log10(sourceValue)) ** 2;
    positiveDays += 1;
  }
  if (positiveDays === 0) throw new Error(`${role} prevalence target has no positive days`);
  const profileLog10Rmse = Math.sqrt(squaredError / positiveDays);
  return {
    role,
    sourceZeroDays,
    modernNonzeroOnSourceZeroDays,
    profileLog10Rmse,
    sourceAuc,
    modernAuc,
    aucLog10Difference: Math.log10(Math.max(modernAuc, Number.MIN_VALUE)) - Math.log10(Math.max(sourceAuc, Number.MIN_VALUE)),
    positiveDays,
    passes: modernNonzeroOnSourceZeroDays.length === 0 && profileLog10Rmse <= tolerance
  };
}

function evaluateCase(
  sourceCase: SourceCalibrationCase,
  constraint: VarianceConstraint,
  indexMeanLog2NAb: number | null,
  tihGramsPerExposure: number,
  contactMeanLog2NAb = sourceCase.browserStateMapping.contactMeanLog2NAb
): EvaluatedCase {
  const mapping = sourceCase.browserStateMapping;
  const output = evaluatePrevalenceMotif({
    indexState: indexState(mapping, indexMeanLog2NAb, constraint),
    householdState: contactState(mapping.householdState, contactMeanLog2NAb, constraint),
    socialState: contactState(mapping.socialState, contactMeanLog2NAb, constraint),
    setting: settingForCase(sourceCase, tihGramsPerExposure),
    indexReferenceExposure: DEFAULTS.indexReferenceExposure,
    indexAgeMonths: sourceCase.primaryAgeMonths,
    householdAgeMonths: sourceCase.secondaryAgeMonths,
    socialAgeMonths: sourceCase.tertiaryAgeMonths,
    horizonDays: sourceCase.horizonDays
  });
  const diagnostics = sourceCase.targetRoles.map((role) => diagnoseRole(
    role,
    sourceProfile(sourceCase.output, role),
    modernProfile(output, role),
    PARAMETERS.success.calibrationLog10Tolerance
  ));
  const objectiveMeanSquaredLog10 = objectiveForRoles(diagnostics, sourceCase.targetRoles);
  return { output, diagnostics, objectiveMeanSquaredLog10 };
}

function objectiveForRoles(diagnostics: readonly RoleDiagnostics[], roles: readonly Role[]): number {
  const selected = diagnostics.filter((diagnostic) => roles.includes(diagnostic.role));
  const positiveDayCount = selected.reduce((total, diagnostic) => total + diagnostic.positiveDays, 0);
  if (positiveDayCount === 0) throw new Error("Calibration objective has no target days");
  return selected.reduce((total, diagnostic) => total + diagnostic.profileLog10Rmse ** 2 * diagnostic.positiveDays, 0) / positiveDayCount;
}

function fitIndexMean(sourceCase: SourceCalibrationCase, constraint: VarianceConstraint): { meanLog2NAb: number; evaluated: EvaluatedCase } {
  let best: { meanLog2NAb: number; evaluated: EvaluatedCase } | undefined;
  const steps = Math.ceil(constraint.maximumMeanLog2NAb / FIT_GRID_STEP_LOG2);
  const candidates = new Set<number>([sourceCase.browserStateMapping.indexMeanLog2NAb]);
  for (let index = 0; index <= steps; index += 1) candidates.add(Math.min(index * FIT_GRID_STEP_LOG2, constraint.maximumMeanLog2NAb));
  for (const meanLog2NAb of candidates) {
    const evaluated = evaluateCase(sourceCase, constraint, meanLog2NAb, sourceCase.TihGramsPerExposure);
    const objective = objectiveForRoles(evaluated.diagnostics, ["primary"]);
    const bestObjective = best ? objectiveForRoles(best.evaluated.diagnostics, ["primary"]) : Infinity;
    if (!best || objective < bestObjective - 1e-15 || (Math.abs(objective - bestObjective) <= 1e-15 && meanLog2NAb < best.meanLog2NAb)) {
      best = { meanLog2NAb, evaluated };
    }
  }
  if (!best) throw new Error("Index-mean fit evaluated no candidate means");
  return best;
}

function fitTih(
  sourceCase: SourceCalibrationCase,
  constraint: VarianceConstraint,
  indexMeanLog2NAb: number | null,
  contactMeanLog2NAb = sourceCase.browserStateMapping.contactMeanLog2NAb
): { tihGramsPerExposure: number; evaluated: EvaluatedCase } {
  let best: { tihGramsPerExposure: number; evaluated: EvaluatedCase } | undefined;
  const log10Minimum = Math.log10(ENVELOPE.TMin);
  const log10Maximum = Math.log10(ENVELOPE.TMax);
  const steps = Math.ceil((log10Maximum - log10Minimum) / FIT_LOG10_TIH_STEP);
  const candidates = new Set<number>([sourceCase.TihGramsPerExposure]);
  for (let index = 0; index <= steps; index += 1) candidates.add(10 ** Math.min(log10Minimum + index * FIT_LOG10_TIH_STEP, log10Maximum));
  for (const tihGramsPerExposure of candidates) {
    const evaluated = evaluateCase(sourceCase, constraint, indexMeanLog2NAb, tihGramsPerExposure, contactMeanLog2NAb);
    const objective = objectiveForRoles(evaluated.diagnostics, ["secondary"]);
    const bestObjective = best ? objectiveForRoles(best.evaluated.diagnostics, ["secondary"]) : Infinity;
    if (!best || objective < bestObjective - 1e-15 || (Math.abs(objective - bestObjective) <= 1e-15 && tihGramsPerExposure < best.tihGramsPerExposure)) {
      best = { tihGramsPerExposure, evaluated };
    }
  }
  if (!best) throw new Error("Tih fit evaluated no candidate doses");
  return best;
}

interface JointCandidate {
  contactMeanLog2NAb: number;
  tihGramsPerExposure: number;
  profileLog10Rmse: number;
  evaluated: EvaluatedCase;
}

function inclusiveGrid(minimum: number, maximum: number, step: number, additional: readonly number[] = []): number[] {
  if (!(Number.isFinite(minimum) && Number.isFinite(maximum) && Number.isFinite(step)) || step <= 0 || maximum < minimum) {
    throw new Error("Calibration grid bounds must be finite and ordered");
  }
  const values = new Set<number>([minimum, maximum]);
  const steps = Math.ceil((maximum - minimum) / step);
  for (let index = 0; index <= steps; index += 1) values.add(Math.min(maximum, minimum + index * step));
  for (const value of additional) if (value >= minimum && value <= maximum) values.add(value);
  return [...values].sort((left, right) => left - right);
}

function log10DoseGrid(minimum: number, maximum: number, step: number, additional: readonly number[] = []): number[] {
  const log10Minimum = Math.log10(minimum);
  const log10Maximum = Math.log10(maximum);
  return inclusiveGrid(log10Minimum, log10Maximum, step, additional.map(Math.log10)).map((value) => 10 ** value);
}

function secondaryProfileRmse(evaluated: EvaluatedCase): number {
  return Math.sqrt(objectiveForRoles(evaluated.diagnostics, ["secondary"]));
}

function isBetterJointCandidate(candidate: JointCandidate, incumbent: JointCandidate | undefined): boolean {
  if (!incumbent) return true;
  if (candidate.profileLog10Rmse < incumbent.profileLog10Rmse - 1e-15) return true;
  if (Math.abs(candidate.profileLog10Rmse - incumbent.profileLog10Rmse) > 1e-15) return false;
  if (candidate.contactMeanLog2NAb !== incumbent.contactMeanLog2NAb) return candidate.contactMeanLog2NAb < incumbent.contactMeanLog2NAb;
  return candidate.tihGramsPerExposure < incumbent.tihGramsPerExposure;
}

function fitIndiaContactMeanAndTih(
  sourceCase: SourceCalibrationCase,
  constraint: VarianceConstraint,
  indexMeanLog2NAb: number | null
): JointContactTihFit {
  const mapping = sourceCase.browserStateMapping;
  if (mapping.householdState !== "campaign-history-gaussian" || mapping.socialState !== "campaign-history-gaussian") {
    throw new Error("Joint contact fit requires a campaign-history distribution for household and social contacts");
  }
  const coarseMeans = inclusiveGrid(0, constraint.maximumMeanLog2NAb, INDIA_JOINT_COARSE_MEAN_STEP_LOG2, [mapping.contactMeanLog2NAb]);
  const coarseTihs = log10DoseGrid(ENVELOPE.TMin, ENVELOPE.TMax, INDIA_JOINT_COARSE_TIH_STEP_LOG10, [sourceCase.TihGramsPerExposure]);
  const coarseProfile: JointContactTihFit["diagnostics"]["coarseGrid"]["profileByContactMean"] = [];
  let coarseBest: JointCandidate | undefined;
  for (const contactMeanLog2NAb of coarseMeans) {
    let rowBest: JointCandidate | undefined;
    for (const tihGramsPerExposure of coarseTihs) {
      const evaluated = evaluateCase(sourceCase, constraint, indexMeanLog2NAb, tihGramsPerExposure, contactMeanLog2NAb);
      const candidate = { contactMeanLog2NAb, tihGramsPerExposure, profileLog10Rmse: secondaryProfileRmse(evaluated), evaluated };
      if (isBetterJointCandidate(candidate, rowBest)) rowBest = candidate;
      if (isBetterJointCandidate(candidate, coarseBest)) coarseBest = candidate;
    }
    if (!rowBest) throw new Error("India joint coarse grid evaluated no dose candidates");
    coarseProfile.push({
      contactMeanLog2NAb,
      bestTihGramsPerExposure: rowBest.tihGramsPerExposure,
      profileLog10Rmse: rowBest.profileLog10Rmse
    });
  }
  if (!coarseBest) throw new Error("India joint coarse grid evaluated no candidates");

  const refinedMeanMinimum = Math.max(0, coarseBest.contactMeanLog2NAb - INDIA_JOINT_REFINE_MEAN_HALF_WIDTH_LOG2);
  const refinedMeanMaximum = Math.min(constraint.maximumMeanLog2NAb, coarseBest.contactMeanLog2NAb + INDIA_JOINT_REFINE_MEAN_HALF_WIDTH_LOG2);
  const refinedLog10TihMinimum = Math.max(Math.log10(ENVELOPE.TMin), Math.log10(coarseBest.tihGramsPerExposure) - INDIA_JOINT_REFINE_TIH_HALF_WIDTH_LOG10);
  const refinedLog10TihMaximum = Math.min(Math.log10(ENVELOPE.TMax), Math.log10(coarseBest.tihGramsPerExposure) + INDIA_JOINT_REFINE_TIH_HALF_WIDTH_LOG10);
  const refinedMeans = inclusiveGrid(refinedMeanMinimum, refinedMeanMaximum, INDIA_JOINT_REFINE_MEAN_STEP_LOG2, [coarseBest.contactMeanLog2NAb]);
  const refinedTihs = log10DoseGrid(10 ** refinedLog10TihMinimum, 10 ** refinedLog10TihMaximum, INDIA_JOINT_REFINE_TIH_STEP_LOG10, [coarseBest.tihGramsPerExposure]);
  const refinedCandidates: JointCandidate[] = [];
  let refinedBest: JointCandidate | undefined;
  for (const contactMeanLog2NAb of refinedMeans) {
    for (const tihGramsPerExposure of refinedTihs) {
      const evaluated = evaluateCase(sourceCase, constraint, indexMeanLog2NAb, tihGramsPerExposure, contactMeanLog2NAb);
      const candidate = { contactMeanLog2NAb, tihGramsPerExposure, profileLog10Rmse: secondaryProfileRmse(evaluated), evaluated };
      refinedCandidates.push(candidate);
      if (isBetterJointCandidate(candidate, refinedBest)) refinedBest = candidate;
    }
  }
  if (!refinedBest) throw new Error("India joint refinement evaluated no candidates");
  const nearOptimal = refinedCandidates.filter((candidate) => candidate.profileLog10Rmse <= refinedBest.profileLog10Rmse + INDIA_JOINT_NEAR_OPTIMAL_RMSE_DELTA_LOG10);
  return {
    contactMeanLog2NAb: refinedBest.contactMeanLog2NAb,
    tihGramsPerExposure: refinedBest.tihGramsPerExposure,
    evaluated: refinedBest.evaluated,
    diagnostics: {
      objective: "secondary profile log10 RMSE",
      coarseGrid: {
        meanStepLog2: INDIA_JOINT_COARSE_MEAN_STEP_LOG2,
        tihStepLog10: INDIA_JOINT_COARSE_TIH_STEP_LOG10,
        candidateCount: coarseMeans.length * coarseTihs.length,
        profileByContactMean: coarseProfile,
        best: {
          contactMeanLog2NAb: coarseBest.contactMeanLog2NAb,
          tihGramsPerExposure: coarseBest.tihGramsPerExposure,
          profileLog10Rmse: coarseBest.profileLog10Rmse
        }
      },
      refinementGrid: {
        meanStepLog2: INDIA_JOINT_REFINE_MEAN_STEP_LOG2,
        tihStepLog10: INDIA_JOINT_REFINE_TIH_STEP_LOG10,
        meanRangeLog2NAb: [refinedMeanMinimum, refinedMeanMaximum],
        log10TihRange: [refinedLog10TihMinimum, refinedLog10TihMaximum],
        candidateCount: refinedCandidates.length,
        nearOptimalRmseDeltaLog10: INDIA_JOINT_NEAR_OPTIMAL_RMSE_DELTA_LOG10,
        nearOptimalCandidateCount: nearOptimal.length,
        nearOptimalMeanRangeLog2NAb: [
          Math.min(...nearOptimal.map((candidate) => candidate.contactMeanLog2NAb)),
          Math.max(...nearOptimal.map((candidate) => candidate.contactMeanLog2NAb))
        ],
        nearOptimalTihRangeGramsPerExposure: [
          Math.min(...nearOptimal.map((candidate) => candidate.tihGramsPerExposure)),
          Math.max(...nearOptimal.map((candidate) => candidate.tihGramsPerExposure))
        ]
      }
    }
  };
}

function reportForCase(sourceCase: SourceCalibrationCase, constraint: VarianceConstraint) {
  const mapping = sourceCase.browserStateMapping;
  const indexFit = mapping.fitIndexMeanLog2NAb
    ? fitIndexMean(sourceCase, constraint)
    : { meanLog2NAb: mapping.indexState === "naive" ? null : mapping.indexMeanLog2NAb };
  const hasCampaignContactDistribution = mapping.householdState === "campaign-history-gaussian";
  let contactMeanLog2NAb = hasCampaignContactDistribution ? mapping.contactMeanLog2NAb : null;
  let jointContactTihFit: JointContactTihFit["diagnostics"] | null = null;
  let tihFit: { tihGramsPerExposure: number; evaluated: EvaluatedCase };
  if (mapping.fitContactMeanLog2NAb) {
    if (!mapping.fitTih) throw new Error("Joint India contact-mean fitting requires Tih fitting");
    const jointFit = fitIndiaContactMeanAndTih(sourceCase, constraint, indexFit.meanLog2NAb);
    contactMeanLog2NAb = jointFit.contactMeanLog2NAb;
    jointContactTihFit = jointFit.diagnostics;
    tihFit = { tihGramsPerExposure: jointFit.tihGramsPerExposure, evaluated: jointFit.evaluated };
  } else {
    const evaluatedContactMean = contactMeanLog2NAb ?? mapping.contactMeanLog2NAb;
    tihFit = mapping.fitTih
      ? fitTih(sourceCase, constraint, indexFit.meanLog2NAb, evaluatedContactMean)
      : {
          tihGramsPerExposure: sourceCase.TihGramsPerExposure,
          evaluated: evaluateCase(sourceCase, constraint, indexFit.meanLog2NAb, sourceCase.TihGramsPerExposure, evaluatedContactMean)
        };
  }
  const varianceLog2NAb = indexFit.meanLog2NAb === null
    ? null
    : constraint.intercept + constraint.slope * indexFit.meanLog2NAb;
  const contactVarianceLog2NAb = contactMeanLog2NAb === null
    ? null
    : constraint.intercept + constraint.slope * contactMeanLog2NAb;
  return {
    id: sourceCase.id,
    label: sourceCase.label,
    stateMapping: sourceCase.browserStateMapping,
    sourceRLocContextOnly: sourceCase.output.rLoc,
    fittedIndexMeanLog2NAb: indexFit.meanLog2NAb,
    constrainedIndexVarianceLog2NAb: varianceLog2NAb,
    fixedContactMeanLog2NAb: mapping.fitContactMeanLog2NAb ? null : contactMeanLog2NAb,
    fittedContactMeanLog2NAb: mapping.fitContactMeanLog2NAb ? contactMeanLog2NAb : null,
    constrainedContactVarianceLog2NAb: contactVarianceLog2NAb,
    jointContactTihFit,
    fittedTihGramsPerExposure: tihFit.tihGramsPerExposure,
    fittedTihMicrogramsPerExposure: tihFit.tihGramsPerExposure * 1_000_000,
    objectiveMeanSquaredLog10: tihFit.evaluated.objectiveMeanSquaredLog10,
    targetRoles: tihFit.evaluated.diagnostics,
    sourceTrajectories: Object.fromEntries(sourceCase.targetRoles.map((role) => [role, sourceProfile(sourceCase.output, role)])),
    modernTrajectories: Object.fromEntries(sourceCase.targetRoles.map((role) => [role, modernProfile(tihFit.evaluated.output, role)])),
    passes: tihFit.evaluated.diagnostics.every((diagnostic) => diagnostic.passes)
  };
}

function buildReport(fixture: SourceFixture) {
  if (fixture.schemaVersion !== "SourcePrevalenceCalibrationFixtureV1") throw new Error("Unexpected calibration fixture schema");
  const constraint = deriveCalibrationVarianceConstraint(vaccineDefaults("sabin2"));
  const cases = fixture.cases.map((sourceCase) => reportForCase(sourceCase, constraint));
  return {
    schemaVersion: "DistributionNativePrevalenceCalibrationReportV1",
    sourceFixture: {
      path: "reference/fixtures/cessation-calibration-prevalence-v1.json",
      schemaVersion: fixture.schemaVersion,
      source: fixture.source,
      dayConvention: fixture.dayConvention
    },
    endpoint: "conditioned shedding prevalence on source output days 1-45",
    tolerance: {
      metric: "role-specific RMSE of log10 prevalence over source-positive days",
      log10RmseMaximum: PARAMETERS.success.calibrationLog10Tolerance,
      zeroDayTolerance: ZERO_PREVALENCE_EPSILON
    },
    optimizer: {
      name: "deterministic staged grid search with declared India joint refinement",
      matlabIndexMean: { fittedAgainst: "primary prevalence", gridStepLog2: FIT_GRID_STEP_LOG2 },
      indiaJointContactMeanTih: {
        fittedAgainst: "secondary prevalence",
        contactMeanLog2NAbRange: [0, constraint.maximumMeanLog2NAb],
        globalMeanStepLog2: INDIA_JOINT_COARSE_MEAN_STEP_LOG2,
        globalTihStepLog10: INDIA_JOINT_COARSE_TIH_STEP_LOG10,
        localMeanStepLog2: INDIA_JOINT_REFINE_MEAN_STEP_LOG2,
        localTihStepLog10: INDIA_JOINT_REFINE_TIH_STEP_LOG10,
        localMeanHalfWidthLog2: INDIA_JOINT_REFINE_MEAN_HALF_WIDTH_LOG2,
        localTihHalfWidthLog10: INDIA_JOINT_REFINE_TIH_HALF_WIDTH_LOG10,
        tieBreak: "lowest contact mean, then lowest Tih"
      },
      tih: {
        fittedAgainst: "secondary prevalence",
        gridStepLog10: FIT_LOG10_TIH_STEP,
        minimumGramsPerExposure: ENVELOPE.TMin,
        maximumGramsPerExposure: ENVELOPE.TMax
      },
      tieBreak: "lowest candidate value for one-parameter fits"
    },
    varianceConstraint: {
      fit: "ordinary least squares varianceLog2NAb = intercept + slope * meanLog2NAb",
      captures: constraint.captures,
      intercept: constraint.intercept,
      slope: constraint.slope,
      maximumMeanLog2NAb: constraint.maximumMeanLog2NAb
    },
    cases,
    calibrationGateSatisfied: cases.every((sourceCase) => sourceCase.passes),
    releaseGateSatisfied: false,
    remainingReleaseConditions: [
      "Section 15.1 source parity remains partial.",
      "A reviewed deterministic uncertainty ensemble remains absent."
    ]
  };
}

function sha256(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

function updateManifestForCalibration(serializedReport: string, calibrationGateSatisfied: boolean): void {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
  manifest.section152CalibrationSatisfied = calibrationGateSatisfied;
  manifest.calibrationArtifact = {
    path: "reference/fixtures/calibration-report-v1.json",
    schemaVersion: "DistributionNativePrevalenceCalibrationReportV1",
    sha256: sha256(serializedReport),
    calibrationGateSatisfied
  };
  const remaining = Array.isArray(manifest.remainingRequiredCoverage)
    ? manifest.remainingRequiredCoverage.filter((item) => typeof item !== "string" || !item.startsWith("Section 15.2"))
    : [];
  if (!calibrationGateSatisfied) remaining.push("Section 15.2 distribution-native trajectory calibration report and acceptance checks");
  manifest.remainingRequiredCoverage = remaining;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

const mode = process.argv[2] ?? "--check";
if (mode !== "--check" && mode !== "--write") throw new Error("Usage: generate-calibration-report.ts [--check|--write]");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as SourceFixture;
const report = buildReport(fixture);
const serializedReport = `${JSON.stringify(report, null, 2)}\n`;
if (mode === "--write") {
  writeFileSync(reportPath, serializedReport);
  updateManifestForCalibration(serializedReport, report.calibrationGateSatisfied);
  console.log(`Wrote calibration report: ${reportPath}`);
} else {
  const committedReport = readFileSync(reportPath, "utf8");
  if (committedReport !== serializedReport) {
    throw new Error("Calibration report is stale; run npm run generate:calibration-report");
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    section152CalibrationSatisfied?: boolean;
    calibrationArtifact?: { path?: string; schemaVersion?: string; sha256?: string; calibrationGateSatisfied?: boolean };
  };
  if (manifest.section152CalibrationSatisfied !== report.calibrationGateSatisfied
    || manifest.calibrationArtifact?.path !== "reference/fixtures/calibration-report-v1.json"
    || manifest.calibrationArtifact?.schemaVersion !== report.schemaVersion
    || manifest.calibrationArtifact?.sha256 !== sha256(serializedReport)
    || manifest.calibrationArtifact?.calibrationGateSatisfied !== report.calibrationGateSatisfied) {
    throw new Error("Calibration manifest record is stale; run npm run generate:calibration-report");
  }
  console.log("Calibration report is current.");
}
