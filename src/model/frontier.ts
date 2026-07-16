import { FRONTIER_GRID, PARAMETERS } from "./parameters";
import type { DesignGridPoint, FrontierResult, ScenarioV1 } from "./types";
import { buildScheduleState } from "./schedule";
import { rLocForSetting } from "./transmission";
import { computePointMetrics } from "./metrics";

export function buildFrontier(scenario: ScenarioV1): FrontierResult {
  const takeValues = linspace(FRONTIER_GRID.takeContext.min, FRONTIER_GRID.takeContext.max, FRONTIER_GRID.takeContext.count);
  const mu0Values = linspace(FRONTIER_GRID.mu0New.min, FRONTIER_GRID.mu0New.max, FRONTIER_GRID.mu0New.count);
  const points: DesignGridPoint[] = [];
  for (const takeContext of takeValues) {
    for (const mu0 of mu0Values) {
      const vaccine = { ...scenario.vaccine, takeContext, mu0 };
      const state = buildScheduleState(vaccine, scenario.schedule);
      const metrics = computePointMetrics(scenario, state, { includeAnchorSettings: false });
      points.push({ takeContext, mu0, qAcq: metrics.qAcq, qShed: metrics.qShed, rLocMax: metrics.rLocMax, passes: metrics.rLocMax < 1 });
    }
  }
  const pareto = paretoBoundary(points);
  const selected = nearestPoint(points, scenario.vaccine.takeContext, scenario.vaccine.mu0);
  return { takeValues, mu0Values, points, pareto, selected };
}

export function paretoBoundary(points: readonly DesignGridPoint[]): DesignGridPoint[] {
  const tolerance = PARAMETERS.success.tieTolerance;
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
  const state = buildScheduleState({ ...scenario.vaccine, takeContext: point.takeContext, mu0: point.mu0 }, scenario.schedule);
  const metrics = computePointMetrics(scenario, state, { includeAnchorSettings: false });
  return Math.abs(metrics.rLocMax - point.rLocMax) <= 1e-10;
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
