import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applyBoost, buildBoostMatrix, normalizeBins, shiftBins } from "../../src/model/bins";
import { buildFrontier, gridPointRLocMatchesDirect, passesThreshold } from "../../src/model/frontier";
import { defaultScenario, evaluateScenario, scenarioWithProduct, scenarioWithSetting } from "../../src/model/model";
import { FRONTIER_GRID, PARAMETERS, SETTING_ANCHORS, vaccineDefaults } from "../../src/model/parameters";
import { envelopeCorner } from "../../src/model/metrics";
import { canonicalJson, decodeScenario, encodeScenario, validateScenario } from "../../src/model/serialization";
import { applyDose, buildScheduleState, buildStateAtAssessment, initialImmuneState, moveState, scheduleDays } from "../../src/model/schedule";
import { peakSheddingAgeAmplitude, sheddingTerms } from "../../src/model/shedding";
import { doseResponse, susceptibilityPerBin, vaccineTakePerBin, wpvSusceptibilityPerBin } from "../../src/model/dose-response";
import { clearTransmissionCaches, conditionIndexBreakthrough, createRLocEvaluator, naiveRLocForSetting, repeatedExposureProbability, rLocForSetting, transmitLink, transmissionCacheStats } from "../../src/model/transmission";
import { waneMucosal, waningDeltaMonths } from "../../src/model/waning";
import { evaluateMatlabFixedTiterMotif } from "../../src/model/matlab-compat";
import { sha256Hex } from "../../src/model/canonical";
import type { ProductId, ScenarioV1, ScheduleV1, SettingV1, VaccineV1 } from "../../src/model/types";

const sourceKernelFixture = JSON.parse(
  readFileSync(new URL("../../reference/fixtures/india-r-susceptibility-v1.json", import.meta.url), "utf8")
) as {
  schemaVersion: string;
  releaseGateSatisfied: boolean;
  inputs: { serotype: number; log2NMax: number; lowDoseLinearRatio: number };
  grid: { alphas: number[]; betas: number[]; doseLabels: string[]; strains: string[]; everInfected: boolean[]; systematicCaseCount: number };
  cases: Array<{
    id: string;
    strain: "WPV" | "Sabin";
    alpha: number;
    beta: number;
    gamma: number;
    doseTCID50: number;
    everInfected: boolean;
    values: number[];
  }>;
};

const sheddingKernelFixture = JSON.parse(
  readFileSync(new URL("../../reference/fixtures/india-r-shedding-v1.json", import.meta.url), "utf8")
) as {
  schemaVersion: string;
  releaseGateSatisfied: boolean;
  inputs: {
    log2NMax: number;
    sheddingWithinBinSd: number;
    b1: number;
    b2: number;
    b3: number;
    cImmunity: number;
    ageAMax: number;
    ageAMin: number;
    ageTauMonths: number;
    temporalMu: number;
    temporalSigma: number;
    temporalKappa: number;
    titerFloor: number;
  };
  grid: { sourceBins: number[]; daysSinceInfection: number[]; agesMonths: number[]; systematicCaseCount: number };
  cases: Array<{
    sourceBin: number;
    daysSinceInfection: number;
    ageMonths: number;
    survival: number;
    jointPeak: number;
    expectedInfectiousConcentration: number;
  }>;
};

const vaccineTakeFixture = JSON.parse(
  readFileSync(new URL("../../reference/fixtures/india-r-vaccine-take-v1.json", import.meta.url), "utf8")
) as {
  schemaVersion: string;
  releaseGateSatisfied: boolean;
  inputs: {
    alpha: number;
    beta: number;
    gamma: number;
    doseTCID50: number;
    takeContext: number;
    formulationMultiplier: number;
    mu0: number;
    sigma0: number;
    lowDoseLinearRatio: number;
    mucosalBins: number[];
    serumBins: number[];
  };
  output: {
    takeProbability: number;
    noTakeProbability: number;
    takeMucosal: number[];
    noTakeMucosal: number[];
    takeSerum: number[];
    noTakeSerum: number[];
    boostedTakeMucosal: number[];
    boostedTakeSerum: number[];
  };
  grid: { alphas: number[]; betas: number[]; dosesTCID50: number[]; takeContexts: number[]; systematicCaseCount: number };
  gridCases: Array<{
    id: string;
    alpha: number;
    beta: number;
    doseTCID50: number;
    takeContext: number;
    takeProbability: number;
    noTakeProbability: number;
    takeMucosal: number[];
    noTakeMucosal: number[];
    takeSerum: number[];
    noTakeSerum: number[];
    boostedTakeMucosal: number[];
    boostedTakeSerum: number[];
  }>;
};

const comparatorFixture = JSON.parse(
  readFileSync(new URL("../../reference/fixtures/india-r-comparators-v1.json", import.meta.url), "utf8")
) as {
  schemaVersion: string;
  releaseGateSatisfied: boolean;
  boostGrid: { mu0Values: number[]; everInfected: boolean[]; systematicCaseCount: number };
  boostTransitionCases: Array<{
    id: string;
    mu0: number;
    sigma0: number;
    everInfected: boolean;
    transitionMatrix: number[][];
  }>;
  ipvCases: Array<{
    id: string;
    everInfected: boolean;
    mucosalInput: number[];
    serumInput: number[];
    mucosalOutput: number[];
    serumOutput: number[];
  }>;
  scheduleCases: Array<{
    id: string;
    productId: Exclude<ProductId, "hypothetical">;
    doseDays: number[];
    assessmentLagDays: number;
    assessmentAgeDays: number;
    groups: Array<{ mass: number; everInfected: boolean; mucosal: number[]; serum: number[] }>;
  }>;
};

const scheduleKernelFixture = JSON.parse(
  readFileSync(new URL("../../reference/fixtures/india-r-schedule-v1.json", import.meta.url), "utf8")
) as {
  schemaVersion: string;
  releaseGateSatisfied: boolean;
  inputs: {
    serotype: number;
    strain: string;
    alpha: number;
    beta: number;
    gamma: number;
    doseTCID50: number;
    takeContext: number;
    formulationMultiplier: number;
    mu0: number;
    sigma0: number;
    log2NMax: number;
    waningLambda: number;
    daysPerMonth: number;
    lowDoseLinearRatio: number;
    waningInputBins: number[];
  };
  vaccineGrid: Array<{ id: string; alpha: number; beta: number; doseTCID50: number; takeContext: number; mu0: number; sigma0: number }>;
  cases: Array<{
    id: string;
    vaccine: { alpha: number; beta: number; doseTCID50: number; takeContext: number; mu0: number; sigma0: number };
    doseDays: number[];
    assessmentLagDays: number;
    assessmentAgeDays: number;
    groups: Array<{ mass: number; everInfected: boolean; mucosal: number[]; serum: number[] }>;
  }>;
  waningCases: Array<{ elapsedDays: number; waningDeltaLog2: number; values: number[] }>;
};

const cessationMotifFixture = JSON.parse(
  readFileSync(new URL("../../reference/fixtures/cessation-matlab-motif-v1.json", import.meta.url), "utf8")
) as {
  schemaVersion: string;
  releaseGateSatisfied: boolean;
  inputs: {
    serotype: number;
    horizonDays: number;
    vaccineDoseTCID50: number;
    perDoseEfficacy: number;
    primaryAgeMonths: number;
    secondaryAgeMonths: number;
    tertiaryAgeMonths: number;
  };
  cases: Array<{
    id: string;
    TihGramsPerExposure: number;
    ThsGramsPerExposure: number;
    dIhExposuresPerPersonDay: number;
    dHsExposuresPerPersonDay: number;
    Ns: number;
    primaryLog2NAb: number;
    secondaryLog2NAb: number;
    tertiaryLog2NAb: number;
    output: {
      primaryIncidence: number[];
      secondaryIncidence: number[];
      tertiaryIncidence: number[];
      primaryPrevalence: number[];
      secondaryPrevalence: number[];
      tertiaryPrevalence: number[];
      primaryTotal: number;
      secondaryTotal: number;
      tertiaryTotal: number;
      rLoc: number;
    };
  }>;
};

const calibrationReport = JSON.parse(
  readFileSync(new URL("../../reference/fixtures/calibration-report-v1.json", import.meta.url), "utf8")
) as {
  schemaVersion: string;
  calibrationGateSatisfied: boolean;
  tolerance: { log10RmseMaximum: number };
  varianceConstraint: { intercept: number; slope: number };
  cases: Array<{
    id: string;
    stateMapping: {
      indexState: string;
      fitIndexMeanLog2NAb: boolean;
      householdState: string;
      contactMeanLog2NAb: number;
      fitTih: boolean;
      fitContactMeanLog2NAb: boolean;
    };
    fittedIndexMeanLog2NAb: number | null;
    constrainedIndexVarianceLog2NAb: number | null;
    fixedContactMeanLog2NAb: number | null;
    fittedContactMeanLog2NAb: number | null;
    constrainedContactVarianceLog2NAb: number | null;
    jointContactTihFit: null | {
      coarseGrid: { candidateCount: number; best: { contactMeanLog2NAb: number; profileLog10Rmse: number } };
      refinementGrid: {
        candidateCount: number;
        nearOptimalCandidateCount: number;
        nearOptimalMeanRangeLog2NAb: [number, number];
        nearOptimalTihRangeGramsPerExposure: [number, number];
      };
    };
    fittedTihMicrogramsPerExposure: number;
    targetRoles: Array<{ role: string; profileLog10Rmse: number; passes: boolean }>;
    passes: boolean;
  }>;
};

function assertMass(values: readonly number[]): void {
  assert.equal(values.length, 16);
  assert.ok(values.every((value) => value >= -1e-12 && value <= 1 + 1e-12));
  assert.ok(Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) < 1e-10);
}

function assertKernelValue(actual: number, expected: number, label: string, tolerance = 1e-8): void {
  const absoluteDifference = Math.abs(actual - expected);
  if (absoluteDifference <= 1e-12) return;
  const relativeDifference = absoluteDifference / Math.abs(expected);
  assert.ok(relativeDifference <= tolerance, `${label}: relative difference=${relativeDifference}`);
}

function assertKernelVector(actual: readonly number[], expected: readonly number[], label: string, tolerance = 1e-8): void {
  assert.equal(actual.length, expected.length, `${label}: length`);
  for (let index = 0; index < actual.length; index += 1) {
    assertKernelValue(actual[index] ?? 0, expected[index] ?? 0, `${label}[${index}]`, tolerance);
  }
}

function assertImmuneStateMatchesFixture(
  actual: { assessmentAgeDays: number; groups: Array<{ mass: number; everInfected: boolean; mucosal: number[]; serum: number[] }> },
  expected: { id: string; assessmentAgeDays: number; groups: Array<{ mass: number; everInfected: boolean; mucosal: number[]; serum: number[] }> },
  labelPrefix = expected.id
): void {
  assert.equal(actual.assessmentAgeDays, expected.assessmentAgeDays, `${labelPrefix}: assessment age`);
  assert.equal(actual.groups.length, expected.groups.length, `${labelPrefix}: group count`);
  for (let index = 0; index < actual.groups.length; index += 1) {
    const actualGroup = actual.groups[index]!;
    const expectedGroup = expected.groups[index]!;
    assert.equal(actualGroup.everInfected, expectedGroup.everInfected, `${labelPrefix}: history group ${index}`);
    assertKernelValue(actualGroup.mass, expectedGroup.mass, `${labelPrefix}: mass group ${index}`);
    assertKernelVector(actualGroup.mucosal, expectedGroup.mucosal, `${labelPrefix}: mucosal group ${index}`);
    assertKernelVector(actualGroup.serum, expectedGroup.serum, `${labelPrefix}: serum group ${index}`);
  }
}

test("bin operations conserve probability mass", () => {
  const source = normalizeBins([0.2, 0.3, 0, 0.5, ...Array<number>(12).fill(0)]);
  assertMass(source);
  assertMass(shiftBins(source, 2.37));
  assertMass(shiftBins(source, -4.2));
  assertMass(applyBoost(source, 6, 2.4, false));
  assertMass(applyBoost(source, 6, 2.4, true));
});

test("dose response is bounded and decreases with mucosal immunity", () => {
  const low = doseResponse(10, 0, PARAMETERS.wpv1.alpha, PARAMETERS.wpv1.beta, PARAMETERS.wpv1.gamma);
  const high = doseResponse(10, 10, PARAMETERS.wpv1.alpha, PARAMETERS.wpv1.beta, PARAMETERS.wpv1.gamma);
  assert.ok(low >= 0 && low <= 1);
  assert.ok(high >= 0 && high <= 1);
  assert.ok(high < low);
  const bins = wpvSusceptibilityPerBin(10, false);
  for (let i = 1; i < bins.length; i += 1) assert.ok((bins[i] ?? 0) <= (bins[i - 1] ?? 0) + 1e-12);
});

test("India R susceptibility grid distinguishes the source low-dose branch from the exact contract equation", () => {
  assert.equal(sourceKernelFixture.schemaVersion, "SourceKernelFixtureV1");
  assert.equal(sourceKernelFixture.releaseGateSatisfied, false);
  assert.equal(sourceKernelFixture.inputs.serotype, 1);
  assert.equal(sourceKernelFixture.inputs.log2NMax, PARAMETERS.immunity.maxLog2);
  assert.equal(sourceKernelFixture.inputs.lowDoseLinearRatio, 0.01);
  assert.equal(
    sourceKernelFixture.grid.systematicCaseCount,
    sourceKernelFixture.grid.alphas.length * sourceKernelFixture.grid.betas.length * sourceKernelFixture.grid.doseLabels.length
      * sourceKernelFixture.grid.strains.length * sourceKernelFixture.grid.everInfected.length
  );
  assert.ok(sourceKernelFixture.cases.length >= sourceKernelFixture.grid.systematicCaseCount);
  let sourceBranchCases = 0;
  let discriminatingSourceBranchCases = 0;
  for (const fixtureCase of sourceKernelFixture.cases) {
    const actual = susceptibilityPerBin(
      fixtureCase.doseTCID50,
      fixtureCase.alpha,
      fixtureCase.beta,
      fixtureCase.gamma,
      fixtureCase.everInfected
    );
    const usesSourceBranch = fixtureCase.doseTCID50 > 0 && fixtureCase.doseTCID50 / fixtureCase.beta <= sourceKernelFixture.inputs.lowDoseLinearRatio;
    if (usesSourceBranch) {
      sourceBranchCases += 1;
      if (actual.some((value, index) => Math.abs(value - (fixtureCase.values[index] ?? 0)) > 1e-14)) discriminatingSourceBranchCases += 1;
    } else {
      assertKernelVector(actual, fixtureCase.values, `${fixtureCase.id}: R susceptibility`, 1e-8);
    }
  }
  assert.ok(sourceBranchCases > 0);
  assert.ok(discriminatingSourceBranchCases > 0);
});

test("India R shedding fixture records rounded source constants separately from exact contract constants", () => {
  assert.equal(sheddingKernelFixture.schemaVersion, "SourceKernelFixtureV1");
  assert.equal(sheddingKernelFixture.releaseGateSatisfied, false);
  assert.equal(sheddingKernelFixture.inputs.log2NMax, PARAMETERS.immunity.maxLog2);
  assert.equal(sheddingKernelFixture.inputs.sheddingWithinBinSd, PARAMETERS.quadrature.sheddingWithinBinSd);
  assert.equal(sheddingKernelFixture.inputs.b1, 3.76);
  assert.equal(sheddingKernelFixture.inputs.b2, 0.1519);
  assert.equal(PARAMETERS.wpv1.sheddingDuration.b1, Math.log(43));
  assert.equal(PARAMETERS.wpv1.sheddingDuration.b2, Math.log(1.164));
  assert.equal(sheddingKernelFixture.inputs.b3, PARAMETERS.wpv1.sheddingDuration.b3);
  assert.equal(sheddingKernelFixture.inputs.cImmunity, PARAMETERS.shedding.immunitySuppression);
  assert.equal(sheddingKernelFixture.inputs.ageAMax, PARAMETERS.shedding.age.aMax);
  assert.equal(sheddingKernelFixture.inputs.ageAMin, PARAMETERS.shedding.age.aMin);
  assert.equal(sheddingKernelFixture.inputs.ageTauMonths, PARAMETERS.shedding.age.tauMonths);
  assert.equal(sheddingKernelFixture.inputs.temporalMu, PARAMETERS.shedding.temporal.mu);
  assert.equal(sheddingKernelFixture.inputs.temporalSigma, PARAMETERS.shedding.temporal.sigma);
  assert.equal(sheddingKernelFixture.inputs.temporalKappa, PARAMETERS.shedding.temporal.kappa);
  assert.equal(sheddingKernelFixture.inputs.titerFloor, 398.1);
  assert.equal(PARAMETERS.shedding.titerFloor, 10 ** 2.6);
  assert.equal(
    sheddingKernelFixture.grid.systematicCaseCount,
    sheddingKernelFixture.grid.sourceBins.length * sheddingKernelFixture.grid.daysSinceInfection.length * sheddingKernelFixture.grid.agesMonths.length
  );
  assert.equal(sheddingKernelFixture.cases.length, sheddingKernelFixture.grid.systematicCaseCount);

  assert.ok(sheddingKernelFixture.cases.every((fixtureCase) => [fixtureCase.survival, fixtureCase.jointPeak, fixtureCase.expectedInfectiousConcentration].every(Number.isFinite)));
});

test("legacy Cessation age-amplitude function has a seven-month neonatal plateau", () => {
  assert.equal(PARAMETERS.shedding.age.legacyPlateauUntilMonths, 7);
  assert.equal(peakSheddingAgeAmplitude(0), 6.67);
  assert.equal(peakSheddingAgeAmplitude(5), 6.67);
  assert.equal(peakSheddingAgeAmplitude(7), 6.67);
  assert.ok(Math.abs(peakSheddingAgeAmplitude(18) - 5.075236384279462) <= 1e-12);
  assert.ok(Math.abs(peakSheddingAgeAmplitude(48) - 4.328160129895197) <= 1e-12);
});

test("higher mucosal immunity cannot increase shedding duration or intensity across the declared kernel domain", () => {
  for (const ageMonths of [0, 5, 7, 12, 18, 48, 120]) {
    for (const daysSinceInfection of [1, 2, 7, 30, 100]) {
      for (let bin = 1; bin < PARAMETERS.immunity.bins; bin += 1) {
        const lowerImmunity = sheddingTerms(daysSinceInfection, bin - 1, ageMonths);
        const higherImmunity = sheddingTerms(daysSinceInfection, bin, ageMonths);
        for (const field of ["survival", "conditionalConcentration", "expectedInfectiousConcentration"] as const) {
          assert.ok(
            higherImmunity[field] <= lowerImmunity[field] + 1e-12,
            `${field} increased from bin ${bin - 1} to ${bin} at age ${ageMonths} months and day ${daysSinceInfection}`
          );
        }
      }
    }
  }
});

test("India R vaccine fixture matches take/no-take conditioning and boost across the declared grid", () => {
  const inputs = vaccineTakeFixture.inputs;
  const defaults = vaccineDefaults("hypothetical");
  assert.equal(vaccineTakeFixture.schemaVersion, "SourceKernelFixtureV1");
  assert.equal(vaccineTakeFixture.releaseGateSatisfied, false);
  assert.equal(inputs.alpha, defaults.alpha);
  assert.equal(inputs.beta, defaults.beta);
  assert.equal(inputs.gamma, defaults.gamma);
  assert.equal(inputs.doseTCID50, defaults.dose);
  assert.equal(inputs.takeContext, defaults.takeContext);
  assert.equal(inputs.formulationMultiplier, defaults.formulationMultiplier);
  assert.equal(inputs.mu0, defaults.mu0);
  assert.equal(inputs.sigma0, defaults.sigma0);
  assert.equal(inputs.lowDoseLinearRatio, 0.01);
  assert.equal(
    vaccineTakeFixture.grid.systematicCaseCount,
    vaccineTakeFixture.grid.alphas.length * vaccineTakeFixture.grid.betas.length
      * vaccineTakeFixture.grid.dosesTCID50.length * vaccineTakeFixture.grid.takeContexts.length
  );
  assert.equal(vaccineTakeFixture.gridCases.length, vaccineTakeFixture.grid.systematicCaseCount);

  const takeHazard = vaccineTakePerBin(
    inputs.doseTCID50,
    inputs.alpha,
    inputs.beta,
    inputs.gamma,
    inputs.takeContext,
    inputs.formulationMultiplier,
    false
  );
  const takeMucosal = normalizeBins(inputs.mucosalBins.map((value, bin) => value * (takeHazard[bin] ?? 0)));
  const noTakeMucosal = normalizeBins(inputs.mucosalBins.map((value, bin) => value * (1 - (takeHazard[bin] ?? 0))));
  const takeSerum = normalizeBins(inputs.serumBins.map((value, bin) => value * (takeHazard[bin] ?? 0)));
  const noTakeSerum = normalizeBins(inputs.serumBins.map((value, bin) => value * (1 - (takeHazard[bin] ?? 0))));
  assertKernelVector(takeMucosal, vaccineTakeFixture.output.takeMucosal, "conditioned take mucosal bins");
  assertKernelVector(noTakeMucosal, vaccineTakeFixture.output.noTakeMucosal, "conditioned no-take mucosal bins");
  assertKernelVector(takeSerum, vaccineTakeFixture.output.takeSerum, "conditioned take serum bins");
  assertKernelVector(noTakeSerum, vaccineTakeFixture.output.noTakeSerum, "conditioned no-take serum bins");

  const postDose = applyDose({
    groups: [{ mass: 1, everInfected: false, mucosal: inputs.mucosalBins, serum: inputs.serumBins }],
    assessmentAgeDays: 0,
    lastDoseDay: 0,
    events: []
  }, defaults);
  const noTakeGroup = postDose.groups.find((group) => !group.everInfected);
  const takeGroup = postDose.groups.find((group) => group.everInfected);
  assert.ok(noTakeGroup);
  assert.ok(takeGroup);
  assertKernelValue(takeGroup.mass, vaccineTakeFixture.output.takeProbability, "take mass");
  assertKernelValue(noTakeGroup.mass, vaccineTakeFixture.output.noTakeProbability, "no-take mass");
  assertKernelVector(noTakeGroup.mucosal, vaccineTakeFixture.output.noTakeMucosal, "no-take mucosal state");
  assertKernelVector(noTakeGroup.serum, vaccineTakeFixture.output.noTakeSerum, "no-take serum state");
  assertKernelVector(takeGroup.mucosal, vaccineTakeFixture.output.boostedTakeMucosal, "boosted take mucosal state");
  assertKernelVector(takeGroup.serum, vaccineTakeFixture.output.boostedTakeSerum, "boosted take serum state");

  for (const fixtureCase of vaccineTakeFixture.gridCases) {
    const vaccine: VaccineV1 = {
      ...defaults,
      alpha: fixtureCase.alpha,
      beta: fixtureCase.beta,
      dose: fixtureCase.doseTCID50,
      takeContext: fixtureCase.takeContext
    };
    const takeHazard = vaccineTakePerBin(
      vaccine.dose, vaccine.alpha, vaccine.beta, vaccine.gamma, vaccine.takeContext, vaccine.formulationMultiplier, false
    );
    assertKernelVector(
      normalizeBins(inputs.mucosalBins.map((value, bin) => value * (takeHazard[bin] ?? 0))),
      fixtureCase.takeMucosal,
      `${fixtureCase.id}: conditioned take mucosal`
    );
    const postDose = applyDose({
      groups: [{ mass: 1, everInfected: false, mucosal: inputs.mucosalBins, serum: inputs.serumBins }],
      assessmentAgeDays: 0,
      lastDoseDay: 0,
      events: []
    }, vaccine);
    const noTakeGroup = postDose.groups.find((group) => !group.everInfected);
    const takeGroup = postDose.groups.find((group) => group.everInfected);
    assert.ok(noTakeGroup, `${fixtureCase.id}: no-take group`);
    assert.ok(takeGroup, `${fixtureCase.id}: take group`);
    assertKernelValue(takeGroup.mass, fixtureCase.takeProbability, `${fixtureCase.id}: take mass`);
    assertKernelValue(noTakeGroup.mass, fixtureCase.noTakeProbability, `${fixtureCase.id}: no-take mass`);
    assertKernelVector(noTakeGroup.mucosal, fixtureCase.noTakeMucosal, `${fixtureCase.id}: no-take mucosal`);
    assertKernelVector(noTakeGroup.serum, fixtureCase.noTakeSerum, `${fixtureCase.id}: no-take serum`);
    assertKernelVector(takeGroup.mucosal, fixtureCase.boostedTakeMucosal, `${fixtureCase.id}: boosted take mucosal`);
    assertKernelVector(takeGroup.serum, fixtureCase.boostedTakeSerum, `${fixtureCase.id}: boosted take serum`);
  }
});

test("India R comparator fixture matches full boost grid, IPV semantics, and fixed-comparator schedules", () => {
  assert.equal(comparatorFixture.schemaVersion, "SourceKernelFixtureV1");
  assert.equal(comparatorFixture.releaseGateSatisfied, false);
  assert.equal(vaccineDefaults("sabin2").mu0, PARAMETERS.boosts.sabin.mu0);
  assert.equal(
    comparatorFixture.boostGrid.systematicCaseCount,
    comparatorFixture.boostGrid.mu0Values.length * comparatorFixture.boostGrid.everInfected.length
  );
  assert.equal(comparatorFixture.boostTransitionCases.length, comparatorFixture.boostGrid.systematicCaseCount);

  for (const fixtureCase of comparatorFixture.boostTransitionCases) {
    const actual = buildBoostMatrix(fixtureCase.mu0, fixtureCase.sigma0, fixtureCase.everInfected);
    assert.equal(actual.length, fixtureCase.transitionMatrix.length, `${fixtureCase.id}: target-bin count`);
    for (let target = 0; target < actual.length; target += 1) {
      assertKernelVector(
        actual[target] ?? [],
        fixtureCase.transitionMatrix[target] ?? [],
        `${fixtureCase.id}: boost transition target bin ${target}`
      );
    }
  }

  const ipv = vaccineDefaults("ipv");
  assert.equal(ipv.live, false);
  assert.equal(ipv.dose, 0);
  for (const fixtureCase of comparatorFixture.ipvCases) {
    const postDose = applyDose({
      groups: [{
        mass: 1,
        everInfected: fixtureCase.everInfected,
        mucosal: fixtureCase.mucosalInput,
        serum: fixtureCase.serumInput
      }],
      assessmentAgeDays: 0,
      lastDoseDay: 0,
      events: []
    }, ipv);
    assert.equal(postDose.groups.length, 1, `${fixtureCase.id}: IPV must not split a group`);
    const group = postDose.groups[0]!;
    assert.equal(group.everInfected, fixtureCase.everInfected, `${fixtureCase.id}: infection history`);
    assertKernelVector(group.mucosal, fixtureCase.mucosalOutput, `${fixtureCase.id}: IPV mucosal state`);
    assertKernelVector(group.serum, fixtureCase.serumOutput, `${fixtureCase.id}: IPV serum state`);
  }

  for (const fixtureCase of comparatorFixture.scheduleCases) {
    const product = vaccineDefaults(fixtureCase.productId);
    let state = initialImmuneState();
    let currentDay = 0;
    for (const doseDay of fixtureCase.doseDays) {
      state = moveState(state, doseDay - currentDay);
      state = applyDose(state, product);
      state.events.push(doseDay);
      state.lastDoseDay = doseDay;
      currentDay = doseDay;
    }
    state = moveState(state, fixtureCase.assessmentLagDays);
    state.assessmentAgeDays = currentDay + fixtureCase.assessmentLagDays;
    assertImmuneStateMatchesFixture(state, fixtureCase);

    if (fixtureCase.doseDays.length >= 3) {
      const boosterDay = fixtureCase.doseDays[3];
      const boosterAgeYears = boosterDay === undefined ? 0 : Math.round(boosterDay / 365.25);
      const schedule: ScheduleV1 = {
        routineDays: [42, 70, 98],
        boosterAgeYears: boosterAgeYears as ScheduleV1["boosterAgeYears"],
        assessmentLagDays: fixtureCase.assessmentLagDays as ScheduleV1["assessmentLagDays"],
        productId: fixtureCase.productId
      };
      assert.deepEqual(scheduleDays(schedule), fixtureCase.doseDays, `${fixtureCase.id}: schedule days`);
      assertImmuneStateMatchesFixture(buildScheduleState(product, schedule), fixtureCase, `${fixtureCase.id}: buildScheduleState`);
    }
  }
});

test("India R schedule fixture matches low/default/high product grids, every selected schedule, and waning interval", () => {
  const inputs = scheduleKernelFixture.inputs;
  const defaults = vaccineDefaults("hypothetical");
  assert.equal(scheduleKernelFixture.schemaVersion, "SourceKernelFixtureV1");
  assert.equal(scheduleKernelFixture.releaseGateSatisfied, false);
  assert.equal(inputs.serotype, 1);
  assert.equal(inputs.strain, "Sabin");
  assert.equal(inputs.alpha, defaults.alpha);
  assert.equal(inputs.beta, defaults.beta);
  assert.equal(inputs.gamma, defaults.gamma);
  assert.equal(inputs.doseTCID50, defaults.dose);
  assert.equal(inputs.takeContext, defaults.takeContext);
  assert.equal(inputs.formulationMultiplier, defaults.formulationMultiplier);
  assert.equal(inputs.mu0, defaults.mu0);
  assert.equal(inputs.sigma0, defaults.sigma0);
  assert.equal(inputs.log2NMax, PARAMETERS.immunity.maxLog2);
  assert.equal(inputs.waningLambda, PARAMETERS.immunity.waningLambda);
  assert.equal(inputs.lowDoseLinearRatio, 0.01);
  assert.equal(scheduleKernelFixture.vaccineGrid.length, 3);
  assert.equal(scheduleKernelFixture.cases.length, scheduleKernelFixture.vaccineGrid.length * 12);

  for (const fixtureCase of scheduleKernelFixture.cases) {
    const vaccine: VaccineV1 = {
      ...defaults,
      alpha: fixtureCase.vaccine.alpha,
      beta: fixtureCase.vaccine.beta,
      dose: fixtureCase.vaccine.doseTCID50,
      takeContext: fixtureCase.vaccine.takeContext,
      mu0: fixtureCase.vaccine.mu0,
      sigma0: fixtureCase.vaccine.sigma0
    };
    let state = initialImmuneState();
    let currentDay = 0;
    for (const doseDay of fixtureCase.doseDays) {
      state = moveState(state, doseDay - currentDay);
      state = applyDose(state, vaccine);
      state.events.push(doseDay);
      state.lastDoseDay = doseDay;
      currentDay = doseDay;
    }
    state = moveState(state, fixtureCase.assessmentLagDays);
    state.assessmentAgeDays = currentDay + fixtureCase.assessmentLagDays;
    assertImmuneStateMatchesFixture(state, fixtureCase);
  }

  for (const fixtureCase of scheduleKernelFixture.waningCases) {
    assertKernelValue(
      waningDeltaMonths(fixtureCase.elapsedDays),
      fixtureCase.waningDeltaLog2,
      `waning delta at ${fixtureCase.elapsedDays} days`
    );
    assertKernelVector(
      waneMucosal(inputs.waningInputBins, fixtureCase.elapsedDays),
      fixtureCase.values,
      `waning bins at ${fixtureCase.elapsedDays} days`
    );
  }
});

test("partial Cessation Matlab fixture matches fixed-titer primary-secondary-tertiary incidence, prevalence, and named-anchor Rloc", () => {
  const inputs = cessationMotifFixture.inputs;
  assert.equal(cessationMotifFixture.schemaVersion, "SourceMotifFixtureV1");
  assert.equal(cessationMotifFixture.releaseGateSatisfied, false);
  assert.equal(inputs.serotype, 4);
  assert.equal(inputs.horizonDays, 100);
  assert.equal(inputs.vaccineDoseTCID50, 1e6);
  assert.equal(inputs.perDoseEfficacy, 0.8863);
  assert.equal(cessationMotifFixture.cases.length, 7);

  for (const fixtureCase of cessationMotifFixture.cases) {
    const actual = evaluateMatlabFixedTiterMotif({
      ...inputs,
      TihGramsPerExposure: fixtureCase.TihGramsPerExposure,
      ThsGramsPerExposure: fixtureCase.ThsGramsPerExposure,
      dIhExposuresPerPersonDay: fixtureCase.dIhExposuresPerPersonDay,
      dHsExposuresPerPersonDay: fixtureCase.dHsExposuresPerPersonDay,
      Ns: fixtureCase.Ns,
      primaryLog2NAb: fixtureCase.primaryLog2NAb,
      secondaryLog2NAb: fixtureCase.secondaryLog2NAb,
      tertiaryLog2NAb: fixtureCase.tertiaryLog2NAb
    });
    assertKernelVector(actual.primaryIncidence, fixtureCase.output.primaryIncidence, `${fixtureCase.id}: primary incidence`, 1e-5);
    assertKernelVector(actual.secondaryIncidence, fixtureCase.output.secondaryIncidence, `${fixtureCase.id}: secondary incidence`, 1e-5);
    assertKernelVector(actual.tertiaryIncidence, fixtureCase.output.tertiaryIncidence, `${fixtureCase.id}: tertiary incidence`, 1e-5);
    assertKernelVector(actual.primaryPrevalence, fixtureCase.output.primaryPrevalence, `${fixtureCase.id}: primary prevalence`, 1e-5);
    assertKernelVector(actual.secondaryPrevalence, fixtureCase.output.secondaryPrevalence, `${fixtureCase.id}: secondary prevalence`, 1e-5);
    assertKernelVector(actual.tertiaryPrevalence, fixtureCase.output.tertiaryPrevalence, `${fixtureCase.id}: tertiary prevalence`, 1e-5);
    assertKernelValue(actual.primaryTotal, fixtureCase.output.primaryTotal, `${fixtureCase.id}: primary total`, 1e-5);
    assertKernelValue(actual.secondaryTotal, fixtureCase.output.secondaryTotal, `${fixtureCase.id}: secondary total`, 1e-5);
    assertKernelValue(actual.tertiaryTotal, fixtureCase.output.tertiaryTotal, `${fixtureCase.id}: tertiary total`, 1e-5);
    assertKernelValue(actual.rLoc, fixtureCase.output.rLoc, `${fixtureCase.id}: Rloc`, 1e-5);
  }

  const byId = new Map(cessationMotifFixture.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase.output.rLoc]));
  assert.ok((byId.get("low-naive") ?? Infinity) < 1, "source low-anchor naive fixed titer is controlled");
  assert.ok((byId.get("moderate-naive") ?? 0) > 1, "source moderate-anchor naive fixed titer is uncontrolled");
  assert.ok((byId.get("moderate-fixed-titer-3") ?? Infinity) < 1, "source moderate-anchor fixed titer 3 is controlled");
  assert.ok((byId.get("high-fixed-titer-3") ?? 0) > 1, "source high-anchor fixed titer 3 is uncontrolled");
  assert.ok((byId.get("high-fixed-titer-8") ?? Infinity) < 1, "source high-anchor fixed titer 8 is controlled");
});

test("distribution-native day-1-45 prevalence calibration uses the approved identifiable parameters", () => {
  assert.equal(calibrationReport.schemaVersion, "DistributionNativePrevalenceCalibrationReportV1");
  assert.equal(calibrationReport.calibrationGateSatisfied, true);
  assert.equal(calibrationReport.tolerance.log10RmseMaximum, PARAMETERS.success.calibrationLog10Tolerance);
  assert.equal(calibrationReport.cases.length, 3);
  assert.ok(calibrationReport.cases.every((fixtureCase) => fixtureCase.passes));
  assert.ok(calibrationReport.cases.every((fixtureCase) => fixtureCase.targetRoles.every((role) =>
    role.passes && role.profileLog10Rmse <= PARAMETERS.success.calibrationLog10Tolerance
  )));

  const houston = calibrationReport.cases.find((fixtureCase) => fixtureCase.id === "houston-naive-index")!;
  assert.equal(houston.stateMapping.indexState, "naive");
  assert.equal(houston.stateMapping.householdState, "naive");
  assert.equal(houston.stateMapping.fitIndexMeanLog2NAb, false);
  assert.equal(houston.stateMapping.fitTih, false);

  const india = calibrationReport.cases.find((fixtureCase) => fixtureCase.id === "india-high-contact")!;
  assert.equal(india.stateMapping.indexState, "naive");
  assert.equal(india.stateMapping.householdState, "campaign-history-gaussian");
  assert.equal(india.stateMapping.contactMeanLog2NAb, 9);
  assert.equal(india.stateMapping.fitTih, true);
  assert.equal(india.stateMapping.fitContactMeanLog2NAb, true);
  assert.equal(india.fittedIndexMeanLog2NAb, null);
  assert.equal(india.fixedContactMeanLog2NAb, null);
  assert.equal(india.fittedContactMeanLog2NAb, 9.21);
  assert.ok(Math.abs((india.constrainedContactVarianceLog2NAb ?? Infinity) - (
    calibrationReport.varianceConstraint.intercept + calibrationReport.varianceConstraint.slope * 9.21
  )) < 1e-12);
  assert.ok(Math.abs(india.fittedTihMicrogramsPerExposure - 199.52623149688788) < 1e-9);
  assert.equal(india.jointContactTihFit?.coarseGrid.candidateCount, 4984);
  assert.equal(india.jointContactTihFit?.coarseGrid.best.contactMeanLog2NAb, 9.25);
  assert.ok((india.jointContactTihFit?.coarseGrid.best.profileLog10Rmse ?? Infinity) < 0.011);
  assert.equal(india.jointContactTihFit?.refinementGrid.candidateCount, 2121);
  assert.ok((india.jointContactTihFit?.refinementGrid.nearOptimalCandidateCount ?? 0) > 0);
  assert.deepEqual(india.jointContactTihFit?.refinementGrid.nearOptimalMeanRangeLog2NAb, [9.09, 9.32]);
  assert.ok(Math.abs((india.jointContactTihFit?.refinementGrid.nearOptimalTihRangeGramsPerExposure[0] ?? 0) - 0.00017378008287493763) < 1e-18);
  assert.ok(Math.abs((india.jointContactTihFit?.refinementGrid.nearOptimalTihRangeGramsPerExposure[1] ?? 0) - 0.00022908676527677748) < 1e-18);

  const matlab = calibrationReport.cases.find((fixtureCase) => fixtureCase.id === "matlab-schedule-index")!;
  assert.equal(matlab.stateMapping.indexState, "schedule-calibrated-gaussian");
  assert.equal(matlab.stateMapping.householdState, "naive");
  assert.equal(matlab.stateMapping.fitIndexMeanLog2NAb, true);
  assert.equal(matlab.stateMapping.fitTih, true);
  assert.equal(matlab.stateMapping.fitContactMeanLog2NAb, false);
  assert.ok((matlab.fittedIndexMeanLog2NAb ?? 0) > 8.374917615821225);
  assert.equal(matlab.fixedContactMeanLog2NAb, null);
  assert.equal(matlab.fittedContactMeanLog2NAb, null);
  assert.equal(matlab.constrainedContactVarianceLog2NAb, null);
  assert.ok(Math.abs((matlab.constrainedIndexVarianceLog2NAb ?? Infinity) - (
    calibrationReport.varianceConstraint.intercept
      + calibrationReport.varianceConstraint.slope * (matlab.fittedIndexMeanLog2NAb ?? Infinity)
  )) < 1e-12);
});

test("fractional contact frequency uses the equivalent Poisson hazard", () => {
  const p = 0.2; const D = 8.9685;
  assert.ok(Math.abs(repeatedExposureProbability(p, D) - (1 - (1 - p) ** D)) < 1e-12);
  assert.equal(repeatedExposureProbability(0, D), 0);
  assert.equal(repeatedExposureProbability(p, 0), 0);
});

test("schedule events and assessment lag follow the locked days", () => {
  const scenario = defaultScenario();
  assert.deepEqual(scheduleDays(scenario.schedule), [42, 70, 98]);
  const state = buildScheduleState(scenario.vaccine, scenario.schedule);
  const explicitState = buildStateAtAssessment(scenario.vaccine, scheduleDays(scenario.schedule), 126);
  assert.deepEqual(state.events, [42, 70, 98]);
  assert.equal(state.assessmentAgeDays, 126);
  assert.deepEqual(explicitState, state);
  const boosted = buildScheduleState(scenario.vaccine, { ...scenario.schedule, boosterAgeYears: 2 });
  assert.deepEqual(boosted.events, [42, 70, 98, 730.5]);
  assert.equal(boosted.assessmentAgeDays, 758.5);
});

test("take splits live-history mass rather than applying scalar efficacy", () => {
  const scenario = defaultScenario();
  const afterDose = applyDose(initialImmuneState(), scenario.vaccine);
  assert.ok(afterDose.groups.some((group) => group.everInfected));
  assert.ok(afterDose.groups.some((group) => !group.everInfected));
  assert.ok(Math.abs(afterDose.groups.reduce((sum, group) => sum + group.mass, 0) - 1) < 1e-12);
  const naiveTake = doseResponse(
    scenario.vaccine.dose,
    0,
    scenario.vaccine.alpha,
    scenario.vaccine.beta,
    scenario.vaccine.gamma
  );
  assert.ok(Math.abs((afterDose.groups.find((group) => group.everInfected)?.mass ?? 0) - naiveTake * scenario.vaccine.takeContext) < 1e-10);
});

test("all-IPV naive schedule has no mucosal endpoint effect", () => {
  const scenario = { ...defaultScenario(), vaccine: vaccineDefaults("ipv"), comparatorId: "ipv" as const, schedule: { ...defaultScenario().schedule, productId: "ipv" as const } };
  const state = buildScheduleState(scenario.vaccine, scenario.schedule);
  assert.equal(state.groups.length, 1);
  assert.equal(state.groups[0]!.mass, 1);
  assert.equal(state.groups[0]!.everInfected, false);
  assert.deepEqual(state.groups[0]!.mucosal, normalizeBins([1, ...Array<number>(15).fill(0)]));
  const metrics = evaluateScenario({ ...scenario, envelope: { ...scenario.envelope, TihMax: 0.000005, TihMin: 0.000005, ThsMax: 0.000005, ThsMin: 0.000005 } });
  assert.ok(Math.abs(metrics.metrics.qAcq - 1) < 1e-12);
});

test("Rloc is monotone in setting axes and zero on any interrupted transmission link", () => {
  const scenario = defaultScenario();
  const state = buildScheduleState(scenario.vaccine, scenario.schedule);
  const base = SETTING_ANCHORS[0]!;
  const moreExposure: SettingV1 = { ...base, Tih: { ...base.Tih, value: base.Tih.value * 10 }, Ths: { ...base.Ths, value: base.Ths.value * 10 } };
  const moreIndexHouseholdDose: SettingV1 = { ...base, Tih: { ...base.Tih, value: base.Tih.value * 10 } };
  const moreHouseholdSocialDose: SettingV1 = { ...base, Ths: { ...base.Ths, value: base.Ths.value * 10 } };
  const moreIndexHouseholdContacts: SettingV1 = { ...base, dIh: { ...base.dIh, value: base.dIh.value * 2 } };
  const moreHouseholdSocialContacts: SettingV1 = { ...base, dHs: { ...base.dHs, value: base.dHs.value * 2 } };
  const moreContacts: SettingV1 = { ...base, Ns: base.Ns + 5 };
  const r0 = rLocForSetting(state, base, scenario.indexReferenceExposure, scenario.horizonDays);
  const rExposure = rLocForSetting(state, moreExposure, scenario.indexReferenceExposure, scenario.horizonDays);
  const rIndexHouseholdDose = rLocForSetting(state, moreIndexHouseholdDose, scenario.indexReferenceExposure, scenario.horizonDays);
  const rHouseholdSocialDose = rLocForSetting(state, moreHouseholdSocialDose, scenario.indexReferenceExposure, scenario.horizonDays);
  const rIndexHouseholdContacts = rLocForSetting(state, moreIndexHouseholdContacts, scenario.indexReferenceExposure, scenario.horizonDays);
  const rHouseholdSocialContacts = rLocForSetting(state, moreHouseholdSocialContacts, scenario.indexReferenceExposure, scenario.horizonDays);
  const rContacts = rLocForSetting(state, moreContacts, scenario.indexReferenceExposure, scenario.horizonDays);
  assert.ok(rExposure >= r0 - 1e-12);
  assert.ok(rIndexHouseholdDose >= r0 - 1e-12);
  assert.ok(rHouseholdSocialDose >= r0 - 1e-12);
  assert.ok(rIndexHouseholdContacts >= r0 - 1e-12);
  assert.ok(rHouseholdSocialContacts >= r0 - 1e-12);
  assert.ok(rContacts >= r0 - 1e-12);
  for (const zero of [
    { ...base, Tih: { ...base.Tih, value: 0 } },
    { ...base, Ths: { ...base.Ths, value: 0 } },
    { ...base, dIh: { ...base.dIh, value: 0 } },
    { ...base, dHs: { ...base.dHs, value: 0 } },
    { ...base, Ns: 0 }
  ] as SettingV1[]) {
    assert.equal(rLocForSetting(state, zero, scenario.indexReferenceExposure, scenario.horizonDays), 0);
    assert.equal(naiveRLocForSetting(zero, scenario.indexReferenceExposure, scenario.horizonDays, state.assessmentAgeDays), 0);
  }
});

test("precomputed Rloc evaluator agrees with direct factorized calculation", () => {
  const scenario = defaultScenario();
  const scenarios = [
    scenario,
    { ...scenario, schedule: { ...scenario.schedule, boosterAgeYears: 2 as const } },
    scenarioWithProduct(scenario, "sabin2")
  ];
  for (const candidate of scenarios) {
    const state = buildScheduleState(candidate.vaccine, candidate.schedule);
    for (const setting of [SETTING_ANCHORS[0]!, envelopeCorner(candidate)]) {
      const evaluator = createRLocEvaluator(setting, candidate.indexReferenceExposure, state.assessmentAgeDays, candidate.horizonDays);
      const direct = rLocForSetting(state, setting, candidate.indexReferenceExposure, candidate.horizonDays);
      assert.ok(Math.abs(evaluator(state) - direct) <= 1e-10, `Rloc paths disagree for ${candidate.vaccine.id} at ${setting.id}`);
    }
  }
});

test("better live-vaccine take or boost cannot increase envelope Rloc over the declared product range", () => {
  const scenario = defaultScenario();
  const schedule = { ...scenario.schedule, productId: "hypothetical" as const };
  const setting = envelopeCorner(scenario);
  for (const takeContext of [0.2, 0.4, 0.6, 0.8]) {
    for (const mu0 of [0, 2, 4, 6]) {
      const vaccine = { ...vaccineDefaults("hypothetical"), takeContext, mu0 };
      const baseline = rLocForSetting(buildScheduleState(vaccine, schedule), setting, scenario.indexReferenceExposure, scenario.horizonDays);
      const higherTake = rLocForSetting(
        buildScheduleState({ ...vaccine, takeContext: takeContext + 0.2 }, schedule),
        setting,
        scenario.indexReferenceExposure,
        scenario.horizonDays
      );
      const higherBoost = rLocForSetting(
        buildScheduleState({ ...vaccine, mu0: mu0 + 2 }, schedule),
        setting,
        scenario.indexReferenceExposure,
        scenario.horizonDays
      );
      assert.ok(higherTake <= baseline + 1e-10, `take increased Rloc at take=${takeContext}, mu0=${mu0}`);
      assert.ok(higherBoost <= baseline + 1e-10, `boost increased Rloc at take=${takeContext}, mu0=${mu0}`);
    }
  }
});

test("scenario serialization is canonical and rejects unknown fields", () => {
  const scenario = defaultScenario();
  const encoded = encodeScenario(scenario);
  const decoded = decodeScenario(encoded);
  assert.equal(canonicalJson(decoded), canonicalJson(scenario));
  assert.throws(() => validateScenario({ ...scenario, unknown: true }));
  assert.throws(() => validateScenario({ ...scenario, vaccine: { ...scenario.vaccine, beta: -1 } }));
  assert.throws(() => decodeScenario("not-a-scenario"), /Invalid scenario URL state/);
  validateScenario(scenarioWithSetting(scenario, "matlab"));
});

test("scenario validation preserves fixed product and named-setting identities", () => {
  const scenario = defaultScenario();
  const sabin2 = scenarioWithProduct(scenario, "sabin2");
  assert.throws(
    () => validateScenario({ ...sabin2, vaccine: { ...sabin2.vaccine, dose: sabin2.vaccine.dose + 1 } }),
    /fixed v1 comparator/
  );
  assert.throws(
    () => validateScenario({ ...sabin2, vaccine: { ...sabin2.vaccine, live: false } }),
    /identity does not match/
  );

  const low = scenarioWithSetting(scenario, "low");
  assert.throws(
    () => validateScenario({ ...low, setting: { ...low.setting, Ns: low.setting.Ns + 1 } }),
    /does not match the bundled named setting/
  );
  assert.throws(
    () => validateScenario({ ...scenario, setting: { ...scenario.setting, Tih: { ...scenario.setting.Tih, unit: "micrograms/exposure" } } }),
    /wrong unit or basis/
  );
});

test("unsupported envelope state fails closed before model execution", () => {
  const scenario = defaultScenario();
  validateScenario(scenario);
  validateScenario({ ...scenario, envelope: { ...scenario.envelope, linkedExposure: false, ThsMin: 2e-7, ThsMax: 0.001 } });
  assert.throws(() => validateScenario({ ...scenario, envelope: { ...scenario.envelope, TihMin: 0 } }), /finite and positive/);
  assert.throws(() => validateScenario({ ...scenario, envelope: { ...scenario.envelope, TihMin: Number.NaN } }), /finite and positive/);
  assert.throws(() => validateScenario({ ...scenario, envelope: { ...scenario.envelope, TihMax: scenario.envelope.TihMin / 2 } }), /finite and in/);
  assert.throws(() => validateScenario({ ...scenario, envelope: { ...scenario.envelope, ThsMax: scenario.envelope.ThsMin / 2 } }), /finite and in/);
  assert.throws(() => validateScenario({ ...scenario, envelope: { ...scenario.envelope, linkedExposure: true, ThsMax: scenario.envelope.ThsMax / 2 } }), /identical/);
  assert.throws(() => validateScenario({ ...scenario, envelope: { ...scenario.envelope, NsMin: scenario.envelope.NsMax + 1 } }), /integer/);
});

test("selected custom setting is calculated separately from the envelope maximum", () => {
  const scenario = defaultScenario();
  const custom = scenarioWithSetting(scenario, "custom");
  const zeroProbe = {
    ...custom,
    setting: {
      ...custom.setting,
      Tih: { ...custom.setting.Tih, value: 0 },
      Ths: { ...custom.setting.Ths, value: 0 },
      dIh: { ...custom.setting.dIh, value: 0 },
      dHs: { ...custom.setting.dHs, value: 0 },
      Ns: 0
    }
  };
  const baseline = evaluateScenario(scenario);
  const probed = evaluateScenario(zeroProbe);
  assert.equal(probed.metrics.rLocSelectedSetting, 0);
  assert.equal(probed.metrics.rLocEnvelopeMax, baseline.metrics.rLocEnvelopeMax);
});

test("frontier cells are direct evaluations and classification uses the locked below-threshold rule", () => {
  const scenario = defaultScenario();
  const frontier = buildFrontier(scenario);
  assert.equal(frontier.points.length, 51 * 51);
  assert.ok(frontier.points.every((point) => point.passes === passesThreshold(point.rLocEnvelopeMax)));
  assert.equal(passesThreshold(1 - 2 * FRONTIER_GRID.contour.tieTolerance), true);
  assert.equal(passesThreshold(1 - FRONTIER_GRID.contour.tieTolerance), false);
  assert.equal(passesThreshold(1), false);
  const point = frontier.points[1300]!;
  assert.equal(gridPointRLocMatchesDirect(scenario, point), true);
});

test("frontier remains the hypothetical family when a fixed comparator is selected", () => {
  const hypotheticalScenario = defaultScenario();
  const sabin2Scenario = scenarioWithProduct(hypotheticalScenario, "sabin2");
  const hypotheticalFrontier = buildFrontier(hypotheticalScenario);
  const sabin2Frontier = buildFrontier(sabin2Scenario);
  assert.equal(sabin2Frontier.familyProductId, "hypothetical");
  assert.equal(sabin2Frontier.selectedDesign, null);
  assert.deepEqual(sabin2Frontier.points, hypotheticalFrontier.points);
  assert.equal(sabin2Frontier.comparators.find((point) => point.productId === "sabin2")?.selected, true);
  assert.equal(sabin2Frontier.comparators.find((point) => point.productId === "ipv")?.selected, false);
});

test("full outputs expose required grid sizes and explicit uncertainty absence", () => {
  const scenario = defaultScenario();
  const outputs = evaluateScenario(scenario);
  assert.equal(outputs.schemaVersion, "ModelOutputsV1");
  assert.equal(outputs.frontier.points.length, 2601);
  assert.equal(outputs.settingSurface.length, 81 * 40);
  assert.equal(outputs.uncertainty.available, false);
  assert.equal(outputs.uncertainty.rLocMax, null);
  const directEnvelopeMaximum = rLocForSetting(
    buildScheduleState(scenario.vaccine, scenario.schedule),
    envelopeCorner(scenario),
    scenario.indexReferenceExposure,
    scenario.horizonDays
  );
  assert.ok(Math.abs(Math.max(...outputs.settingSurface.map((point) => point.rLoc)) - directEnvelopeMaximum) <= 1e-10);
  assert.deepEqual(evaluateScenario(defaultScenario()), outputs);
  assert.throws(
    () => evaluateScenario({ ...defaultScenario(), successRule: "upper95" as never }),
    /point R_loc success rule/
  );
});

test("canonical identities use SHA-256", () => {
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.match(evaluateScenario(defaultScenario()).modelIdentity, /^sha256-[0-9a-f]{64}$/);
});

test("the exact selected hypothetical design is not replaced by a display-grid cell", () => {
  const scenario = defaultScenario();
  const outputs = evaluateScenario(scenario);
  assert.equal(outputs.frontier.selectedDesign?.takeContext, 1);
  assert.equal(outputs.frontier.selectedDesign?.mu0, 6);
  assert.equal(outputs.frontier.selectedDesign?.rLocEnvelopeMax, outputs.metrics.rLocEnvelopeMax);
  assert.notEqual(outputs.frontier.nearestGridPoint?.mu0, 6);

  const outsideGrid = { ...scenario, vaccine: { ...scenario.vaccine, mu0: 15 } };
  const outsideOutputs = evaluateScenario(outsideGrid);
  assert.equal(outsideOutputs.frontier.selectedDesign?.mu0, 15);
  assert.equal(outsideOutputs.frontier.selectedDesign?.rLocEnvelopeMax, outsideOutputs.metrics.rLocEnvelopeMax);
  assert.equal(outsideOutputs.frontier.nearestGridPoint?.mu0, 8);
  assert.notEqual(outsideOutputs.frontier.selectedDesign?.passes, outsideOutputs.frontier.nearestGridPoint?.passes);
});

test("unlinked exposure envelopes use both independent upper bounds", () => {
  const scenario = defaultScenario();
  const unlinked = {
    ...scenario,
    envelope: {
      ...scenario.envelope,
      linkedExposure: false,
      TihMin: 1e-7,
      TihMax: 1e-5,
      ThsMin: 2e-7,
      ThsMax: 3e-4
    }
  };
  validateScenario(unlinked);
  const corner = envelopeCorner(unlinked);
  assert.equal(corner.Tih.value, unlinked.envelope.TihMax);
  assert.equal(corner.Ths.value, unlinked.envelope.ThsMax);
  const state = buildScheduleState(unlinked.vaccine, unlinked.schedule);
  assert.equal(
    evaluateScenario(unlinked).metrics.rLocEnvelopeMax,
    rLocForSetting(state, corner, unlinked.indexReferenceExposure, unlinked.horizonDays)
  );
});

test("model outputs own their canonical scenario and boost matrices cannot be corrupted", () => {
  const scenario = defaultScenario();
  const outputs = evaluateScenario(scenario);
  scenario.vaccine.mu0 = 0;
  assert.equal(outputs.scenario.vaccine.mu0, 6);
  assert.equal(outputs.metrics.rLocEnvelopeMax, outputs.frontier.selectedDesign?.rLocEnvelopeMax);

  const first = buildBoostMatrix(6, 2.4, false);
  assert.ok(Object.isFrozen(first) && Object.isFrozen(first[0]));
  assert.throws(() => { (first as number[][])[0]![0] = 0.5; }, TypeError);
  assert.equal(buildBoostMatrix(6, 2.4, false)[0]?.[0], first[0]?.[0]);
  assert.ok(Object.isFrozen(PARAMETERS) && Object.isFrozen(PARAMETERS.wpv1));
});

test("invalid bin state fails closed instead of becoming a naive cohort", () => {
  assert.throws(() => normalizeBins(Array<number>(16).fill(0)), /positive total mass/);
  assert.throws(() => normalizeBins([Number.NaN, ...Array<number>(15).fill(1)]), /finite/);
  assert.throws(() => normalizeBins([-0.1, ...Array<number>(15).fill(1)]), /nonnegative/);
  assert.throws(() => shiftBins([1, ...Array<number>(15).fill(0)], Number.NaN), /finite/);
});

test("each motif link receives the full post-infection horizon and agrees with explicit link composition", () => {
  let maximumRelativeDifference = 0;
  for (const scenario of [defaultScenario(), scenarioWithProduct(defaultScenario(), "ipv")]) {
    const state = buildScheduleState(scenario.vaccine, scenario.schedule);
    const index = conditionIndexBreakthrough(state, scenario.indexReferenceExposure).cohorts;
    const ageMonths = state.assessmentAgeDays / (365.25 / 12);
    for (const setting of SETTING_ANCHORS) {
      const household = transmitLink(index, state.groups, setting.Tih.value, setting.dIh.value, ageMonths, scenario.horizonDays);
      const independentlyTimedHousehold = household.map((cohort) => ({ ...cohort, infectionDay: 0 }));
      const social = transmitLink(independentlyTimedHousehold, state.groups, setting.Ths.value, setting.dHs.value, ageMonths, scenario.horizonDays);
      const composed = setting.Ns * social.reduce((sum, cohort) => sum + cohort.mass, 0);
      const direct = rLocForSetting(state, setting, scenario.indexReferenceExposure, scenario.horizonDays);
      const relativeDifference = Math.abs(composed - direct) / Math.max(Math.abs(direct), Number.MIN_VALUE);
      maximumRelativeDifference = Math.max(maximumRelativeDifference, relativeDifference);
    }
  }
  assert.ok(maximumRelativeDifference < 1e-12, `maximum cross-path relative difference was ${maximumRelativeDifference}`);
});

test("the 120-day per-infection horizon satisfies the extension criterion at every anchor", () => {
  assert.equal(PARAMETERS.transmission.horizonDays, 120);
  for (const scenario of [defaultScenario(), scenarioWithProduct(defaultScenario(), "sabin2"), scenarioWithProduct(defaultScenario(), "ipv")]) {
    const state = buildScheduleState(scenario.vaccine, scenario.schedule);
    for (const setting of SETTING_ANCHORS) {
      clearTransmissionCaches();
      const baseline = rLocForSetting(state, setting, scenario.indexReferenceExposure, scenario.horizonDays);
      const extended = rLocForSetting(state, setting, scenario.indexReferenceExposure, scenario.horizonDays * 2);
      const relativeDifference = Math.abs(extended - baseline) / Math.max(Math.abs(extended), Number.MIN_VALUE);
      assert.ok(relativeDifference < PARAMETERS.success.horizonExtensionRelativeTolerance, `${scenario.vaccine.id}/${setting.id}: ${relativeDifference}`);
    }
  }
});

test("transmission caches remain explicitly bounded across distinct valid settings", () => {
  const scenario = defaultScenario();
  const state = buildScheduleState(scenario.vaccine, scenario.schedule);
  clearTransmissionCaches();
  for (let index = 1; index <= 40; index += 1) {
    const scale = index / 40;
    const setting: SettingV1 = {
      ...SETTING_ANCHORS[0]!,
      id: "custom",
      Tih: { ...SETTING_ANCHORS[0]!.Tih, value: 1e-7 + scale * 1e-3 },
      Ths: { ...SETTING_ANCHORS[0]!.Ths, value: 2e-7 + scale * 2e-3 }
    };
    rLocForSetting(state, setting, scenario.indexReferenceExposure, scenario.horizonDays);
  }
  const stats = transmissionCacheStats();
  assert.ok(stats.linkKernels <= stats.capacity);
  assert.ok(stats.sheddingProfiles <= stats.capacity);
  assert.ok(stats.perExposureProfiles <= stats.capacity);
});
