import { DIAGNOSTIC_GRID, FRONTIER_GRID, PARAMETERS, SETTING_ANCHORS, SETTING_MANIFEST_VERSION, UNCERTAINTY_ENSEMBLE, vaccineDefaults } from "./parameters";
import { diagnosticDoseGrid, diagnosticTimeGrid } from "./diagnostics";
import { scheduleDays } from "./schedule";
import { ROUTINE_DAYS } from "./types";
import type { DesignGridPoint, ModelOutputsV1, ScenarioV1, SettingV1, UnitValueV1, VaccineV1 } from "./types";
import { canonicalHash, canonicalJson } from "./canonical";

export { canonicalHash, canonicalJson };

export function encodeScenario(scenario: ScenarioV1): string {
  return base64UrlEncode(canonicalJson(scenario));
}

export function decodeScenario(encoded: string): ScenarioV1 {
  try {
    const decoded = base64UrlDecode(encoded);
    const value: unknown = JSON.parse(decoded);
    validateScenario(value);
    return value;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid scenario URL state: ${detail}`);
  }
}

export function validateScenario(value: unknown): asserts value is ScenarioV1 {
  if (!isRecord(value)) throw new Error("Scenario must be a JSON object");
  exactKeys(value, ["schemaVersion", "targetId", "comparatorId", "vaccine", "schedule", "setting", "envelope", "successRule", "indexReferenceExposure", "horizonDays", "parameterManifestVersion", "settingManifestVersion", "frontierGridVersion", "uncertaintyEnsembleVersion"], "ScenarioV1");
  if (value.schemaVersion !== "ScenarioV1" || value.targetId !== "WPV1") throw new Error("Unsupported scenario schema or target");
  if (!isProductId(value.comparatorId)) throw new Error("Invalid comparator id");
  validateVaccine(value.vaccine);
  validateSchedule(value.schedule);
  if (value.schedule.productId !== value.vaccine.id || value.comparatorId !== value.vaccine.id) throw new Error("Product ids must agree across scenario, vaccine, and schedule");
  validateSetting(value.setting);
  validateEnvelope(value.envelope);
  if (value.successRule !== "point") throw new Error("This iteration supports only the point R_loc success rule");
  finitePositive(value.indexReferenceExposure, "indexReferenceExposure");
  integerRange(value.horizonDays, 1, 1000, "horizonDays");
  for (const [key, expected] of [["parameterManifestVersion", PARAMETERS.manifestVersion], ["settingManifestVersion", SETTING_MANIFEST_VERSION], ["frontierGridVersion", FRONTIER_GRID.version], ["uncertaintyEnsembleVersion", UNCERTAINTY_ENSEMBLE.version]] as const) {
    if (value[key] !== expected) throw new Error(`${key} does not match the bundled manifest`);
  }
}

export function validateModelOutputs(value: unknown): asserts value is ModelOutputsV1 {
  if (!isRecord(value)) throw new Error("ModelOutputsV1 must be a JSON object");
  exactKeys(value, ["schemaVersion", "scenario", "metrics", "settingSurface", "frontier", "diagnostics", "uncertainty", "assumptions", "modelIdentity", "provenance"], "ModelOutputsV1");
  if (value.schemaVersion !== "ModelOutputsV1") throw new Error("Unsupported model-output schema");
  validateScenario(value.scenario);

  const metrics = requireRecord(value.metrics, "PointMetrics");
  exactKeys(metrics, ["qAcq", "qShed", "qIndex", "rLocSelectedSetting", "rLocEnvelopeMax", "rLocAnchors", "naiveRLocEnvelopeMax", "effectiveFirstDoseTake", "assessmentAgeDays", "assessmentLagDays", "indexReferenceExposure"], "PointMetrics");
  for (const key of ["qAcq", "qShed", "qIndex", "effectiveFirstDoseTake"] as const) finiteRange(metrics[key], 0, 1, `PointMetrics.${key}`);
  for (const key of ["rLocEnvelopeMax", "naiveRLocEnvelopeMax", "assessmentAgeDays", "assessmentLagDays", "indexReferenceExposure"] as const) finiteRange(metrics[key], 0, Number.MAX_VALUE, `PointMetrics.${key}`);
  if (metrics.rLocSelectedSetting !== null) finiteRange(metrics.rLocSelectedSetting, 0, Number.MAX_VALUE, "PointMetrics.rLocSelectedSetting");
  const anchors = requireRecord(metrics.rLocAnchors, "rLocAnchors"); exactKeys(anchors, ["houston", "matlab", "up-bihar"], "rLocAnchors");
  for (const key of ["houston", "matlab", "up-bihar"] as const) finiteRange(anchors[key], 0, Number.MAX_VALUE, `rLocAnchors.${key}`);

  if (!Array.isArray(value.settingSurface)) throw new Error("settingSurface must be an array");
  for (const [index, candidate] of value.settingSurface.entries()) {
    const point = requireRecord(candidate, `settingSurface[${index}]`); exactKeys(point, ["Tih", "Ths", "dIh", "dHs", "Ns", "rLoc"], `settingSurface[${index}]`);
    for (const key of ["Tih", "Ths", "dIh", "dHs", "rLoc"] as const) finiteRange(point[key], 0, Number.MAX_VALUE, `settingSurface[${index}].${key}`);
    integerRange(point.Ns, 0, 1000, `settingSurface[${index}].Ns`);
  }

  const frontier = requireRecord(value.frontier, "FrontierResult");
  exactKeys(frontier, ["familyProductId", "takeValues", "mu0Values", "points", "pareto", "selectedDesign", "nearestGridPoint", "comparators"], "FrontierResult");
  if (frontier.familyProductId !== "hypothetical") throw new Error("Frontier family must be hypothetical");
  finiteArray(frontier.takeValues, "FrontierResult.takeValues"); finiteArray(frontier.mu0Values, "FrontierResult.mu0Values");
  if (frontier.takeValues.length !== FRONTIER_GRID.takeContext.count || frontier.mu0Values.length !== FRONTIER_GRID.mu0New.count) throw new Error("Frontier axes have the wrong size");
  validateDesignPointArray(frontier.points, "FrontierResult.points"); validateDesignPointArray(frontier.pareto, "FrontierResult.pareto");
  if (frontier.points.length !== FRONTIER_GRID.takeContext.count * FRONTIER_GRID.mu0New.count) throw new Error("Frontier point grid has the wrong size");
  if (frontier.selectedDesign !== null) validateDesignPoint(frontier.selectedDesign, "FrontierResult.selectedDesign");
  if (frontier.nearestGridPoint !== null) validateDesignPoint(frontier.nearestGridPoint, "FrontierResult.nearestGridPoint");
  if (!Array.isArray(frontier.comparators)) throw new Error("FrontierResult.comparators must be an array");
  for (const [index, candidate] of frontier.comparators.entries()) {
    const point = requireRecord(candidate, `comparators[${index}]`);
    exactKeys(point, ["productId", "label", "takeContext", "mu0", "qAcq", "qShed", "rLocEnvelopeMax", "passes", "selected"], `comparators[${index}]`);
    if (point.productId !== "sabin2" && point.productId !== "ipv") throw new Error("Comparator product is invalid");
    if (typeof point.label !== "string" || typeof point.passes !== "boolean" || typeof point.selected !== "boolean") throw new Error("Comparator metadata is invalid");
    for (const key of ["qAcq", "qShed"] as const) finiteRange(point[key], 0, 1, `comparators[${index}].${key}`);
    finiteRange(point.rLocEnvelopeMax, 0, Number.MAX_VALUE, `comparators[${index}].rLocEnvelopeMax`);
    for (const key of ["takeContext", "mu0"] as const) if (point[key] !== null) finiteNumber(point[key], `comparators[${index}].${key}`);
  }
  if (frontier.comparators.length !== 2) throw new Error("Frontier must contain both fixed comparators");

  if (typeof value.modelIdentity !== "string" || !/^sha256-[0-9a-f]{64}$/.test(value.modelIdentity)) throw new Error("modelIdentity must be a SHA-256 content identity");
  validateWithinHostDiagnostics(value.diagnostics, metrics, value.scenario, value.modelIdentity);

  const uncertainty = requireRecord(value.uncertainty, "uncertainty"); exactKeys(uncertainty, ["available", "label", "reason", "rLocMax"], "uncertainty");
  if (uncertainty.available !== false || uncertainty.rLocMax !== null || typeof uncertainty.label !== "string" || typeof uncertainty.reason !== "string") throw new Error("Uncertainty output must fail closed as unavailable");
  if (!Array.isArray(value.assumptions) || value.assumptions.some((item) => typeof item !== "string")) throw new Error("assumptions must be a string array");
  validateProvenance(value.provenance);
}

function validateWithinHostDiagnostics(value: unknown, metrics: Record<string, any>, scenario: ScenarioV1, modelIdentity: string): void {
  const diagnostics = requireRecord(value, "WithinHostDiagnosticsV2");
  exactKeys(diagnostics, ["schemaVersion", "gridVersion", "gridSchemaVersion", "sourceParameterSchemaVersion", "sourceParameterManifestVersion", "modelIdentity", "challengeUnit", "units", "referenceChallengeDoseCID50", "assessmentAgeDays", "acquisitionCondition", "sheddingCondition", "burdenDefinition", "reference", "vaccinated", "qAcq", "qShed", "qIndex", "immuneResponse"], "WithinHostDiagnosticsV2");
  if (diagnostics.schemaVersion !== "WithinHostDiagnosticsV2") throw new Error("Unsupported within-host diagnostic schema");
  if (diagnostics.gridVersion !== DIAGNOSTIC_GRID.version || diagnostics.gridSchemaVersion !== DIAGNOSTIC_GRID.schemaVersion || diagnostics.sourceParameterSchemaVersion !== PARAMETERS.schemaVersion || diagnostics.sourceParameterManifestVersion !== PARAMETERS.manifestVersion || diagnostics.modelIdentity !== modelIdentity) throw new Error("Within-host diagnostics do not identify the bundled scientific inputs");
  if (diagnostics.challengeUnit !== "CID50" || diagnostics.acquisitionCondition !== "productive WPV acquisition after oral challenge" || diagnostics.sheddingCondition !== "conditioned on WPV acquisition" || diagnostics.burdenDefinition !== "survival probability times concentration conditional on still shedding") throw new Error("Within-host diagnostics have invalid conditioning");
  const units = requireRecord(diagnostics.units, "WithinHostDiagnosticsV2.units");
  exactKeys(units, ["challengeDose", "assessmentAge", "sheddingTime", "concentration", "dailyBurden", "integratedBurden", "sheddingIndex"], "WithinHostDiagnosticsV2.units");
  const expectedUnits = { challengeDose: "CID50", assessmentAge: "days", sheddingTime: "days after WPV acquisition", concentration: "TCID50/g", dailyBurden: "TCID50/g", integratedBurden: "TCID50-days/g", sheddingIndex: "TCID50-days/g" } as const;
  for (const [key, expected] of Object.entries(expectedUnits)) if (units[key] !== expected) throw new Error(`Within-host diagnostic unit ${key} is invalid`);
  finiteRange(diagnostics.referenceChallengeDoseCID50, 0, Number.MAX_VALUE, "WithinHostDiagnosticsV2.referenceChallengeDoseCID50");
  finiteRange(diagnostics.assessmentAgeDays, 0, Number.MAX_VALUE, "WithinHostDiagnosticsV2.assessmentAgeDays");
  if (diagnostics.referenceChallengeDoseCID50 !== scenario.indexReferenceExposure || diagnostics.referenceChallengeDoseCID50 !== metrics.indexReferenceExposure) throw new Error("Within-host reference challenge does not match the scenario");
  if (diagnostics.assessmentAgeDays !== metrics.assessmentAgeDays) throw new Error("Within-host assessment age does not match the scenario");
  const reference = validateDiagnosticCohort(diagnostics.reference, "naive-reference", "WithinHostDiagnosticsV2.reference");
  const vaccinated = validateDiagnosticCohort(diagnostics.vaccinated, "selected-vaccinated", "WithinHostDiagnosticsV2.vaccinated");
  validateImmuneResponse(diagnostics.immuneResponse, scenario, vaccinated.immunityBins as number[]);
  for (const key of ["qAcq", "qShed", "qIndex"] as const) finiteRange(diagnostics[key], 0, 1, `WithinHostDiagnosticsV2.${key}`);
  const expectedQAcq = reference.acquisitionAtReference > 0 ? vaccinated.acquisitionAtReference / reference.acquisitionAtReference : 0;
  const expectedQShed = reference.integratedConditionalBurdenTCID50DaysPerGram > 0 ? vaccinated.integratedConditionalBurdenTCID50DaysPerGram / reference.integratedConditionalBurdenTCID50DaysPerGram : 0;
  const expectedQIndex = reference.sheddingIndexAtReferenceTCID50DaysPerGram > 0 ? vaccinated.sheddingIndexAtReferenceTCID50DaysPerGram / reference.sheddingIndexAtReferenceTCID50DaysPerGram : 0;
  if (Math.abs(diagnostics.qAcq - expectedQAcq) > 1e-12 || Math.abs(diagnostics.qShed - expectedQShed) > 1e-12 || Math.abs(diagnostics.qIndex - expectedQIndex) > 1e-12) throw new Error("Within-host qAcq, qShed, or qIndex ratio does not match the cohort projections");
  if (Math.abs(diagnostics.qIndex - diagnostics.qAcq * diagnostics.qShed) > 1e-12) throw new Error("Within-host qIndex must equal qAcq times qShed");
  if (Math.abs(diagnostics.qAcq - metrics.qAcq) > 1e-12 || Math.abs(diagnostics.qShed - metrics.qShed) > 1e-12 || Math.abs(diagnostics.qIndex - metrics.qIndex) > 1e-12) {
    throw new Error("Within-host diagnostics do not agree with point metrics");
  }
}

function validateImmuneResponse(value: unknown, scenario: ScenarioV1, vaccinatedBins: number[]): void {
  const response = requireRecord(value, "ImmuneResponseDiagnosticsV1");
  exactKeys(response, ["schemaVersion", "displayMapping", "responseCondition", "boostResponse", "scheduleSnapshots", "monthlyTrace", "doseDiagnostics"], "ImmuneResponseDiagnosticsV1");
  if (response.schemaVersion !== "ImmuneResponseDiagnosticsV1") throw new Error("Unsupported immune-response diagnostic schema");
  const vaccine = scenario.vaccine;
  const live = vaccine.live;
  if (response.displayMapping !== (live ? "serum-equivalent-live-opv-like" : "mucosal-only-ipv")) throw new Error("Immune-response display mapping does not match the selected vaccine");
  if (response.responseCondition !== (live ? "conditioned on successful live-vaccine take" : "not applicable to non-live IPV")) throw new Error("Immune-response conditioning does not match the selected vaccine");

  // Panel A: the Section 7.3 boost operator, recomputed and compared exactly.
  const nMax = PARAMETERS.immunity.maxLog2;
  if (!live) {
    if (response.boostResponse !== null) throw new Error("IPV must not fabricate a live-vaccine boost-response curve");
  } else {
    if (!Array.isArray(response.boostResponse) || response.boostResponse.length !== PARAMETERS.immunity.bins) throw new Error("Live boost response must have one point per immunity bin");
    response.boostResponse.forEach((pointValue: unknown, index: number) => {
      const point = requireRecord(pointValue, `boostResponse[${index}]`);
      exactKeys(point, ["preStateLog2", "meanShiftLog2", "responseCenterFoldRise", "postMeanLog2", "postSdLog2", "postVarianceLog2Squared", "bandLowLog2", "bandHighLog2"], `boostResponse[${index}]`);
      if (point.preStateLog2 !== index) throw new Error(`boostResponse[${index}] pre-state must equal its bin index`);
      const scale = Math.max(0, 1 - index / nMax);
      const meanShiftLog2 = vaccine.mu0 * scale;
      const postMeanLog2 = Math.min(nMax, index + vaccine.mu0 * scale);
      const postSdLog2 = vaccine.sigma0 * scale;
      const expected: Record<string, number> = {
        meanShiftLog2,
        responseCenterFoldRise: 2 ** meanShiftLog2,
        postMeanLog2,
        postSdLog2,
        postVarianceLog2Squared: postSdLog2 * postSdLog2,
        bandLowLog2: Math.max(0, postMeanLog2 - postSdLog2),
        bandHighLog2: Math.min(nMax, postMeanLog2 + postSdLog2)
      };
      for (const [key, target] of Object.entries(expected)) {
        finiteNumber(point[key], `boostResponse[${index}].${key}`);
        if (Math.abs(point[key] - target) > 1e-12) throw new Error(`boostResponse[${index}].${key} does not match the Section 7.3 boost operator`);
      }
    });
  }

  // Panel B: schedule snapshots must match the selected schedule chronology exactly.
  const doseEventDays = scheduleDays(scenario.schedule);
  const assessmentDay = (doseEventDays.at(-1) ?? 0) + scenario.schedule.assessmentLagDays;
  const expectedSnapshots: Array<{ day: number; phase: string; doseNumber: number | null }> = [{ day: 0, phase: "initial", doseNumber: null }];
  doseEventDays.forEach((day, index) => {
    expectedSnapshots.push({ day, phase: "pre-dose", doseNumber: index + 1 });
    expectedSnapshots.push({ day, phase: "post-dose", doseNumber: index + 1 });
  });
  expectedSnapshots.push({ day: assessmentDay, phase: "assessment", doseNumber: null });
  if (!Array.isArray(response.scheduleSnapshots) || response.scheduleSnapshots.length !== expectedSnapshots.length) throw new Error("Schedule snapshots do not match the selected schedule chronology");
  response.scheduleSnapshots.forEach((snapshotValue: unknown, index: number) => {
    const snapshot = requireRecord(snapshotValue, `scheduleSnapshots[${index}]`);
    exactKeys(snapshot, ["sequence", "day", "phase", "doseNumber", "label", "mucosalBins", "meanStateLog2"], `scheduleSnapshots[${index}]`);
    const expected = expectedSnapshots[index]!;
    if (snapshot.sequence !== index) throw new Error(`scheduleSnapshots[${index}] is out of sequence`);
    if (snapshot.phase !== expected.phase || snapshot.doseNumber !== expected.doseNumber) throw new Error(`scheduleSnapshots[${index}] phase or dose number does not match the schedule`);
    finiteNumber(snapshot.day, `scheduleSnapshots[${index}].day`);
    if (Math.abs(snapshot.day - expected.day) > 1e-9) throw new Error(`scheduleSnapshots[${index}] day does not match the schedule`);
    if (typeof snapshot.label !== "string" || snapshot.label.length === 0) throw new Error(`scheduleSnapshots[${index}] label is missing`);
    finiteArray(snapshot.mucosalBins, `scheduleSnapshots[${index}].mucosalBins`);
    const bins = snapshot.mucosalBins as number[];
    if (bins.length !== PARAMETERS.immunity.bins || bins.some((mass) => mass < 0) || Math.abs(bins.reduce((sum, mass) => sum + mass, 0) - 1) > 1e-12) throw new Error(`scheduleSnapshots[${index}].mucosalBins is not a probability distribution`);
    finiteNumber(snapshot.meanStateLog2, `scheduleSnapshots[${index}].meanStateLog2`);
    if (Math.abs(snapshot.meanStateLog2 - bins.reduce((sum, mass, bin) => sum + mass * bin, 0)) > 1e-12) throw new Error(`scheduleSnapshots[${index}].meanStateLog2 must be the bin-weighted mean`);
  });
  const finalBins = (response.scheduleSnapshots.at(-1) as Record<string, any>).mucosalBins as number[];
  if (finalBins.some((mass, bin) => Math.abs(mass - (vaccinatedBins[bin] ?? 0)) > 1e-12)) throw new Error("Final assessment snapshot does not match the vaccinated immunity distribution");

  // Monthly waned trace: strictly increasing ages from birth to assessment, each a
  // conserved distribution; the final month equals the vaccinated distribution.
  if (!Array.isArray(response.monthlyTrace) || response.monthlyTrace.length < 2) throw new Error("Monthly trace must sample at least birth and assessment");
  let previousAgeMonths = -Infinity;
  response.monthlyTrace.forEach((pointValue: unknown, index: number) => {
    const point = requireRecord(pointValue, `monthlyTrace[${index}]`);
    exactKeys(point, ["ageMonths", "ageDays", "mucosalBins", "meanStateLog2"], `monthlyTrace[${index}]`);
    finiteRange(point.ageMonths, 0, Number.MAX_VALUE, `monthlyTrace[${index}].ageMonths`);
    finiteRange(point.ageDays, 0, Number.MAX_VALUE, `monthlyTrace[${index}].ageDays`);
    if (point.ageMonths <= previousAgeMonths) throw new Error(`monthlyTrace[${index}] ages must strictly increase`);
    previousAgeMonths = point.ageMonths;
    finiteArray(point.mucosalBins, `monthlyTrace[${index}].mucosalBins`);
    const bins = point.mucosalBins as number[];
    if (bins.length !== PARAMETERS.immunity.bins || bins.some((mass) => mass < 0) || Math.abs(bins.reduce((sum, mass) => sum + mass, 0) - 1) > 1e-12) throw new Error(`monthlyTrace[${index}].mucosalBins is not a probability distribution`);
    finiteNumber(point.meanStateLog2, `monthlyTrace[${index}].meanStateLog2`);
    if (Math.abs(point.meanStateLog2 - bins.reduce((sum, mass, bin) => sum + mass * bin, 0)) > 1e-12) throw new Error(`monthlyTrace[${index}].meanStateLog2 must be the bin-weighted mean`);
  });
  if (response.monthlyTrace[0].ageMonths !== 0) throw new Error("Monthly trace must begin at birth");
  if (Math.abs(response.monthlyTrace.at(-1).ageDays - assessmentDay) > 1e-9) throw new Error("Monthly trace must end at the assessment age");
  const finalMonthly = response.monthlyTrace.at(-1).mucosalBins as number[];
  if (finalMonthly.some((mass, bin) => Math.abs(mass - (vaccinatedBins[bin] ?? 0)) > 1e-12)) throw new Error("Final monthly snapshot does not match the vaccinated immunity distribution");

  // Per-dose aggregate take: bin-specific mass for a live dose, null for IPV.
  if (!Array.isArray(response.doseDiagnostics) || response.doseDiagnostics.length !== doseEventDays.length) throw new Error("Dose diagnostics do not match the schedule dose count");
  response.doseDiagnostics.forEach((doseValue: unknown, index: number) => {
    const dose = requireRecord(doseValue, `doseDiagnostics[${index}]`);
    exactKeys(dose, ["doseNumber", "day", "aggregateTakeProbability"], `doseDiagnostics[${index}]`);
    if (dose.doseNumber !== index + 1) throw new Error(`doseDiagnostics[${index}] dose number is wrong`);
    finiteNumber(dose.day, `doseDiagnostics[${index}].day`);
    if (Math.abs(dose.day - doseEventDays[index]!) > 1e-9) throw new Error(`doseDiagnostics[${index}] day does not match the schedule`);
    if (live) finiteRange(dose.aggregateTakeProbability, 0, 1, `doseDiagnostics[${index}].aggregateTakeProbability`);
    else if (dose.aggregateTakeProbability !== null) throw new Error(`doseDiagnostics[${index}] must be null for non-live IPV`);
  });
}

function validateDiagnosticCohort(value: unknown, id: string, label: string): Record<string, any> {
  const cohort = requireRecord(value, label);
  exactKeys(cohort, ["id", "label", "immunityBins", "acquisitionByDose", "acquisitionAtReference", "sheddingByDay", "integratedConditionalBurdenTCID50DaysPerGram", "sheddingIndexAtReferenceTCID50DaysPerGram"], label);
  if (cohort.id !== id || typeof cohort.label !== "string" || cohort.label.length === 0) throw new Error(`${label} identity is invalid`);
  finiteArray(cohort.immunityBins, `${label}.immunityBins`);
  if (cohort.immunityBins.length !== PARAMETERS.immunity.bins || cohort.immunityBins.some((value: number) => value < 0) || Math.abs(cohort.immunityBins.reduce((sum: number, item: number) => sum + item, 0) - 1) > 1e-10) {
    throw new Error(`${label}.immunityBins must be a probability distribution`);
  }
  if (!Array.isArray(cohort.acquisitionByDose) || cohort.acquisitionByDose.length !== DIAGNOSTIC_GRID.challengeDose.count) throw new Error(`${label}.acquisitionByDose has the wrong grid size`);
  const doseGrid = diagnosticDoseGrid();
  let previousDose = 0;
  let previousProbability = -Number.EPSILON;
  for (const [index, pointValue] of cohort.acquisitionByDose.entries()) {
    const point = requireRecord(pointValue, `${label}.acquisitionByDose[${index}]`);
    exactKeys(point, ["doseCID50", "probability"], `${label}.acquisitionByDose[${index}]`);
    finiteRange(point.doseCID50, 0, Number.MAX_VALUE, `${label}.acquisitionByDose[${index}].doseCID50`);
    if (point.doseCID50 !== doseGrid[index]) throw new Error(`${label}.acquisitionByDose has a stale dose grid`);
    finiteRange(point.probability, 0, 1, `${label}.acquisitionByDose[${index}].probability`);
    if (point.doseCID50 <= previousDose || point.probability + 1e-12 < previousProbability) throw new Error(`${label}.acquisitionByDose is not monotone`);
    previousDose = point.doseCID50;
    previousProbability = point.probability;
  }
  finiteRange(cohort.acquisitionAtReference, 0, 1, `${label}.acquisitionAtReference`);
  const timeGrid = diagnosticTimeGrid();
  if (!Array.isArray(cohort.sheddingByDay) || cohort.sheddingByDay.length !== timeGrid.length) throw new Error(`${label}.sheddingByDay has the wrong grid size`);
  let burden = 0;
  for (const [index, pointValue] of cohort.sheddingByDay.entries()) {
    const point = requireRecord(pointValue, `${label}.sheddingByDay[${index}]`);
    exactKeys(point, ["day", "survivalProbability", "conditionalConcentrationTCID50PerGram", "expectedInfectiousConcentrationTCID50PerGram"], `${label}.sheddingByDay[${index}]`);
    if (point.day !== timeGrid[index]) throw new Error(`${label}.sheddingByDay has a stale day grid`);
    finiteRange(point.survivalProbability, 0, 1, `${label}.sheddingByDay[${index}].survivalProbability`);
    finiteRange(point.conditionalConcentrationTCID50PerGram, 0, Number.MAX_VALUE, `${label}.sheddingByDay[${index}].conditionalConcentrationTCID50PerGram`);
    finiteRange(point.expectedInfectiousConcentrationTCID50PerGram, 0, Number.MAX_VALUE, `${label}.sheddingByDay[${index}].expectedInfectiousConcentrationTCID50PerGram`);
    const expected = point.survivalProbability * point.conditionalConcentrationTCID50PerGram;
    if (Math.abs(point.expectedInfectiousConcentrationTCID50PerGram - expected) > Math.max(1e-8, Math.abs(expected) * 1e-10)) throw new Error(`${label}.sheddingByDay does not preserve the joint expectation`);
    burden += point.expectedInfectiousConcentrationTCID50PerGram;
  }
  finiteRange(cohort.integratedConditionalBurdenTCID50DaysPerGram, 0, Number.MAX_VALUE, `${label}.integratedConditionalBurdenTCID50DaysPerGram`);
  if (Math.abs(cohort.integratedConditionalBurdenTCID50DaysPerGram - burden) > Math.max(1e-6, Math.abs(burden) * 1e-10)) throw new Error(`${label}.integrated burden does not match the daily diagnostic grid`);
  finiteRange(cohort.sheddingIndexAtReferenceTCID50DaysPerGram, 0, Number.MAX_VALUE, `${label}.sheddingIndexAtReferenceTCID50DaysPerGram`);
  const index = cohort.acquisitionAtReference * cohort.integratedConditionalBurdenTCID50DaysPerGram;
  if (Math.abs(cohort.sheddingIndexAtReferenceTCID50DaysPerGram - index) > Math.max(1e-6, Math.abs(index) * 1e-10)) throw new Error(`${label}.shedding index does not match the reference acquisition and burden`);
  return cohort;
}

function validateProvenance(value: unknown): void {
  const provenance = requireRecord(value, "ProvenanceV1");
  exactKeys(provenance, ["schemaVersion", "designContract", "generatedAt", "sourceFiles", "sourceCommits", "transforms"], "ProvenanceV1");
  if (provenance.schemaVersion !== "ProvenanceV1" || provenance.designContract !== PARAMETERS.designContractVersion) throw new Error("Provenance does not match the bundled contract");
  if (typeof provenance.generatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(provenance.generatedAt)) throw new Error("Provenance generatedAt must be an ISO date");
  nonemptyStringArray(provenance.sourceFiles, "ProvenanceV1.sourceFiles");
  nonemptyStringArray(provenance.transforms, "ProvenanceV1.transforms");
  const commits = requireRecord(provenance.sourceCommits, "ProvenanceV1.sourceCommits");
  exactKeys(commits, ["cessationStability", "indiaPolio"], "ProvenanceV1.sourceCommits");
  for (const key of ["cessationStability", "indiaPolio"] as const) if (typeof commits[key] !== "string" || !/^[0-9a-f]{40}$/.test(commits[key])) throw new Error(`ProvenanceV1.sourceCommits.${key} must be a full Git commit`);
}

function validateVaccine(value: unknown): asserts value is VaccineV1 {
  if (!isRecord(value)) throw new Error("Vaccine must be an object");
  exactKeys(value, ["id", "label", "live", "alpha", "beta", "dose", "takeContext", "formulationMultiplier", "mu0", "sigma0", "gamma"], "VaccineV1");
  if (!isProductId(value.id)) throw new Error("Invalid vaccine identity");
  const catalog = vaccineDefaults(value.id);
  if (value.label !== catalog.label || value.live !== catalog.live) throw new Error(`${value.id} identity does not match the bundled product catalog`);
  if (value.id !== "hypothetical") {
    if (!sameRecord(value, catalog)) throw new Error(`${value.id} is a fixed v1 comparator and cannot be parameterized`);
    return;
  }
  finiteRange(value.alpha, ...PARAMETERS.validationBounds.hypothetical.alpha, "alpha");
  finiteRange(value.beta, ...PARAMETERS.validationBounds.hypothetical.beta, "beta");
  finiteRange(value.dose, ...PARAMETERS.validationBounds.hypothetical.dose, "dose");
  finiteRange(value.takeContext, ...PARAMETERS.validationBounds.hypothetical.takeContext, "takeContext");
  finiteRange(value.mu0, ...PARAMETERS.validationBounds.hypothetical.mu0, "mu0");
  if (value.formulationMultiplier !== catalog.formulationMultiplier) throw new Error("formulationMultiplier is fixed at 1 in v1");
  if (value.sigma0 !== catalog.sigma0) throw new Error("sigma0 is fixed at 2.4 in v1");
  if (value.gamma !== catalog.gamma) throw new Error("gamma is fixed at 0.4624 in v1");
}

function validateSchedule(value: unknown): void {
  if (!isRecord(value)) throw new Error("Schedule must be an object");
  exactKeys(value, ["routineDays", "boosterAgeYears", "assessmentLagDays", "productId"], "ScheduleV1");
  if (!Array.isArray(value.routineDays) || value.routineDays.length !== ROUTINE_DAYS.length || value.routineDays.some((day, index) => day !== ROUTINE_DAYS[index])) throw new Error(`Routine schedule must be ${ROUTINE_DAYS.join(", ")} days`);
  if (![0, 1, 2, 3, 4].includes(value.boosterAgeYears as number)) throw new Error("Invalid booster age");
  if (value.assessmentLagDays !== 28 && value.assessmentLagDays !== 90) throw new Error("Assessment lag must be 28 or 90 days");
  if (!isProductId(value.productId)) throw new Error("Invalid schedule product");
}

function validateSetting(value: unknown): asserts value is SettingV1 {
  if (!isRecord(value)) throw new Error("Setting must be an object");
  exactKeys(value, ["id", "Tih", "Ths", "dIh", "dHs", "Ns"], "SettingV1");
  if (value.id === "global") throw new Error("Legacy 'global' setting state is no longer supported; select an explicit probe and decision scope");
  if (!["houston", "matlab", "up-bihar", "custom"].includes(value.id as string)) throw new Error("Invalid setting id");
  validateUnitValue(value.Tih, "grams/exposure", "per_exposure", "Tih");
  validateUnitValue(value.Ths, "grams/exposure", "per_exposure", "Ths");
  validateUnitValue(value.dIh, "exposures/person/day", "per_day", "dIh");
  validateUnitValue(value.dHs, "exposures/person/day", "per_day", "dHs");
  integerRange(value.Ns, 0, 1000, "Ns");
  if (value.id !== "custom") {
    const anchor = SETTING_ANCHORS.find((candidate) => candidate.id === value.id);
    if (!anchor || !sameRecord(value, pickSetting(anchor))) throw new Error(`${value.id} does not match the bundled named setting`);
  }
}

function validateEnvelope(value: unknown): void {
  if (!isRecord(value)) throw new Error("Envelope must be an object");
  exactKeys(value, ["linkedExposure", "TihMin", "TihMax", "ThsMin", "ThsMax", "NsMin", "NsMax", "dIhMin", "dIhMax", "dHsMin", "dHsMax"], "EnvelopeV1");
  if (typeof value.linkedExposure !== "boolean") throw new Error("linkedExposure must be boolean");
  finitePositive(value.TihMin, "TihMin");
  finiteRange(value.TihMax, value.TihMin, 1, "TihMax");
  finitePositive(value.ThsMin, "ThsMin");
  finiteRange(value.ThsMax, value.ThsMin, 1, "ThsMax");
  if (value.linkedExposure && (value.TihMin !== value.ThsMin || value.TihMax !== value.ThsMax)) {
    throw new Error("Linked exposure requires identical Tih and Ths bounds");
  }
  integerRange(value.NsMin, 0, 1000, "NsMin");
  integerRange(value.NsMax, value.NsMin, 1000, "NsMax");
  finiteRange(value.dIhMin, 0, 1000, "dIhMin");
  finiteRange(value.dIhMax, value.dIhMin, 1000, "dIhMax");
  finiteRange(value.dHsMin, 0, 1000, "dHsMin");
  finiteRange(value.dHsMax, value.dHsMin, 1000, "dHsMax");
}

function validateUnitValue(value: unknown, unit: string, basis: UnitValueV1["basis"], label: string): asserts value is UnitValueV1 {
  if (!isRecord(value)) throw new Error(`${label} must be a unit value`);
  exactKeys(value, ["value", "unit", "basis"], label);
  finiteRange(value.value, 0, 1000, label);
  if (value.unit !== unit || value.basis !== basis) throw new Error(`${label} has the wrong unit or basis`);
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...allowed].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error(`${label} contains unknown or missing fields`);
}

function requireRecord(value: unknown, label: string): Record<string, any> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function finiteNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be finite`);
}

function finiteArray(value: unknown, label: string): void {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  value.forEach((item, index) => finiteNumber(item, `${label}[${index}]`));
}

function nonemptyStringArray(value: unknown, label: string): void {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || item.length === 0)) throw new Error(`${label} must be a nonempty string array`);
}

function validateDesignPointArray(value: unknown, label: string): void {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  value.forEach((item, index) => validateDesignPoint(item, `${label}[${index}]`));
}

function validateDesignPoint(value: unknown, label: string): asserts value is DesignGridPoint {
  const point = requireRecord(value, label); exactKeys(point, ["takeContext", "mu0", "qAcq", "qShed", "rLocEnvelopeMax", "passes"], label);
  finiteRange(point.takeContext, ...PARAMETERS.validationBounds.hypothetical.takeContext, `${label}.takeContext`);
  finiteRange(point.mu0, ...PARAMETERS.validationBounds.hypothetical.mu0, `${label}.mu0`);
  for (const key of ["qAcq", "qShed"] as const) finiteRange(point[key], 0, 1, `${label}.${key}`);
  finiteRange(point.rLocEnvelopeMax, 0, Number.MAX_VALUE, `${label}.rLocEnvelopeMax`);
  if (typeof point.passes !== "boolean") throw new Error(`${label}.passes must be boolean`);
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProductId(value: unknown): value is "sabin2" | "ipv" | "hypothetical" {
  return value === "sabin2" || value === "ipv" || value === "hypothetical";
}

function pickSetting(value: SettingV1): SettingV1 {
  return { id: value.id, Tih: value.Tih, Ths: value.Ths, dIh: value.dIh, dHs: value.dHs, Ns: value.Ns };
}

function sameRecord(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function finitePositive(value: unknown, label: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new Error(`${label} must be finite and positive`);
}

function finiteRange(value: unknown, min: number, max: number, label: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be finite and in [${min}, ${max}]`);
}

function integerRange(value: unknown, min: number, max: number, label: string): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new Error(`${label} must be an integer in [${min}, ${max}]`);
}

function base64UrlEncode(value: string): string {
  if (typeof btoa === "function") return btoa(unescape(encodeURIComponent(value))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  if (typeof atob === "function") return decodeURIComponent(escape(atob(value.replace(/-/g, "+").replace(/_/g, "/"))));
  return Buffer.from(value, "base64url").toString("utf8");
}
