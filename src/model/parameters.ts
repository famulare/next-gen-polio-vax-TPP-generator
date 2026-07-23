import rawParameters from "../data/parameters.json";
import rawAnchors from "../data/setting-anchors.json";
import rawFrontierGrid from "../data/frontier-grid.json";
import rawDiagnosticGrid from "../data/diagnostic-grid.json";
import rawEnsemble from "../data/uncertainty-ensemble.json";
import { MICROGRAMS_PER_GRAM } from "./types";
import type { AnchorSettingId, DiagnosticGridV1, EnvelopeV1, FrontierGridManifestV2, ParameterManifestV1, ProductId, SettingAnchorRecord, SettingManifestV2, SettingV1 } from "./types";
import { canonicalHash } from "./canonical";
import { deepFreeze, validateDiagnosticGridManifest, validateFrontierGridManifest, validateParameterManifest, validateSettingManifest, validateUncertaintyManifest } from "./manifest-validation";

validateParameterManifest(rawParameters);
validateFrontierGridManifest(rawFrontierGrid);
validateDiagnosticGridManifest(rawDiagnosticGrid);
validateSettingManifest(rawAnchors);
validateUncertaintyManifest(rawEnsemble);

export const PARAMETERS = deepFreeze(structuredClone(rawParameters)) as ParameterManifestV1;
export const FRONTIER_GRID = deepFreeze(structuredClone(rawFrontierGrid)) as FrontierGridManifestV2;
export const DIAGNOSTIC_GRID = deepFreeze(structuredClone(rawDiagnosticGrid)) as DiagnosticGridV1;
export const SETTING_MANIFEST = deepFreeze(structuredClone(rawAnchors)) as SettingManifestV2;
export const UNCERTAINTY_ENSEMBLE = deepFreeze(structuredClone(rawEnsemble)) as {
  schemaVersion: "UncertaintyEnsembleV1";
  version: string;
  status: "out_of_scope";
  groups: never[];
  draws: never[];
  weights: never[];
  quantileAlgorithm: null;
  provenance: string;
};

function toGrams(value: number, unit: string): number {
  if (unit === "micrograms/exposure" || unit === "micrograms/day") return value / MICROGRAMS_PER_GRAM;
  if (unit === "grams/exposure" || unit === "grams/day") return value;
  throw new Error(`Unsupported setting unit: ${unit}`);
}

function canonicalExposure(
  value: { value: number; unit: string; basis: "per_exposure" | "per_day" },
  contactsPerDay: number
): SettingV1["Tih"] {
  const grams = toGrams(value.value, value.unit);
  if (value.basis === "per_exposure") {
    return { value: grams, unit: "grams/exposure", basis: "per_exposure" };
  }
  if (value.basis === "per_day" && contactsPerDay > 0) {
    return { value: grams / contactsPerDay, unit: "grams/exposure", basis: "per_exposure" };
  }
  throw new Error("Daily setting exposure requires a positive exposure frequency");
}

export const SETTING_MANIFEST_VERSION = rawAnchors.version;

export const SETTING_ANCHORS = deepFreeze((rawAnchors.anchors as Array<Record<string, unknown>>).map((record) => {
  const dIh = record.dIh as SettingAnchorRecord["dIh"];
  const dHs = record.dHs as SettingAnchorRecord["dHs"];
  return {
    id: record.id as SettingAnchorRecord["id"],
    label: record.label as string,
    kind: record.kind as SettingAnchorRecord["kind"],
    Tih: canonicalExposure(record.T_ih as Parameters<typeof canonicalExposure>[0], dIh.value),
    Ths: canonicalExposure(record.T_hs as Parameters<typeof canonicalExposure>[0], dHs.value),
    dIh,
    dHs,
    Ns: record.Ns as number,
    interval: record.interval as SettingAnchorRecord["interval"],
    tooltip: record.tooltip as string | undefined
  };
}) as SettingAnchorRecord[]);

export const SETTING_DISPLAY_DOMAIN = deepFreeze({
  linkedExposure: true,
  exposure: {
    count: rawAnchors.surfaceDisplayDomain.exposure.count,
    min: rawAnchors.surfaceDisplayDomain.exposure.min / MICROGRAMS_PER_GRAM,
    max: rawAnchors.surfaceDisplayDomain.exposure.max / MICROGRAMS_PER_GRAM,
    scale: "logarithmic" as const,
    unit: "grams/exposure" as const,
    basis: "per_exposure" as const
  },
  contacts: { ...rawAnchors.surfaceDisplayDomain.contacts },
  dIh: { value: rawAnchors.surfaceDisplayDomain.dIh.value, unit: "exposures/person/day", basis: "per_day" as const },
  dHs: { value: rawAnchors.surfaceDisplayDomain.dHs.value, unit: "exposures/person/day", basis: "per_day" as const }
});

export const DEFAULT_DECISION_SCOPE_ANCHOR_ID = rawAnchors.defaultDecisionScope.anchorId as AnchorSettingId;

export function envelopeForAnchor(id: AnchorSettingId): EnvelopeV1 {
  const anchor = anchorById(id);
  return {
    linkedExposure: anchor.Tih.value === anchor.Ths.value,
    TihMin: anchor.Tih.value,
    TihMax: anchor.Tih.value,
    ThsMin: anchor.Ths.value,
    ThsMax: anchor.Ths.value,
    NsMin: anchor.Ns,
    NsMax: anchor.Ns,
    dIhMin: anchor.dIh.value,
    dIhMax: anchor.dIh.value,
    dHsMin: anchor.dHs.value,
    dHsMax: anchor.dHs.value
  };
}

export const SCIENTIFIC_MANIFEST_ID = canonicalHash({
  parameters: PARAMETERS,
  settings: rawAnchors,
  frontierGrid: FRONTIER_GRID,
  diagnosticGrid: DIAGNOSTIC_GRID,
  uncertainty: UNCERTAINTY_ENSEMBLE
});

export const PRODUCT_LABELS: Record<ProductId, string> = {
  sabin2: "Sabin 2 monovalent OPV",
  ipv: "IPV",
  hypothetical: "Next-gen gut mucosal vaccine"
};

export const DEFAULT_PRODUCT_ID: ProductId = "hypothetical";
export const DEFAULTS = {
  productId: DEFAULT_PRODUCT_ID,
  boosterAgeYears: 0 as const,
  assessmentLagDays: 28 as const,
  settingId: DEFAULT_DECISION_SCOPE_ANCHOR_ID,
  successRule: "point" as const,
  horizonDays: PARAMETERS.transmission.horizonDays,
  indexReferenceExposure: PARAMETERS.wpv1.beta * (2 ** (1 / PARAMETERS.wpv1.alpha) - 1)
};

export function vaccineDefaults(id: ProductId) {
  const values = PARAMETERS.vaccineDefaults[id];
  return {
    id,
    label: PRODUCT_LABELS[id],
    live: id !== "ipv",
    alpha: values.alpha,
    beta: values.beta,
    dose: values.dose,
    takeContext: values.takeContext,
    formulationMultiplier: PARAMETERS.vaccineDefaults.formulationMultiplier,
    mu0: values.mu0,
    sigma0: values.sigma0,
    gamma: PARAMETERS.vaccineDefaults.gamma
  };
}

export function anchorById(id: AnchorSettingId): SettingAnchorRecord {
  const anchor = SETTING_ANCHORS.find((candidate) => candidate.id === id);
  if (!anchor) throw new Error(`Unknown setting anchor: ${id}`);
  return anchor;
}
