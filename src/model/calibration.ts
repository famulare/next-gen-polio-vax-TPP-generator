import { GH_WEIGHTS, projectGaussian, sourceQuadratureValues } from "./bins";
import { PARAMETERS } from "./parameters";
import { buildStateAtAssessment } from "./schedule";
import { sheddingTerms } from "./shedding";
import { conditionIndexBreakthrough, transmitLink } from "./transmission";
import type { ImmuneState, SettingV1, SourceCohort, VaccineV1 } from "./types";
import { DAYS_PER_MONTH } from "./waning";

const CALIBRATION_CAPTURE_MONTHS = [5, 8, 11, 17, 23] as const;
const CALIBRATION_DOSE_MONTHS = [42 / DAYS_PER_MONTH, 70 / DAYS_PER_MONTH, 98 / DAYS_PER_MONTH, 8, 11, 17, 23] as const;

export interface ImmunityMoments {
  meanLog2NAb: number;
  varianceLog2NAb: number;
}

export interface VarianceConstraint {
  captures: Array<ImmunityMoments & { ageMonths: number }>;
  intercept: number;
  slope: number;
  maximumMeanLog2NAb: number;
}

export interface PrevalenceMotifInput {
  indexState: ImmuneState;
  householdState: ImmuneState;
  socialState: ImmuneState;
  setting: SettingV1;
  indexReferenceExposure: number;
  indexAgeMonths: number;
  householdAgeMonths: number;
  socialAgeMonths: number;
  horizonDays: number;
}

export interface PrevalenceMotifOutput {
  days: number[];
  indexBreakthroughProbability: number;
  primaryPrevalence: number[];
  secondaryPrevalence: number[];
  tertiaryPrevalence: number[];
}

/**
 * Calibration-only schedule path. It accepts the approved study schedule and
 * capture ages, which intentionally lie outside the app's user-selectable
 * ScheduleV1 controls.
 */
export function buildCalibrationScheduleState(vaccine: VaccineV1, doseDays: readonly number[], assessmentAgeDays: number): ImmuneState {
  return buildStateAtAssessment(vaccine, doseDays, assessmentAgeDays);
}

export function immunityMoments(state: ImmuneState): ImmunityMoments {
  let total = 0;
  let first = 0;
  let second = 0;
  for (const group of state.groups) {
    for (let bin = 0; bin < group.mucosal.length; bin += 1) {
      const binMass = group.mass * (group.mucosal[bin] ?? 0);
      if (binMass <= 0) continue;
      const values = sourceQuadratureValues(bin, group.everInfected, PARAMETERS.quadrature.susceptibilityWithinBinSd);
      for (let index = 0; index < values.length; index += 1) {
        const weight = binMass * (values.length === 1 ? 1 : (GH_WEIGHTS[index] ?? 0));
        const value = values[index] ?? 0;
        total += weight;
        first += weight * value;
        second += weight * value ** 2;
      }
    }
  }
  // The committed GH weights are decimal source values and sum to 1 within
  // 1e-9; normalize their moment accumulation rather than changing them.
  if (Math.abs(total - 1) > 1e-8) throw new Error("Calibration immunity state must have unit mass");
  const meanLog2NAb = first / total;
  return { meanLog2NAb, varianceLog2NAb: Math.max(0, second / total - meanLog2NAb ** 2) };
}

/**
 * The approved calibration family uses a single fitted log2-NAb location.
 * Its latent Gaussian variance is fixed by an OLS line through the five
 * schedule-derived capture moments. The family is restricted before that line
 * becomes negative; no variance floor or undocumented multiplier is used.
 */
export function deriveCalibrationVarianceConstraint(vaccine: VaccineV1): VarianceConstraint {
  const doseDays = CALIBRATION_DOSE_MONTHS.map((month) => month * DAYS_PER_MONTH);
  const captures = CALIBRATION_CAPTURE_MONTHS.map((ageMonths) => ({
    ageMonths,
    ...immunityMoments(buildCalibrationScheduleState(vaccine, doseDays.filter((day) => day <= ageMonths * DAYS_PER_MONTH), ageMonths * DAYS_PER_MONTH))
  }));
  const meanX = captures.reduce((sum, capture) => sum + capture.meanLog2NAb, 0) / captures.length;
  const meanY = captures.reduce((sum, capture) => sum + capture.varianceLog2NAb, 0) / captures.length;
  const denominator = captures.reduce((sum, capture) => sum + (capture.meanLog2NAb - meanX) ** 2, 0);
  if (denominator <= 0) throw new Error("Calibration variance line requires distinct schedule-derived means");
  const slope = captures.reduce((sum, capture) => sum + (capture.meanLog2NAb - meanX) * (capture.varianceLog2NAb - meanY), 0) / denominator;
  const intercept = meanY - slope * meanX;
  if (!(slope < 0) || !(intercept > 0)) throw new Error("Calibration variance line must have positive variance over its fitted domain");
  return { captures, intercept, slope, maximumMeanLog2NAb: -intercept / slope };
}

/**
 * Calibration-only Gaussian immunity state. The caller names the role and
 * specifies whether its mean is fixed or fitted; this constructor has no
 * contact-specific semantics.
 */
export function gaussianCalibrationStateForMean(meanLog2NAb: number, constraint: VarianceConstraint): ImmuneState {
  if (!Number.isFinite(meanLog2NAb) || meanLog2NAb < 0 || meanLog2NAb > constraint.maximumMeanLog2NAb) {
    throw new Error("Gaussian calibration mean is outside the nonnegative-variance domain");
  }
  const varianceLog2NAb = constraint.intercept + constraint.slope * meanLog2NAb;
  if (varianceLog2NAb < -1e-12) throw new Error("Gaussian calibration variance is negative");
  return {
    groups: [{
      mass: 1,
      everInfected: true,
      mucosal: projectGaussian(meanLog2NAb, Math.sqrt(Math.max(0, varianceLog2NAb))),
      serum: projectGaussian(meanLog2NAb, Math.sqrt(Math.max(0, varianceLog2NAb)))
    }],
    assessmentAgeDays: 0,
    lastDoseDay: 0,
    events: []
  };
}

/**
 * Emits prevalence on source output days 1..horizon. Infection is seeded at
 * source day 1, so that day is the infection instant (zero observable
 * shedding), and browser elapsed days are 0..horizon-1.
 */
export function evaluatePrevalenceMotif(input: PrevalenceMotifInput): PrevalenceMotifOutput {
  if (!Number.isInteger(input.horizonDays) || input.horizonDays < 1) throw new Error("Calibration prevalence horizon must be a positive integer");
  const conditionedIndex = conditionIndexBreakthrough(input.indexState, input.indexReferenceExposure);
  const index = conditionedIndex.cohorts.map((cohort) => ({ ...cohort, infectionDay: 1 }));
  const secondary = transmitLink(
    index,
    input.householdState.groups,
    input.setting.Tih.value,
    input.setting.dIh.value,
    input.indexAgeMonths,
    input.horizonDays
  );
  const tertiary = transmitLink(
    secondary,
    input.socialState.groups,
    input.setting.Ths.value,
    input.setting.dHs.value,
    input.householdAgeMonths,
    input.horizonDays
  );
  return {
    days: Array.from({ length: input.horizonDays }, (_, index) => index + 1),
    indexBreakthroughProbability: conditionedIndex.probability,
    primaryPrevalence: prevalenceForCohorts(index, input.indexAgeMonths, input.horizonDays),
    secondaryPrevalence: prevalenceForCohorts(secondary, input.householdAgeMonths, input.horizonDays),
    tertiaryPrevalence: prevalenceForCohorts(tertiary, input.socialAgeMonths, input.horizonDays)
  };
}

function prevalenceForCohorts(cohorts: readonly SourceCohort[], ageMonths: number, horizonDays: number): number[] {
  const prevalence = Array<number>(horizonDays).fill(0);
  for (let day = 1; day <= horizonDays; day += 1) {
    for (const cohort of cohorts) {
      const elapsedDays = day - cohort.infectionDay;
      if (elapsedDays <= 0) continue;
      prevalence[day - 1]! += cohort.mass * sheddingTerms(elapsedDays, cohort.sourceBin, ageMonths).survival;
    }
  }
  return prevalence;
}
