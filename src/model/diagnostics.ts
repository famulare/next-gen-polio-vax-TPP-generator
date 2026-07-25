import { buildScheduleTrace, buildStateAtAssessment, combinedMucosal, initialImmuneState, scheduleDays } from "./schedule";
import { clamp01, doseResponse } from "./dose-response";
import { DIAGNOSTIC_GRID, PARAMETERS } from "./parameters";
import { sheddingTerms } from "./shedding";
import { conditionIndexBreakthrough } from "./transmission";
import { DAYS_PER_MONTH } from "./waning";
import type { BoostResponsePointV1, ImmuneResponseDiagnosticsV1, ImmuneState, ScenarioV1, ScheduleMonthlySnapshotV1, ScheduleV1, VaccineV1, WithinHostCohortDiagnosticsV1, WithinHostDiagnosticsV2 } from "./types";

export interface VaccineTakeCurve { level: number; points: { dose: number; take: number }[] }

// Render-time teaching helper: productive vaccine take vs administered dose at a few
// pre-dose immunity levels. Take = dose-response susceptibility x take context. This is
// NOT part of the hashed within-host diagnostic grid; it never affects model identity.
export function vaccineTakeCurve(vaccine: VaccineV1, immunityLevels: number[], doseGrid: number[]): VaccineTakeCurve[] {
  return immunityLevels.map((level) => ({
    level,
    points: doseGrid.map((dose) => ({ dose, take: clamp01(doseResponse(dose, level, vaccine.alpha, vaccine.beta, vaccine.gamma) * vaccine.takeContext * vaccine.formulationMultiplier) }))
  }));
}

/**
 * Panel A of the immune-response teaching figure. For each integer pre-dose
 * state x = 0..15, this reports the exact Section 7.3 boost operator summary:
 * the mean log2 shift, its implied response-center fold rise, the post-response
 * mean and SD, the modeled log2 variance, and the clipped ±1 SD display band.
 * The curve is conditioned on successful live-vaccine take and summarizes the
 * Gaussian before projection into bins; it is null for non-live IPV.
 */
export function boostResponsePoints(vaccine: VaccineV1): BoostResponsePointV1[] | null {
  if (!vaccine.live) return null;
  const nMax = PARAMETERS.immunity.maxLog2;
  return Array.from({ length: PARAMETERS.immunity.bins }, (_, preStateLog2) => {
    const scale = Math.max(0, 1 - preStateLog2 / nMax);
    const meanShiftLog2 = vaccine.mu0 * scale;
    const postMeanLog2 = Math.min(nMax, preStateLog2 + vaccine.mu0 * scale);
    const postSdLog2 = vaccine.sigma0 * scale;
    return {
      preStateLog2,
      meanShiftLog2,
      responseCenterFoldRise: 2 ** meanShiftLog2,
      postMeanLog2,
      postSdLog2,
      postVarianceLog2Squared: postSdLog2 * postSdLog2,
      bandLowLog2: Math.max(0, postMeanLog2 - postSdLog2),
      bandHighLog2: Math.min(nMax, postMeanLog2 + postSdLog2)
    };
  });
}

/**
 * Deterministic read-only immune-response diagnostics: the Panel A boost-response
 * curve plus the Panel B schedule trace. Both derive from the exact production
 * transitions; the schedule trace reruns the identical event loop so its final
 * assessment snapshot equals the vaccinated diagnostic distribution. For a live
 * vaccine the display maps the modeled state one-to-one to a serum-equivalent
 * titer; IPV keeps distinct serum and mucosal semantics and has no live take.
 */
export function buildImmuneResponseDiagnostics(vaccine: VaccineV1, schedule: ScheduleV1): ImmuneResponseDiagnosticsV1 {
  const trace = buildScheduleTrace(vaccine, schedule);
  return {
    schemaVersion: "ImmuneResponseDiagnosticsV1",
    displayMapping: vaccine.live ? "serum-equivalent-live-opv-like" : "mucosal-only-ipv",
    responseCondition: vaccine.live ? "conditioned on successful live-vaccine take" : "not applicable to non-live IPV",
    boostResponse: boostResponsePoints(vaccine),
    scheduleSnapshots: trace.snapshots,
    monthlyTrace: buildMonthlyTrace(vaccine, schedule),
    doseDiagnostics: trace.doseDiagnostics
  };
}

/**
 * Panel B sampling: the waned cohort distribution at each integer month of age
 * from birth through assessment, plus an exact sample at the assessment age.
 * Each sample runs the same production schedule engine to that age, so the final
 * sample equals the vaccinated diagnostic distribution.
 */
function buildMonthlyTrace(vaccine: VaccineV1, schedule: ScheduleV1): ScheduleMonthlySnapshotV1[] {
  const doseDays = scheduleDays(schedule);
  const assessmentDays = (doseDays.at(-1) ?? 0) + schedule.assessmentLagDays;
  const lastMonth = Math.floor(assessmentDays / DAYS_PER_MONTH);
  const points: ScheduleMonthlySnapshotV1[] = [];
  for (let month = 0; month <= lastMonth; month += 1) {
    points.push(monthlySample(vaccine, doseDays, month * DAYS_PER_MONTH, month));
  }
  if (Math.abs(lastMonth * DAYS_PER_MONTH - assessmentDays) > 1e-9) {
    points.push(monthlySample(vaccine, doseDays, assessmentDays, assessmentDays / DAYS_PER_MONTH));
  }
  return points;
}

function monthlySample(vaccine: VaccineV1, doseDays: number[], ageDays: number, ageMonths: number): ScheduleMonthlySnapshotV1 {
  const dosesBefore = doseDays.filter((day) => day <= ageDays);
  const bins = combinedMucosal(buildStateAtAssessment(vaccine, dosesBefore, ageDays));
  return { ageMonths, ageDays, mucosalBins: bins, meanStateLog2: bins.reduce((sum, mass, bin) => sum + mass * bin, 0) };
}

/**
 * Read-only teaching diagnostics. These project the production state and
 * kernels; they never feed back into the transmission calculation.
 */
export function buildWithinHostDiagnostics(scenario: ScenarioV1, vaccinatedState: ImmuneState, modelIdentity: string): WithinHostDiagnosticsV2 {
  const referenceState: ImmuneState = {
    ...initialImmuneState(),
    assessmentAgeDays: vaccinatedState.assessmentAgeDays
  };
  const reference = cohortDiagnostics("naive-reference", "Naive reference cohort", referenceState, scenario);
  const vaccinated = cohortDiagnostics("selected-vaccinated", "Selected vaccinated cohort", vaccinatedState, scenario);
  const qAcq = reference.acquisitionAtReference > 0
    ? stableDiagnosticNumber(vaccinated.acquisitionAtReference / reference.acquisitionAtReference)
    : 0;
  const qShed = reference.integratedConditionalBurdenTCID50DaysPerGram > 0
    ? stableDiagnosticNumber(vaccinated.integratedConditionalBurdenTCID50DaysPerGram / reference.integratedConditionalBurdenTCID50DaysPerGram)
    : 0;
  return {
    schemaVersion: "WithinHostDiagnosticsV2",
    gridVersion: DIAGNOSTIC_GRID.version,
    gridSchemaVersion: DIAGNOSTIC_GRID.schemaVersion,
    sourceParameterSchemaVersion: PARAMETERS.schemaVersion,
    sourceParameterManifestVersion: PARAMETERS.manifestVersion,
    modelIdentity,
    challengeUnit: "CID50",
    units: {
      challengeDose: "CID50",
      assessmentAge: "days",
      sheddingTime: "days after WPV acquisition",
      concentration: "TCID50/g",
      dailyBurden: "TCID50/g",
      integratedBurden: "TCID50-days/g",
      sheddingIndex: "TCID50-days/g"
    },
    referenceChallengeDoseCID50: scenario.indexReferenceExposure,
    assessmentAgeDays: vaccinatedState.assessmentAgeDays,
    acquisitionCondition: "productive WPV acquisition after oral challenge",
    sheddingCondition: "conditioned on WPV acquisition",
    burdenDefinition: "survival probability times concentration conditional on still shedding",
    reference,
    vaccinated,
    qAcq,
    qShed,
    qIndex: qAcq * qShed,
    immuneResponse: buildImmuneResponseDiagnostics(scenario.vaccine, scenario.schedule)
  };
}

function cohortDiagnostics(
  id: WithinHostCohortDiagnosticsV1["id"],
  label: string,
  state: ImmuneState,
  scenario: ScenarioV1
): WithinHostCohortDiagnosticsV1 {
  const referenceBreakthrough = conditionIndexBreakthrough(state, scenario.indexReferenceExposure);
  const ageMonths = state.assessmentAgeDays / DAYS_PER_MONTH;
  const sheddingByDay = diagnosticTimeGrid().map((day) => {
    let survivalProbability = 0;
    let expectedInfectiousConcentrationTCID50PerGram = 0;
    for (const cohort of referenceBreakthrough.cohorts) {
      const terms = sheddingTerms(day, cohort.sourceBin, ageMonths);
      survivalProbability += cohort.mass * terms.survival;
      expectedInfectiousConcentrationTCID50PerGram += cohort.mass * terms.expectedInfectiousConcentration;
    }
    const survival = stableDiagnosticNumber(survivalProbability);
    const jointBurden = stableDiagnosticNumber(expectedInfectiousConcentrationTCID50PerGram);
    return {
      day,
      survivalProbability: survival,
      conditionalConcentrationTCID50PerGram: survival > 0
        ? stableDiagnosticNumber(jointBurden / survival)
        : 0,
      expectedInfectiousConcentrationTCID50PerGram: jointBurden
    };
  });
  const integratedConditionalBurdenTCID50DaysPerGram = stableDiagnosticNumber(sheddingByDay.reduce(
    (sum, point) => sum + point.expectedInfectiousConcentrationTCID50PerGram,
    0
  ));
  const acquisitionAtReference = stableDiagnosticNumber(referenceBreakthrough.probability);
  return {
    id,
    label,
    immunityBins: combinedMucosal(state),
    acquisitionByDose: diagnosticDoseGrid().map((doseCID50) => ({
      doseCID50,
      probability: stableDiagnosticNumber(conditionIndexBreakthrough(state, doseCID50).probability)
    })),
    acquisitionAtReference,
    sheddingByDay,
    integratedConditionalBurdenTCID50DaysPerGram,
    sheddingIndexAtReferenceTCID50DaysPerGram: stableDiagnosticNumber(acquisitionAtReference * integratedConditionalBurdenTCID50DaysPerGram)
  };
}

/**
 * The teaching grids are exported across browser and Node runtimes. Quantizing
 * their read-only values to 15 significant digits removes one-ULP libm drift
 * without changing a model kernel, metric, or displayed precision.
 */
function stableDiagnosticNumber(value: number): number {
  return value === 0 ? 0 : Number(value.toPrecision(15));
}

export function diagnosticDoseGrid(): number[] {
  const grid = DIAGNOSTIC_GRID.challengeDose;
  return Array.from({ length: grid.count }, (_, index) => {
    const fraction = index / (grid.count - 1);
    return grid.min * (grid.max / grid.min) ** fraction;
  });
}

export function diagnosticTimeGrid(): number[] {
  const grid = DIAGNOSTIC_GRID.timeDays;
  return Array.from({ length: Math.floor((grid.max - grid.min) / grid.step) + 1 }, (_, index) => grid.min + index * grid.step);
}
