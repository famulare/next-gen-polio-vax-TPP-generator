import rawParameters from "../data/parameters.json";
import rawAnchors from "../data/setting-anchors.json";
import rawFrontierGrid from "../data/frontier-grid.json";
import rawEnsemble from "../data/uncertainty-ensemble.json";
import type { FrontierGridManifestV1, ParameterManifestV1, ProductId, SettingAnchorRecord } from "./types";

export const PARAMETERS = rawParameters as ParameterManifestV1;
export const FRONTIER_GRID = rawFrontierGrid as FrontierGridManifestV1;
export const UNCERTAINTY_ENSEMBLE = rawEnsemble as {
  schemaVersion: "UncertaintyEnsembleV1";
  version: string;
  status: "absent";
  groups: never[];
  draws: never[];
  weights: never[];
  quantileAlgorithm: null;
  provenance: string;
};

function toGrams(value: number, unit: string): number {
  if (unit === "micrograms/exposure" || unit === "micrograms/day") return value / 1_000_000;
  if (unit === "grams/exposure" || unit === "grams/day") return value;
  throw new Error(`Unsupported setting unit: ${unit}`);
}

export const SETTING_ANCHORS = (rawAnchors.anchors as Array<Record<string, unknown>>).map((record) => ({
  id: record.id as SettingAnchorRecord["id"],
  label: record.label as string,
  kind: record.kind as SettingAnchorRecord["kind"],
  Tih: { value: toGrams((record.T_ih as { value: number }).value, (record.T_ih as { unit: string }).unit), unit: "grams/exposure", basis: "per_exposure" as const },
  Ths: { value: toGrams((record.T_hs as { value: number }).value, (record.T_hs as { unit: string }).unit), unit: "grams/exposure", basis: "per_exposure" as const },
  dIh: record.dIh as SettingAnchorRecord["dIh"],
  dHs: record.dHs as SettingAnchorRecord["dHs"],
  Ns: record.Ns as number,
  interval: record.interval as SettingAnchorRecord["interval"],
  tooltip: record.tooltip as string | undefined
})) as SettingAnchorRecord[];

export const ENVELOPE = {
  linkedExposure: true,
  TMin: rawAnchors.envelope.TMin / 1_000_000,
  TMax: rawAnchors.envelope.TMax / 1_000_000,
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

export function anchorById(id: Exclude<SettingAnchorRecord["id"], "global" | "custom">): SettingAnchorRecord {
  const anchor = SETTING_ANCHORS.find((candidate) => candidate.id === id);
  if (!anchor) throw new Error(`Unknown setting anchor: ${id}`);
  return anchor;
}
