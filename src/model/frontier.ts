import { FRONTIER_GRID, PRODUCT_LABELS, vaccineDefaults } from "./parameters";
import type { ComparatorPoint, DesignGridPoint, FrontierResult, ProductId, ScenarioV1, VaccineV1 } from "./types";
import { buildScheduleState } from "./schedule";
import { createRLocEvaluator, rLocForSetting } from "./transmission";
import { computeProductRatios, envelopeCorner } from "./metrics";

export function buildFrontier(scenario: ScenarioV1): FrontierResult {
  const takeValues = linspace(FRONTIER_GRID.takeContext.min, FRONTIER_GRID.takeContext.max, FRONTIER_GRID.takeContext.count);
  const mu0Values = linspace(FRONTIER_GRID.mu0New.min, FRONTIER_GRID.mu0New.max, FRONTIER_GRID.mu0New.count);
  const familyVaccine = hypotheticalFamilyVaccine(scenario);
  const familySchedule = { ...scenario.schedule, productId: "hypothetical" as const };
  const referenceState = buildScheduleState(familyVaccine, familySchedule);
  const evaluator = createRLocEvaluator(envelopeCorner(scenario), scenario.indexReferenceExposure, referenceState.assessmentAgeDays, scenario.horizonDays);
  const points: DesignGridPoint[] = [];
  for (const takeContext of takeValues) {
    for (const mu0 of mu0Values) {
      const vaccine = { ...familyVaccine, takeContext, mu0 };
      const state = buildScheduleState(vaccine, familySchedule);
      const metrics = computeProductRatios({ ...scenario, vaccine, schedule: familySchedule, comparatorId: "hypothetical" }, state);
      const rLocEnvelopeMax = evaluator(state);
      points.push({ takeContext, mu0, qAcq: metrics.qAcq, qShed: metrics.qShed, rLocEnvelopeMax, passes: passesThreshold(rLocEnvelopeMax) });
    }
  }
  return {
    familyProductId: "hypothetical",
    takeValues,
    mu0Values,
    points,
    pareto: paretoBoundary(points),
    selectedDesign: scenario.vaccine.id === "hypothetical"
      ? nearestPoint(points, scenario.vaccine.takeContext, scenario.vaccine.mu0)
      : null,
    comparators: fixedComparatorPoints(scenario, evaluator)
  };
}

export function passesThreshold(rLocEnvelopeMax: number): boolean {
  return rLocEnvelopeMax < FRONTIER_GRID.contour.threshold - FRONTIER_GRID.contour.tieTolerance;
}

export function paretoBoundary(points: readonly DesignGridPoint[]): DesignGridPoint[] {
  const tolerance = FRONTIER_GRID.contour.tieTolerance;
  const passing = points.filter((point) => point.passes);
  return passing.filter((candidate) => !passing.some((other) => {
    if (other === candidate) return false;
    const xOther = 1 - other.qAcq;
    const yOther = 1 - other.qShed;
    const xCandidate = 1 - candidate.qAcq;
    const yCandidate = 1 - candidate.qShed;
    const noWorse = xOther <= xCandidate + tolerance && yOther <= yCandidate + tolerance;
    const strictlyBetter = xOther < xCandidate - tolerance || yOther < yCandidate - tolerance;
    return noWorse && strictlyBetter;
  })).sort((a, b) => (1 - a.qAcq) - (1 - b.qAcq) || (1 - a.qShed) - (1 - b.qShed));
}

export function gridPointRLocMatchesDirect(scenario: ScenarioV1, point: DesignGridPoint): boolean {
  const vaccine = { ...hypotheticalFamilyVaccine(scenario), takeContext: point.takeContext, mu0: point.mu0 };
  const schedule = { ...scenario.schedule, productId: "hypothetical" as const };
  const state = buildScheduleState(vaccine, schedule);
  const rLocEnvelopeMax = rLocForSetting(state, envelopeCorner(scenario), scenario.indexReferenceExposure, scenario.horizonDays);
  return Math.abs(rLocEnvelopeMax - point.rLocEnvelopeMax) <= 1e-10;
}

function fixedComparatorPoints(scenario: ScenarioV1, evaluator: ReturnType<typeof createRLocEvaluator>): ComparatorPoint[] {
  return (["sabin2", "ipv"] as const).map((productId) => {
    const vaccine = vaccineDefaults(productId);
    const schedule = { ...scenario.schedule, productId };
    const state = buildScheduleState(vaccine, schedule);
    const comparatorScenario = { ...scenario, comparatorId: productId, vaccine, schedule };
    const metrics = computeProductRatios(comparatorScenario, state);
    const rLocEnvelopeMax = evaluator(state);
    return {
      productId,
      label: PRODUCT_LABELS[productId],
      takeContext: productId === "sabin2" ? vaccine.takeContext : null,
      mu0: productId === "sabin2" ? vaccine.mu0 : null,
      qAcq: metrics.qAcq,
      qShed: metrics.qShed,
      rLocEnvelopeMax,
      passes: passesThreshold(rLocEnvelopeMax),
      selected: scenario.vaccine.id === productId
    };
  });
}

function hypotheticalFamilyVaccine(scenario: ScenarioV1): VaccineV1 {
  if (scenario.vaccine.id === "hypothetical") return scenario.vaccine;
  return vaccineDefaults("hypothetical");
}

function nearestPoint(points: readonly DesignGridPoint[], takeContext: number, mu0: number): DesignGridPoint {
  let best = points[0];
  if (!best) throw new Error("Frontier grid cannot be empty");
  let bestDistance = Infinity;
  for (const point of points) {
    const distance = (point.takeContext - takeContext) ** 2 + (point.mu0 - mu0) ** 2;
    if (distance < bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return best;
}

function linspace(min: number, max: number, count: number): number[] {
  return Array.from({ length: count }, (_, index) => min + (max - min) * index / (count - 1));
}
