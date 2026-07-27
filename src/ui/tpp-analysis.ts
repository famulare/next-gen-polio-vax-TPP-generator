import { passesThreshold } from "../model/frontier";
import { computeProductRatios, envelopeCorner } from "../model/metrics";
import { evaluateScenarioLight, scenarioWithProduct } from "../model/model";
import { PRODUCT_LABELS, vaccineDefaults } from "../model/parameters";
import { buildScheduleState } from "../model/schedule";
import { conditionIndexBreakthrough, createRLocEvaluator, rLocForSetting, transmitLink } from "../model/transmission";
import type { ProductId, ScenarioV1, SettingV1, SourceCohort, TeachingView } from "../model/types";
import { DAYS_PER_MONTH } from "../model/waning";
import { describeDecisionScope } from "./presentation";

export interface TransmissionTeachingDiagnostics {
  setting: SettingV1;
  indexAcquisitionProbability: number;
  householdInfectionProbability: number;
  socialGivenHouseholdProbability: number;
  singleSocialContactProbability: number;
  reconstructedRLoc: number;
  directRLoc: number;
  reconciliationError: number;
}

export interface TppProfile {
  label: string;
  scenario: ScenarioV1;
  view: TeachingView;
  scopeLabel: string;
  hid50CID50: number;
  heterogeneity: number;
  meanMucosalLog2: number;
  doseTakeProbabilities: Array<{ doseNumber: number; day: number; probability: number | null }>;
  sabinLikeStartingAssumptions: boolean;
  designFamily: {
    sourceLabel: string;
    hid50CID50: number;
    heterogeneity: number;
    administeredDoseTCID50: number;
  };
  transmission: TransmissionTeachingDiagnostics;
  decisionPasses: boolean;
  decisionMargin: number;
}

export interface MechanismCandidate {
  takeContext: number;
  mu0: number;
  qAcq: number;
  qShed: number;
  qIndex: number;
  rLoc: number;
  passes: boolean;
}

export interface MechanismContrastPair {
  acquisitionLed: MechanismCandidate;
  sheddingLed: MechanismCandidate;
  relativeQIndexGap: number;
  mechanismSeparation: number;
  relativeRLocGap: number;
}

export function buildTransmissionTeachingDiagnostics(scenario: ScenarioV1): TransmissionTeachingDiagnostics {
  const state = buildScheduleState(scenario.vaccine, scenario.schedule);
  const setting = envelopeCorner(scenario);
  const index = conditionIndexBreakthrough(state, scenario.indexReferenceExposure);
  const ageMonths = state.assessmentAgeDays / DAYS_PER_MONTH;

  if (index.cohorts.length === 0) {
    const directRLoc = rLocForSetting(state, setting, scenario.indexReferenceExposure, scenario.horizonDays);
    return {
      setting,
      indexAcquisitionProbability: index.probability,
      householdInfectionProbability: 0,
      socialGivenHouseholdProbability: 0,
      singleSocialContactProbability: 0,
      reconstructedRLoc: 0,
      directRLoc,
      reconciliationError: Math.abs(directRLoc)
    };
  }

  const householdIncidence = transmitLink(
    index.cohorts,
    state.groups,
    setting.Tih.value,
    setting.dIh.value,
    ageMonths,
    scenario.horizonDays
  );
  const householdInfectionProbability = householdIncidence.reduce((sum, cohort) => sum + cohort.mass, 0);
  const binCount = state.groups[0]?.mucosal.length ?? 16;
  const householdMassBySourceBin = new Float64Array(binCount);
  for (const cohort of householdIncidence) householdMassBySourceBin[cohort.sourceBin]! += cohort.mass;

  let singleSocialContactProbability = 0;
  for (let sourceBin = 0; sourceBin < householdMassBySourceBin.length; sourceBin += 1) {
    const householdMass = householdMassBySourceBin[sourceBin]!;
    if (householdMass <= 0) continue;
    // The authoritative motif gives each link its own post-infection horizon. Rebase the
    // household source to day zero before evaluating the second link, then weight that
    // conditional probability by the first-link incidence mass.
    const source: SourceCohort[] = [{ infectionDay: 0, sourceBin, mass: 1 }];
    const socialIncidence = transmitLink(
      source,
      state.groups,
      setting.Ths.value,
      setting.dHs.value,
      ageMonths,
      scenario.horizonDays
    );
    const probabilityGivenSourceBin = socialIncidence.reduce((sum, cohort) => sum + cohort.mass, 0);
    singleSocialContactProbability += householdMass * probabilityGivenSourceBin;
  }

  const reconstructedRLoc = setting.Ns * singleSocialContactProbability;
  const directRLoc = rLocForSetting(state, setting, scenario.indexReferenceExposure, scenario.horizonDays);
  return {
    setting,
    indexAcquisitionProbability: index.probability,
    householdInfectionProbability,
    socialGivenHouseholdProbability: householdInfectionProbability > 0
      ? singleSocialContactProbability / householdInfectionProbability
      : 0,
    singleSocialContactProbability,
    reconstructedRLoc,
    directRLoc,
    reconciliationError: Math.abs(reconstructedRLoc - directRLoc)
  };
}

export function buildTppProfile(scenario: ScenarioV1, label = PRODUCT_LABELS[scenario.vaccine.id]): TppProfile {
  const view = evaluateScenarioLight(structuredClone(scenario));
  const familyVaccine = view.scenario.vaccine.id === "hypothetical"
    ? view.scenario.vaccine
    : vaccineDefaults("hypothetical");
  const meanMucosalLog2 = view.diagnostics.vaccinated.immunityBins.reduce(
    (sum, mass, bin) => sum + mass * bin,
    0
  );
  return {
    label,
    scenario: structuredClone(view.scenario),
    view,
    scopeLabel: describeDecisionScope(view.scenario.envelope).label,
    hid50CID50: vaccineHid50(view.scenario),
    heterogeneity: 1 / view.scenario.vaccine.alpha,
    meanMucosalLog2,
    doseTakeProbabilities: view.diagnostics.immuneResponse.doseDiagnostics.map((dose) => ({
      doseNumber: dose.doseNumber,
      day: dose.day,
      probability: dose.aggregateTakeProbability
    })),
    sabinLikeStartingAssumptions: isSabinLikeStartingPoint(view.scenario),
    designFamily: {
      sourceLabel: view.scenario.vaccine.id === "hypothetical"
        ? "the selected hypothetical product family"
        : "the versioned hypothetical-product defaults",
      hid50CID50: vaccineHid50ForVaccine(familyVaccine),
      heterogeneity: 1 / familyVaccine.alpha,
      administeredDoseTCID50: familyVaccine.dose
    },
    transmission: buildTransmissionTeachingDiagnostics(view.scenario),
    decisionPasses: passesThreshold(view.metrics.rLocEnvelopeMax),
    decisionMargin: 1 - view.metrics.rLocEnvelopeMax
  };
}

export function buildComparatorProfile(current: ScenarioV1, productId: Exclude<ProductId, "hypothetical">): TppProfile {
  const scenario = scenarioWithProduct(structuredClone(current), productId);
  return buildTppProfile(scenario, `${PRODUCT_LABELS[productId]} under the current schedule and setting`);
}

export function findMechanismContrastPair(scenario: ScenarioV1): MechanismContrastPair {
  // Preserve the current hypothetical product family (HID50, alpha, dose, and fixed
  // response assumptions). Fixed catalog products do not define an editable family,
  // so comparisons launched from them use the versioned hypothetical defaults.
  const family = scenario.vaccine.id === "hypothetical"
    ? structuredClone(scenario)
    : scenarioWithProduct(structuredClone(scenario), "hypothetical");
  // A modest deterministic grid is dense enough to find an instructive tradeoff
  // without re-running the full 51 x 51 decision frontier in the browser.
  const takeValues = Array.from({ length: 11 }, (_, index) => index / 10);
  const boostValues = Array.from({ length: 17 }, (_, index) => index / 2);
  const candidates: MechanismCandidate[] = [];
  const familySchedule = { ...family.schedule, productId: "hypothetical" as const };
  const referenceState = buildScheduleState(family.vaccine, familySchedule);
  const evaluator = createRLocEvaluator(
    envelopeCorner(family),
    family.indexReferenceExposure,
    referenceState.assessmentAgeDays,
    family.horizonDays
  );

  for (const takeContext of takeValues) {
    for (const mu0 of boostValues) {
      const vaccine = { ...family.vaccine, takeContext, mu0 };
      const candidateScenario: ScenarioV1 = {
        ...family,
        comparatorId: "hypothetical",
        vaccine,
        schedule: familySchedule
      };
      const state = buildScheduleState(vaccine, familySchedule);
      const ratios = computeProductRatios(candidateScenario, state);
      const rLoc = evaluator(state);
      if (ratios.qIndex > 0) candidates.push({
        takeContext,
        mu0,
        qAcq: ratios.qAcq,
        qShed: ratios.qShed,
        qIndex: ratios.qIndex,
        rLoc,
        passes: passesThreshold(rLoc)
      });
    }
  }

  let bestPreferred: { a: MechanismCandidate; b: MechanismCandidate; gap: number; separation: number; score: number } | null = null;
  let bestAcceptable: { a: MechanismCandidate; b: MechanismCandidate; gap: number; separation: number; score: number } | null = null;
  let bestTradeoff: { a: MechanismCandidate; b: MechanismCandidate; gap: number; separation: number; score: number } | null = null;
  let bestFallback: { a: MechanismCandidate; b: MechanismCandidate; gap: number; separation: number; score: number } | null = null;
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i]!;
      const b = candidates[j]!;
      const relativeQIndexGap = Math.abs(a.qIndex - b.qIndex) / Math.max(a.qIndex, b.qIndex);
      const mechanismSeparation = Math.abs(a.qAcq - b.qAcq) + Math.abs(a.qShed - b.qShed);
      const tradeoff = (a.qAcq - b.qAcq) * (a.qShed - b.qShed) < 0;
      const parameterSeparation = Math.abs(a.takeContext - b.takeContext) + Math.abs(a.mu0 - b.mu0) / 8;
      const directSeparation = Math.abs(a.rLoc - b.rLoc) / Math.max(a.rLoc, b.rLoc, 1e-12);
      const thresholdContrast = a.passes !== b.passes ? 0.35 : 0;
      const score = mechanismSeparation + 0.2 * parameterSeparation + 0.25 * directSeparation
        + thresholdContrast + (tradeoff ? 0.4 : 0) - 4 * relativeQIndexGap;
      const record = { a, b, gap: relativeQIndexGap, separation: mechanismSeparation, score };
      if (bestFallback === null || record.score > bestFallback.score) bestFallback = record;
      if (tradeoff && (bestTradeoff === null || record.score > bestTradeoff.score)) bestTradeoff = record;
      if (tradeoff && relativeQIndexGap <= 0.2 && (bestAcceptable === null || record.score > bestAcceptable.score)) bestAcceptable = record;
      if (tradeoff && relativeQIndexGap <= 0.08 && (bestPreferred === null || record.score > bestPreferred.score)) bestPreferred = record;
    }
  }

  const best = bestPreferred ?? bestAcceptable ?? bestTradeoff ?? bestFallback;
  if (!best) throw new Error("No mechanism-contrast pair could be constructed");
  const acquisitionLed = best.a.qAcq <= best.b.qAcq ? best.a : best.b;
  const sheddingLed = acquisitionLed === best.a ? best.b : best.a;
  return {
    acquisitionLed,
    sheddingLed,
    relativeQIndexGap: best.gap,
    mechanismSeparation: best.separation,
    relativeRLocGap: Math.abs(acquisitionLed.rLoc - sheddingLed.rLoc)
      / Math.max(acquisitionLed.rLoc, sheddingLed.rLoc, 1e-12)
  };
}

export function decisionRecordMarkdown(profile: TppProfile): string {
  const scenario = profile.scenario;
  const metrics = profile.view.metrics;
  const schedule = scenario.schedule;
  const transmission = profile.transmission;
  const takes = profile.doseTakeProbabilities
    .map((dose) => `- Dose ${dose.doseNumber} at day ${formatNumber(dose.day)}: ${dose.probability === null ? "not applicable" : formatPercent(dose.probability)}`)
    .join("\n");
  return `# Transmission-efficacy TPP decision record

## Scope

- Product: ${scenario.vaccine.label}
- Schedule: routine doses at 6, 10, and 14 weeks${schedule.boosterAgeYears > 0 ? `; booster at year ${schedule.boosterAgeYears}` : "; no booster"}
- Assessment: ${schedule.assessmentLagDays} days after the last scheduled dose
- Decision setting: ${profile.scopeLabel}
- Decision rule: direct R_loc < 1
- Interpretation: transmission-efficacy module for a TPP, not a complete vaccine TPP

## Product assumptions

${scenario.vaccine.live
    ? `- Context multiplier on vaccine take: ${scenario.vaccine.live ? formatNumber(scenario.vaccine.takeContext) : "not applicable to non-live IPV"}
- Vaccine HID50: ${scenario.vaccine.live ? `${formatNumber(profile.hid50CID50)} CID50` : "not applicable"}
- Dose-response heterogeneity, 1/alpha: ${scenario.vaccine.live ? formatNumber(profile.heterogeneity) : "not applicable"}
- Administered dose: ${scenario.vaccine.live ? `${formatNumber(scenario.vaccine.dose)} TCID50` : "not applicable"}
- Maximum mean mucosal boost given take: ${scenario.vaccine.live ? `${formatNumber(scenario.vaccine.mu0)} log2` : "not applicable"}
- Fixed maximum boost SD: ${scenario.vaccine.live ? `${formatNumber(scenario.vaccine.sigma0)} log2` : "not applicable"}
- Fixed immunity-sensitivity gamma: ${scenario.vaccine.live ? formatNumber(scenario.vaccine.gamma) : "not applicable"}`
    : "- Live-vaccine take and taking-dose boost coordinates: not applicable to IPV"}
- Receipt assumption: 100%
${profile.sabinLikeStartingAssumptions ? "- Starting-assumption identity: matches fixed Sabin 2 for dose response, take context, and mucosal boost under this selected schedule" : ""}

## Modeled take by dose

${takes || "- No live-vaccine take coordinate for this product."}

## Modeled biological effects at the reference challenge

- Mean assessment-age mucosal state: ${formatNumber(profile.meanMucosalLog2)} log2
- Residual productive WPV acquisition probability ratio, q_acq: ${formatNumber(metrics.qAcq)} (${formatPercent(1 - metrics.qAcq)} reduction)
- Residual conditional shedding-burden ratio, q_shed: ${formatNumber(metrics.qShed)} (${formatPercent(1 - metrics.qShed)} reduction)
- Relative shedding index, q_index: ${formatNumber(metrics.qIndex)}

## Close-contact transmission calculation

The calculation is conditioned on one breakthrough index child. The index acquisition probability below is shown for context and is not multiplied into R_loc.

- Reference WPV challenge: ${formatNumber(scenario.indexReferenceExposure)} CID50 (one WPV HID50 under the fixed convention)
- Episode horizon on each link: ${formatNumber(scenario.horizonDays)} days
- Index-to-household exposure: ${formatNumber(transmission.setting.Tih.value * 1_000_000)} micrograms/exposure x ${formatNumber(transmission.setting.dIh.value)} exposures/person/day
- Household-to-social exposure: ${formatNumber(transmission.setting.Ths.value * 1_000_000)} micrograms/exposure x ${formatNumber(transmission.setting.dHs.value)} exposures/person/day
- Selected-cohort WPV acquisition probability at one reference HID50: ${formatPercent(transmission.indexAcquisitionProbability)}
- P(household child infected | breakthrough index): ${formatPercent(transmission.householdInfectionProbability)}
- P(one social contact infected | breakthrough index): ${formatPercent(transmission.singleSocialContactProbability)}
- Number of close social contacts, N_s: ${formatNumber(transmission.setting.Ns)}
- Reconstructed R_loc: ${formatNumber(transmission.reconstructedRLoc)}
- Direct authoritative R_loc: ${formatNumber(transmission.directRLoc)}
- Diagnostic reconciliation error: ${transmission.reconciliationError.toExponential(2)}

## Decision

- Status: ${profile.decisionPasses ? "below the strict threshold" : "at or above the strict threshold"}
- Margin, 1 - R_loc: ${formatNumber(profile.decisionMargin)}
- Parameter uncertainty: not quantified; this is one deterministic point-parameter result
- Qualification: R_loc is the expected tertiary infections in the declared close-contact motif, not a complete-population R_e or an outbreak forecast

## Identity

- Model identity: ${profile.view.diagnostics.modelIdentity}
`;
}

export function vaccineHid50(scenario: ScenarioV1): number {
  return vaccineHid50ForVaccine(scenario.vaccine);
}

function vaccineHid50ForVaccine(vaccine: Pick<ScenarioV1["vaccine"], "alpha" | "beta">): number {
  return vaccine.beta * (2 ** (1 / vaccine.alpha) - 1);
}

export function isSabinLikeStartingPoint(scenario: ScenarioV1): boolean {
  if (scenario.vaccine.id !== "hypothetical") return false;
  const sabin = vaccineDefaults("sabin2");
  return ["alpha", "beta", "dose", "takeContext", "mu0", "sigma0", "gamma", "formulationMultiplier"].every((key) => {
    const field = key as keyof typeof sabin;
    const selected = scenario.vaccine[field];
    const reference = sabin[field];
    return typeof selected === "number" && typeof reference === "number" && Math.abs(selected - reference) <= 1e-12;
  });
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1e4 || abs < 0.01) return value.toExponential(1);
  return abs >= 1 ? String(Number(value.toPrecision(2))) : value.toFixed(2);
}

function formatPercent(value: number): string {
  const percent = 100 * value;
  const displayed = formatNumber(percent);
  if (displayed === "100" && value < 1) return `${(Math.floor(percent * 10) / 10).toFixed(1)}%`;
  return `${displayed}%`;
}
