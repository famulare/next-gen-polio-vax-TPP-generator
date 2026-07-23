import assert from "node:assert/strict";
import test from "node:test";
import { evaluateScenario, defaultScenario, scenarioWithDecisionScope } from "../../src/model/model";
import { buildPresentation, describeDecisionScope } from "../../src/ui/presentation";

test("presentation derives the default hardest-anchor pass without duplicating the threshold", () => {
  const outputs = evaluateScenario(defaultScenario());
  const presentation = buildPresentation(outputs);
  assert.equal(presentation.result.branch, "pass");
  assert.match(presentation.result.headline, /hardest known modeled anchor/);
  assert.match(presentation.result.qualification, /does not prove control everywhere/);
  assert.match(presentation.result.qualification, /not a complete-population R_e/);
  assert.equal(presentation.frontier.passingCount, 92);
  assert.equal(presentation.frontier.paretoCount, 8);
  assert.equal(presentation.frontier.branch, "available");
  assert.equal(presentation.uncertainty.branch, "unavailable");
});

test("presentation derives fail, tie, and empty-frontier branches from model output", () => {
  const scenario = defaultScenario();
  const harsh = {
    ...scenario,
    envelope: {
      ...scenario.envelope,
      TihMin: 0.002,
      TihMax: 0.002,
      ThsMin: 0.002,
      ThsMax: 0.002,
      NsMin: 20,
      NsMax: 20
    }
  };
  const failed = evaluateScenario(harsh);
  const failedPresentation = buildPresentation(failed);
  assert.equal(failedPresentation.result.branch, "fail");
  assert.equal(failedPresentation.frontier.branch, "empty");
  assert.match(failedPresentation.frontier.message, /No Pareto line/);

  const tied = structuredClone(failed);
  tied.metrics.rLocEnvelopeMax = 1;
  assert.equal(buildPresentation(tied).result.branch, "tie");
  assert.match(buildPresentation(tied).result.headline, /does not meet/);
});

test("scenarioWithDecisionScope changes the envelope without touching the setting", () => {
  const scenario = defaultScenario();
  assert.equal(describeDecisionScope(scenario.envelope).id, "up-bihar");
  const houstonScope = scenarioWithDecisionScope(scenario, "houston");
  assert.equal(describeDecisionScope(houstonScope.envelope).id, "houston");
  assert.equal(houstonScope.setting.id, "up-bihar");
});
