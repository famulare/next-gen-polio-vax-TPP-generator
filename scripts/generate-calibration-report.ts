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
import { DEFAULTS, PARAMETERS, vaccineDefaults } from "../src/model/parameters";
import { initialImmuneState } from "../src/model/schedule";
import type { ImmuneState, SettingV1 } from "../src/model/types";

// The Matlab/India joint calibration searches a fixed 0.1–2000 µg exposure range. This is
// deliberately independent of the (narrower) nonbinding setting-surface display domain, so
// narrowing the heatmap does not shift the committed calibration fit.
const CALIBRATION_EXPOSURE_MIN_GRAMS = 0.1 / 1_000_000;
const CALIBRATION_EXPOSURE_MAX_GRAMS = 2000 / 1_000_000;

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
const REPORT_NUMERIC_ABSOLUTE_TOLERANCE = 1e-12;
const REPORT_NUMERIC_RELATIVE_TOLERANCE = 1e-8;

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
  coverage: string;
  releaseGateSatisfied: boolean;
  generatorCommand: string;
  source: {
    repository: string;
    commit: string;
    branch: string;
    trackedDirty: boolean;
    untrackedPaths: string[];
    runtime: string;
    sourceFilesRead: string[];
  };
  dayConvention: { sourceOutputDays: number[]; browserElapsedDays: number[]; meaning: string };
  cases: SourceCalibrationCase[];
}

function validateSourceFixture(value: unknown): asserts value is SourceFixture {
  if (!isPlainRecord(value)) throw new Error("Calibration source fixture must be an object");
  exactObjectKeys(value, ["schemaVersion", "coverage", "releaseGateSatisfied", "generatorCommand", "source", "dayConvention", "cases"], "source fixture");
  if (value.schemaVersion !== "SourcePrevalenceCalibrationFixtureV1") throw new Error("Unexpected calibration fixture schema");
  requireNonemptyString(value.coverage, "source fixture coverage");
  if (typeof value.releaseGateSatisfied !== "boolean") throw new Error("source fixture releaseGateSatisfied must be boolean");
  requireNonemptyString(value.generatorCommand, "source fixture generatorCommand");
  if (!isPlainRecord(value.source)) throw new Error("Calibration source record must be an object");
  exactObjectKeys(value.source, ["repository", "commit", "branch", "trackedDirty", "untrackedPaths", "runtime", "sourceFilesRead"], "source fixture source");
  for (const key of ["repository", "branch", "runtime"] as const) requireNonemptyString(value.source[key], `source fixture source.${key}`);
  if (typeof value.source.commit !== "string" || !/^[0-9a-f]{40}$/.test(value.source.commit)) throw new Error("source fixture source.commit must be a full Git commit");
  if (value.source.trackedDirty !== false) throw new Error("Calibration source fixture must come from a clean tracked worktree");
  stringArray(value.source.untrackedPaths, "source fixture source.untrackedPaths");
  stringArray(value.source.sourceFilesRead, "source fixture source.sourceFilesRead", true);
  if (!isPlainRecord(value.dayConvention)) throw new Error("Calibration day convention must be an object");
  exactObjectKeys(value.dayConvention, ["sourceOutputDays", "browserElapsedDays", "meaning"], "source fixture dayConvention");
  requireNonemptyString(value.dayConvention.meaning, "source fixture dayConvention.meaning");
  consecutiveIntegerArray(value.dayConvention.sourceOutputDays, 1, "source fixture dayConvention.sourceOutputDays");
  consecutiveIntegerArray(value.dayConvention.browserElapsedDays, 0, "source fixture dayConvention.browserElapsedDays");
  if (value.dayConvention.sourceOutputDays.length !== value.dayConvention.browserElapsedDays.length) throw new Error("Calibration day-convention arrays must have equal lengths");
  if (!Array.isArray(value.cases) || value.cases.length === 0) throw new Error("Calibration source fixture must contain cases");
  const caseIds = new Set<string>();
  for (const [index, candidate] of value.cases.entries()) {
    if (!isPlainRecord(candidate)) throw new Error(`Calibration case ${index} must be an object`);
    exactObjectKeys(candidate, ["id", "label", "TihGramsPerExposure", "ThsGramsPerExposure", "dIhExposuresPerPersonDay", "dHsExposuresPerPersonDay", "Ns", "primaryLog2NAb", "secondaryLog2NAb", "tertiaryLog2NAb", "targetRoles", "horizonDays", "vaccineDoseTCID50", "perDoseEfficacy", "primaryAgeMonths", "secondaryAgeMonths", "tertiaryAgeMonths", "browserStateMapping", "output"], `source fixture case ${index}`);
    requireNonemptyString(candidate.id, `Calibration case ${index}.id`);
    if (caseIds.has(candidate.id)) throw new Error(`Calibration case id ${candidate.id} is duplicated`);
    caseIds.add(candidate.id);
    requireNonemptyString(candidate.label, `Calibration case ${index}.label`);
    for (const key of ["TihGramsPerExposure", "ThsGramsPerExposure", "dIhExposuresPerPersonDay", "dHsExposuresPerPersonDay", "primaryLog2NAb", "secondaryLog2NAb", "tertiaryLog2NAb", "vaccineDoseTCID50", "primaryAgeMonths", "secondaryAgeMonths", "tertiaryAgeMonths"] as const) requireNonnegativeFinite(candidate[key], `Calibration case ${index}.${key}`);
    requireInteger(candidate.Ns, 0, `Calibration case ${index}.Ns`);
    requireInteger(candidate.horizonDays, 1, `Calibration case ${index}.horizonDays`);
    requireRange(candidate.perDoseEfficacy, 0, 1, `Calibration case ${index}.perDoseEfficacy`);
    if (candidate.horizonDays !== value.dayConvention.sourceOutputDays.length) throw new Error(`Calibration case ${index} horizon does not match the day convention`);
    if (!Array.isArray(candidate.targetRoles) || candidate.targetRoles.length === 0 || new Set(candidate.targetRoles).size !== candidate.targetRoles.length || candidate.targetRoles.some((role) => !["primary", "secondary", "tertiary"].includes(role as string))) throw new Error(`Calibration case ${index} has invalid target roles`);
    if (!isPlainRecord(candidate.browserStateMapping)) throw new Error(`Calibration case ${index} mapping must be an object`);
    exactObjectKeys(candidate.browserStateMapping, ["indexState", "indexScheduleDoseDays", "indexAssessmentAgeDays", "indexMeanLog2NAb", "fitIndexMeanLog2NAb", "householdState", "socialState", "contactMeanLog2NAb", "fitTih", "fitContactMeanLog2NAb"], `source fixture case ${index} mapping`);
    const mapping = candidate.browserStateMapping;
    if (!["naive", "campaign-history-gaussian", "schedule-calibrated-gaussian"].includes(mapping.indexState as string)
      || !["naive", "campaign-history-gaussian", "schedule-calibrated-gaussian"].includes(mapping.householdState as string)
      || !["naive", "campaign-history-gaussian", "schedule-calibrated-gaussian"].includes(mapping.socialState as string)) throw new Error(`Calibration case ${index} has an invalid mapped immune state`);
    finiteIntegerArray(mapping.indexScheduleDoseDays, `Calibration case ${index} mapping.indexScheduleDoseDays`);
    for (const key of ["indexAssessmentAgeDays", "indexMeanLog2NAb", "contactMeanLog2NAb"] as const) requireNonnegativeFinite(mapping[key], `Calibration case ${index} mapping.${key}`);
    for (const key of ["fitIndexMeanLog2NAb", "fitTih", "fitContactMeanLog2NAb"] as const) if (typeof mapping[key] !== "boolean") throw new Error(`Calibration case ${index} mapping.${key} must be boolean`);
    if (!isPlainRecord(candidate.output)) throw new Error(`Calibration case ${index} output must be an object`);
    exactObjectKeys(candidate.output, ["primaryIncidence", "secondaryIncidence", "tertiaryIncidence", "primaryPrevalence", "secondaryPrevalence", "tertiaryPrevalence", "conditionedPrimaryPrevalence", "conditionedSecondaryPrevalence", "conditionedTertiaryPrevalence", "primaryTotal", "secondaryTotal", "tertiaryTotal", "rLoc"], `source fixture case ${index} output`);
    for (const key of ["primaryIncidence", "secondaryIncidence", "tertiaryIncidence", "primaryPrevalence", "secondaryPrevalence", "tertiaryPrevalence", "conditionedPrimaryPrevalence", "conditionedSecondaryPrevalence", "conditionedTertiaryPrevalence"] as const) {
      const profile = candidate.output[key];
      if (!Array.isArray(profile) || profile.length !== candidate.horizonDays || profile.some((item) => typeof item !== "number" || !Number.isFinite(item) || item < 0)) throw new Error(`Calibration case ${index}.${key} is invalid`);
    }
    for (const key of ["primaryTotal", "secondaryTotal", "tertiaryTotal", "rLoc"] as const) requireNonnegativeFinite(candidate.output[key], `Calibration case ${index} output.${key}`);
  }
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
  const log10Minimum = Math.log10(CALIBRATION_EXPOSURE_MIN_GRAMS);
  const log10Maximum = Math.log10(CALIBRATION_EXPOSURE_MAX_GRAMS);
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
  const coarseTihs = log10DoseGrid(CALIBRATION_EXPOSURE_MIN_GRAMS, CALIBRATION_EXPOSURE_MAX_GRAMS, INDIA_JOINT_COARSE_TIH_STEP_LOG10, [sourceCase.TihGramsPerExposure]);
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
  const refinedLog10TihMinimum = Math.max(Math.log10(CALIBRATION_EXPOSURE_MIN_GRAMS), Math.log10(coarseBest.tihGramsPerExposure) - INDIA_JOINT_REFINE_TIH_HALF_WIDTH_LOG10);
  const refinedLog10TihMaximum = Math.min(Math.log10(CALIBRATION_EXPOSURE_MAX_GRAMS), Math.log10(coarseBest.tihGramsPerExposure) + INDIA_JOINT_REFINE_TIH_HALF_WIDTH_LOG10);
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
        minimumGramsPerExposure: CALIBRATION_EXPOSURE_MIN_GRAMS,
        maximumGramsPerExposure: CALIBRATION_EXPOSURE_MAX_GRAMS
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
      "This Section 15.2 calibration artifact is not an application-release decision; apply the complete Section 17 checklist."
    ]
  };
}

function sha256(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

function assertReportEquivalent(committed: unknown, generated: unknown, path = "$"): void {
  if (typeof committed === "number" || typeof generated === "number") {
    if (typeof committed !== "number" || typeof generated !== "number") {
      throw new Error(`Calibration report mismatch at ${path}: ${JSON.stringify(committed)} !== ${JSON.stringify(generated)}`);
    }
    if (!numericEquivalent(committed, generated)) {
      const absoluteDifference = Math.abs(committed - generated);
      const relativeDifference = absoluteDifference / Math.max(1, Math.abs(committed), Math.abs(generated));
      throw new Error(
        `Calibration report numeric mismatch at ${path}: committed=${committed}, generated=${generated}, `
        + `absolute=${absoluteDifference}, relative=${relativeDifference}`
      );
    }
    return;
  }
  if (Array.isArray(committed) || Array.isArray(generated)) {
    if (!Array.isArray(committed) || !Array.isArray(generated) || committed.length !== generated.length) {
      throw new Error(`Calibration report array mismatch at ${path}`);
    }
    for (let index = 0; index < committed.length; index += 1) {
      assertReportEquivalent(committed[index], generated[index], `${path}[${index}]`);
    }
    return;
  }
  if (isPlainRecord(committed) || isPlainRecord(generated)) {
    if (!isPlainRecord(committed) || !isPlainRecord(generated)) {
      throw new Error(`Calibration report type mismatch at ${path}`);
    }
    const committedKeys = Object.keys(committed).sort();
    const generatedKeys = Object.keys(generated).sort();
    if (committedKeys.length !== generatedKeys.length || committedKeys.some((key, index) => key !== generatedKeys[index])) {
      throw new Error(`Calibration report object-key mismatch at ${path}`);
    }
    for (const key of committedKeys) {
      assertReportEquivalent(committed[key], generated[key], `${path}.${key}`);
    }
    return;
  }
  if (committed !== generated) {
    throw new Error(`Calibration report mismatch at ${path}: ${JSON.stringify(committed)} !== ${JSON.stringify(generated)}`);
  }
}

function numericEquivalent(committed: number, generated: number): boolean {
  const absoluteDifference = Math.abs(committed - generated);
  if (absoluteDifference <= REPORT_NUMERIC_ABSOLUTE_TOLERANCE) return true;
  return absoluteDifference / Math.max(1, Math.abs(committed), Math.abs(generated)) <= REPORT_NUMERIC_RELATIVE_TOLERANCE;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactObjectKeys(value: Record<string, unknown>, expectedKeys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error(`${label} contains unknown or missing fields`);
}

function requireNonemptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a nonempty string`);
}

function requireNonnegativeFinite(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`${label} must be finite and nonnegative`);
}

function requireInteger(value: unknown, minimum: number, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) throw new Error(`${label} must be an integer >= ${minimum}`);
}

function requireRange(value: unknown, minimum: number, maximum: number, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${label} must be in [${minimum}, ${maximum}]`);
}

function stringArray(value: unknown, label: string, requireNonempty = false): asserts value is string[] {
  if (!Array.isArray(value) || (requireNonempty && value.length === 0) || value.some((item) => typeof item !== "string" || item.length === 0)) throw new Error(`${label} must be ${requireNonempty ? "a nonempty " : "a "}string array`);
}

function finiteIntegerArray(value: unknown, label: string): asserts value is number[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "number" || !Number.isInteger(item) || item < 0)) throw new Error(`${label} must be a nonnegative integer array`);
}

function consecutiveIntegerArray(value: unknown, first: number, label: string): asserts value is number[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((item, index) => item !== first + index)) throw new Error(`${label} must contain consecutive integers starting at ${first}`);
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
const fixture: unknown = JSON.parse(readFileSync(fixturePath, "utf8"));
validateSourceFixture(fixture);
const report = buildReport(fixture);
const serializedReport = `${JSON.stringify(report, null, 2)}\n`;
if (mode === "--write") {
  writeFileSync(reportPath, serializedReport);
  updateManifestForCalibration(serializedReport, report.calibrationGateSatisfied);
  console.log(`Wrote calibration report: ${reportPath}`);
  if (!report.calibrationGateSatisfied) throw new Error("Calibration gate failed; the report was recorded but is not release-eligible");
} else {
  const committedReport = readFileSync(reportPath, "utf8");
  const parsedCommittedReport = JSON.parse(committedReport) as { calibrationGateSatisfied?: boolean };
  assertReportEquivalent(parsedCommittedReport, report);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    section152CalibrationSatisfied?: boolean;
    calibrationArtifact?: { path?: string; schemaVersion?: string; sha256?: string; calibrationGateSatisfied?: boolean };
  };
  if (manifest.section152CalibrationSatisfied !== parsedCommittedReport.calibrationGateSatisfied
    || manifest.calibrationArtifact?.path !== "reference/fixtures/calibration-report-v1.json"
    || manifest.calibrationArtifact?.schemaVersion !== report.schemaVersion
    || manifest.calibrationArtifact?.sha256 !== sha256(committedReport)
    || manifest.calibrationArtifact?.calibrationGateSatisfied !== parsedCommittedReport.calibrationGateSatisfied) {
    throw new Error("Calibration manifest record is stale; run npm run generate:calibration-report");
  }
  if (parsedCommittedReport.calibrationGateSatisfied !== true) throw new Error("Calibration gate is not satisfied");
  console.log("Calibration report is current.");
}
