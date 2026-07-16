import { normalCdf } from "./bins";
import { PARAMETERS } from "./parameters";

export interface SheddingTerms {
  survival: number;
  jointPeak: number;
  concentration: number;
}

export function sheddingTerms(daysSinceInfection: number, sourceBin: number, ageMonths: number): SheddingTerms {
  if (daysSinceInfection <= 0) return { survival: 1, jointPeak: 0, concentration: 0 };
  const duration = PARAMETERS.wpv1.sheddingDuration;
  const b0 = (Math.log(daysSinceInfection) - duration.b1) / duration.b3;
  const b1 = duration.b2 / duration.b3;
  const sd = PARAMETERS.quadrature.sheddingWithinBinSd;
  const denominator = Math.sqrt(1 + (b1 * sd) ** 2);
  const age = PARAMETERS.shedding.age;
  const agePeak = age.aMin + (age.aMax - age.aMin) * Math.exp(-ageMonths / age.tauMonths);
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
  const concentration = Math.max(temporalProfile * jointPeak, PARAMETERS.shedding.titerFloor * survival);
  return { survival: clamp01(survival), jointPeak: Math.max(0, jointPeak), concentration: Math.max(0, concentration) };
}

export function integratedShedding(sourceBin: number, ageMonths: number, horizonDays: number): number {
  let total = 0;
  for (let day = 1; day <= horizonDays; day += 1) total += sheddingTerms(day, sourceBin, ageMonths).concentration;
  return total;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
