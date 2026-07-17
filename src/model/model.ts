import rawProvenance from "../data/provenance.json";
import { buildFrontier } from "./frontier";
import { DEFAULTS, ENVELOPE, FRONTIER_GRID, GLOBAL_SETTING, PARAMETERS, PRODUCT_LABELS, SETTING_ANCHORS, SETTING_MANIFEST_VERSION, UNCERTAINTY_ENSEMBLE, vaccineDefaults } from "./parameters";
import { computePointMetrics } from "./metrics";
import { buildScheduleState } from "./schedule";
import { canonicalHash, validateScenario } from "./serialization";
import { rLocForSetting } from "./transmission";
import type { EnvelopeV1, ModelOutputsV1, ScenarioV1, SettingV1 } from "./types";

export function defaultScenario(): ScenarioV1 {
  const product = vaccineDefaults(DEFAULTS.productId);
  return {
    schemaVersion: "ScenarioV1",
    targetId: "WPV1",
    comparatorId: DEFAULTS.productId,
    vaccine: product,
    schedule: { routineDays: [42, 70, 98], boosterAgeYears: DEFAULTS.boosterAgeYears, assessmentLagDays: DEFAULTS.assessmentLagDays, productId: DEFAULTS.productId },
    setting: globalSetting(),
    envelope: { ...ENVELOPE },
    successRule: DEFAULTS.successRule,
    indexReferenceExposure: DEFAULTS.indexReferenceExposure,
    horizonDays: DEFAULTS.horizonDays,
    parameterManifestVersion: PARAMETERS.manifestVersion,
    settingManifestVersion: SETTING_MANIFEST_VERSION,
    frontierGridVersion: FRONTIER_GRID.version,
    uncertaintyEnsembleVersion: UNCERTAINTY_ENSEMBLE.version
  };
}

export function globalSetting(): SettingV1 {
  return structuredClone(GLOBAL_SETTING);
}

export function scenarioWithSetting(scenario: ScenarioV1, id: ScenarioV1["setting"]["id"]): ScenarioV1 {
  if (id === "global") return { ...scenario, setting: globalSetting() };
  if (id === "custom") return { ...scenario, setting: { ...scenario.setting, id: "custom" } };
  const anchor = SETTING_ANCHORS.find((candidate) => candidate.id === id);
  if (!anchor) throw new Error(`Unknown setting ${id}`);
  return {
    ...scenario,
    setting: {
      id,
      Tih: { ...anchor.Tih },
      Ths: { ...anchor.Ths },
      dIh: { ...anchor.dIh },
      dHs: { ...anchor.dHs },
      Ns: anchor.Ns
    }
  };
}

export function scenarioWithProduct(scenario: ScenarioV1, productId: ScenarioV1["vaccine"]["id"]): ScenarioV1 {
  const product = vaccineDefaults(productId);
  return { ...scenario, comparatorId: productId, vaccine: { ...product }, schedule: { ...scenario.schedule, productId } };
}

export function evaluateScenario(scenario: ScenarioV1): ModelOutputsV1 {
  validateScenario(scenario);
  if (scenario.successRule === "upper95" && UNCERTAINTY_ENSEMBLE.draws.length === 0) {
    throw new Error("The upper central 95% success rule is unavailable because the bundled joint uncertainty ensemble is absent.");
  }
  const state = buildScheduleState(scenario.vaccine, scenario.schedule);
  const metrics = computePointMetrics(scenario, state);
  const frontier = buildFrontier(scenario);
  const settingSurface = buildSettingSurface(scenario, state);
  const assumptions = [
    "If source parity and a reviewed uncertainty ensemble are completed, the v1 close-contact sufficiency criterion will be R_loc below 1 across the declared envelope; it is not a complete population R_e. Current threshold comparisons are prototype output only.",
    "All scheduled doses are received. take is biological productive live-vaccine infection, not receipt or coverage.",
    "Transmission, susceptibility, and shedding use mucosal immunity only; IPV has no mucosal effect in a live-virus-naive cohort.",
    "The Matlab marker is a hybrid: daily exposure mass is converted to mass per exposure using each link's contact frequency; the social-contact structure is inherited rather than fitted by the Matlab study.",
    "Runtime uncertainty draws are absent. Any interval-like comparison must be labeled sensitivity until a reviewed joint ensemble is bundled."
  ];
  return {
    schemaVersion: "ModelOutputsV1",
    scenario,
    metrics,
    settingSurface,
    frontier,
    uncertainty: { available: false, label: "central 95% range conditional on the included parameter groups", reason: UNCERTAINTY_ENSEMBLE.provenance, rLocMax: null },
    assumptions,
    modelIdentity: canonicalHash({ scenario, parameters: PARAMETERS, settings: SETTING_ANCHORS, uncertainty: UNCERTAINTY_ENSEMBLE, frontierGrid: FRONTIER_GRID }),
    provenance: rawProvenance
  };
}

export function buildSettingSurface(scenario: ScenarioV1, state: ReturnType<typeof buildScheduleState>) {
  const surface = [];
  const min = scenario.envelope.TMin;
  const max = scenario.envelope.TMax;
  const exposureCount = FRONTIER_GRID.settingExposure.count;
  const contactStep = FRONTIER_GRID.settingContacts.step;
  for (let i = 0; i < exposureCount; i += 1) {
    const T = min * (max / min) ** (i / (exposureCount - 1));
    const unitSetting: SettingV1 = {
      id: "custom",
      Tih: { value: T, unit: "grams/exposure", basis: "per_exposure" },
      Ths: { value: T, unit: "grams/exposure", basis: "per_exposure" },
      dIh: { value: scenario.envelope.dIhMax, unit: "exposures/person/day", basis: "per_day" },
      dHs: { value: scenario.envelope.dHsMax, unit: "exposures/person/day", basis: "per_day" },
      Ns: 1
    };
    const rLocPerSocialContact = rLocForSetting(state, unitSetting, scenario.indexReferenceExposure, scenario.horizonDays);
    for (let Ns = scenario.envelope.NsMin; Ns <= scenario.envelope.NsMax; Ns += contactStep) {
      const setting: SettingV1 = {
        ...unitSetting,
        Ns
      };
      surface.push({ Tih: T, Ths: setting.Ths.value, dIh: setting.dIh.value, dHs: setting.dHs.value, Ns, rLoc: rLocPerSocialContact * Ns });
    }
  }
  return surface;
}

export { rawProvenance, PRODUCT_LABELS };
