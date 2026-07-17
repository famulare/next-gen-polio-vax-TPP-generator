import type { FrontierGridManifestV1, ParameterManifestV1 } from "./types";

type RecordValue = Record<string, unknown>;

export function validateParameterManifest(value: unknown): asserts value is ParameterManifestV1 {
  const root = record(value, "ParameterManifestV1");
  exact(root, ["schemaVersion", "manifestVersion", "designContractVersion", "sourceSnapshot", "quadrature", "validationBounds", "immunity", "wpv1", "vaccineDefaults", "boosts", "shedding", "transmission", "success"], "ParameterManifestV1");
  literal(root.schemaVersion, "ParameterManifestV1", "parameter schemaVersion");
  string(root.manifestVersion, "manifestVersion"); string(root.designContractVersion, "designContractVersion");

  const snapshot = record(root.sourceSnapshot, "sourceSnapshot");
  exact(snapshot, ["cessationStability", "indiaPolio"], "sourceSnapshot");
  for (const key of ["cessationStability", "indiaPolio"] as const) {
    const source = record(snapshot[key], `sourceSnapshot.${key}`);
    exact(source, ["commit", "trackedDirty"], `sourceSnapshot.${key}`);
    if (typeof source.commit !== "string" || !/^[0-9a-f]{40}$/.test(source.commit)) throw new Error(`${key} commit must be a 40-character lowercase Git SHA`);
    literal(source.trackedDirty, false, `${key}.trackedDirty`);
  }

  const quadrature = record(root.quadrature, "quadrature");
  exact(quadrature, ["nodes", "weights", "susceptibilityWithinBinSd", "sheddingWithinBinSd", "bin0WanedCenter", "bin0WanedSd"], "quadrature");
  numberArray(quadrature.nodes, 5, "quadrature.nodes"); numberArray(quadrature.weights, 5, "quadrature.weights");
  for (const key of ["susceptibilityWithinBinSd", "sheddingWithinBinSd", "bin0WanedCenter", "bin0WanedSd"] as const) positive(quadrature[key], `quadrature.${key}`);
  const weights = quadrature.weights as number[];
  if (Math.abs(weights.reduce((sum, item) => sum + item, 0) - 1) > 1e-9) throw new Error("quadrature weights must sum to one");

  const validation = record(root.validationBounds, "validationBounds"); exact(validation, ["hypothetical"], "validationBounds");
  const hypothetical = record(validation.hypothetical, "validationBounds.hypothetical");
  exact(hypothetical, ["alpha", "beta", "dose", "takeContext", "mu0"], "validationBounds.hypothetical");
  for (const key of ["alpha", "beta", "dose", "takeContext", "mu0"] as const) orderedTuple(hypothetical[key], `validationBounds.hypothetical.${key}`);

  const immunity = record(root.immunity, "immunity"); exact(immunity, ["bins", "maxLog2", "waningLambda"], "immunity");
  integer(immunity.bins, 2, 100, "immunity.bins"); integer(immunity.maxLog2, 1, 99, "immunity.maxLog2"); positive(immunity.waningLambda, "immunity.waningLambda");
  if (immunity.bins !== (immunity.maxLog2 as number) + 1) throw new Error("immunity bins must equal maxLog2 + 1");

  const wpv1 = record(root.wpv1, "wpv1"); exact(wpv1, ["alpha", "beta", "gamma", "sheddingDuration", "boost"], "wpv1");
  for (const key of ["alpha", "beta", "gamma"] as const) positive(wpv1[key], `wpv1.${key}`);
  positiveObject(wpv1.sheddingDuration, ["b1", "b2", "b3"], "wpv1.sheddingDuration");
  positiveObject(wpv1.boost, ["mu0", "sigma0"], "wpv1.boost");

  const defaults = record(root.vaccineDefaults, "vaccineDefaults");
  exact(defaults, ["gamma", "formulationMultiplier", "sabin2", "hypothetical", "ipv"], "vaccineDefaults");
  positive(defaults.gamma, "vaccineDefaults.gamma"); positive(defaults.formulationMultiplier, "vaccineDefaults.formulationMultiplier");
  for (const product of ["sabin2", "hypothetical", "ipv"] as const) {
    const item = record(defaults[product], `vaccineDefaults.${product}`);
    exact(item, ["alpha", "beta", "dose", "takeContext", "mu0", "sigma0"], `vaccineDefaults.${product}`);
    for (const key of ["alpha", "beta", "takeContext", "sigma0"] as const) nonnegative(item[key], `vaccineDefaults.${product}.${key}`);
    nonnegative(item.dose, `vaccineDefaults.${product}.dose`); nonnegative(item.mu0, `vaccineDefaults.${product}.mu0`);
  }

  const boosts = record(root.boosts, "boosts"); exact(boosts, ["sabin", "wpv"], "boosts");
  positiveObject(boosts.sabin, ["mu0", "sigma0"], "boosts.sabin"); positiveObject(boosts.wpv, ["mu0", "sigma0"], "boosts.wpv");
  const shedding = record(root.shedding, "shedding"); exact(shedding, ["age", "immunitySuppression", "temporal", "titerFloor"], "shedding");
  positiveObject(shedding.age, ["aMax", "aMin", "tauMonths", "legacyPlateauUntilMonths"], "shedding.age");
  positive(shedding.immunitySuppression, "shedding.immunitySuppression"); positiveObject(shedding.temporal, ["mu", "sigma", "kappa"], "shedding.temporal"); positive(shedding.titerFloor, "shedding.titerFloor");
  const transmission = record(root.transmission, "transmission"); exact(transmission, ["horizonDays", "indexReferenceExposure", "dIh", "dHs"], "transmission");
  integer(transmission.horizonDays, 1, 1000, "transmission.horizonDays"); string(transmission.indexReferenceExposure, "transmission.indexReferenceExposure"); positive(transmission.dIh, "transmission.dIh"); positive(transmission.dHs, "transmission.dHs");
  const success = record(root.success, "success"); exact(success, ["calibrationLog10Tolerance", "horizonExtensionRelativeTolerance"], "success");
  positive(success.calibrationLog10Tolerance, "success.calibrationLog10Tolerance"); positive(success.horizonExtensionRelativeTolerance, "success.horizonExtensionRelativeTolerance");
}

export function validateFrontierGridManifest(value: unknown): asserts value is FrontierGridManifestV1 {
  const root = record(value, "FrontierGridV1");
  exact(root, ["schemaVersion", "version", "takeContext", "mu0New", "settingExposure", "settingContacts", "contour", "ordering"], "FrontierGridV1");
  literal(root.schemaVersion, "FrontierGridV1", "frontier schemaVersion"); string(root.version, "frontier version"); string(root.ordering, "frontier ordering");
  const take = record(root.takeContext, "takeContext"); exact(take, ["count", "min", "max", "scale"], "takeContext"); integer(take.count, 2, 1000, "takeContext.count"); finite(take.min, "takeContext.min"); finite(take.max, "takeContext.max"); literal(take.scale, "linear", "takeContext.scale");
  const mu = record(root.mu0New, "mu0New"); exact(mu, ["count", "min", "max", "scale", "unit"], "mu0New"); integer(mu.count, 2, 1000, "mu0New.count"); finite(mu.min, "mu0New.min"); finite(mu.max, "mu0New.max"); literal(mu.scale, "linear", "mu0New.scale"); string(mu.unit, "mu0New.unit");
  const exposure = record(root.settingExposure, "settingExposure"); exact(exposure, ["count", "scale"], "settingExposure"); integer(exposure.count, 2, 1000, "settingExposure.count"); literal(exposure.scale, "logarithmic", "settingExposure.scale");
  positiveObject(root.settingContacts, ["min", "max", "step"], "settingContacts"); positiveObject(root.contour, ["threshold", "tieTolerance"], "contour");
}

export function validateSettingManifest(value: unknown): void {
  const root = record(value, "SettingManifestV1"); exact(root, ["schemaVersion", "version", "anchors", "matlabInterval", "envelope"], "SettingManifestV1");
  literal(root.schemaVersion, "SettingManifestV1", "setting schemaVersion"); string(root.version, "setting version");
  if (!Array.isArray(root.anchors) || root.anchors.length !== 4) throw new Error("Setting manifest must contain four anchors");
  for (const [index, candidate] of root.anchors.entries()) {
    const anchor = record(candidate, `anchors[${index}]`);
    const allowed = ["id", "label", "T_ih", "T_hs", "dIh", "dHs", "Ns", "kind", ...(anchor.kind === "hybrid" ? ["interval", "tooltip"] : [])];
    exact(anchor, allowed, `anchors[${index}]`); string(anchor.id, "anchor.id"); string(anchor.label, "anchor.label"); string(anchor.kind, "anchor.kind"); integer(anchor.Ns, 0, 1000, "anchor.Ns");
    unitValue(anchor.T_ih, `anchor[${index}].T_ih`); unitValue(anchor.T_hs, `anchor[${index}].T_hs`); unitValue(anchor.dIh, `anchor[${index}].dIh`); unitValue(anchor.dHs, `anchor[${index}].dHs`);
    if (anchor.interval !== undefined) positiveObject(anchor.interval, ["low", "high", "unit"], `anchor[${index}].interval`, ["unit"]);
    if (anchor.tooltip !== undefined) string(anchor.tooltip, `anchor[${index}].tooltip`);
  }
  positiveObject(root.matlabInterval, ["low", "high", "unit"], "matlabInterval", ["unit"]);
  positiveObject(root.envelope, ["TMin", "TMax", "NsMin", "NsMax", "dIhMin", "dIhMax", "dHsMin", "dHsMax"], "envelope");
}

export function validateUncertaintyManifest(value: unknown): void {
  const root = record(value, "UncertaintyEnsembleV1"); exact(root, ["schemaVersion", "version", "status", "groups", "draws", "weights", "quantileAlgorithm", "provenance"], "UncertaintyEnsembleV1");
  literal(root.schemaVersion, "UncertaintyEnsembleV1", "uncertainty schemaVersion"); string(root.version, "uncertainty version"); literal(root.status, "out_of_scope", "uncertainty status");
  for (const key of ["groups", "draws", "weights"] as const) if (!Array.isArray(root[key]) || root[key].length !== 0) throw new Error(`uncertainty ${key} must be empty`);
  literal(root.quantileAlgorithm, null, "uncertainty quantileAlgorithm"); string(root.provenance, "uncertainty provenance");
}

export function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function record(value: unknown, label: string): RecordValue { if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`); return value as RecordValue; }
function exact(value: RecordValue, keys: readonly string[], label: string): void { const actual = Object.keys(value).sort(); const expected = [...keys].sort(); if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error(`${label} contains unknown or missing fields`); }
function literal(value: unknown, expected: unknown, label: string): void { if (value !== expected) throw new Error(`${label} must equal ${String(expected)}`); }
function string(value: unknown, label: string): void { if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a nonempty string`); }
function finite(value: unknown, label: string): asserts value is number { if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be finite`); }
function positive(value: unknown, label: string): void { finite(value, label); if (value <= 0) throw new Error(`${label} must be positive`); }
function nonnegative(value: unknown, label: string): void { finite(value, label); if (value < 0) throw new Error(`${label} must be nonnegative`); }
function integer(value: unknown, min: number, max: number, label: string): void { finite(value, label); if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label} must be an integer in [${min}, ${max}]`); }
function numberArray(value: unknown, length: number, label: string): void { if (!Array.isArray(value) || value.length !== length) throw new Error(`${label} must have length ${length}`); value.forEach((item, index) => finite(item, `${label}[${index}]`)); }
function orderedTuple(value: unknown, label: string): void { numberArray(value, 2, label); if ((value as number[])[0]! > (value as number[])[1]!) throw new Error(`${label} must be ordered`); }
function positiveObject(value: unknown, keys: readonly string[], label: string, stringKeys: readonly string[] = []): void { const item = record(value, label); exact(item, keys, label); for (const key of keys) stringKeys.includes(key) ? string(item[key], `${label}.${key}`) : positive(item[key], `${label}.${key}`); }
function unitValue(value: unknown, label: string): void { const item = record(value, label); exact(item, ["value", "unit", "basis"], label); nonnegative(item.value, `${label}.value`); string(item.unit, `${label}.unit`); string(item.basis, `${label}.basis`); }
