import { passesThreshold } from "../model/frontier";
import { FRONTIER_GRID, PRODUCT_LABELS, SETTING_ANCHORS } from "../model/parameters";
import type { AnchorSettingId, DesignGridPoint, EnvelopeV1, ModelOutputsV1, PointMetrics, ScenarioV1, SettingId } from "../model/types";

export type ResultBranch = "pass" | "fail" | "tie";
export type FrontierBranch = "available" | "empty";
export type UncertaintyBranch = "unavailable";

export interface ScientificState {
  scenario: ScenarioV1;
  outputs: ModelOutputsV1;
  modelIdentity: string;
}

export interface ViewState {
  probeId: SettingId;
  hoveredDesignKey: string | null;
  selectedDesignKey: string | null;
  chapterId: string | null;
  drawerOpen: boolean;
}

export interface ReleaseState {
  status: "prototype";
  exportable: boolean;
  buildIdentity: string;
}

export type TransactionState =
  | { kind: "committed"; scientific: ScientificState }
  | { kind: "pending"; prior: ScientificState | null; message: string }
  | { kind: "stale"; prior: ScientificState; message: string }
  | { kind: "invalid"; prior: ScientificState | null; message: string }
  | { kind: "failed"; prior: ScientificState | null; message: string };

export interface ResultView {
  branch: ResultBranch;
  statusLabel: string;
  headline: string;
  value: number;
  criterion: string;
  scopeLabel: string;
  scopeShortLabel: string;
  qualification: string;
}
export interface CandidateView { label: string; schedule: string; assessment: string }

export interface PresentationModel {
  result: ResultView;
  candidate: CandidateView;
  frontier: { branch: FrontierBranch; passingCount: number; paretoCount: number; message: string };
  uncertainty: { branch: UncertaintyBranch; label: string; reason: string };
  identity: { exactDesign: string; nearestGrid: string; model: string };
  comparators: Array<{ id: string; label: string; status: string }>;
}

// Frontier-free: the verdict + candidate summary derive only from point metrics and the
// scenario, so the live tier can render them before the committed frontier is recomputed.
export function buildResult(metrics: PointMetrics, scenario: ScenarioV1): ResultView {
  const value = metrics.rLocEnvelopeMax;
  const difference = Math.abs(value - FRONTIER_GRID.contour.threshold);
  const branch: ResultBranch = difference <= FRONTIER_GRID.contour.tieTolerance
    ? "tie"
    : passesThreshold(value) ? "pass" : "fail";
  const scope = describeDecisionScope(scenario.envelope);
  const hardestKnown = scope.id === "up-bihar";
  const headline = branch === "pass"
    ? hardestKnown
      ? "This candidate clears the hardest known modeled anchor."
      : "This candidate meets the selected close-contact criterion."
    : branch === "tie"
      ? "This candidate is at the threshold and does not meet the strict criterion."
      : "This candidate does not meet the selected close-contact criterion.";
  const statusLabel = branch === "pass" ? "Meets criterion" : branch === "tie" ? "Threshold tie — does not meet" : "Does not meet criterion";
  const qualification = hardestKnown
    ? "Clearing UP/Bihar supports likely adequacy under less demanding conditions represented by this mechanism, but does not prove control everywhere. The result applies to the v1 close-contact motif, not a complete-population R_e."
    : "The result applies only to the declared decision scope under the v1 close-contact sufficiency axiom. It is not a complete-population R_e, an outbreak forecast, or a probability of success.";
  return {
    branch,
    statusLabel,
    headline,
    value,
    criterion: `${PRESENTATION_LABELS.criterion}; equality within ${FRONTIER_GRID.contour.tieTolerance} does not meet`,
    scopeLabel: scope.label,
    scopeShortLabel: scope.shortLabel,
    qualification
  };
}

export function buildCandidate(scenario: ScenarioV1): CandidateView {
  return {
    label: PRODUCT_LABELS[scenario.vaccine.id],
    schedule: scheduleLabel(scenario),
    assessment: `${scenario.schedule.assessmentLagDays} days after the last dose`
  };
}

export const PRESENTATION_LABELS = {
  candidate: "Candidate",
  schedule: "Schedule",
  probe: "Inspection probe",
  decisionScope: "Decision scope",
  criterion: `Direct R_loc < ${FRONTIER_GRID.contour.threshold}`,
  exactDesign: "Selected exact design",
  nearestGrid: "Nearest evaluated grid point",
  comparators: "Fixed comparators"
} as const;

export function buildPresentation(outputs: ModelOutputsV1): PresentationModel {
  const passingCount = outputs.frontier.points.filter((point) => point.passes).length;
  const paretoCount = outputs.frontier.pareto.length;
  const frontierBranch: FrontierBranch = paretoCount > 0 ? "available" : "empty";
  const selected = outputs.frontier.selectedDesign;
  const nearest = outputs.frontier.nearestGridPoint;
  return {
    result: buildResult(outputs.metrics, outputs.scenario),
    candidate: buildCandidate(outputs.scenario),
    frontier: {
      branch: frontierBranch,
      passingCount,
      paretoCount,
      message: frontierBranch === "available"
        ? `${passingCount.toLocaleString("en-US")} of ${outputs.frontier.points.length.toLocaleString("en-US")} evaluated designs meet the criterion; ${paretoCount} lie on the minimum-sufficient Pareto boundary.`
        : `No evaluated hypothetical design meets the selected scope. No Pareto line is drawn.`
    },
    uncertainty: {
      branch: "unavailable",
      label: "Parameter uncertainty unavailable in this version",
      reason: outputs.uncertainty.reason
    },
    identity: {
      exactDesign: selected ? designLabel(selected) : "Fixed comparator selected",
      nearestGrid: nearest ? designLabel(nearest) : "Not applicable",
      model: outputs.modelIdentity
    },
    comparators: outputs.frontier.comparators.map((point) => ({
      id: point.productId,
      label: point.label,
      status: point.passes ? "meets criterion" : "does not meet criterion"
    }))
  };
}

export function describeDecisionScope(envelope: EnvelopeV1): { id: AnchorSettingId | "custom"; label: string; shortLabel: string } {
  for (const anchor of SETTING_ANCHORS) {
    if (envelope.TihMin === anchor.Tih.value && envelope.TihMax === anchor.Tih.value
      && envelope.ThsMin === anchor.Ths.value && envelope.ThsMax === anchor.Ths.value
      && envelope.NsMin === anchor.Ns && envelope.NsMax === anchor.Ns
      && envelope.dIhMin === anchor.dIh.value && envelope.dIhMax === anchor.dIh.value
      && envelope.dHsMin === anchor.dHs.value && envelope.dHsMax === anchor.dHs.value) {
      return { id: anchor.id, label: `${anchor.label} singleton anchor`, shortLabel: anchor.label };
    }
  }
  const exposure = envelope.linkedExposure
    ? `${formatMicrograms(envelope.TihMin)}–${formatMicrograms(envelope.TihMax)} µg/exposure`
    : `Tih ${formatMicrograms(envelope.TihMin)}–${formatMicrograms(envelope.TihMax)} and Ths ${formatMicrograms(envelope.ThsMin)}–${formatMicrograms(envelope.ThsMax)} µg/exposure`;
  return {
    id: "custom",
    label: `Custom rectangular scope: ${exposure}; ${envelope.NsMin}–${envelope.NsMax} close social contacts`,
    shortLabel: "Custom rectangular scope"
  };
}

export function designKey(point: Pick<DesignGridPoint, "takeContext" | "mu0">): string {
  return `${point.takeContext.toFixed(6)}:${point.mu0.toFixed(6)}`;
}

function designLabel(point: Pick<DesignGridPoint, "takeContext" | "mu0">): string {
  return `take ${point.takeContext.toFixed(2)}, mean boost ${point.mu0.toFixed(2)} log2`;
}

function scheduleLabel(scenario: ScenarioV1): string {
  const booster = scenario.schedule.boosterAgeYears === 0
    ? "no booster"
    : `booster at ${scenario.schedule.boosterAgeYears} year${scenario.schedule.boosterAgeYears === 1 ? "" : "s"}`;
  return `RI at 6, 10, and 14 weeks; ${booster}`;
}

function formatMicrograms(grams: number): string {
  const value = grams * 1_000_000;
  return value >= 100 ? value.toFixed(0) : value >= 1 ? value.toFixed(1) : value.toPrecision(2);
}
