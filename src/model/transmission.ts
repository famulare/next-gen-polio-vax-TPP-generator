import { normalizeBins, sourceQuadratureValues } from "./bins";
import { doseResponse, wpvSusceptibilityPerBin } from "./dose-response";
import { PARAMETERS } from "./parameters";
import { sheddingTerms } from "./shedding";
import type { ImmuneGroup, ImmuneState, IncidenceCohort, SettingV1, SourceCohort } from "./types";

export interface BreakthroughResult {
  probability: number;
  cohorts: SourceCohort[];
}

const sheddingProfileCache = new Map<string, number[][]>();
const transmissionKernelCache = new Map<string, number[][][]>();

export function conditionIndexBreakthrough(state: ImmuneState, referenceExposure: number): BreakthroughResult {
  const cohorts: SourceCohort[] = [];
  let probability = 0;
  for (const group of state.groups) {
    const perBin = wpvSusceptibilityPerBin(referenceExposure, group.everInfected);
    for (let bin = 0; bin < group.mucosal.length; bin += 1) {
      const mass = group.mass * (group.mucosal[bin] ?? 0) * (perBin[bin] ?? 0);
      if (mass <= 0) continue;
      probability += mass;
      cohorts.push({ infectionDay: 0, sourceBin: bin, mass });
    }
  }
  if (probability <= 0) return { probability: 0, cohorts: [] };
  return { probability, cohorts: cohorts.map((cohort) => ({ ...cohort, mass: cohort.mass / probability })) };
}

export function transmitLink(source: readonly SourceCohort[], recipientGroups: readonly ImmuneGroup[], T: number, D: number, ageMonths: number, horizonDays: number): IncidenceCohort[] {
  if (T <= 0 || D <= 0 || source.length === 0) return [];
  const sourceMassByBin = Array<number>(PARAMETERS.immunity.bins).fill(0);
  for (const cohort of source) sourceMassByBin[cohort.sourceBin] = (sourceMassByBin[cohort.sourceBin] ?? 0) + cohort.mass;
  const result = Array<number>(PARAMETERS.immunity.bins).fill(0);
  const kernel = transmissionKernel(T, D, ageMonths, horizonDays);
  for (let sourceBin = 0; sourceBin < sourceMassByBin.length; sourceBin += 1) {
    const sourceMass = sourceMassByBin[sourceBin] ?? 0;
    if (sourceMass <= 0) continue;
    for (const group of recipientGroups) {
      for (let recipientBin = 0; recipientBin < group.mucosal.length; recipientBin += 1) {
        const recipientMass = group.mass * (group.mucosal[recipientBin] ?? 0);
        if (recipientMass <= 0) continue;
        result[recipientBin]! += sourceMass * recipientMass * (kernel[group.everInfected ? 1 : 0]?.[sourceBin]?.[recipientBin] ?? 0);
      }
    }
  }
  return result.flatMap((mass, sourceBin) => mass > 0 ? [{ infectionDay: 0, sourceBin, mass, recipientEverInfected: true as const }] : []);
}

export function rLocForSetting(state: ImmuneState, setting: SettingV1, referenceExposure: number, horizonDays: number): number {
  if (setting.Ns <= 0 || setting.Tih.value <= 0 || setting.Ths.value <= 0) return 0;
  const index = conditionIndexBreakthrough(state, referenceExposure);
  if (index.cohorts.length === 0) return 0;
  const household = transmitLink(index.cohorts, state.groups, setting.Tih.value, setting.dIh.value, state.assessmentAgeDays / (365.25 / 12), horizonDays);
  const social = transmitLink(household, state.groups, setting.Ths.value, setting.dHs.value, state.assessmentAgeDays / (365.25 / 12), horizonDays);
  return setting.Ns * social.reduce((sum, cohort) => sum + cohort.mass, 0);
}

export function naiveRLocForSetting(setting: SettingV1, referenceExposure: number, horizonDays: number, ageDays: number): number {
  const naive: ImmuneState = {
    groups: [{ mass: 1, everInfected: false, mucosal: normalizeBins([1, ...Array<number>(15).fill(0)]), serum: normalizeBins([1, ...Array<number>(15).fill(0)]) }],
    assessmentAgeDays: ageDays,
    lastDoseDay: 0,
    events: []
  };
  return rLocForSetting(naive, setting, referenceExposure, horizonDays);
}

export function repeatedExposureProbability(perExposure: number, D: number): number {
  if (perExposure <= 0 || D <= 0) return 0;
  if (perExposure >= 1) return 1;
  return -Math.expm1(-D * -Math.log1p(-perExposure));
}

function transmissionKernel(T: number, D: number, ageMonths: number, horizonDays: number): number[][][] {
  const key = `${T.toPrecision(15)}:${D.toPrecision(15)}:${ageMonths.toPrecision(15)}:${horizonDays}`;
  const cached = transmissionKernelCache.get(key);
  if (cached) return cached;
  const concentrations = sheddingProfile(ageMonths, horizonDays);
  const kernel = Array.from({ length: 2 }, () => Array.from({ length: PARAMETERS.immunity.bins }, () => Array<number>(PARAMETERS.immunity.bins).fill(0)));
  for (let everIndex = 0; everIndex < 2; everIndex += 1) {
    const recipientValues = Array.from({ length: PARAMETERS.immunity.bins }, (_, recipientBin) => sourceQuadratureValues(recipientBin, everIndex === 1, PARAMETERS.quadrature.susceptibilityWithinBinSd));
    for (let sourceBin = 0; sourceBin < PARAMETERS.immunity.bins; sourceBin += 1) {
      for (let recipientBin = 0; recipientBin < PARAMETERS.immunity.bins; recipientBin += 1) {
        const values = recipientValues[recipientBin] ?? [0];
        let escape = 1;
        let total = 0;
        for (const concentration of concentrations[sourceBin] ?? []) {
          const dose = concentration * T;
          const perExposure = values.length === 1
            ? doseResponse(dose, values[0] ?? 0, PARAMETERS.wpv1.alpha, PARAMETERS.wpv1.beta, PARAMETERS.wpv1.gamma)
            : values.reduce((sum, n, index) => sum + doseResponse(dose, n, PARAMETERS.wpv1.alpha, PARAMETERS.wpv1.beta, PARAMETERS.wpv1.gamma) * (PARAMETERS.quadrature.weights[index] ?? 0), 0);
          const daily = repeatedExposureProbability(perExposure, D);
          total += escape * daily;
          escape *= 1 - daily;
          if (escape < 1e-15) break;
        }
        kernel[everIndex]![sourceBin]![recipientBin] = total;
      }
    }
  }
  transmissionKernelCache.set(key, kernel);
  return kernel;
}

function sheddingProfile(ageMonths: number, horizonDays: number): number[][] {
  const key = `${ageMonths.toPrecision(15)}:${horizonDays}`;
  const cached = sheddingProfileCache.get(key);
  if (cached) return cached;
  const profile = Array.from({ length: PARAMETERS.immunity.bins }, (_, sourceBin) => Array.from({ length: horizonDays }, (_, index) => sheddingTerms(index + 1, sourceBin, ageMonths).concentration));
  sheddingProfileCache.set(key, profile);
  return profile;
}
