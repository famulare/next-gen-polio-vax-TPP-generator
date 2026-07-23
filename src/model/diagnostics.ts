import { combinedMucosal, initialImmuneState } from "./schedule";
import { clamp01, doseResponse } from "./dose-response";
import { DIAGNOSTIC_GRID, PARAMETERS } from "./parameters";
import { sheddingTerms } from "./shedding";
import { conditionIndexBreakthrough } from "./transmission";
import { DAYS_PER_MONTH } from "./waning";
import type { ImmuneState, ScenarioV1, VaccineV1, WithinHostCohortDiagnosticsV1, WithinHostDiagnosticsV1 } from "./types";

export interface VaccineTakeCurve { level: number; points: { dose: number; take: number }[] }

// Render-time teaching helper: productive vaccine take vs administered dose at a few
// pre-dose immunity levels. Take = dose-response susceptibility x take context. This is
// NOT part of the hashed WithinHostDiagnosticsV1 grid; it never affects model identity.
export function vaccineTakeCurve(vaccine: VaccineV1, immunityLevels: number[], doseGrid: number[]): VaccineTakeCurve[] {
  return immunityLevels.map((level) => ({
    level,
    points: doseGrid.map((dose) => ({ dose, take: clamp01(doseResponse(dose, level, vaccine.alpha, vaccine.beta, vaccine.gamma) * vaccine.takeContext * vaccine.formulationMultiplier) }))
  }));
}

/**
 * Read-only teaching diagnostics. These project the production state and
 * kernels; they never feed back into the transmission calculation.
 */
export function buildWithinHostDiagnostics(scenario: ScenarioV1, vaccinatedState: ImmuneState, modelIdentity: string): WithinHostDiagnosticsV1 {
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
    schemaVersion: "WithinHostDiagnosticsV1",
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
    qIndex: qAcq * qShed
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
