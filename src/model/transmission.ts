import { sourceQuadratureValues } from "./bins";
import { doseResponse, wpvSusceptibilityPerBin } from "./dose-response";
import { PARAMETERS } from "./parameters";
import { initialImmuneState } from "./schedule";
import { sheddingTerms } from "./shedding";
import type { ImmuneGroup, ImmuneState, IncidenceCohort, SettingV1, SourceCohort } from "./types";
import { DAYS_PER_MONTH } from "./waning";

export interface BreakthroughResult {
  probability: number;
  cohorts: SourceCohort[];
}

interface LinkKernel {
  daily: Float64Array;
  cumulative: Float64Array;
  horizonDays: number;
}

interface SheddingProfile {
  survival: Float64Array;
  conditionalConcentration: Float64Array;
}

export type RLocEvaluator = (state: ImmuneState, socialContacts?: number) => number;

const BIN_COUNT = PARAMETERS.immunity.bins;
const HISTORY_COUNT = 2;
const linkKernelCache = new Map<string, LinkKernel>();
const sheddingProfileCache = new Map<string, SheddingProfile>();
const perExposureProfileCache = new Map<string, Float64Array>();

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

export function transmitLink(
  source: readonly SourceCohort[],
  recipientGroups: readonly ImmuneGroup[],
  T: number,
  D: number,
  ageMonths: number,
  horizonDays: number
): IncidenceCohort[] {
  validateLinkInputs(T, D, ageMonths, horizonDays);
  if (T === 0 || D === 0 || source.length === 0) return [];
  const kernel = linkKernel(T, D, ageMonths, horizonDays);
  const incidence = new Float64Array((horizonDays + 1) * BIN_COUNT);
  for (const cohort of source) {
    validateSourceCohort(cohort, horizonDays);
    const remainingDays = horizonDays - cohort.infectionDay;
    for (const group of recipientGroups) {
      const history = group.everInfected ? 1 : 0;
      for (let recipientBin = 0; recipientBin < BIN_COUNT; recipientBin += 1) {
        const recipientMass = group.mass * (group.mucosal[recipientBin] ?? 0);
        if (recipientMass <= 0) continue;
        for (let elapsedDay = 1; elapsedDay <= remainingDays; elapsedDay += 1) {
          const mass = cohort.mass * recipientMass * kernel.daily[kernelIndex(history, cohort.sourceBin, recipientBin, elapsedDay, horizonDays)]!;
          if (mass > 0) incidence[(cohort.infectionDay + elapsedDay) * BIN_COUNT + recipientBin]! += mass;
        }
      }
    }
  }
  const result: IncidenceCohort[] = [];
  for (let infectionDay = 1; infectionDay <= horizonDays; infectionDay += 1) {
    for (let sourceBin = 0; sourceBin < BIN_COUNT; sourceBin += 1) {
      const mass = incidence[infectionDay * BIN_COUNT + sourceBin]!;
      if (mass > 0) result.push({ infectionDay, sourceBin, mass, recipientEverInfected: true });
    }
  }
  return result;
}

export function rLocForSetting(state: ImmuneState, setting: SettingV1, referenceExposure: number, horizonDays: number): number {
  validateSettingInputs(setting, referenceExposure, horizonDays);
  if (setting.Ns === 0 || setting.Tih.value === 0 || setting.Ths.value === 0 || setting.dIh.value === 0 || setting.dHs.value === 0) return 0;
  const index = conditionIndexBreakthrough(state, referenceExposure);
  if (index.cohorts.length === 0) return 0;
  const ageMonths = state.assessmentAgeDays / DAYS_PER_MONTH;
  const recipientMass = recipientMassByHistoryAndBin(state.groups);
  const indexMass = sourceMassByBin(index.cohorts);
  const indexHousehold = linkKernel(setting.Tih.value, setting.dIh.value, ageMonths, horizonDays);
  const householdSocial = linkKernel(setting.Ths.value, setting.dHs.value, ageMonths, horizonDays);
  const socialProbabilityBySourceAndRemaining = new Float64Array(BIN_COUNT * (horizonDays + 1));

  for (let sourceBin = 0; sourceBin < BIN_COUNT; sourceBin += 1) {
    for (let remaining = 1; remaining <= horizonDays; remaining += 1) {
      let probability = 0;
      for (let history = 0; history < HISTORY_COUNT; history += 1) {
        for (let recipientBin = 0; recipientBin < BIN_COUNT; recipientBin += 1) {
          probability += recipientMass[history * BIN_COUNT + recipientBin]!
            * householdSocial.cumulative[kernelIndex(history, sourceBin, recipientBin, remaining, horizonDays)]!;
        }
      }
      socialProbabilityBySourceAndRemaining[sourceBin * (horizonDays + 1) + remaining] = probability;
    }
  }

  let socialProbability = 0;
  for (let householdBin = 0; householdBin < BIN_COUNT; householdBin += 1) {
    for (let infectionDay = 1; infectionDay < horizonDays; infectionDay += 1) {
      let householdIncidence = 0;
      for (let sourceBin = 0; sourceBin < BIN_COUNT; sourceBin += 1) {
        const sourceMass = indexMass[sourceBin]!;
        if (sourceMass === 0) continue;
        for (let history = 0; history < HISTORY_COUNT; history += 1) {
          householdIncidence += sourceMass * recipientMass[history * BIN_COUNT + householdBin]!
            * indexHousehold.daily[kernelIndex(history, sourceBin, householdBin, infectionDay, horizonDays)]!;
        }
      }
      socialProbability += householdIncidence
        * socialProbabilityBySourceAndRemaining[householdBin * (horizonDays + 1) + horizonDays - infectionDay]!;
    }
  }
  return setting.Ns * socialProbability;
}

/**
 * Precomputes a fixed-setting motif tensor for repeated design-grid evaluation.
 * rLocForSetting remains the direct factorized path for point and surface work.
 */
export function createRLocEvaluator(setting: SettingV1, referenceExposure: number, ageDays: number, horizonDays: number): RLocEvaluator {
  validateSettingInputs(setting, referenceExposure, horizonDays);
  if (setting.Tih.value === 0 || setting.Ths.value === 0 || setting.dIh.value === 0 || setting.dHs.value === 0) return () => 0;
  const ageMonths = ageDays / DAYS_PER_MONTH;
  const first = linkKernel(setting.Tih.value, setting.dIh.value, ageMonths, horizonDays);
  const second = linkKernel(setting.Ths.value, setting.dHs.value, ageMonths, horizonDays);
  const tensor = buildMotifTensor(first, second);
  return (state, socialContacts = setting.Ns) => {
    if (!Number.isInteger(socialContacts) || socialContacts < 0) throw new Error("socialContacts must be a nonnegative integer");
    if (socialContacts === 0) return 0;
    const index = conditionIndexBreakthrough(state, referenceExposure);
    if (index.cohorts.length === 0) return 0;
    const indexMass = sourceMassByBin(index.cohorts);
    const recipientMass = recipientMassByHistoryAndBin(state.groups);
    let socialProbability = 0;
    for (let indexBin = 0; indexBin < BIN_COUNT; indexBin += 1) {
      if (indexMass[indexBin] === 0) continue;
      for (let householdHistory = 0; householdHistory < HISTORY_COUNT; householdHistory += 1) {
        for (let householdBin = 0; householdBin < BIN_COUNT; householdBin += 1) {
          const householdMass = recipientMass[householdHistory * BIN_COUNT + householdBin]!;
          if (householdMass === 0) continue;
          for (let socialHistory = 0; socialHistory < HISTORY_COUNT; socialHistory += 1) {
            for (let socialBin = 0; socialBin < BIN_COUNT; socialBin += 1) {
              const socialMass = recipientMass[socialHistory * BIN_COUNT + socialBin]!;
              if (socialMass === 0) continue;
              socialProbability += indexMass[indexBin]! * householdMass * socialMass
                * tensor[motifIndex(indexBin, householdHistory, householdBin, socialHistory, socialBin)]!;
            }
          }
        }
      }
    }
    return socialContacts * socialProbability;
  };
}

export function naiveRLocForSetting(setting: SettingV1, referenceExposure: number, horizonDays: number, ageDays: number): number {
  const naive: ImmuneState = { ...initialImmuneState(), assessmentAgeDays: ageDays };
  return rLocForSetting(naive, setting, referenceExposure, horizonDays);
}

export function repeatedExposureProbability(perExposure: number, D: number): number {
  if (!Number.isFinite(perExposure) || !Number.isFinite(D) || perExposure < 0 || D < 0) throw new Error("Exposure probability and frequency must be finite and nonnegative");
  if (perExposure === 0 || D === 0) return 0;
  if (perExposure >= 1) return 1;
  return -Math.expm1(-D * -Math.log1p(-perExposure));
}

function linkKernel(T: number, D: number, ageMonths: number, horizonDays: number): LinkKernel {
  const key = `${PARAMETERS.manifestVersion}:${T.toPrecision(15)}:${D.toPrecision(15)}:${ageMonths.toPrecision(15)}:${horizonDays}`;
  const cached = linkKernelCache.get(key);
  if (cached) return cached;
  const size = HISTORY_COUNT * BIN_COUNT * BIN_COUNT * (horizonDays + 1);
  const daily = new Float64Array(size);
  const cumulative = new Float64Array(size);
  const shedding = sheddingProfile(ageMonths, horizonDays);
  const perExposureProfile = infectionProbabilityProfile(T, ageMonths, horizonDays, shedding);
  for (let history = 0; history < HISTORY_COUNT; history += 1) {
    for (let sourceBin = 0; sourceBin < BIN_COUNT; sourceBin += 1) {
      for (let recipientBin = 0; recipientBin < BIN_COUNT; recipientBin += 1) {
        let escapeWhileShedding = 1;
        let cumulativeProbability = 0;
        for (let elapsedDay = 1; elapsedDay <= horizonDays; elapsedDay += 1) {
          const profileOffset = kernelIndex(history, sourceBin, recipientBin, elapsedDay, horizonDays);
          const perExposure = perExposureProfile[profileOffset]!;
          const dailyConditional = repeatedExposureProbability(perExposure, D);
          const firstInfection = shedding.survival[sourceBin * (horizonDays + 1) + elapsedDay]!
            * escapeWhileShedding * dailyConditional;
          cumulativeProbability += firstInfection;
          daily[profileOffset] = firstInfection;
          cumulative[profileOffset] = cumulativeProbability;
          escapeWhileShedding *= 1 - dailyConditional;
        }
      }
    }
  }
  const kernel = { daily, cumulative, horizonDays };
  linkKernelCache.set(key, kernel);
  return kernel;
}

function sheddingProfile(ageMonths: number, horizonDays: number): SheddingProfile {
  const key = `${PARAMETERS.manifestVersion}:${ageMonths.toPrecision(15)}:${horizonDays}`;
  const cached = sheddingProfileCache.get(key);
  if (cached) return cached;
  const survival = new Float64Array(BIN_COUNT * (horizonDays + 1));
  const conditionalConcentration = new Float64Array(BIN_COUNT * (horizonDays + 1));
  for (let sourceBin = 0; sourceBin < BIN_COUNT; sourceBin += 1) {
    for (let elapsedDay = 1; elapsedDay <= horizonDays; elapsedDay += 1) {
      const terms = sheddingTerms(elapsedDay, sourceBin, ageMonths);
      const offset = sourceBin * (horizonDays + 1) + elapsedDay;
      survival[offset] = terms.survival;
      conditionalConcentration[offset] = terms.conditionalConcentration;
    }
  }
  const profile = { survival, conditionalConcentration };
  sheddingProfileCache.set(key, profile);
  return profile;
}

function infectionProbabilityProfile(T: number, ageMonths: number, horizonDays: number, shedding: SheddingProfile): Float64Array {
  const key = `${PARAMETERS.manifestVersion}:${T.toPrecision(15)}:${ageMonths.toPrecision(15)}:${horizonDays}`;
  const cached = perExposureProfileCache.get(key);
  if (cached) return cached;
  const probabilities = new Float64Array(HISTORY_COUNT * BIN_COUNT * BIN_COUNT * (horizonDays + 1));
  for (let history = 0; history < HISTORY_COUNT; history += 1) {
    const recipientValues = Array.from({ length: BIN_COUNT }, (_, recipientBin) =>
      sourceQuadratureValues(recipientBin, history === 1, PARAMETERS.quadrature.susceptibilityWithinBinSd));
    for (let sourceBin = 0; sourceBin < BIN_COUNT; sourceBin += 1) {
      for (let recipientBin = 0; recipientBin < BIN_COUNT; recipientBin += 1) {
        const values = recipientValues[recipientBin] ?? [0];
        for (let elapsedDay = 1; elapsedDay <= horizonDays; elapsedDay += 1) {
          const dose = shedding.conditionalConcentration[sourceBin * (horizonDays + 1) + elapsedDay]! * T;
          probabilities[kernelIndex(history, sourceBin, recipientBin, elapsedDay, horizonDays)] = values.length === 1
            ? doseResponse(dose, values[0] ?? 0, PARAMETERS.wpv1.alpha, PARAMETERS.wpv1.beta, PARAMETERS.wpv1.gamma)
            : values.reduce((sum, n, index) => sum + doseResponse(dose, n, PARAMETERS.wpv1.alpha, PARAMETERS.wpv1.beta, PARAMETERS.wpv1.gamma)
              * (PARAMETERS.quadrature.weights[index] ?? 0), 0);
        }
      }
    }
  }
  perExposureProfileCache.set(key, probabilities);
  return probabilities;
}

function buildMotifTensor(first: LinkKernel, second: LinkKernel): Float64Array {
  if (first.horizonDays !== second.horizonDays) throw new Error("Link kernels must share a horizon");
  const horizonDays = first.horizonDays;
  const tensor = new Float64Array(BIN_COUNT * HISTORY_COUNT * BIN_COUNT * HISTORY_COUNT * BIN_COUNT);
  for (let indexBin = 0; indexBin < BIN_COUNT; indexBin += 1) {
    for (let householdHistory = 0; householdHistory < HISTORY_COUNT; householdHistory += 1) {
      for (let householdBin = 0; householdBin < BIN_COUNT; householdBin += 1) {
        for (let socialHistory = 0; socialHistory < HISTORY_COUNT; socialHistory += 1) {
          for (let socialBin = 0; socialBin < BIN_COUNT; socialBin += 1) {
            let probability = 0;
            for (let infectionDay = 1; infectionDay < horizonDays; infectionDay += 1) {
              probability += first.daily[kernelIndex(householdHistory, indexBin, householdBin, infectionDay, horizonDays)]!
                * second.cumulative[kernelIndex(socialHistory, householdBin, socialBin, horizonDays - infectionDay, horizonDays)]!;
            }
            tensor[motifIndex(indexBin, householdHistory, householdBin, socialHistory, socialBin)] = probability;
          }
        }
      }
    }
  }
  return tensor;
}

function sourceMassByBin(cohorts: readonly SourceCohort[]): Float64Array {
  const mass = new Float64Array(BIN_COUNT);
  for (const cohort of cohorts) mass[cohort.sourceBin]! += cohort.mass;
  return mass;
}

function recipientMassByHistoryAndBin(groups: readonly ImmuneGroup[]): Float64Array {
  const mass = new Float64Array(HISTORY_COUNT * BIN_COUNT);
  for (const group of groups) {
    const history = group.everInfected ? 1 : 0;
    for (let bin = 0; bin < BIN_COUNT; bin += 1) mass[history * BIN_COUNT + bin]! += group.mass * (group.mucosal[bin] ?? 0);
  }
  return mass;
}

function kernelIndex(history: number, sourceBin: number, recipientBin: number, day: number, horizonDays: number): number {
  return (((history * BIN_COUNT + sourceBin) * BIN_COUNT + recipientBin) * (horizonDays + 1)) + day;
}

function motifIndex(indexBin: number, householdHistory: number, householdBin: number, socialHistory: number, socialBin: number): number {
  return ((((indexBin * HISTORY_COUNT + householdHistory) * BIN_COUNT + householdBin) * HISTORY_COUNT + socialHistory) * BIN_COUNT) + socialBin;
}

function validateLinkInputs(T: number, D: number, ageMonths: number, horizonDays: number): void {
  if (!Number.isFinite(T) || T < 0) throw new Error("Exposure mass must be finite and nonnegative");
  if (!Number.isFinite(D) || D < 0) throw new Error("Exposure frequency must be finite and nonnegative");
  if (!Number.isFinite(ageMonths) || ageMonths < 0) throw new Error("Age must be finite and nonnegative");
  if (!Number.isInteger(horizonDays) || horizonDays < 1) throw new Error("Transmission horizon must be a positive integer");
}

function validateSettingInputs(setting: SettingV1, referenceExposure: number, horizonDays: number): void {
  validateLinkInputs(setting.Tih.value, setting.dIh.value, 0, horizonDays);
  validateLinkInputs(setting.Ths.value, setting.dHs.value, 0, horizonDays);
  if (!Number.isInteger(setting.Ns) || setting.Ns < 0) throw new Error("Social-contact count must be a nonnegative integer");
  if (!Number.isFinite(referenceExposure) || referenceExposure <= 0) throw new Error("Index reference exposure must be finite and positive");
}

function validateSourceCohort(cohort: SourceCohort, horizonDays: number): void {
  if (!Number.isInteger(cohort.infectionDay) || cohort.infectionDay < 0 || cohort.infectionDay > horizonDays) throw new Error("Source infection day is outside the modeled horizon");
  if (!Number.isInteger(cohort.sourceBin) || cohort.sourceBin < 0 || cohort.sourceBin >= BIN_COUNT) throw new Error("Source immunity bin is invalid");
  if (!Number.isFinite(cohort.mass) || cohort.mass < 0) throw new Error("Source cohort mass must be finite and nonnegative");
}
