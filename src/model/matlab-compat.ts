import { normalCdf } from "./bins";

/**
 * Fixed-titer compatibility calculation for the locked Cessation Matlab
 * primary -> secondary -> tertiary motif. It is a calibration comparator only;
 * the production TPP calculation remains distribution-native.
 */
export interface MatlabFixedTiterMotifInput {
  horizonDays: number;
  vaccineDoseTCID50: number;
  perDoseEfficacy: number;
  primaryAgeMonths: number;
  secondaryAgeMonths: number;
  tertiaryAgeMonths: number;
  TihGramsPerExposure: number;
  ThsGramsPerExposure: number;
  dIhExposuresPerPersonDay: number;
  dHsExposuresPerPersonDay: number;
  Ns: number;
  primaryLog2NAb: number;
  secondaryLog2NAb: number;
  tertiaryLog2NAb: number;
}

export interface MatlabFixedTiterMotifOutput {
  primaryIncidence: number[];
  secondaryIncidence: number[];
  tertiaryIncidence: number[];
  primaryPrevalence: number[];
  secondaryPrevalence: number[];
  tertiaryPrevalence: number[];
  primaryTotal: number;
  secondaryTotal: number;
  tertiaryTotal: number;
  rLoc: number;
}

const SOURCE = {
  doseResponse: { beta: 2.31, alpha: 0.444, gamma: 0.4624 },
  sheddingDuration: { b1: Math.log(43), b2: Math.log(1.164), b3: Math.log(1.69) },
  sheddingIntensity: { mu: 1.64, sigma: 0.18, immunitySuppression: 0.056, kappa: 0.32, floor: 10 ** 2.6 },
  peakAge: { max: 6.67, min: 4.29, tauMonths: 9.92 }
} as const;

export function evaluateMatlabFixedTiterMotif(input: MatlabFixedTiterMotifInput): MatlabFixedTiterMotifOutput {
  validateInput(input);
  const primaryIncidence = Array<number>(input.horizonDays).fill(0);
  primaryIncidence[0] = input.perDoseEfficacy * matlabDoseResponse(input.vaccineDoseTCID50, input.primaryLog2NAb);
  const secondaryIncidence = incidenceFromContact(
    primaryIncidence,
    input.primaryLog2NAb,
    input.primaryAgeMonths,
    input.TihGramsPerExposure,
    input.secondaryLog2NAb,
    input.dIhExposuresPerPersonDay
  );
  const tertiaryIncidence = incidenceFromContact(
    secondaryIncidence,
    input.secondaryLog2NAb,
    input.secondaryAgeMonths,
    input.ThsGramsPerExposure,
    input.tertiaryLog2NAb,
    input.dHsExposuresPerPersonDay
  );
  const primaryPrevalence = prevalenceFromIncidence(primaryIncidence, input.primaryLog2NAb);
  const secondaryPrevalence = prevalenceFromIncidence(secondaryIncidence, input.secondaryLog2NAb);
  const tertiaryPrevalence = prevalenceFromIncidence(tertiaryIncidence, input.tertiaryLog2NAb);
  const primaryTotal = sum(primaryIncidence);
  const secondaryTotal = sum(secondaryIncidence);
  const tertiaryTotal = sum(tertiaryIncidence);
  return {
    primaryIncidence,
    secondaryIncidence,
    tertiaryIncidence,
    primaryPrevalence,
    secondaryPrevalence,
    tertiaryPrevalence,
    primaryTotal,
    secondaryTotal,
    tertiaryTotal,
    rLoc: input.Ns * tertiaryTotal / primaryTotal
  };
}

function prevalenceFromIncidence(incidence: readonly number[], log2NAb: number): number[] {
  const prevalence = Array<number>(incidence.length).fill(0);
  for (let infectionDay = 1; infectionDay <= incidence.length; infectionDay += 1) {
    const incidenceMass = incidence[infectionDay - 1] ?? 0;
    if (incidenceMass === 0) continue;
    for (let day = infectionDay; day <= incidence.length; day += 1) {
      prevalence[day - 1]! += incidenceMass * probabilityStillInfected(day, log2NAb, infectionDay);
    }
  }
  return prevalence;
}

function incidenceFromContact(
  sourceIncidence: readonly number[],
  sourceLog2NAb: number,
  sourceAgeMonths: number,
  stoolMassPerExposure: number,
  recipientLog2NAb: number,
  contactsPerDay: number
): number[] {
  const horizonDays = sourceIncidence.length;
  const receivingIncidence = Array<number>(horizonDays).fill(0);
  const survivalByElapsedDay = Array.from({ length: horizonDays }, (_, index) =>
    probabilityStillInfected(index + 1, sourceLog2NAb, 1)
  );
  for (let infectionDay = 1; infectionDay <= horizonDays; infectionDay += 1) {
    const sourceMass = sourceIncidence[infectionDay - 1] ?? 0;
    if (sourceMass === 0) continue;
    const times = Array.from({ length: horizonDays - infectionDay + 1 }, (_, index) => infectionDay + index);
    const firstInfectionByDay = transmissionFromOneSource(
      sourceLog2NAb,
      sourceAgeMonths,
      stoolMassPerExposure,
      times,
      infectionDay,
      recipientLog2NAb,
      contactsPerDay
    );
    for (let index = 0; index < times.length; index += 1) {
      receivingIncidence[infectionDay - 1 + index]! += sourceMass
        * (survivalByElapsedDay[index] ?? 0)
        * (firstInfectionByDay[index] ?? 0);
    }
  }
  return receivingIncidence;
}

function transmissionFromOneSource(
  sourceLog2NAb: number,
  sourceAgeMonths: number,
  stoolMassPerExposure: number,
  times: readonly number[],
  infectionDay: number,
  recipientLog2NAb: number,
  contactsPerDay: number
): number[] {
  const perDayHazards = times.map((day) => {
    const dose = stoolMassPerExposure * sheddingViralLoad(sourceLog2NAb, day, infectionDay, sourceAgeMonths);
    const perExposure = matlabDoseResponse(dose, recipientLog2NAb);
    return 1 - (1 - perExposure) ** contactsPerDay;
  });
  let escape = 1;
  return perDayHazards.map((hazard, index) => {
    const firstInfection = hazard * escape;
    escape *= 1 - hazard;
    return (times[index] ?? 0) < infectionDay + 1 ? 0 : firstInfection;
  });
}

function matlabDoseResponse(dose: number, log2NAb: number): number {
  if (dose <= 0) return 0;
  const exponent = -SOURCE.doseResponse.alpha / (2 ** Math.max(0, log2NAb)) ** SOURCE.doseResponse.gamma;
  return 1 - (1 + dose / SOURCE.doseResponse.beta) ** exponent;
}

function probabilityStillInfected(day: number, log2NAb: number, infectionDay: number): number {
  if (day < infectionDay + 1) return 0;
  const duration = SOURCE.sheddingDuration;
  return 1 - normalCdf((Math.log(Math.abs(day - infectionDay)) - (duration.b1 - duration.b2 * log2NAb)) / duration.b3);
}

function sheddingViralLoad(log2NAb: number, day: number, infectionDay: number, ageMonths: number): number {
  if (day < infectionDay + 1) return 0;
  const elapsed = day - infectionDay;
  const age = SOURCE.peakAge;
  const peakAgeMultiplier = Math.min(age.max, (age.max - age.min) * Math.exp(-(ageMonths - 7) / age.tauMonths) + age.min);
  const peak = 10 ** (peakAgeMultiplier * (1 - SOURCE.sheddingIntensity.immunitySuppression * Math.max(0, log2NAb)));
  const temporal = SOURCE.sheddingIntensity;
  const temporalProfile = Math.exp(temporal.mu - temporal.sigma ** 2 / 2) / (elapsed + 0.01)
    * Math.exp(-((Math.log(elapsed + 0.01) - temporal.mu) ** 2) / (2 * (temporal.sigma + temporal.kappa * Math.log(elapsed)) ** 2));
  return Math.max(peak * temporalProfile, temporal.floor);
}

function validateInput(input: MatlabFixedTiterMotifInput): void {
  const finiteNonnegative = [
    input.vaccineDoseTCID50,
    input.perDoseEfficacy,
    input.primaryAgeMonths,
    input.secondaryAgeMonths,
    input.tertiaryAgeMonths,
    input.TihGramsPerExposure,
    input.ThsGramsPerExposure,
    input.dIhExposuresPerPersonDay,
    input.dHsExposuresPerPersonDay,
    input.Ns,
    input.primaryLog2NAb,
    input.secondaryLog2NAb,
    input.tertiaryLog2NAb
  ];
  if (!Number.isInteger(input.horizonDays) || input.horizonDays < 1 || finiteNonnegative.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Matlab fixed-titer compatibility inputs must be finite and nonnegative, with a positive integer horizon");
  }
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
