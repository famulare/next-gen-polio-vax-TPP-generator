import { integratedShedding } from "./shedding";
import { PARAMETERS, SETTING_ANCHORS } from "./parameters";
import { conditionIndexBreakthrough, naiveRLocForSetting, rLocForSetting } from "./transmission";
import type { ImmuneState, PointMetrics, ScenarioV1, SettingV1 } from "./types";

export function computePointMetrics(scenario: ScenarioV1, state: ImmuneState, options: { includeAnchorSettings: boolean }): PointMetrics {
  const index = conditionIndexBreakthrough(state, scenario.indexReferenceExposure);
  const naiveSusceptibility = PARAMETERS.wpv1.beta * 0 + (1 - (1 + scenario.indexReferenceExposure / PARAMETERS.wpv1.beta) ** (-PARAMETERS.wpv1.alpha));
  const qAcq = naiveSusceptibility > 0 ? index.probability / naiveSusceptibility : 0;
  const vaccinatedBurden = index.cohorts.reduce((sum, cohort) => sum + cohort.mass * integratedShedding(cohort.sourceBin, state.assessmentAgeDays / (365.25 / 12), scenario.horizonDays), 0);
  const naiveBurden = integratedShedding(0, state.assessmentAgeDays / (365.25 / 12), scenario.horizonDays);
  const qShed = naiveBurden > 0 ? vaccinatedBurden / naiveBurden : 0;
  const rLocMax = rLocForSetting(state, envelopeCorner(scenario), scenario.indexReferenceExposure, scenario.horizonDays);
  const anchors = options.includeAnchorSettings ? new Map(SETTING_ANCHORS.map((anchor) => [anchor.id, rLocForSetting(state, anchor, scenario.indexReferenceExposure, scenario.horizonDays)])) : new Map<string, number>();
  const low = anchors.get("low") ?? rLocMax;
  const houston = anchors.get("houston") ?? rLocMax;
  const matlab = anchors.get("matlab") ?? rLocMax;
  const high = anchors.get("up-bihar") ?? rLocMax;
  const firstDose = state.events.length > 0 ? effectiveFirstDoseTake(scenario) : 0;
  return {
    qAcq,
    qShed,
    qIndex: qAcq * qShed,
    rLocMax,
    rLocLow: options.includeAnchorSettings ? low : rLocMax,
    rLocHouston: options.includeAnchorSettings ? houston : rLocMax,
    rLocMatlab: options.includeAnchorSettings ? matlab : rLocMax,
    rLocHigh: options.includeAnchorSettings ? high : rLocMax,
    naiveRLocMax: options.includeAnchorSettings ? naiveRLocForSetting(envelopeCorner(scenario), scenario.indexReferenceExposure, scenario.horizonDays, state.assessmentAgeDays) : rLocMax,
    effectiveFirstDoseTake: firstDose,
    assessmentAgeDays: state.assessmentAgeDays,
    assessmentLagDays: scenario.schedule.assessmentLagDays,
    indexReferenceExposure: scenario.indexReferenceExposure
  };
}

export function envelopeCorner(scenario: ScenarioV1): SettingV1 {
  const envelope = scenario.envelope;
  return {
    id: "global",
    Tih: { value: envelope.TMax, unit: "grams/exposure", basis: "per_exposure" },
    Ths: { value: envelope.TMax, unit: "grams/exposure", basis: "per_exposure" },
    dIh: { value: envelope.dIhMax, unit: "exposures/person/day", basis: "per_day" },
    dHs: { value: envelope.dHsMax, unit: "exposures/person/day", basis: "per_day" },
    Ns: envelope.NsMax
  };
}

export function effectiveFirstDoseTake(scenario: ScenarioV1): number {
  if (!scenario.vaccine.live) return 0;
  const p = 1 - (1 + scenario.vaccine.dose / scenario.vaccine.beta) ** (-scenario.vaccine.alpha);
  return Math.max(0, Math.min(1, p * scenario.vaccine.takeContext * scenario.vaccine.formulationMultiplier));
}
