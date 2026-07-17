import { normalCdf } from "./bins";
import { PARAMETERS, SCIENTIFIC_MANIFEST_ID } from "./parameters";

const INTEGRATED_SHEDDING_CACHE_CAPACITY = 256;
const integratedSheddingCache = new Map<string, number>();

export interface SheddingTerms {
  survival: number;
  jointPeak: number;
  expectedInfectiousConcentration: number;
  conditionalConcentration: number;
}

/**
 * Legacy Cessation age-amplitude function retained for the reduced R_loc
 * model. India-polio currently omits the seven-month plateau; that is a
 * documented upstream discrepancy, not a silent browser approximation.
 */
export function peakSheddingAgeAmplitude(ageMonths: number): number {
  if (!Number.isFinite(ageMonths) || ageMonths < 0) throw new Error("Shedding age must be finite and nonnegative");
  const age = PARAMETERS.shedding.age;
  return Math.min(
    age.aMax,
    age.aMin + (age.aMax - age.aMin) * Math.exp(-(ageMonths - age.legacyPlateauUntilMonths) / age.tauMonths)
  );
}

export function sheddingTerms(daysSinceInfection: number, sourceBin: number, ageMonths: number): SheddingTerms {
  if (daysSinceInfection <= 0) return { survival: 1, jointPeak: 0, expectedInfectiousConcentration: 0, conditionalConcentration: 0 };
  const duration = PARAMETERS.wpv1.sheddingDuration;
  const b0 = (Math.log(daysSinceInfection) - duration.b1) / duration.b3;
  const b1 = duration.b2 / duration.b3;
  const sd = PARAMETERS.quadrature.sheddingWithinBinSd;
  const denominator = Math.sqrt(1 + (b1 * sd) ** 2);
  const agePeak = peakSheddingAgeAmplitude(ageMonths);
  const suppression = PARAMETERS.shedding.immunitySuppression;
  const lambda = Math.log(10) * agePeak * suppression;
  let survival: number;
  let jointPeak: number;
  if (sourceBin === 0) {
    survival = 1 - normalCdf(b0);
    jointPeak = 10 ** agePeak * survival;
  } else {
    survival = 1 - normalCdf((b0 + b1 * sourceBin) / denominator);
    const logTilt = Math.min(-lambda * sourceBin + 0.5 * (lambda * sd) ** 2, 500);
    const tiltedPeak = 10 ** agePeak * Math.exp(logTilt);
    const jointSurvival = 1 - normalCdf((b0 + b1 * (sourceBin - lambda * sd ** 2)) / denominator);
    jointPeak = tiltedPeak * jointSurvival;
  }
  const temporal = PARAMETERS.shedding.temporal;
  const safeDays = Math.max(daysSinceInfection, 1e-6);
  const logTime = Math.log(safeDays);
  const effectiveSigma = Math.max(temporal.sigma + temporal.kappa * logTime, 1e-6);
  const temporalProfile = Math.exp(temporal.mu - temporal.sigma ** 2 / 2) / safeDays * Math.exp(-((logTime - temporal.mu) ** 2) / (2 * effectiveSigma ** 2));
  const boundedSurvival = clamp01(survival);
  const expectedInfectiousConcentration = Math.max(temporalProfile * jointPeak, PARAMETERS.shedding.titerFloor * boundedSurvival);
  const conditionalConcentration = boundedSurvival > 0 ? expectedInfectiousConcentration / boundedSurvival : 0;
  return {
    survival: boundedSurvival,
    jointPeak: Math.max(0, jointPeak),
    expectedInfectiousConcentration: Math.max(0, expectedInfectiousConcentration),
    conditionalConcentration: Math.max(0, conditionalConcentration)
  };
}

export function integratedShedding(sourceBin: number, ageMonths: number, horizonDays: number): number {
  if (!Number.isInteger(sourceBin) || sourceBin < 0 || sourceBin >= PARAMETERS.immunity.bins) throw new Error("Shedding source bin is invalid");
  if (!Number.isFinite(ageMonths) || ageMonths < 0 || !Number.isInteger(horizonDays) || horizonDays < 1) throw new Error("Integrated shedding inputs are invalid");
  const key = `${SCIENTIFIC_MANIFEST_ID}:${sourceBin}:${ageMonths.toPrecision(15)}:${horizonDays}`;
  const cached = integratedSheddingCache.get(key);
  if (cached !== undefined) {
    integratedSheddingCache.delete(key);
    integratedSheddingCache.set(key, cached);
    return cached;
  }
  let total = 0;
  for (let day = 1; day <= horizonDays; day += 1) total += sheddingTerms(day, sourceBin, ageMonths).expectedInfectiousConcentration;
  integratedSheddingCache.set(key, total);
  while (integratedSheddingCache.size > INTEGRATED_SHEDDING_CACHE_CAPACITY) integratedSheddingCache.delete(integratedSheddingCache.keys().next().value!);
  return total;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
