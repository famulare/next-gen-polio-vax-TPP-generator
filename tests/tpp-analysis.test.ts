import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultScenario, scenarioWithDecisionScope, scenarioWithSetting } from "../src/model/model";
import {
  buildComparatorProfile,
  buildTppProfile,
  buildTransmissionTeachingDiagnostics,
  decisionRecordMarkdown,
  findMechanismContrastPair
} from "../src/ui/tpp-analysis";

test("transmission teaching diagnostics reconcile with the authoritative direct calculation", () => {
  const profile = buildTppProfile(defaultScenario());
  assert.ok(profile.transmission.reconciliationError < 1e-10);
  assert.ok(Math.abs(profile.transmission.directRLoc - profile.view.metrics.rLocEnvelopeMax) < 1e-10);
  assert.ok(profile.transmission.householdInfectionProbability >= profile.transmission.singleSocialContactProbability);
  assert.ok(Math.abs(profile.transmission.reconstructedRLoc - profile.transmission.setting.Ns * profile.transmission.singleSocialContactProbability) < 1e-14);
});

test("Matlab is a valid linked-exposure point with one exposure per day on both links", () => {
  const scenario = scenarioWithSetting(scenarioWithDecisionScope(defaultScenario(), "matlab"), "matlab");
  assert.equal(scenario.setting.Tih.value, 18.6e-6);
  assert.equal(scenario.setting.Ths.value, 18.6e-6);
  assert.equal(scenario.setting.dIh.value, 1);
  assert.equal(scenario.setting.dHs.value, 1);
  const diagnostics = buildTransmissionTeachingDiagnostics(scenario);
  assert.ok(diagnostics.reconciliationError < 1e-10);
});

test("mechanism contrast finds similar shedding indices with opposing component effects", () => {
  const pair = findMechanismContrastPair(defaultScenario());
  assert.ok(pair.relativeQIndexGap <= 0.2);
  assert.ok(pair.acquisitionLed.qAcq <= pair.sheddingLed.qAcq);
  assert.ok(pair.acquisitionLed.qShed >= pair.sheddingLed.qShed);
  assert.ok(pair.mechanismSeparation > 0);
  assert.ok(Number.isFinite(pair.acquisitionLed.rLoc));
  assert.ok(Number.isFinite(pair.sheddingLed.rLoc));
  assert.ok(pair.relativeRLocGap >= 0);
  assert.ok(pair.relativeRLocGap > 0);
  assert.notEqual(pair.acquisitionLed.rLoc, pair.sheddingLed.rLoc);
});

test("fixed comparator profiles keep the hypothetical frontier family explicit", () => {
  const ipv = buildComparatorProfile(defaultScenario(), "ipv");
  assert.equal(ipv.designFamily.sourceLabel, "the versioned hypothetical-product defaults");
  assert.ok(ipv.designFamily.administeredDoseTCID50 > 0);
  assert.match(decisionRecordMarkdown(ipv), /not applicable to IPV/i);
});

test("decision record states the conditioning, authoritative endpoint, and uncertainty boundary", () => {
  const record = decisionRecordMarkdown(buildTppProfile(defaultScenario()));
  assert.match(record, /conditioned on one breakthrough index child/i);
  assert.match(record, /Direct authoritative R_loc/);
  assert.match(record, /Parameter uncertainty: not quantified/);
  assert.match(record, /not a complete vaccine TPP/i);
});
