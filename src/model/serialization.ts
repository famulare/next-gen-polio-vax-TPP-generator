import { FRONTIER_GRID, GLOBAL_SETTING, PARAMETERS, SETTING_ANCHORS, SETTING_MANIFEST_VERSION, UNCERTAINTY_ENSEMBLE, vaccineDefaults } from "./parameters";
import { ROUTINE_DAYS } from "./types";
import type { ScenarioV1, SettingV1, UnitValueV1, VaccineV1 } from "./types";

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

export function canonicalHash(value: unknown): string {
  const text = canonicalJson(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function encodeScenario(scenario: ScenarioV1): string {
  return base64UrlEncode(canonicalJson(scenario));
}

export function decodeScenario(encoded: string): ScenarioV1 {
  try {
    const decoded = base64UrlDecode(encoded);
    const value: unknown = JSON.parse(decoded);
    validateScenario(value);
    return value;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid scenario URL state: ${detail}`);
  }
}

export function validateScenario(value: unknown): asserts value is ScenarioV1 {
  if (!isRecord(value)) throw new Error("Scenario must be a JSON object");
  exactKeys(value, ["schemaVersion", "targetId", "comparatorId", "vaccine", "schedule", "setting", "envelope", "successRule", "indexReferenceExposure", "horizonDays", "parameterManifestVersion", "settingManifestVersion", "frontierGridVersion", "uncertaintyEnsembleVersion"], "ScenarioV1");
  if (value.schemaVersion !== "ScenarioV1" || value.targetId !== "WPV1") throw new Error("Unsupported scenario schema or target");
  if (!isProductId(value.comparatorId)) throw new Error("Invalid comparator id");
  validateVaccine(value.vaccine);
  validateSchedule(value.schedule);
  if (value.schedule.productId !== value.vaccine.id || value.comparatorId !== value.vaccine.id) throw new Error("Product ids must agree across scenario, vaccine, and schedule");
  validateSetting(value.setting);
  validateEnvelope(value.envelope);
  if (value.successRule !== "point") throw new Error("This iteration supports only the point R_loc success rule");
  finitePositive(value.indexReferenceExposure, "indexReferenceExposure");
  integerRange(value.horizonDays, 1, 1000, "horizonDays");
  for (const [key, expected] of [["parameterManifestVersion", PARAMETERS.manifestVersion], ["settingManifestVersion", SETTING_MANIFEST_VERSION], ["frontierGridVersion", FRONTIER_GRID.version], ["uncertaintyEnsembleVersion", UNCERTAINTY_ENSEMBLE.version]] as const) {
    if (value[key] !== expected) throw new Error(`${key} does not match the bundled manifest`);
  }
}

function validateVaccine(value: unknown): asserts value is VaccineV1 {
  if (!isRecord(value)) throw new Error("Vaccine must be an object");
  exactKeys(value, ["id", "label", "live", "alpha", "beta", "dose", "takeContext", "formulationMultiplier", "mu0", "sigma0", "gamma"], "VaccineV1");
  if (!isProductId(value.id)) throw new Error("Invalid vaccine identity");
  const catalog = vaccineDefaults(value.id);
  if (value.label !== catalog.label || value.live !== catalog.live) throw new Error(`${value.id} identity does not match the bundled product catalog`);
  if (value.id !== "hypothetical") {
    if (!sameRecord(value, catalog)) throw new Error(`${value.id} is a fixed v1 comparator and cannot be parameterized`);
    return;
  }
  finiteRange(value.alpha, 0.001, 5, "alpha");
  finiteRange(value.beta, 0.001, 1e6, "beta");
  finitePositive(value.dose, "dose");
  finiteRange(value.takeContext, 0, 1, "takeContext");
  finiteRange(value.mu0, 0, 15, "mu0");
  if (value.formulationMultiplier !== catalog.formulationMultiplier) throw new Error("formulationMultiplier is fixed at 1 in v1");
  if (value.sigma0 !== catalog.sigma0) throw new Error("sigma0 is fixed at 2.4 in v1");
  if (value.gamma !== catalog.gamma) throw new Error("gamma is fixed at 0.4624 in v1");
}

function validateSchedule(value: unknown): void {
  if (!isRecord(value)) throw new Error("Schedule must be an object");
  exactKeys(value, ["routineDays", "boosterAgeYears", "assessmentLagDays", "productId"], "ScheduleV1");
  if (!Array.isArray(value.routineDays) || value.routineDays.length !== ROUTINE_DAYS.length || value.routineDays.some((day, index) => day !== ROUTINE_DAYS[index])) throw new Error(`Routine schedule must be ${ROUTINE_DAYS.join(", ")} days`);
  if (![0, 1, 2, 3, 4].includes(value.boosterAgeYears as number)) throw new Error("Invalid booster age");
  if (value.assessmentLagDays !== 28 && value.assessmentLagDays !== 90) throw new Error("Assessment lag must be 28 or 90 days");
  if (!isProductId(value.productId)) throw new Error("Invalid schedule product");
}

function validateSetting(value: unknown): asserts value is SettingV1 {
  if (!isRecord(value)) throw new Error("Setting must be an object");
  exactKeys(value, ["id", "Tih", "Ths", "dIh", "dHs", "Ns"], "SettingV1");
  if (!["low", "houston", "matlab", "up-bihar", "global", "custom"].includes(value.id as string)) throw new Error("Invalid setting id");
  validateUnitValue(value.Tih, "grams/exposure", "per_exposure", "Tih");
  validateUnitValue(value.Ths, "grams/exposure", "per_exposure", "Ths");
  validateUnitValue(value.dIh, "exposures/person/day", "per_day", "dIh");
  validateUnitValue(value.dHs, "exposures/person/day", "per_day", "dHs");
  integerRange(value.Ns, 0, 1000, "Ns");
  if (value.id === "global") {
    if (!sameRecord(value, GLOBAL_SETTING)) throw new Error("The global setting record must match its bundled placeholder; the envelope defines the evaluated range");
  } else if (value.id !== "custom") {
    const anchor = SETTING_ANCHORS.find((candidate) => candidate.id === value.id);
    if (!anchor || !sameRecord(value, pickSetting(anchor))) throw new Error(`${value.id} does not match the bundled named setting`);
  }
}

function validateEnvelope(value: unknown): void {
  if (!isRecord(value)) throw new Error("Envelope must be an object");
  exactKeys(value, ["linkedExposure", "TMin", "TMax", "NsMin", "NsMax", "dIhMin", "dIhMax", "dHsMin", "dHsMax"], "EnvelopeV1");
  if (value.linkedExposure !== true) throw new Error("Unlinked envelope bounds are not representable by ScenarioV1; keep linkedExposure true");
  finitePositive(value.TMin, "TMin");
  finiteRange(value.TMax, value.TMin, 1, "TMax");
  integerRange(value.NsMin, 0, 1000, "NsMin");
  integerRange(value.NsMax, value.NsMin, 1000, "NsMax");
  finiteRange(value.dIhMin, 0, 1000, "dIhMin");
  finiteRange(value.dIhMax, value.dIhMin, 1000, "dIhMax");
  finiteRange(value.dHsMin, 0, 1000, "dHsMin");
  finiteRange(value.dHsMax, value.dHsMin, 1000, "dHsMax");
}

function validateUnitValue(value: unknown, unit: string, basis: UnitValueV1["basis"], label: string): asserts value is UnitValueV1 {
  if (!isRecord(value)) throw new Error(`${label} must be a unit value`);
  exactKeys(value, ["value", "unit", "basis"], label);
  finiteRange(value.value, 0, 1000, label);
  if (value.unit !== unit || value.basis !== basis) throw new Error(`${label} has the wrong unit or basis`);
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...allowed].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error(`${label} contains unknown or missing fields`);
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProductId(value: unknown): value is "sabin2" | "ipv" | "hypothetical" {
  return value === "sabin2" || value === "ipv" || value === "hypothetical";
}

function pickSetting(value: SettingV1): SettingV1 {
  return { id: value.id, Tih: value.Tih, Ths: value.Ths, dIh: value.dIh, dHs: value.dHs, Ns: value.Ns };
}

function sameRecord(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function finitePositive(value: unknown, label: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new Error(`${label} must be finite and positive`);
}

function finiteRange(value: unknown, min: number, max: number, label: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be finite and in [${min}, ${max}]`);
}

function integerRange(value: unknown, min: number, max: number, label: string): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new Error(`${label} must be an integer in [${min}, ${max}]`);
}

function canonicalValue(value: unknown): unknown {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Canonical JSON does not allow nonfinite numbers");
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (isRecord(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
  return value;
}

function base64UrlEncode(value: string): string {
  if (typeof btoa === "function") return btoa(unescape(encodeURIComponent(value))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  if (typeof atob === "function") return decodeURIComponent(escape(atob(value.replace(/-/g, "+").replace(/_/g, "/"))));
  return Buffer.from(value, "base64url").toString("utf8");
}
