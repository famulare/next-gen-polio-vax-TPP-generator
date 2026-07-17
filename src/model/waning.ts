import { PARAMETERS } from "./parameters";
import { shiftBins } from "./bins";
import type { Bins } from "./types";

export const DAYS_PER_YEAR = 365.25;
export const DAYS_PER_MONTH = DAYS_PER_YEAR / 12;

export function waningDeltaMonths(elapsedDays: number): number {
  const elapsedMonths = Math.max(elapsedDays / DAYS_PER_MONTH, 0);
  return PARAMETERS.immunity.waningLambda * Math.log2(Math.max(elapsedMonths, 1));
}

export function waneMucosal(probs: readonly number[], elapsedDays: number): Bins {
  return shiftBins(probs, waningDeltaMonths(elapsedDays));
}
