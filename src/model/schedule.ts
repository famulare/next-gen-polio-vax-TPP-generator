import { applyBoost, normalizeBins, weightedMix } from "./bins";
import { vaccineTakePerBin } from "./dose-response";
import { PARAMETERS } from "./parameters";
import { DAYS_PER_YEAR, waneMucosal } from "./waning";
import type { ImmuneGroup, ImmuneState, ScheduleDoseDiagnosticV1, ScheduleTraceSnapshotV1, ScheduleV1, VaccineV1 } from "./types";

const INITIAL_BINS = [1, ...Array<number>(PARAMETERS.immunity.bins - 1).fill(0)];

export function scheduleDays(schedule: ScheduleV1): number[] {
  const days = [...schedule.routineDays] as number[];
  if (schedule.boosterAgeYears > 0) days.push(DAYS_PER_YEAR * schedule.boosterAgeYears);
  return days.sort((a, b) => a - b);
}

export function initialImmuneState(): ImmuneState {
  return {
    groups: [{ mass: 1, everInfected: false, mucosal: [...INITIAL_BINS], serum: [...INITIAL_BINS] }],
    assessmentAgeDays: 0,
    lastDoseDay: 0,
    events: []
  };
}

export function buildScheduleState(vaccine: VaccineV1, schedule: ScheduleV1): ImmuneState {
  if (vaccine.id !== schedule.productId) throw new Error("Schedule product and vaccine product must match");
  const doseDays = scheduleDays(schedule);
  const lastDoseDay = doseDays.at(-1) ?? 0;
  return buildStateAtAssessment(vaccine, doseDays, lastDoseDay + schedule.assessmentLagDays);
}

/**
 * Applies an explicit dose sequence through a specified assessment age. This
 * shared state transition is used by the locked app schedule and the
 * calibration-only schedule; only their allowed input domains differ. The
 * production path runs without allocating any trace, so the dominant frontier
 * loop pays no teaching cost.
 */
export function buildStateAtAssessment(vaccine: VaccineV1, doseDays: readonly number[], assessmentAgeDays: number): ImmuneState {
  return runSchedule(vaccine, doseDays, assessmentAgeDays, null).state;
}

export interface ScheduleTraceResult {
  state: ImmuneState;
  snapshots: ScheduleTraceSnapshotV1[];
  doseDiagnostics: ScheduleDoseDiagnosticV1[];
}

/**
 * Runs the identical event loop as `buildScheduleState` while recording a
 * distribution-native snapshot before and after every dose plus the initial and
 * assessment states. It reuses the same dose transition, so the trace's final
 * state equals `buildScheduleState`. Snapshots hold cloned marginals; later
 * transitions never mutate earlier snapshots.
 */
export function buildScheduleTrace(vaccine: VaccineV1, schedule: ScheduleV1): ScheduleTraceResult {
  if (vaccine.id !== schedule.productId) throw new Error("Schedule product and vaccine product must match");
  const doseDays = scheduleDays(schedule);
  const lastDoseDay = doseDays.at(-1) ?? 0;
  const boosterDay = schedule.boosterAgeYears > 0 ? DAYS_PER_YEAR * schedule.boosterAgeYears : null;
  const doseLabels = doseDays.map((day, index) => (boosterDay !== null && day === boosterDay ? "Booster" : `Dose ${index + 1}`));
  const recorder: TraceRecorder = { snapshots: [], doseDiagnostics: [], doseLabels, sequence: 0 };
  const { state } = runSchedule(vaccine, doseDays, lastDoseDay + schedule.assessmentLagDays, recorder);
  return { state, snapshots: recorder.snapshots, doseDiagnostics: recorder.doseDiagnostics };
}

interface TraceRecorder {
  snapshots: ScheduleTraceSnapshotV1[];
  doseDiagnostics: ScheduleDoseDiagnosticV1[];
  doseLabels: string[];
  sequence: number;
}

function recordSnapshot(
  recorder: TraceRecorder,
  state: ImmuneState,
  day: number,
  phase: ScheduleTraceSnapshotV1["phase"],
  doseNumber: number | null,
  label: string
): void {
  const mucosalBins = combinedMucosal(state);
  recorder.snapshots.push({
    sequence: recorder.sequence,
    day,
    phase,
    doseNumber,
    label,
    mucosalBins,
    meanStateLog2: mucosalBins.reduce((sum, mass, bin) => sum + mass * bin, 0)
  });
  recorder.sequence += 1;
}

function runSchedule(
  vaccine: VaccineV1,
  doseDays: readonly number[],
  assessmentAgeDays: number,
  recorder: TraceRecorder | null
): { state: ImmuneState } {
  if (!Number.isFinite(assessmentAgeDays) || assessmentAgeDays < 0) throw new Error("Assessment age must be finite and nonnegative");
  let state = initialImmuneState();
  if (recorder) recordSnapshot(recorder, state, 0, "initial", null, "Birth");
  let currentDay = 0;
  for (const [index, doseDay] of doseDays.entries()) {
    if (!Number.isFinite(doseDay) || doseDay < currentDay || doseDay > assessmentAgeDays) {
      throw new Error("Dose days must be sorted, finite, and no later than assessment");
    }
    state = moveState(state, doseDay - currentDay);
    const doseNumber = index + 1;
    const doseLabel = recorder?.doseLabels[index] ?? `Dose ${doseNumber}`;
    if (recorder) recordSnapshot(recorder, state, doseDay, "pre-dose", doseNumber, `Before ${doseLabel}`);
    const transition = applyDoseWithTake(state, vaccine);
    state = transition.state;
    state = { ...state, events: [...state.events, doseDay], lastDoseDay: doseDay };
    if (recorder) {
      recordSnapshot(recorder, state, doseDay, "post-dose", doseNumber, `After ${doseLabel}`);
      recorder.doseDiagnostics.push({ doseNumber, day: doseDay, aggregateTakeProbability: transition.aggregateTakeProbability });
    }
    currentDay = doseDay;
  }
  state = moveState(state, assessmentAgeDays - currentDay);
  state = { ...state, assessmentAgeDays };
  if (recorder) recordSnapshot(recorder, state, assessmentAgeDays, "assessment", null, "Assessment");
  return { state };
}

export function moveState(state: ImmuneState, elapsedDays: number): ImmuneState {
  if (elapsedDays < -1e-9) throw new Error("State cannot move backwards");
  if (elapsedDays === 0) return cloneState(state);
  return {
    ...state,
    groups: state.groups.map((group) => ({
      ...group,
      mucosal: waneMucosal(group.mucosal, elapsedDays),
      serum: waneMucosal(group.serum, elapsedDays)
    }))
  };
}

/**
 * The single dose transition shared by the production schedule and the teaching
 * trace. It returns the post-dose state and, for a live vaccine, the aggregate
 * take probability computed from the exact bin-specific take weights it uses to
 * split take/no-take mass. IPV has no live-vaccine take coordinate and returns
 * `null`.
 */
export function applyDoseWithTake(state: ImmuneState, vaccine: VaccineV1): { state: ImmuneState; aggregateTakeProbability: number | null } {
  const groups: ImmuneGroup[] = [];
  let aggregateTakeMass = 0;
  for (const group of state.groups) {
    if (!vaccine.live) {
      groups.push({
        mass: group.mass,
        everInfected: group.everInfected,
        mucosal: group.everInfected ? applyBoost(group.mucosal, PARAMETERS.boosts.sabin.mu0, PARAMETERS.boosts.sabin.sigma0, true) : [...group.mucosal],
        serum: applyBoost(group.serum, PARAMETERS.boosts.sabin.mu0, PARAMETERS.boosts.sabin.sigma0, group.everInfected)
      });
      continue;
    }

    const take = vaccineTakePerBin(vaccine.dose, vaccine.alpha, vaccine.beta, vaccine.gamma, vaccine.takeContext, vaccine.formulationMultiplier, group.everInfected);
    const takeWeights = group.mucosal.map((value, bin) => value * (take[bin] ?? 0));
    const noTakeWeights = group.mucosal.map((value, bin) => value * (1 - (take[bin] ?? 0)));
    const takeSerumWeights = group.serum.map((value, bin) => value * (take[bin] ?? 0));
    const noTakeSerumWeights = group.serum.map((value, bin) => value * (1 - (take[bin] ?? 0)));
    const takeProbability = takeWeights.reduce((sum, value) => sum + value, 0);
    const noTakeProbability = noTakeWeights.reduce((sum, value) => sum + value, 0);
    aggregateTakeMass += group.mass * takeProbability;
    if (noTakeProbability > 1e-14) {
      groups.push({
        mass: group.mass * noTakeProbability,
        everInfected: group.everInfected,
        mucosal: normalizeBins(noTakeWeights),
        serum: normalizeBins(noTakeSerumWeights)
      });
    }
    if (takeProbability > 1e-14) {
      const conditionedTake = normalizeBins(takeWeights);
      const conditionedTakeSerum = normalizeBins(takeSerumWeights);
      groups.push({
        mass: group.mass * takeProbability,
        everInfected: true,
        mucosal: applyBoost(conditionedTake, vaccine.mu0, vaccine.sigma0, group.everInfected),
        serum: applyBoost(conditionedTakeSerum, vaccine.mu0, vaccine.sigma0, group.everInfected)
      });
    }
  }
  return { state: { ...state, groups: mergeGroups(groups) }, aggregateTakeProbability: vaccine.live ? aggregateTakeMass : null };
}

export function applyDose(state: ImmuneState, vaccine: VaccineV1): ImmuneState {
  return applyDoseWithTake(state, vaccine).state;
}

export function combinedMucosal(state: ImmuneState): number[] {
  return weightedMix(state.groups.map((group) => ({ mass: group.mass, bins: group.mucosal })));
}

export function mergeGroups(groups: ImmuneGroup[]): ImmuneGroup[] {
  const merged: ImmuneGroup[] = [];
  for (const everInfected of [false, true]) {
    const matching = groups.filter((group) => group.everInfected === everInfected && group.mass > 0);
    if (matching.length === 0) continue;
    const mass = matching.reduce((sum, group) => sum + group.mass, 0);
    merged.push({
      mass,
      everInfected,
      mucosal: weightedMix(matching.map((group) => ({ mass: group.mass, bins: group.mucosal }))),
      serum: weightedMix(matching.map((group) => ({ mass: group.mass, bins: group.serum })))
    });
  }
  const total = merged.reduce((sum, group) => sum + group.mass, 0);
  if (total <= 0) return initialImmuneState().groups;
  return merged.map((group) => ({ ...group, mass: group.mass / total }));
}

function cloneState(state: ImmuneState): ImmuneState {
  return {
    ...state,
    groups: state.groups.map((group) => ({ ...group, mucosal: [...group.mucosal], serum: [...group.serum] }),),
    events: [...state.events]
  };
}
