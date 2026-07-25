import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// The chart module imports the inline WOFF2 fonts transitively, so it is read as
// source text here (the same pattern brand.test.ts uses); the browser smoke test
// exercises the rendered SVG in a real DOM.
const charts = readFileSync(new URL("../../src/ui/charts.ts", import.meta.url), "utf8");

test("immune-response renderer is exported with paired desktop and mobile figures", () => {
  assert.match(charts, /export function renderImmuneResponseTeaching\(view: TeachingView\): string/);
  for (const id of ["immune-response-figure", "immune-response-mobile-figure", "immune-response-title", "immune-response-mobile-title", "immune-response-desc", "immune-response-mobile-desc"]) {
    assert.ok(charts.includes(id), `renderer must declare ${id}`);
  }
});

test("immune-response figure carries the required live-correlate and non-uncertainty wording", () => {
  for (const phrase of [
    "one modeled SD before bin projection",
    "response variation, not parameter uncertainty",
    "serum-equivalent",
    "conditional on successful take",
    "not a prediction of a particular serum assay distribution",
    "corresponding mucosal state"
  ]) {
    assert.ok(charts.includes(phrase), `immune-response figure must state: ${phrase}`);
  }
  // No uncertainty vocabulary on the response band.
  assert.doesNotMatch(charts, /confidence interval|credible interval|posterior interval/);
});

test("schedule panel uses a real monthly time axis with titer-aware labels", () => {
  assert.ok(charts.includes("Age (months)"), "Panel B x-axis is age in months");
  assert.ok(charts.includes("log2 OPV-equivalent serum titer"), "live y-axis names the serum-equivalent titer");
  assert.ok(charts.includes("log2 mucosal-immunity state"), "IPV y-axis stays mucosal, not serum-equivalent");
  assert.ok(charts.includes("monthlyTrace"), "Panel B renders from the monthly trace diagnostic");
  assert.ok(charts.includes(">mean</text>"), "mean overlay keeps a short label");
  // Dropped per owner direction: the fold-rise equation and bin-15 cap annotations.
  assert.doesNotMatch(charts, /bin-15 cap|fold rise|2\^\(mu0/);
});

test("immune-response figure has an explicit IPV not-applicable branch, not a zero curve", () => {
  assert.ok(charts.includes("immuneResponsePanelNotApplicable"));
  assert.ok(charts.includes("Not applicable to IPV"));
  assert.ok(charts.includes("No live-response curve is shown for IPV"));
});

test("chart code does not duplicate the boost, take, or waning kernels", () => {
  // Scientific coordinates must come from diagnostics, not be recomputed here.
  assert.doesNotMatch(charts, /applyBoost|buildBoostMatrix|waneMucosal|vaccineTakePerBin|projectGaussian|shiftBins/);
  assert.doesNotMatch(charts, /from "\.\.\/model\/waning"|from "\.\.\/model\/dose-response"/);
});
