import assert from "node:assert/strict";
import test from "node:test";
import { applyBoost, normalizeBins, shiftBins } from "../../src/model/bins";
import { buildFrontier, gridPointRLocMatchesDirect } from "../../src/model/frontier";
import { defaultScenario, evaluateScenario, scenarioWithSetting } from "../../src/model/model";
import { PARAMETERS, SETTING_ANCHORS, vaccineDefaults } from "../../src/model/parameters";
import { canonicalJson, decodeScenario, encodeScenario, validateScenario } from "../../src/model/serialization";
import { applyDose, buildScheduleState, initialImmuneState, scheduleDays } from "../../src/model/schedule";
import { doseResponse, wpvSusceptibilityPerBin } from "../../src/model/dose-response";
import { naiveRLocForSetting, repeatedExposureProbability, rLocForSetting } from "../../src/model/transmission";
import type { ScenarioV1, SettingV1 } from "../../src/model/types";

function assertMass(values: readonly number[]): void {
  assert.equal(values.length, 16);
  assert.ok(values.every((value) => value >= -1e-12 && value <= 1 + 1e-12));
  assert.ok(Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) < 1e-10);
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
  assert.deepEqual(state.events, [42, 70, 98]);
  assert.equal(state.assessmentAgeDays, 126);
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
  const naiveTake = 1 - (1 + scenario.vaccine.dose / scenario.vaccine.beta) ** (-scenario.vaccine.alpha);
  assert.ok(Math.abs((afterDose.groups.find((group) => group.everInfected)?.mass ?? 0) - naiveTake * scenario.vaccine.takeContext) < 1e-10);
});

test("all-IPV naive schedule has no mucosal endpoint effect", () => {
  const scenario = { ...defaultScenario(), vaccine: vaccineDefaults("ipv"), comparatorId: "ipv" as const, schedule: { ...defaultScenario().schedule, productId: "ipv" as const } };
  const state = buildScheduleState(scenario.vaccine, scenario.schedule);
  assert.equal(state.groups.length, 1);
  assert.equal(state.groups[0]!.mass, 1);
  assert.equal(state.groups[0]!.everInfected, false);
  assert.deepEqual(state.groups[0]!.mucosal, normalizeBins([1, ...Array<number>(15).fill(0)]));
  const metrics = evaluateScenario({ ...scenario, envelope: { ...scenario.envelope, TMax: 0.000005, TMin: 0.000005 } });
  assert.ok(Math.abs(metrics.metrics.qAcq - 1) < 1e-12);
});

test("Rloc is monotone in exposure and social contacts", () => {
  const scenario = defaultScenario();
  const state = buildScheduleState(scenario.vaccine, scenario.schedule);
  const base = SETTING_ANCHORS[0]!;
  const moreExposure: SettingV1 = { ...base, Tih: { ...base.Tih, value: base.Tih.value * 10 }, Ths: { ...base.Ths, value: base.Ths.value * 10 } };
  const moreContacts: SettingV1 = { ...base, Ns: base.Ns + 5 };
  const r0 = rLocForSetting(state, base, scenario.indexReferenceExposure, scenario.horizonDays);
  const rExposure = rLocForSetting(state, moreExposure, scenario.indexReferenceExposure, scenario.horizonDays);
  const rContacts = rLocForSetting(state, moreContacts, scenario.indexReferenceExposure, scenario.horizonDays);
  assert.ok(rExposure >= r0 - 1e-12);
  assert.ok(rContacts >= r0 - 1e-12);
  const zero: SettingV1 = { ...base, Ns: 0 };
  assert.equal(rLocForSetting(state, zero, scenario.indexReferenceExposure, scenario.horizonDays), 0);
  assert.equal(naiveRLocForSetting(zero, scenario.indexReferenceExposure, scenario.horizonDays, state.assessmentAgeDays), 0);
});

test("scenario serialization is canonical and rejects unknown fields", () => {
  const scenario = defaultScenario();
  const encoded = encodeScenario(scenario);
  const decoded = decodeScenario(encoded);
  assert.equal(canonicalJson(decoded), canonicalJson(scenario));
  assert.throws(() => validateScenario({ ...scenario, unknown: true }));
  assert.throws(() => validateScenario({ ...scenario, vaccine: { ...scenario.vaccine, beta: -1 } }));
  validateScenario(scenarioWithSetting(scenario, "matlab"));
});

test("frontier cells are direct evaluations and classification uses strict Rloc < 1", () => {
  const scenario = defaultScenario();
  const frontier = buildFrontier(scenario);
  assert.equal(frontier.points.length, 51 * 51);
  assert.ok(frontier.points.every((point) => point.passes === (point.rLocMax < 1)));
  const point = frontier.points[1300]!;
  assert.equal(gridPointRLocMatchesDirect(scenario, point), true);
});

test("full outputs expose required grid sizes and explicit uncertainty absence", () => {
  const outputs = evaluateScenario(defaultScenario());
  assert.equal(outputs.schemaVersion, "ModelOutputsV1");
  assert.equal(outputs.frontier.points.length, 2601);
  assert.equal(outputs.settingSurface.length, 81 * 40);
  assert.equal(outputs.uncertainty.available, false);
  assert.equal(outputs.uncertainty.rLocMax, null);
  assert.throws(() => evaluateScenario({ ...defaultScenario(), successRule: "upper95" }));
});
