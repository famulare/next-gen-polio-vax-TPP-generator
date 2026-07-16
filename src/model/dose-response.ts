import { PARAMETERS } from "./parameters";
import { quadratureAverage, sourceQuadratureValues } from "./bins";

export function doseResponse(dose: number, n: number, alpha: number, beta: number, gamma: number): number {
  if (dose <= 0) return 0;
  if (!Number.isFinite(dose) || beta <= 0 || alpha < 0) throw new Error("Invalid dose-response parameters");
  const exponent = -alpha / (2 ** (gamma * Math.max(0, n)));
  return clamp01(1 - (1 + dose / beta) ** exponent);
}

export function susceptibilityPerBin(dose: number, alpha: number, beta: number, gamma: number, everInfected: boolean): number[] {
  return Array.from({ length: PARAMETERS.immunity.bins }, (_, bin) => {
    const values = sourceQuadratureValues(bin, everInfected, PARAMETERS.quadrature.susceptibilityWithinBinSd);
    return clamp01(quadratureAverage(values.map((n) => doseResponse(dose, n, alpha, beta, gamma))));
  });
}

export function wpvSusceptibilityPerBin(dose: number, everInfected: boolean): number[] {
  const wpv = PARAMETERS.wpv1;
  return susceptibilityPerBin(dose, wpv.alpha, wpv.beta, wpv.gamma, everInfected);
}

export function vaccineTakePerBin(dose: number, alpha: number, beta: number, gamma: number, takeContext: number, formulationMultiplier: number, everInfected: boolean): number[] {
  const base = susceptibilityPerBin(dose, alpha, beta, gamma, everInfected);
  return base.map((value) => clamp01(value * takeContext * formulationMultiplier));
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
