import { integratedShedding } from "./shedding";
import { doseResponse } from "./dose-response";
import { PARAMETERS, SETTING_ANCHORS } from "./parameters";
import { conditionIndexBreakthrough, naiveRLocForSetting, rLocForSetting } from "./transmission";
import type { AnchorSettingId, ImmuneState, PointMetrics, ScenarioV1, SettingV1 } from "./types";
import { DAYS_PER_MONTH } from "./waning";

export type ProductRatios = Pick<PointMetrics, "qAcq" | "qShed" | "qIndex" | "effectiveFirstDoseTake" | "assessmentAgeDays" | "assessmentLagDays" | "indexReferenceExposure">;

export function computeProductRatios(scenario: ScenarioV1, state: ImmuneState): ProductRatios {
  const index = conditionIndexBreakthrough(state, scenario.indexReferenceExposure);
  const naiveSusceptibility = doseResponse(
    scenario.indexReferenceExposure,
    0,
    PARAMETERS.wpv1.alpha,
    PARAMETERS.wpv1.beta,
    PARAMETERS.wpv1.gamma
  );
  const qAcq = naiveSusceptibility > 0 ? index.probability / naiveSusceptibility : 0;
  const ageMonths = state.assessmentAgeDays / DAYS_PER_MONTH;
  const vaccinatedBurden = index.cohorts.reduce((sum, cohort) =>
    sum + cohort.mass * integratedShedding(cohort.sourceBin, ageMonths, scenario.horizonDays), 0);
  const naiveBurden = integratedShedding(0, ageMonths, scenario.horizonDays);
  const qShed = naiveBurden > 0 ? vaccinatedBurden / naiveBurden : 0;
  return {
    qAcq,
    qShed,
    qIndex: qAcq * qShed,
    effectiveFirstDoseTake: state.events.length > 0 ? effectiveFirstDoseTake(scenario) : 0,
    assessmentAgeDays: state.assessmentAgeDays,
    assessmentLagDays: scenario.schedule.assessmentLagDays,
    indexReferenceExposure: scenario.indexReferenceExposure
  };
}

export function computePointMetrics(scenario: ScenarioV1, state: ImmuneState): PointMetrics {
  const product = computeProductRatios(scenario, state);
  const rLocEnvelopeMax = rLocForSetting(state, envelopeCorner(scenario), scenario.indexReferenceExposure, scenario.horizonDays);
  const rLocAnchors = Object.fromEntries(SETTING_ANCHORS.map((anchor) => [
    anchor.id,
    rLocForSetting(state, anchor, scenario.indexReferenceExposure, scenario.horizonDays)
  ])) as Record<AnchorSettingId, number>;
  return {
    ...product,
    rLocSelectedSetting: scenario.setting.id === "global"
      ? null
      : rLocForSetting(state, scenario.setting, scenario.indexReferenceExposure, scenario.horizonDays),
    rLocEnvelopeMax,
    rLocAnchors,
    naiveRLocEnvelopeMax: naiveRLocForSetting(envelopeCorner(scenario), scenario.indexReferenceExposure, scenario.horizonDays, state.assessmentAgeDays)
  };
}

export function envelopeCorner(scenario: ScenarioV1): SettingV1 {
  const envelope = scenario.envelope;
  return {
    id: "global",
    Tih: { value: envelope.TihMax, unit: "grams/exposure", basis: "per_exposure" },
    Ths: { value: envelope.ThsMax, unit: "grams/exposure", basis: "per_exposure" },
    dIh: { value: envelope.dIhMax, unit: "exposures/person/day", basis: "per_day" },
    dHs: { value: envelope.dHsMax, unit: "exposures/person/day", basis: "per_day" },
    Ns: envelope.NsMax
  };
}

export function effectiveFirstDoseTake(scenario: ScenarioV1): number {
  if (!scenario.vaccine.live) return 0;
  const p = doseResponse(
    scenario.vaccine.dose,
    0,
    scenario.vaccine.alpha,
    scenario.vaccine.beta,
    scenario.vaccine.gamma
  );
  return Math.max(0, Math.min(1, p * scenario.vaccine.takeContext * scenario.vaccine.formulationMultiplier));
}
