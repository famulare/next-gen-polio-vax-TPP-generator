import rawProvenance from "../data/provenance.json";
import { buildFrontier } from "./frontier";
import { anchorById, DEFAULTS, DEFAULT_DECISION_SCOPE_ANCHOR_ID, DIAGNOSTIC_GRID, envelopeForAnchor, FRONTIER_GRID, PARAMETERS, PRODUCT_LABELS, SCIENTIFIC_MANIFEST_ID, SETTING_ANCHORS, SETTING_DISPLAY_DOMAIN, SETTING_MANIFEST_VERSION, UNCERTAINTY_ENSEMBLE, vaccineDefaults } from "./parameters";
import { buildWithinHostDiagnostics } from "./diagnostics";
import { computePointMetrics } from "./metrics";
import { buildScheduleState } from "./schedule";
import { canonicalHash, validateModelOutputs, validateScenario } from "./serialization";
import { rLocForSetting } from "./transmission";
import { ROUTINE_DAYS } from "./types";
import type { AnchorSettingId, ModelOutputsV1, ScenarioV1, SettingV1 } from "./types";

const SETTING_SURFACE_CACHE_CAPACITY = 4;
const settingSurfaceValueCache = new Map<string, Float64Array>();

export function defaultScenario(): ScenarioV1 {
  const product = vaccineDefaults(DEFAULTS.productId);
  return {
    schemaVersion: "ScenarioV1",
    targetId: "WPV1",
    comparatorId: DEFAULTS.productId,
    vaccine: product,
    schedule: { routineDays: [...ROUTINE_DAYS], boosterAgeYears: DEFAULTS.boosterAgeYears, assessmentLagDays: DEFAULTS.assessmentLagDays, productId: DEFAULTS.productId },
    setting: settingFromAnchor(DEFAULTS.settingId),
    envelope: envelopeForAnchor(DEFAULT_DECISION_SCOPE_ANCHOR_ID),
    successRule: DEFAULTS.successRule,
    indexReferenceExposure: DEFAULTS.indexReferenceExposure,
    horizonDays: DEFAULTS.horizonDays,
    parameterManifestVersion: PARAMETERS.manifestVersion,
    settingManifestVersion: SETTING_MANIFEST_VERSION,
    frontierGridVersion: FRONTIER_GRID.version,
    uncertaintyEnsembleVersion: UNCERTAINTY_ENSEMBLE.version
  };
}

export function scenarioWithSetting(scenario: ScenarioV1, id: ScenarioV1["setting"]["id"]): ScenarioV1 {
  if (id === "custom") return { ...scenario, setting: { ...scenario.setting, id: "custom" } };
  return { ...scenario, setting: settingFromAnchor(id) };
}

export function scenarioWithDecisionScope(scenario: ScenarioV1, id: AnchorSettingId): ScenarioV1 {
  return { ...scenario, envelope: envelopeForAnchor(id) };
}

export function scenarioWithProduct(scenario: ScenarioV1, productId: ScenarioV1["vaccine"]["id"]): ScenarioV1 {
  const product = vaccineDefaults(productId);
  return { ...scenario, comparatorId: productId, vaccine: { ...product }, schedule: { ...scenario.schedule, productId } };
}

export function evaluateScenario(scenario: ScenarioV1): ModelOutputsV1 {
  const canonicalScenario = structuredClone(scenario);
  validateScenario(canonicalScenario);
  const modelIdentity = canonicalHash({ scenario: scientificScenario(canonicalScenario), parameters: PARAMETERS, settings: SETTING_ANCHORS, displayDomain: SETTING_DISPLAY_DOMAIN, uncertainty: UNCERTAINTY_ENSEMBLE, frontierGrid: FRONTIER_GRID, diagnosticGrid: DIAGNOSTIC_GRID });
  const state = buildScheduleState(canonicalScenario.vaccine, canonicalScenario.schedule);
  const metrics = computePointMetrics(canonicalScenario, state);
  const diagnostics = buildWithinHostDiagnostics(canonicalScenario, state, modelIdentity);
  const frontier = buildFrontier(canonicalScenario);
  const settingSurface = buildSettingSurface(canonicalScenario, state);
  const assumptions = [
    "The default point-rule result is evaluated directly at the UP/Bihar high anchor. Clearing this hardest known empirical/model-calibrated stress-test supports likely adequacy under less demanding modeled conditions, but does not prove control everywhere.",
    "The close-contact criterion is a conditional-plausibility screen under the v1 sufficiency axiom: the modeled motif is treated as high strength and remaining connections as mostly weaker. It is not a calculated complete-population R_e.",
    "All scheduled doses are received. take is biological productive live-vaccine infection, not receipt or coverage.",
    "Transmission, susceptibility, and shedding use mucosal immunity only; IPV has no mucosal effect in a live-virus-naive cohort.",
    "The Matlab marker is a hybrid: daily exposure mass is converted to mass per exposure using each link's contact frequency; the social-contact structure is inherited rather than fitted by the Matlab study.",
    "A parameter-uncertainty interval and upper-95 rule are out of scope for this iteration. This point output does not quantify threshold-crossing probability or support probability-weighted expected-loss or risk-sensitive decisions. Any future low/base/high evaluation must be labeled sensitivity, not probability."
  ];
  const outputs: ModelOutputsV1 = {
    schemaVersion: "ModelOutputsV1",
    scenario: canonicalScenario,
    metrics,
    settingSurface,
    frontier,
    diagnostics,
    uncertainty: { available: false, label: "parameter-uncertainty interval is out of scope for this iteration", reason: UNCERTAINTY_ENSEMBLE.provenance, rLocMax: null },
    assumptions,
    modelIdentity,
    provenance: structuredClone(rawProvenance)
  };
  validateModelOutputs(outputs);
  return outputs;
}

export function buildSettingSurface(scenario: ScenarioV1, state: ReturnType<typeof buildScheduleState>) {
  const surface = [];
  const tihMin = SETTING_DISPLAY_DOMAIN.exposure.min;
  const tihMax = SETTING_DISPLAY_DOMAIN.exposure.max;
  const thsMin = SETTING_DISPLAY_DOMAIN.exposure.min;
  const thsMax = SETTING_DISPLAY_DOMAIN.exposure.max;
  const exposureCount = SETTING_DISPLAY_DOMAIN.exposure.count;
  const contactStep = SETTING_DISPLAY_DOMAIN.contacts.step;
  const cacheKey = canonicalHash({
    scientificManifest: SCIENTIFIC_MANIFEST_ID,
    gridVersion: FRONTIER_GRID.version,
    vaccine: scenario.vaccine,
    schedule: scenario.schedule,
    indexReferenceExposure: scenario.indexReferenceExposure,
    horizonDays: scenario.horizonDays,
    state
  });
  let rLocPerSocialContact = settingSurfaceValueCache.get(cacheKey);
  if (rLocPerSocialContact) {
    settingSurfaceValueCache.delete(cacheKey);
    settingSurfaceValueCache.set(cacheKey, rLocPerSocialContact);
  } else {
    rLocPerSocialContact = new Float64Array(exposureCount);
  }
  for (let i = 0; i < exposureCount; i += 1) {
    const fraction = i / (exposureCount - 1);
    const Tih = tihMin * (tihMax / tihMin) ** fraction;
    const Ths = thsMin * (thsMax / thsMin) ** fraction;
    const unitSetting: SettingV1 = {
      id: "custom",
      Tih: { value: Tih, unit: "grams/exposure", basis: "per_exposure" },
      Ths: { value: Ths, unit: "grams/exposure", basis: "per_exposure" },
      dIh: { ...SETTING_DISPLAY_DOMAIN.dIh },
      dHs: { ...SETTING_DISPLAY_DOMAIN.dHs },
      Ns: 1
    };
    if (!settingSurfaceValueCache.has(cacheKey)) {
      rLocPerSocialContact[i] = rLocForSetting(state, unitSetting, scenario.indexReferenceExposure, scenario.horizonDays);
    }
    for (let Ns = SETTING_DISPLAY_DOMAIN.contacts.min; Ns <= SETTING_DISPLAY_DOMAIN.contacts.max; Ns += contactStep) {
      const setting: SettingV1 = {
        ...unitSetting,
        Ns
      };
      surface.push({ Tih, Ths, dIh: setting.dIh.value, dHs: setting.dHs.value, Ns, rLoc: rLocPerSocialContact[i]! * Ns });
    }
  }
  if (!settingSurfaceValueCache.has(cacheKey)) {
    settingSurfaceValueCache.set(cacheKey, rLocPerSocialContact);
    while (settingSurfaceValueCache.size > SETTING_SURFACE_CACHE_CAPACITY) settingSurfaceValueCache.delete(settingSurfaceValueCache.keys().next().value!);
  }
  return surface;
}

export function clearSettingSurfaceCache(): void {
  settingSurfaceValueCache.clear();
}

export function settingSurfaceCacheStats(): { entries: number; capacity: number } {
  return { entries: settingSurfaceValueCache.size, capacity: SETTING_SURFACE_CACHE_CAPACITY };
}

function settingFromAnchor(id: AnchorSettingId): SettingV1 {
  const anchor = anchorById(id);
  return {
    id,
    Tih: { ...anchor.Tih },
    Ths: { ...anchor.Ths },
    dIh: { ...anchor.dIh },
    dHs: { ...anchor.dHs },
    Ns: anchor.Ns
  };
}

function scientificScenario(scenario: ScenarioV1): Omit<ScenarioV1, "setting"> {
  const { setting: _probe, ...scientific } = scenario;
  return scientific;
}

export { rawProvenance, PRODUCT_LABELS };
