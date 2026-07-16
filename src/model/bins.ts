import { BIN_COUNT } from "./types";
import { PARAMETERS } from "./parameters";
import type { Bins } from "./types";

export const GH_NODES = PARAMETERS.quadrature.nodes;
export const GH_WEIGHTS = PARAMETERS.quadrature.weights;
const EPS = 1e-12;
const boostMatrixCache = new Map<string, number[][]>();

export function normalizeBins(values: readonly number[]): Bins {
  if (values.length !== BIN_COUNT) throw new Error(`Expected ${BIN_COUNT} immunity bins`);
  const clipped = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const total = clipped.reduce((sum, value) => sum + value, 0);
  if (total <= EPS) return [1, ...Array<number>(BIN_COUNT - 1).fill(0)];
  const result = clipped.map((value) => value / total);
  result[BIN_COUNT - 1]! += 1 - result.reduce((sum, value) => sum + value, 0);
  return result;
}

export function assertBins(values: readonly number[], label = "bins"): void {
  if (values.length !== BIN_COUNT || values.some((value) => !Number.isFinite(value) || value < -1e-10) || Math.abs(values.reduce((a, b) => a + b, 0) - 1) > 1e-10) {
    throw new Error(`${label} must be finite, non-negative, and sum to 1`);
  }
}

export function projectGaussian(mu: number, sd: number): Bins {
  const result = Array<number>(BIN_COUNT).fill(0);
  if (sd <= EPS) {
    result[Math.max(0, Math.min(BIN_COUNT - 1, Math.ceil(mu - 0.5)))] = 1;
    return result;
  }
  for (let bin = 0; bin < BIN_COUNT; bin += 1) {
    const lower = bin === 0 ? -Infinity : bin - 0.5;
    const upper = bin === BIN_COUNT - 1 ? Infinity : bin + 0.5;
    result[bin] = normalCdf((upper - mu) / sd) - normalCdf((lower - mu) / sd);
  }
  return normalizeBins(result);
}

export function shiftBins(probs: readonly number[], delta: number): Bins {
  const normalized = normalizeBins(probs);
  if (!Number.isFinite(delta) || delta === 0) return normalized;
  const result = Array<number>(BIN_COUNT).fill(0);
  normalized.forEach((mass, source) => {
    if (mass <= 0) return;
    const x = source - delta;
    if (x <= 0) {
      result[0]! += mass;
      return;
    }
    const lower = Math.floor(x);
    const upper = Math.ceil(x);
    const lowerIndex = Math.min(BIN_COUNT - 1, Math.max(0, lower));
    const upperIndex = Math.min(BIN_COUNT - 1, Math.max(0, upper));
    if (lowerIndex === upperIndex) {
      result[lowerIndex]! += mass;
      return;
    }
    const upperWeight = x - lower;
    result[lowerIndex]! += mass * (1 - upperWeight);
    result[upperIndex]! += mass * upperWeight;
  });
  return normalizeBins(result);
}

export function weightedMix(distributions: Array<{ mass: number; bins: readonly number[] }>): Bins {
  const result = Array<number>(BIN_COUNT).fill(0);
  let total = 0;
  for (const distribution of distributions) {
    if (distribution.mass <= 0) continue;
    const bins = normalizeBins(distribution.bins);
    for (let i = 0; i < BIN_COUNT; i += 1) result[i]! += distribution.mass * (bins[i] ?? 0);
    total += distribution.mass;
  }
  return total > 0 ? normalizeBins(result.map((value) => value / total)) : normalizeBins(result);
}

export function sourceQuadratureValues(bin: number, everInfected: boolean, sd: number): number[] {
  if (bin === 0 && !everInfected) return [0];
  if (bin === 0 && everInfected) return GH_NODES.map((node) => clamp(PARAMETERS.quadrature.bin0WanedCenter + PARAMETERS.quadrature.bin0WanedSd * node));
  return GH_NODES.map((node) => clamp(bin + sd * node));
}

export function quadratureAverage(values: readonly number[]): number {
  if (values.length === 1) return values[0] ?? 0;
  return values.reduce((sum, value, index) => sum + value * (GH_WEIGHTS[index] ?? 0), 0);
}

export function buildBoostMatrix(mu0: number, sigma0: number, sourceEverInfected: boolean): number[][] {
  const key = `${mu0.toPrecision(15)}:${sigma0.toPrecision(15)}:${sourceEverInfected ? 1 : 0}`;
  const cached = boostMatrixCache.get(key);
  if (cached) return cached;
  const matrix = Array.from({ length: BIN_COUNT }, () => Array<number>(BIN_COUNT).fill(0));
  for (let source = 0; source < BIN_COUNT; source += 1) {
    const values = sourceQuadratureValues(source, sourceEverInfected, PARAMETERS.quadrature.susceptibilityWithinBinSd);
    const column = Array<number>(BIN_COUNT).fill(0);
    for (let index = 0; index < values.length; index += 1) {
      const x = values[index] ?? 0;
      const scale = Math.max(0, 1 - x / (BIN_COUNT - 1));
      const postMean = Math.min(BIN_COUNT - 1, x + mu0 * scale);
      const postSd = sigma0 * scale;
      const projected = projectGaussian(postMean, postSd);
      const weight = values.length === 1 ? 1 : (GH_WEIGHTS[index] ?? 0);
      for (let target = 0; target < BIN_COUNT; target += 1) column[target]! += weight * (projected[target] ?? 0);
    }
    const normalized = normalizeBins(column);
    for (let target = 0; target < BIN_COUNT; target += 1) matrix[target]![source] = normalized[target] ?? 0;
  }
  boostMatrixCache.set(key, matrix);
  return matrix;
}

export function applyBoost(probs: readonly number[], mu0: number, sigma0: number, everInfected: boolean): Bins {
  const matrix = buildBoostMatrix(mu0, sigma0, everInfected);
  const result = Array<number>(BIN_COUNT).fill(0);
  const input = normalizeBins(probs);
  for (let target = 0; target < BIN_COUNT; target += 1) {
    for (let source = 0; source < BIN_COUNT; source += 1) result[target]! += (matrix[target]?.[source] ?? 0) * (input[source] ?? 0);
  }
  return normalizeBins(result);
}

export function normalCdf(x: number): number {
  if (x === Infinity) return 1;
  if (x === -Infinity) return 0;
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const value = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * value);
  const polynomial = (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  return sign * (1 - polynomial * Math.exp(-value * value));
}

function clamp(value: number): number {
  return Math.max(0, Math.min(BIN_COUNT - 1, value));
}
