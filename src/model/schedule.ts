import { applyBoost, normalizeBins, weightedMix } from "./bins";
import { vaccineTakePerBin } from "./dose-response";
import { PARAMETERS } from "./parameters";
import { waneMucosal } from "./waning";
import type { ImmuneGroup, ImmuneState, ScheduleV1, VaccineV1 } from "./types";

const INITIAL_BINS = [1, ...Array<number>(PARAMETERS.immunity.bins - 1).fill(0)];

export function scheduleDays(schedule: ScheduleV1): number[] {
  const days = [...schedule.routineDays] as number[];
  if (schedule.boosterAgeYears > 0) days.push(365.25 * schedule.boosterAgeYears);
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
  let state = initialImmuneState();
  let currentDay = 0;
  for (const eventDay of scheduleDays(schedule)) {
    state = moveState(state, eventDay - currentDay);
    state = applyDose(state, vaccine);
    state.events.push(eventDay);
    state.lastDoseDay = eventDay;
    currentDay = eventDay;
  }
  state = moveState(state, schedule.assessmentLagDays);
  state.assessmentAgeDays = state.lastDoseDay + schedule.assessmentLagDays;
  return state;
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

export function applyDose(state: ImmuneState, vaccine: VaccineV1): ImmuneState {
  const groups: ImmuneGroup[] = [];
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
    const takeProbability = takeWeights.reduce((sum, value) => sum + value, 0);
    const noTakeProbability = noTakeWeights.reduce((sum, value) => sum + value, 0);
    if (noTakeProbability > 1e-14) {
      groups.push({
        mass: group.mass * noTakeProbability,
        everInfected: group.everInfected,
        mucosal: normalizeBins(noTakeWeights),
        serum: [...group.serum]
      });
    }
    if (takeProbability > 1e-14) {
      const conditionedTake = normalizeBins(takeWeights);
      groups.push({
        mass: group.mass * takeProbability,
        everInfected: true,
        mucosal: applyBoost(conditionedTake, vaccine.mu0, vaccine.sigma0, group.everInfected),
        serum: applyBoost(group.serum, vaccine.mu0, vaccine.sigma0, group.everInfected)
      });
    }
  }
  return { ...state, groups: mergeGroups(groups) };
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
  if (total <= 0) return [{ mass: 1, everInfected: false, mucosal: [...INITIAL_BINS], serum: [...INITIAL_BINS] }];
  return merged.map((group) => ({ ...group, mass: group.mass / total }));
}

function cloneState(state: ImmuneState): ImmuneState {
  return {
    ...state,
    groups: state.groups.map((group) => ({ ...group, mucosal: [...group.mucosal], serum: [...group.serum] }),),
    events: [...state.events]
  };
}
