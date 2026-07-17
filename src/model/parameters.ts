import rawParameters from "../data/parameters.json";
import rawAnchors from "../data/setting-anchors.json";
import rawFrontierGrid from "../data/frontier-grid.json";
import rawEnsemble from "../data/uncertainty-ensemble.json";
import { MICROGRAMS_PER_GRAM } from "./types";
import type { AnchorSettingId, FrontierGridManifestV1, ParameterManifestV1, ProductId, SettingAnchorRecord, SettingV1 } from "./types";

export const PARAMETERS = rawParameters as ParameterManifestV1;
export const FRONTIER_GRID = rawFrontierGrid as FrontierGridManifestV1;
export const UNCERTAINTY_ENSEMBLE = rawEnsemble as {
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

export const SETTING_ANCHORS = (rawAnchors.anchors as Array<Record<string, unknown>>).map((record) => {
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
}) as SettingAnchorRecord[];

export const ENVELOPE = {
  linkedExposure: true,
  TMin: rawAnchors.envelope.TMin / MICROGRAMS_PER_GRAM,
  TMax: rawAnchors.envelope.TMax / MICROGRAMS_PER_GRAM,
  NsMin: rawAnchors.envelope.NsMin,
  NsMax: rawAnchors.envelope.NsMax,
  dIhMin: rawAnchors.envelope.dIhMin,
  dIhMax: rawAnchors.envelope.dIhMax,
  dHsMin: rawAnchors.envelope.dHsMin,
  dHsMax: rawAnchors.envelope.dHsMax
} as const;

export const PRODUCT_LABELS: Record<ProductId, string> = {
  sabin2: "Sabin 2 monovalent OPV",
  ipv: "IPV",
  hypothetical: "Hypothetical OPV-like vaccine"
};

export const DEFAULT_PRODUCT_ID: ProductId = "hypothetical";
export const GLOBAL_SETTING: SettingV1 = {
  id: "global",
  Tih: { value: 5 / MICROGRAMS_PER_GRAM, unit: "grams/exposure", basis: "per_exposure" },
  Ths: { value: 5 / MICROGRAMS_PER_GRAM, unit: "grams/exposure", basis: "per_exposure" },
  dIh: { value: PARAMETERS.transmission.dIh, unit: "exposures/person/day", basis: "per_day" },
  dHs: { value: PARAMETERS.transmission.dHs, unit: "exposures/person/day", basis: "per_day" },
  Ns: 3
};
export const DEFAULTS = {
  productId: DEFAULT_PRODUCT_ID,
  boosterAgeYears: 0 as const,
  assessmentLagDays: 28 as const,
  settingId: "global" as const,
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
