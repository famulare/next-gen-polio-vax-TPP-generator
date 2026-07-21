import { combinedMucosal, initialImmuneState } from "./schedule";
import { DIAGNOSTIC_GRID } from "./parameters";
import { sheddingTerms } from "./shedding";
import { conditionIndexBreakthrough } from "./transmission";
import { DAYS_PER_MONTH } from "./waning";
import type { ImmuneState, ScenarioV1, WithinHostCohortDiagnosticsV1, WithinHostDiagnosticsV1 } from "./types";

/**
 * Read-only teaching diagnostics. These project the production state and
 * kernels; they never feed back into the transmission calculation.
 */
export function buildWithinHostDiagnostics(scenario: ScenarioV1, vaccinatedState: ImmuneState): WithinHostDiagnosticsV1 {
  const referenceState: ImmuneState = {
    ...initialImmuneState(),
    assessmentAgeDays: vaccinatedState.assessmentAgeDays
  };
  const reference = cohortDiagnostics("naive-reference", "Naive reference cohort", referenceState, scenario);
  const vaccinated = cohortDiagnostics("selected-vaccinated", "Selected vaccinated cohort", vaccinatedState, scenario);
  const qAcq = reference.acquisitionAtReference > 0
    ? vaccinated.acquisitionAtReference / reference.acquisitionAtReference
    : 0;
  const qShed = reference.integratedConditionalBurdenTCID50DaysPerGram > 0
    ? vaccinated.integratedConditionalBurdenTCID50DaysPerGram / reference.integratedConditionalBurdenTCID50DaysPerGram
    : 0;
  return {
    schemaVersion: "WithinHostDiagnosticsV1",
    gridVersion: DIAGNOSTIC_GRID.version,
    challengeUnit: "CID50",
    referenceChallengeDoseCID50: scenario.indexReferenceExposure,
    assessmentAgeDays: vaccinatedState.assessmentAgeDays,
    sheddingCondition: "conditioned on WPV acquisition",
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
  const sheddingByDay = timeGrid().map((day) => {
    let survivalProbability = 0;
    let expectedInfectiousConcentrationTCID50PerGram = 0;
    for (const cohort of referenceBreakthrough.cohorts) {
      const terms = sheddingTerms(day, cohort.sourceBin, ageMonths);
      survivalProbability += cohort.mass * terms.survival;
      expectedInfectiousConcentrationTCID50PerGram += cohort.mass * terms.expectedInfectiousConcentration;
    }
    return {
      day,
      survivalProbability,
      conditionalConcentrationTCID50PerGram: survivalProbability > 0
        ? expectedInfectiousConcentrationTCID50PerGram / survivalProbability
        : 0,
      expectedInfectiousConcentrationTCID50PerGram
    };
  });
  return {
    id,
    label,
    immunityBins: combinedMucosal(state),
    acquisitionByDose: doseGrid().map((doseCID50) => ({
      doseCID50,
      probability: conditionIndexBreakthrough(state, doseCID50).probability
    })),
    acquisitionAtReference: referenceBreakthrough.probability,
    sheddingByDay,
    integratedConditionalBurdenTCID50DaysPerGram: sheddingByDay.reduce(
      (sum, point) => sum + point.expectedInfectiousConcentrationTCID50PerGram,
      0
    )
  };
}

function doseGrid(): number[] {
  const grid = DIAGNOSTIC_GRID.challengeDose;
  return Array.from({ length: grid.count }, (_, index) => {
    const fraction = index / (grid.count - 1);
    return grid.min * (grid.max / grid.min) ** fraction;
  });
}

function timeGrid(): number[] {
  const grid = DIAGNOSTIC_GRID.timeDays;
  return Array.from({ length: Math.floor((grid.max - grid.min) / grid.step) + 1 }, (_, index) => grid.min + index * grid.step);
}
