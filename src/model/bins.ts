import { BIN_COUNT } from "./types";
import { PARAMETERS, SCIENTIFIC_MANIFEST_ID } from "./parameters";
import type { Bins } from "./types";

export const GH_NODES = PARAMETERS.quadrature.nodes;
export const GH_WEIGHTS = PARAMETERS.quadrature.weights;
const EPS = 1e-12;
const boostMatrixCache = new Map<string, number[][]>();
const BOOST_CACHE_CAPACITY = 128;
const ROUND_OFF_NEGATIVE_TOLERANCE = 1e-14;

export function normalizeBins(values: readonly number[]): Bins {
  if (values.length !== BIN_COUNT) throw new Error(`Expected ${BIN_COUNT} immunity bins`);
  const clipped = values.map((value, index) => {
    if (!Number.isFinite(value)) throw new Error(`Bin ${index} mass must be finite`);
    if (value < -ROUND_OFF_NEGATIVE_TOLERANCE) throw new Error(`Bin ${index} mass must be nonnegative`);
    return value < 0 ? 0 : value;
  });
  const total = clipped.reduce((sum, value) => sum + value, 0);
  if (total <= EPS) throw new Error("Bin distribution must have positive total mass");
  const result = clipped.map((value) => value / total);
  let largest = 0;
  for (let index = 1; index < result.length; index += 1) if (result[index]! > result[largest]!) largest = index;
  result[largest]! += 1 - result.reduce((sum, value) => sum + value, 0);
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
  if (!Number.isFinite(delta)) throw new Error("Bin shift must be finite");
  if (delta === 0) return normalized;
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
    if (!Number.isFinite(distribution.mass) || distribution.mass < 0) throw new Error("Mixture mass must be finite and nonnegative");
    if (distribution.mass === 0) continue;
    const bins = normalizeBins(distribution.bins);
    for (let i = 0; i < BIN_COUNT; i += 1) result[i]! += distribution.mass * (bins[i] ?? 0);
    total += distribution.mass;
  }
  if (total <= 0) throw new Error("Mixture must have positive total mass");
  return normalizeBins(result.map((value) => value / total));
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

export function buildBoostMatrix(mu0: number, sigma0: number, sourceEverInfected: boolean): readonly (readonly number[])[] {
  if (!Number.isFinite(mu0) || !Number.isFinite(sigma0) || mu0 < 0 || sigma0 < 0) throw new Error("Boost parameters must be finite and nonnegative");
  const key = `${SCIENTIFIC_MANIFEST_ID}:${mu0.toPrecision(15)}:${sigma0.toPrecision(15)}:${sourceEverInfected ? 1 : 0}`;
  const cached = boostMatrixCache.get(key);
  if (cached) {
    boostMatrixCache.delete(key);
    boostMatrixCache.set(key, cached);
    return cached;
  }
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
  const frozen = Object.freeze(matrix.map((row) => Object.freeze(row))) as unknown as number[][];
  boostMatrixCache.set(key, frozen);
  while (boostMatrixCache.size > BOOST_CACHE_CAPACITY) boostMatrixCache.delete(boostMatrixCache.keys().next().value!);
  return frozen;
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
  return normalProbabilities(x).cdf;
}

function normalProbabilities(x: number): { cdf: number } {
  if (x === Infinity) return { cdf: 1 };
  if (x === -Infinity) return { cdf: 0 };
  if (!Number.isFinite(x)) throw new Error("Normal probability requires a finite argument");

  const a = [2.2352520354606839287, 161.02823106855587881, 1067.6894854603709582, 18154.981253343561249, 0.065682337918207449113];
  const b = [47.20258190468824187, 976.09855173777669322, 10260.932208618978205, 45507.789335026729956];
  const c = [0.39894151208813466764, 8.8831497943883759412, 93.506656132177855979, 597.27027639480026226, 2494.5375852903726711, 6848.1904505362823326, 11602.651437647350124, 9842.7148383839780218, 1.0765576773720192317e-8];
  const d = [22.266688044328115691, 235.38790178262499861, 1519.377599407554805, 6485.558298266760755, 18615.571640885098091, 34900.952721145977266, 38912.003286093271411, 19685.429676859990727];
  const p = [0.21589853405795699, 0.1274011611602473639, 0.022235277870649807, 0.001421619193227893466, 2.9112874951168792e-5, 0.02307344176494017303];
  const q = [1.28426009614491121, 0.468238212480865118, 0.0659881378689285515, 0.00378239633202758244, 7.29751555083966205e-5];
  const y = Math.abs(x);
  let tail: number;

  if (y <= 0.67448975) {
    let numerator = 0;
    let denominator = 0;
    if (y > Number.EPSILON / 2) {
      const square = x * x;
      numerator = a[4]! * square;
      denominator = square;
      for (let index = 0; index < 3; index += 1) {
        numerator = (numerator + a[index]!) * square;
        denominator = (denominator + b[index]!) * square;
      }
    }
    const offset = x * (numerator + a[3]!) / (denominator + b[3]!);
    return { cdf: 0.5 + offset };
  }

  if (y <= Math.sqrt(32)) {
    let numerator = c[8]! * y;
    let denominator = y;
    for (let index = 0; index < 7; index += 1) {
      numerator = (numerator + c[index]!) * y;
      denominator = (denominator + d[index]!) * y;
    }
    tail = (numerator + c[7]!) / (denominator + d[7]!);
  } else if (y < 38.4674) {
    const inverseSquare = 1 / (x * x);
    let numerator = p[5]! * inverseSquare;
    let denominator = inverseSquare;
    for (let index = 0; index < 4; index += 1) {
      numerator = (numerator + p[index]!) * inverseSquare;
      denominator = (denominator + q[index]!) * inverseSquare;
    }
    tail = (0.3989422804014327 - inverseSquare * (numerator + p[4]!) / (denominator + q[4]!)) / y;
  } else {
    return x > 0 ? { cdf: 1 } : { cdf: 0 };
  }

  const truncated = Math.trunc(y * 16) / 16;
  const correction = (y - truncated) * (y + truncated);
  tail *= Math.exp(-truncated * truncated / 2) * Math.exp(-correction / 2);
  return x > 0 ? { cdf: 1 - tail } : { cdf: tail };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(BIN_COUNT - 1, value));
}
