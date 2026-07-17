import { contours } from "d3-contour";
import { scaleLinear, scaleLog } from "d3-scale";
import { line } from "d3-shape";
import { passesThreshold } from "./model/frontier";
import { defaultScenario, evaluateScenario, scenarioWithProduct, scenarioWithSetting } from "./model/model";
import { ENVELOPE, FRONTIER_GRID, PARAMETERS, PRODUCT_LABELS, SETTING_ANCHORS, SETTING_MANIFEST_VERSION } from "./model/parameters";
import { canonicalJson, decodeScenario, encodeScenario } from "./model/serialization";
import type { DesignGridPoint, ModelOutputsV1, ScenarioV1, SettingId } from "./model/types";

declare const __BUILD_IDENTITY__: string;

const APP_VERSION = "0.2.0-prototype";
const AUTO_UPDATE_DELAY_MS = 180;
const PROTOTYPE_STATUS = "Scientific prototype: point-rule close-contact results are conditional-plausibility evidence under the v1 sufficiency axiom";
const BUILD_IDENTITY = __BUILD_IDENTITY__;

export function mountApp(root: HTMLElement): void {
  root.innerHTML = shell();
  const initial = scenarioFromHash();
  let scenario = initial.scenario;
  let hashWarning = initial.error;
  let outputs: ModelOutputsV1 | null = null;
  let updateTimer: number | undefined;
  const warning = document.querySelector<HTMLElement>("#state-warning")!;
  const status = document.querySelector<HTMLElement>("#compute-status")!;

  if (initial.error) showWarning(`The URL state was not evaluated: ${initial.error} Defaults were loaded.`);
  syncControls(scenario);

  document.querySelector<HTMLButtonElement>("#reset")!.addEventListener("click", () => {
    scenario = defaultScenario();
    hashWarning = undefined;
    syncControls(scenario);
    renderPending("Versioned defaults restored; evaluating scenario…");
    run();
  });
  document.querySelector<HTMLButtonElement>("#compute")!.addEventListener("click", () => scheduleUpdate(0));
  document.querySelector<HTMLSelectElement>("#product")!.addEventListener("change", (event) => {
    scenario = scenarioWithProduct(scenario, (event.target as HTMLSelectElement).value as ScenarioV1["vaccine"]["id"]);
    syncControls(scenario);
    scheduleUpdate(0);
  });
  document.querySelector<HTMLSelectElement>("#setting")!.addEventListener("change", (event) => {
    scenario = scenarioWithSetting(scenario, (event.target as HTMLSelectElement).value as SettingId);
    syncControls(scenario);
    scheduleUpdate(0);
  });
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-model-control]").forEach((input) => {
    input.addEventListener(input instanceof HTMLInputElement && input.type === "range" ? "input" : "change", () => {
      updateReadouts();
      scheduleUpdate();
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-export]").forEach((button) => button.addEventListener("click", () => {
    if (!outputs) return;
    exportOutput(button.dataset.export ?? "json", outputs);
    const exportStatus = document.querySelector<HTMLElement>("#export-status")!;
    exportStatus.textContent = `${button.textContent ?? "Export"} prepared from the current evaluated prototype scenario (${outputs.modelIdentity}).`;
  }));

  run();

  function scheduleUpdate(delay = AUTO_UPDATE_DELAY_MS): void {
    if (updateTimer !== undefined) window.clearTimeout(updateTimer);
    renderPending("Scenario changed; evaluating current controls…");
    status.textContent = "Change pending…";
    status.className = "compute-status pending";
    updateTimer = window.setTimeout(() => {
      updateTimer = undefined;
      try {
        scenario = readControls(scenario);
        hashWarning = undefined;
      } catch (error) {
        renderInvalid(error);
        return;
      }
      run();
    }, delay);
  }

  function run(): void {
    const start = performance.now();
    status.textContent = "Computing deterministic model…";
    status.className = "compute-status busy";
    try {
      const evaluatedScenario = structuredClone(scenario);
      outputs = evaluateScenario(evaluatedScenario);
      window.location.hash = `scenario=${encodeScenario(outputs.scenario)}`;
      if (hashWarning) showWarning(`The URL state was not evaluated: ${hashWarning} Defaults were loaded.`);
      else hideWarning();
      renderOutputs(outputs);
      status.textContent = `Model updated in ${Math.round(performance.now() - start)} ms`;
      status.className = "compute-status ready";
    } catch (error) {
      renderInvalid(error);
    }
  }

  function renderInvalid(error: unknown): void {
    outputs = null;
    status.textContent = "Model state is invalid; no result is displayed";
    status.className = "compute-status error";
    showWarning(error instanceof Error ? error.message : String(error));
    setExportAvailability(false);
    const resultStatus = document.querySelector<HTMLElement>("#result-status")!;
    resultStatus.className = "result-status invalid";
    delete resultStatus.dataset.modelIdentity;
    resultStatus.innerHTML = "<strong>INVALID SCENARIO</strong><span>Correct the highlighted scientific state before evaluation.</span>";
    document.querySelector<HTMLElement>("#summary-cards")!.innerHTML = "";
    document.querySelector<HTMLElement>("#selected-setting-result")!.textContent = "No evaluated scenario";
    document.querySelector<HTMLElement>("#schedule-summary")!.textContent = "";
    document.querySelector<HTMLElement>("#assumptions")!.innerHTML = "";
    for (const id of ["effect-map", "product-map", "setting-map"]) document.querySelector<HTMLElement>(`#${id}`)!.innerHTML = '<p class="empty-plot">No stale figure is shown for invalid state.</p>';
  }

  function renderPending(message: string): void {
    outputs = null;
    setExportAvailability(false);
    const resultStatus = document.querySelector<HTMLElement>("#result-status")!;
    resultStatus.className = "result-status pending";
    delete resultStatus.dataset.modelIdentity;
    resultStatus.innerHTML = `<strong>RESULT WITHHELD</strong><span>${message} No threshold comparison, figure, summary, or export is shown until this scenario finishes evaluation.</span>`;
    document.querySelector<HTMLElement>("#summary-cards")!.innerHTML = "";
    document.querySelector<HTMLElement>("#selected-setting-result")!.textContent = "Scenario changed; result withheld";
    document.querySelector<HTMLElement>("#schedule-summary")!.textContent = "";
    document.querySelector<HTMLElement>("#assumptions")!.innerHTML = "";
    document.querySelector<HTMLElement>("#export-status")!.textContent = "Exports are unavailable until the current scenario is evaluated.";
    for (const id of ["effect-map", "product-map", "setting-map"]) document.querySelector<HTMLElement>(`#${id}`)!.innerHTML = '<p class="empty-plot">Scenario changed. Result withheld pending evaluation.</p>';
  }

  function showWarning(message: string): void {
    warning.hidden = false;
    warning.textContent = message;
  }

  function hideWarning(): void {
    warning.hidden = true;
    warning.textContent = "";
  }

  function renderOutputs(result: ModelOutputsV1): void {
    const metrics = result.metrics;
    const belowThreshold = passesThreshold(metrics.rLocEnvelopeMax);
    const envelopeName = isBundledGlobalEnvelope(result.scenario) ? "v1 global envelope" : "selected envelope";
    const resultStatus = document.querySelector<HTMLElement>("#result-status")!;
    resultStatus.className = `result-status prototype ${belowThreshold ? "below-threshold" : "at-or-above-threshold"}`;
    resultStatus.dataset.modelIdentity = result.modelIdentity;
    resultStatus.innerHTML = `<strong>PROTOTYPE POINT-RULE COMPARISON: ${belowThreshold ? "R<sub>loc</sub> is below 1" : "R<sub>loc</sub> is not below 1"}</strong><span>Direct maximum R<sub>loc</sub> = ${format(metrics.rLocEnvelopeMax)} across the ${formatMicrograms(result.scenario.envelope.TMin)}–${formatMicrograms(result.scenario.envelope.TMax)} microgram/exposure and ${result.scenario.envelope.NsMin}–${result.scenario.envelope.NsMax} contact ${envelopeName}. Under the v1 sufficiency axiom, this is conditional-plausibility evidence for population-level herd immunity; it is not a calculated complete population R<sub>e</sub> or product-performance claim. Ties within ${PARAMETERS.success.tieTolerance} of 1 are not below threshold.</span>`;
    const selectedRLoc = metrics.rLocSelectedSetting ?? metrics.rLocEnvelopeMax;
    document.querySelector<HTMLElement>("#selected-setting-result")!.textContent = `${result.scenario.setting.id === "global" ? "Prototype envelope maximum" : "Prototype selected-setting probe"} · ${settingLabel(result.scenario.setting.id)} · Rloc ${format(selectedRLoc)}`;
    document.querySelector<HTMLElement>("#summary-cards")!.innerHTML = summaryCards(result);
    document.querySelector<HTMLElement>("#assumptions")!.innerHTML = `<h3>Assumptions and uncertainty</h3><p class="prototype-note"><strong>Scientific prototype only.</strong> ${PROTOTYPE_STATUS}. Threshold comparisons shown above and in the maps are not release classifications.</p><ul>${result.assumptions.map((item) => `<li>${item}</li>`).join("")}</ul><p class="uncertainty-note"><strong>Interval status:</strong> ${result.uncertainty.reason}</p>`;
    document.querySelector<HTMLElement>("#effect-map")!.innerHTML = effectMap(result);
    document.querySelector<HTMLElement>("#product-map")!.innerHTML = productMap(result);
    document.querySelector<HTMLElement>("#setting-map")!.innerHTML = settingMap(result);
    document.querySelector<HTMLElement>("#schedule-summary")!.textContent = `RI days 42, 70, 98${result.scenario.schedule.boosterAgeYears ? `; booster at ${result.scenario.schedule.boosterAgeYears} year${result.scenario.schedule.boosterAgeYears === 1 ? "" : "s"}` : "; no booster"}. Assessment: ${result.metrics.assessmentLagDays} days after last dose (age ${formatDays(result.metrics.assessmentAgeDays)}).`;
    setExportAvailability(true);
    document.querySelector<HTMLElement>("#export-status")!.textContent = "Exports are ready for this evaluated prototype scenario.";
  }

  function setExportAvailability(available: boolean): void {
    document.querySelectorAll<HTMLButtonElement>("[data-export]").forEach((button) => { button.disabled = !available; });
  }
}

function shell(): string {
  const productOptions = Object.entries(PRODUCT_LABELS).map(([id, label]) => `<option value="${id}">${label}</option>`).join("");
  const settingOptions = [["global", "Any setting: v1 global envelope"], ["low", "Low transmission"], ["houston", "Houston/Louisiana moderate"], ["matlab", "Matlab household exposure (hybrid)"], ["up-bihar", "UP/Bihar high"], ["custom", "Custom setting"]].map(([id, label]) => `<option value="${id}">${label}</option>`).join("");
  return `<main class="app-shell">
    <header class="hero">
      <p class="eyebrow">WPV1 close-contact model · design contract ${PARAMETERS.designContractVersion}</p>
      <h1>What vaccine performance is enough?</h1>
      <p class="lede">Explore acquisition blocking, breakthrough infectiousness, schedule, and close-contact setting assumptions. The authoritative modeled result is the direct R<sub>loc</sub> envelope criterion—not a scalar shedding target and not a complete population R<sub>e</sub>.</p>
    </header>
    <aside class="prototype-banner" role="note"><strong>Scientific prototype — point rule only</strong><span>Kernel parity and the named prevalence calibration support this conditional-plausibility close-contact calculation. Under the v1 sufficiency axiom, it informs population-level herd-immunity reasoning; it is not a calculated complete-population result or product-performance claim.</span></aside>
    <section class="control-panel" aria-labelledby="controls-heading">
      <div class="section-heading"><div><p class="eyebrow">Scenario</p><h2 id="controls-heading">Product, schedule, and setting</h2></div><button id="reset" class="secondary">Reset versioned defaults</button></div>
      <div class="controls-grid">
        <label>Product<select id="product">${productOptions}</select><small>Fixed Sabin 2 and IPV comparators cannot be parameterized.</small></label>
        <label>Setting<select id="setting">${settingOptions}</select><small>Named/custom results are shown separately; status always uses the declared envelope.</small></label>
        <label>Booster<select id="booster" data-model-control><option value="0">None</option><option value="1">At 1 year</option><option value="2">At 2 years</option><option value="3">At 3 years</option><option value="4">At 4 years</option></select></label>
        <label>Assessment lag<select id="lag" data-model-control><option value="28">28 days</option><option value="90">90 days</option></select><small>Applied identically to index, household, and social roles.</small></label>
        <label>Biological take context <output id="take-output">0.80</output><input id="take" data-model-control type="range" min="0" max="1" step="0.01" value="0.8"><small id="take-help">Productive live-vaccine infection after receipt; receipt itself is fixed at 100%.</small></label>
        <label>Mean mucosal boost <output id="mu-output">4.0 log2</output><input id="mu" data-model-control type="range" min="0" max="8" step="0.1" value="4"><small id="mu-help">Hypothetical live product; sigma remains fixed at 2.4 log2 units.</small></label>
      </div>
      <details><summary>Advanced scientific controls and fixed parameters</summary><div class="controls-grid advanced">
        <label>Vaccine alpha<input id="alpha" data-model-control type="number" min="0.001" max="5" step="0.001"></label>
        <label>Vaccine beta (CID50)<input id="beta" data-model-control type="number" min="0.001" max="1000000" step="0.1"></label>
        <label>Administered dose (log10 TCID50)<input id="dose-log" data-model-control type="number" min="0" max="9" step="0.01"></label>
        <label>Custom Tih (micrograms/exposure)<input id="custom-tih" data-model-control type="number" min="0" max="1000000" step="0.1"></label>
        <label>Custom Ths (micrograms/exposure)<input id="custom-ths" data-model-control type="number" min="0" max="1000000" step="0.1"></label>
        <label>Custom Dih (exposures/person/day)<input id="custom-dih" data-model-control type="number" min="0" max="1000" step="0.01"></label>
        <label>Custom Dhs (exposures/person/day)<input id="custom-dhs" data-model-control type="number" min="0" max="1000" step="0.01"></label>
        <label>Custom Ns (close social contacts)<input id="custom-ns" data-model-control type="number" min="0" max="1000" step="1"></label>
        <label>Envelope T minimum (micrograms/exposure)<input id="envelope-t-min" data-model-control type="number" min="0.000001" max="1000000" step="0.1"></label>
        <label>Envelope T maximum (micrograms/exposure)<input id="envelope-t-max" data-model-control type="number" min="0.000001" max="1000000" step="1"></label>
        <label>Envelope Ns minimum<input id="envelope-ns-min" data-model-control type="number" min="0" max="1000" step="1"></label>
        <label>Envelope Ns maximum<input id="envelope-ns-max" data-model-control type="number" min="0" max="1000" step="1"></label>
        <label>Envelope Dih maximum<input id="envelope-dih-max" data-model-control type="number" min="0" max="1000" step="0.01"></label>
        <label>Envelope Dhs maximum<input id="envelope-dhs-max" data-model-control type="number" min="0" max="1000" step="0.01"></label>
        <label>Index reference exposure (WPV1 dose units)<input id="index-reference" data-model-control type="number" min="0.000001" max="1000000000" step="0.01"></label>
        <label>Success rule<input value="Point Rloc &lt; 1" disabled></label>
        <label>Fixed gamma<input id="fixed-gamma" type="number" disabled></label>
        <label>Fixed boost sigma<input id="fixed-sigma" type="number" disabled></label>
        <label>Episode horizon (days)<input id="fixed-horizon" type="number" disabled></label>
      </div></details>
      <p id="state-warning" class="warning" hidden></p><div class="control-actions"><button id="compute" class="primary">Update now</button><span id="compute-status" class="compute-status" role="status" aria-live="polite"></span></div>
    </section>
    <p id="schedule-summary" class="schedule-summary"></p>
    <section id="result-status" class="result-status" aria-live="polite"></section>
    <section id="summary-cards" class="summary-cards"></section>
    <section class="primary-views" aria-labelledby="maps-heading"><div class="section-heading"><div><p class="eyebrow">Prototype threshold maps</p><h2 id="maps-heading">Linked hypothetical-product maps</h2></div><span id="selected-setting-result" class="pill">No evaluated scenario</span></div><div class="map-grid"><figure><div id="effect-map"></div><figcaption><strong>Requirement space — prototype only.</strong> Filled points are below R<sub>loc</sub> = 1 in this prototype calculation; open points are not. The orange path is the prototype minimum-below-threshold set. Fixed products are separate comparator markers.</figcaption></figure><figure><div id="product-map"></div><figcaption><strong>Product space — prototype only.</strong> The same 2,601 hypothetical designs shown as take context versus mean boost. Hatched cells are not below R<sub>loc</sub> = 1 in the prototype calculation. Fixed comparators are never mutated into this family.</figcaption></figure></div></section>
    <section class="surface-section" aria-labelledby="surface-heading"><p class="eyebrow">Prototype setting surface</p><h2 id="surface-heading">Selected-product setting surface</h2><p class="section-copy">Exposure is in micrograms of stool-equivalent transfer per exposure. Fill reports log<sub>10</sub>(R<sub>loc</sub>); hatching marks R<sub>loc</sub> ≥ 1, and the heavy contour marks the threshold in the unreleased prototype calculation. Named anchors are overlays, not extra model pathways.</p><figure><div id="setting-map"></div></figure></section>
    <section id="assumptions" class="assumptions"></section>
    <section class="exports"><h2>Prototype exports</h2><p>Exports include the canonical evaluated scenario, manifest versions, exact grid ordering, fixed comparators, and directly evaluated outputs. They are labeled as prototype output and disabled whenever the controls no longer match an evaluated scenario.</p><button data-export="json" class="secondary" disabled>JSON</button><button data-export="csv" class="secondary" disabled>CSV grids</button><button data-export="svg" class="secondary" disabled>SVG figures</button><span id="export-status" class="export-status" role="status">Exports are unavailable until the current scenario is evaluated.</span></section>
    <footer><p>Prototype ${APP_VERSION} · design contract ${PARAMETERS.designContractVersion} · parameter manifest ${PARAMETERS.manifestVersion} · setting manifest ${SETTING_MANIFEST_VERSION} · build ${BUILD_IDENTITY}.</p><p>No runtime network dependency or random sampling. <a href="#assumptions">Model assumptions</a> · <a href="https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.2002468">Source paper</a> · <a href="https://github.com/famulare/cessationStability">cessationStability</a> · <a href="https://github.com/famulare/india-polio">india-polio</a></p></footer>
  </main>`;
}

function scenarioFromHash(): { scenario: ScenarioV1; error?: string } {
  const encoded = window.location.hash.startsWith("#scenario=") ? window.location.hash.slice("#scenario=".length) : "";
  if (!encoded) return { scenario: defaultScenario() };
  try { return { scenario: decodeScenario(encoded) }; }
  catch (error) { return { scenario: defaultScenario(), error: error instanceof Error ? error.message : String(error) }; }
}

function syncControls(scenario: ScenarioV1): void {
  setValue("product", scenario.vaccine.id);
  setValue("setting", scenario.setting.id);
  setValue("booster", scenario.schedule.boosterAgeYears);
  setValue("lag", scenario.schedule.assessmentLagDays);
  setValue("take", scenario.vaccine.takeContext);
  setValue("mu", scenario.vaccine.mu0);
  setValue("alpha", scenario.vaccine.alpha);
  setValue("beta", scenario.vaccine.beta);
  setValue("dose-log", Math.log10(Math.max(scenario.vaccine.dose, 1)));
  setValue("custom-tih", scenario.setting.Tih.value * 1e6);
  setValue("custom-ths", scenario.setting.Ths.value * 1e6);
  setValue("custom-dih", scenario.setting.dIh.value);
  setValue("custom-dhs", scenario.setting.dHs.value);
  setValue("custom-ns", scenario.setting.Ns);
  setValue("envelope-t-min", scenario.envelope.TMin * 1e6);
  setValue("envelope-t-max", scenario.envelope.TMax * 1e6);
  setValue("envelope-ns-min", scenario.envelope.NsMin);
  setValue("envelope-ns-max", scenario.envelope.NsMax);
  setValue("envelope-dih-max", scenario.envelope.dIhMax);
  setValue("envelope-dhs-max", scenario.envelope.dHsMax);
  setValue("index-reference", scenario.indexReferenceExposure);
  setValue("fixed-gamma", scenario.vaccine.gamma);
  setValue("fixed-sigma", scenario.vaccine.sigma0);
  setValue("fixed-horizon", scenario.horizonDays);
  setProductEditability(scenario.vaccine.id);
  updateReadouts();
}

function readControls(previous: ScenarioV1): ScenarioV1 {
  const product = document.querySelector<HTMLSelectElement>("#product")!.value as ScenarioV1["vaccine"]["id"];
  let scenario = product === previous.vaccine.id ? structuredClone(previous) : scenarioWithProduct(previous, product);
  const settingId = document.querySelector<HTMLSelectElement>("#setting")!.value as SettingId;
  scenario = settingId === "custom"
    ? { ...scenario, setting: { id: "custom", Tih: unitExposure(numberValue("custom-tih") / 1e6), Ths: unitExposure(numberValue("custom-ths") / 1e6), dIh: unitFrequency(numberValue("custom-dih")), dHs: unitFrequency(numberValue("custom-dhs")), Ns: numberValue("custom-ns") } }
    : scenarioWithSetting(scenario, settingId);
  scenario.schedule = {
    ...scenario.schedule,
    boosterAgeYears: Number(document.querySelector<HTMLSelectElement>("#booster")!.value) as ScenarioV1["schedule"]["boosterAgeYears"],
    assessmentLagDays: Number(document.querySelector<HTMLSelectElement>("#lag")!.value) as 28 | 90
  };
  if (scenario.vaccine.id === "hypothetical") {
    scenario.vaccine = { ...scenario.vaccine, takeContext: numberValue("take"), mu0: numberValue("mu"), alpha: numberValue("alpha"), beta: numberValue("beta"), dose: 10 ** numberValue("dose-log") };
  }
  scenario.envelope = {
    ...scenario.envelope,
    TMin: numberValue("envelope-t-min") / 1e6,
    TMax: numberValue("envelope-t-max") / 1e6,
    NsMin: numberValue("envelope-ns-min"),
    NsMax: numberValue("envelope-ns-max"),
    dIhMax: numberValue("envelope-dih-max"),
    dHsMax: numberValue("envelope-dhs-max")
  };
  scenario.indexReferenceExposure = numberValue("index-reference");
  return scenario;
}

function updateReadouts(): void {
  const take = document.querySelector<HTMLInputElement>("#take")!;
  const mu = document.querySelector<HTMLInputElement>("#mu")!;
  document.querySelector<HTMLOutputElement>("#take-output")!.value = Number(take.value).toFixed(2);
  document.querySelector<HTMLOutputElement>("#mu-output")!.value = `${Number(mu.value).toFixed(1)} log2`;
}

function setProductEditability(productId: ScenarioV1["vaccine"]["id"]): void {
  const editable = productId === "hypothetical";
  for (const id of ["take", "mu", "alpha", "beta", "dose-log"]) {
    const input = document.querySelector<HTMLInputElement>(`#${id}`);
    if (input) input.disabled = !editable;
  }
  const takeHelp = document.querySelector<HTMLElement>("#take-help")!;
  const muHelp = document.querySelector<HTMLElement>("#mu-help")!;
  if (productId === "hypothetical") {
    takeHelp.textContent = "Productive live-vaccine infection after receipt; receipt itself is fixed at 100%.";
    muHelp.textContent = "Hypothetical live product; sigma remains fixed at 2.4 log2 units.";
  } else if (productId === "sabin2") {
    takeHelp.textContent = "Fixed Sabin 2 catalog take; receipt itself is fixed at 100%.";
    muHelp.textContent = "Fixed Sabin 2 catalog boost; sigma remains fixed at 2.4 log2 units.";
  } else {
    takeHelp.textContent = "IPV has no live-vaccine take parameter; receipt is not modelled as coverage.";
    muHelp.textContent = "Fixed IPV catalog semantics; serum boosts all recipients and mucosal boost requires prior live infection.";
  }
}

function numberValue(id: string): number { return Number(document.querySelector<HTMLInputElement>(`#${id}`)!.value); }
function setValue(id: string, value: string | number): void { const element = document.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`); if (element) element.value = String(value); }
function unitExposure(value: number) { return { value, unit: "grams/exposure" as const, basis: "per_exposure" as const }; }
function unitFrequency(value: number) { return { value, unit: "exposures/person/day", basis: "per_day" as const }; }

function summaryCards(result: ModelOutputsV1): string {
  const m = result.metrics;
  return [
    ["Prototype acquisition reduction", percent(1 - m.qAcq), "1 − q_acq"],
    ["Prototype breakthrough shedding reduction", percent(1 - m.qShed), "1 − q_shed"],
    ["Derived shedding index", format(m.qIndex), "prototype diagnostic only: q_acq × q_shed"],
    ["Prototype envelope maximum Rloc", format(m.rLocEnvelopeMax), "threshold comparison only; interval unavailable"],
    ["Prototype naive envelope maximum", format(m.naiveRLocEnvelopeMax), "same envelope and index reference"],
    ["Prototype first-dose effective take", percent(m.effectiveFirstDoseTake), "naive recipient; not dose receipt"]
  ].map(([title, value, detail]) => `<article class="summary-card"><span>${title}</span><strong>${value}</strong><small>${detail}</small></article>`).join("");
}

function effectMap(result: ModelOutputsV1): string {
  const width = 560; const height = 350; const margin = { top: 34, right: 24, bottom: 56, left: 64 };
  const x = scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
  const y = scaleLinear().domain([0, 1]).range([height - margin.bottom, margin.top]);
  const points = result.frontier.points.map((point) => `<circle cx="${x(1 - point.qAcq)}" cy="${y(1 - point.qShed)}" r="2.1" class="${point.passes ? "pass-point" : "fail-point"}"><title>Prototype hypothetical: take ${point.takeContext.toFixed(2)}, boost ${point.mu0.toFixed(1)}; envelope Rloc ${format(point.rLocEnvelopeMax)}</title></circle>`).join("");
  const pareto = result.frontier.pareto.map((point) => [1 - point.qAcq, 1 - point.qShed] as [number, number]);
  const paretoPath = line<[number, number]>().x((d) => x(d[0])).y((d) => y(d[1]))(pareto) ?? "";
  const selected = result.frontier.selectedDesign ? `<circle class="selected-ring" cx="${x(1 - result.frontier.selectedDesign.qAcq)}" cy="${y(1 - result.frontier.selectedDesign.qShed)}" r="6"><title>Selected hypothetical design</title></circle>` : "";
  const comparators = result.frontier.comparators.map((point, index) => {
    const cx = x(1 - point.qAcq); const cy = y(1 - point.qShed); const marker = index === 0
      ? `<rect x="${cx - 4}" y="${cy - 4}" width="8" height="8" class="comparator-marker"/>`
      : `<path d="M${cx},${cy - 5}L${cx + 5},${cy}L${cx},${cy + 5}L${cx - 5},${cy}Z" class="comparator-marker"/>`;
    return `<g class="${point.selected ? "selected-comparator" : ""}">${marker}<title>Prototype ${point.label}; envelope Rloc ${format(point.rLocEnvelopeMax)}</title></g>`;
  }).join("");
  return `<svg id="effect-figure" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="effect-title effect-desc"><title id="effect-title">Prototype acquisition and breakthrough shedding reduction map</title><desc id="effect-desc">In the unreleased prototype calculation, filled hypothetical designs are below Rloc equals one and open designs are not. Sabin 2 is a square and IPV is a diamond. This is not a v1 sufficiency classification.</desc><rect class="plot-bg" x="${margin.left}" y="${margin.top}" width="${width - margin.left - margin.right}" height="${height - margin.top - margin.bottom}"/><line class="grid-line" x1="${x(0)}" x2="${x(1)}" y1="${y(0)}" y2="${y(0)}"/><line class="grid-line" x1="${x(0)}" x2="${x(0)}" y1="${y(0)}" y2="${y(1)}"/>${points}<path class="pareto-line" d="${paretoPath}"/>${selected}${comparators}<text class="axis-label" x="${width / 2}" y="${height - 12}" text-anchor="middle">Acquisition reduction (1 − q_acq)</text><text class="axis-label" transform="translate(16 ${height / 2}) rotate(-90)" text-anchor="middle">Breakthrough shedding reduction (1 − q_shed)</text>${classificationLegend(margin.left + 8, margin.top - 13)}${tickLabels(x, y, height, margin)}</svg>`;
}

function productMap(result: ModelOutputsV1): string {
  const width = 560; const height = 350; const margin = { top: 34, right: 24, bottom: 56, left: 64 };
  const columns = result.frontier.takeValues.length; const rows = result.frontier.mu0Values.length;
  const x = scaleLinear().domain([result.frontier.takeValues[0] ?? 0, result.frontier.takeValues.at(-1) ?? 1]).range([margin.left, width - margin.right]);
  const y = scaleLinear().domain([result.frontier.mu0Values[0] ?? 0, result.frontier.mu0Values.at(-1) ?? 8]).range([height - margin.bottom, margin.top]);
  const values = Array.from({ length: rows * columns }, (_, index) => {
    const takeIndex = index % columns; const muIndex = Math.floor(index / columns);
    return result.frontier.points[takeIndex * rows + muIndex]?.rLocEnvelopeMax ?? 0;
  });
  const cellWidth = (width - margin.left - margin.right) / columns; const cellHeight = (height - margin.top - margin.bottom) / rows;
  const cells = result.frontier.points.map((point) => `<rect x="${x(point.takeContext) - cellWidth / 2}" y="${y(point.mu0) - cellHeight / 2}" width="${cellWidth + 0.4}" height="${cellHeight + 0.4}" class="${point.passes ? "pass-cell" : "fail-cell"}"><title>Prototype hypothetical: take ${point.takeContext.toFixed(2)}, boost ${point.mu0.toFixed(1)}; envelope Rloc ${format(point.rLocEnvelopeMax)}</title></rect>`).join("");
  const contourPaths = thresholdContour(values, columns, rows, (index) => margin.left + index * (width - margin.left - margin.right) / (columns - 1), (index) => height - margin.bottom - index * (height - margin.top - margin.bottom) / (rows - 1));
  const selected = result.frontier.selectedDesign ? `<circle class="selected-ring" cx="${x(result.frontier.selectedDesign.takeContext)}" cy="${y(result.frontier.selectedDesign.mu0)}" r="6"><title>Selected hypothetical design</title></circle>` : "";
  const sabin = result.frontier.comparators.find((point) => point.productId === "sabin2")!;
  const sabinMarker = sabin.takeContext !== null && sabin.mu0 !== null ? `<rect x="${x(sabin.takeContext) - 5}" y="${y(sabin.mu0) - 5}" width="10" height="10" class="comparator-marker"><title>Prototype fixed Sabin 2 comparator; envelope Rloc ${format(sabin.rLocEnvelopeMax)}</title></rect>` : "";
  return `<svg id="product-figure" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="product-title product-desc"><title id="product-title">Prototype hypothetical product design map</title><desc id="product-desc">In the unreleased prototype calculation, designs below Rloc equals one are solid green. Designs not below the threshold are peach with diagonal hatching. The selected hypothetical design is ringed; Sabin 2 is a square. This is not a v1 sufficiency classification.</desc><defs><pattern id="product-fail-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" class="hatch-bg"/><line x1="0" y1="0" x2="0" y2="6" class="hatch-line"/></pattern></defs><rect class="plot-bg" x="${margin.left}" y="${margin.top}" width="${width - margin.left - margin.right}" height="${height - margin.top - margin.bottom}"/>${cells}${contourPaths}${selected}${sabinMarker}<text class="axis-label" x="${width / 2}" y="${height - 12}" text-anchor="middle">Biological take context</text><text class="axis-label" transform="translate(16 ${height / 2}) rotate(-90)" text-anchor="middle">Mean mucosal boost (log2 units)</text>${classificationLegend(margin.left + 8, margin.top - 13)}${tickLabels(x, y, height, margin, true)}</svg>`;
}

function settingMap(result: ModelOutputsV1): string {
  const width = 960; const height = 420; const margin = { top: 42, right: 28, bottom: 66, left: 72 };
  const exposureValues = [...new Set(result.settingSurface.map((point) => point.Tih))].sort((a, b) => a - b);
  const contactValues = [...new Set(result.settingSurface.map((point) => point.Ns))].sort((a, b) => a - b);
  const columns = exposureValues.length; const rows = contactValues.length;
  const x = scaleLog().domain([result.scenario.envelope.TMin * 1e6, result.scenario.envelope.TMax * 1e6]).range([margin.left, width - margin.right]);
  const yMin = contactValues[0] ?? 0; const yMax = contactValues.at(-1) ?? yMin + 1;
  const y = scaleLinear().domain(yMin === yMax ? [yMin - 0.5, yMax + 0.5] : [yMin, yMax]).range([height - margin.bottom, margin.top]);
  const cellWidth = (width - margin.left - margin.right) / columns; const cellHeight = (height - margin.top - margin.bottom) / Math.max(rows, 1);
  const values = Array.from({ length: rows * columns }, (_, index) => {
    const exposureIndex = index % columns; const contactIndex = Math.floor(index / columns);
    return result.settingSurface[exposureIndex * rows + contactIndex]?.rLoc ?? 0;
  });
  const cells = result.settingSurface.map((point) => {
    const px = x(point.Tih * 1e6) - cellWidth / 2; const py = y(point.Ns) - cellHeight / 2;
    const hatch = point.rLoc >= 1 - PARAMETERS.success.tieTolerance ? `<rect x="${px}" y="${py}" width="${cellWidth + 0.3}" height="${cellHeight + 0.3}" fill="url(#surface-fail-hatch)"/>` : "";
    return `<g><rect x="${px}" y="${py}" width="${cellWidth + 0.3}" height="${cellHeight + 0.3}" fill="${surfaceColor(point.rLoc)}"><title>Prototype: ${formatMicrograms(point.Tih)} micrograms/exposure, Ns ${point.Ns}; Rloc ${format(point.rLoc)}</title></rect>${hatch}</g>`;
  }).join("");
  const contourPaths = thresholdContour(values, columns, rows, (index) => margin.left + index * (width - margin.left - margin.right) / (columns - 1), (index) => height - margin.bottom - index * (height - margin.top - margin.bottom) / Math.max(rows - 1, 1));
  const anchors = SETTING_ANCHORS.filter((anchor) => anchor.Tih.value >= result.scenario.envelope.TMin && anchor.Tih.value <= result.scenario.envelope.TMax && anchor.Ns >= yMin && anchor.Ns <= yMax).map((anchor) => {
    const offsets: Record<string, [number, number]> = { low: [-4, 17], houston: [7, -8], matlab: [7, 17], "up-bihar": [7, -8] };
    const [dx, dy] = offsets[anchor.id] ?? [7, -8];
    const interval = anchor.id === "matlab" && anchor.interval
      ? `<line class="hybrid-interval" x1="${x(Math.max(anchor.interval.low, result.scenario.envelope.TMin * 1e6))}" x2="${x(Math.min(anchor.interval.high, result.scenario.envelope.TMax * 1e6))}" y1="${y(anchor.Ns)}" y2="${y(anchor.Ns)}"/>`
      : "";
    return `${interval}<circle class="anchor-point ${anchor.kind === "hybrid" ? "hybrid-anchor" : ""}" cx="${x(anchor.Tih.value * 1e6)}" cy="${y(anchor.Ns)}" r="5"><title>${anchor.label}${anchor.tooltip ? `: ${anchor.tooltip}` : ""}</title></circle><text class="anchor-label" x="${x(anchor.Tih.value * 1e6) + dx}" y="${y(anchor.Ns) + dy}">${anchorShortLabel(anchor.id)}</text>`;
  }).join("");
  return `<svg id="setting-figure" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="setting-title setting-desc"><title id="setting-title">Prototype selected-product setting surface</title><desc id="setting-desc">Color reports prototype log10 Rloc. Diagonal hatching marks cells not below one in the unreleased prototype calculation. The heavy line is Rloc equals one. Named setting anchors and the Matlab interval are overlaid. This is not a v1 sufficiency classification.</desc><defs><pattern id="surface-fail-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" class="surface-hatch-line"/></pattern></defs><rect class="plot-bg" x="${margin.left}" y="${margin.top}" width="${width - margin.left - margin.right}" height="${height - margin.top - margin.bottom}"/>${cells}${contourPaths}${anchors}${surfaceLegend(width - 326, 15)}<text class="axis-label" x="${width / 2}" y="${height - 14}" text-anchor="middle">Stool-equivalent exposure (micrograms/exposure, log scale)</text><text class="axis-label" transform="translate(18 ${height / 2}) rotate(-90)" text-anchor="middle">Close social contacts (Ns)</text>${settingTicks(x, y, result.scenario)}</svg>`;
}

function thresholdContour(values: number[], columns: number, rows: number, x: (value: number) => number, y: (value: number) => number): string {
  if (columns < 2 || rows < 2 || Math.min(...values) >= 1 || Math.max(...values) < 1) return "";
  return contours().size([columns, rows]).thresholds([1])(values).map((shape) => contourPath(shape, x, y)).join("");
}

function contourPath(shape: { coordinates: number[][][][] }, x: (value: number) => number, y: (value: number) => number): string {
  return shape.coordinates.flatMap((polygon) => polygon.map((ring) => `<path class="contour-line" d="M${ring.map((point) => `${x(point[0] ?? 0)},${y(point[1] ?? 0)}`).join("L")}Z"/>`)).join("");
}

function tickLabels(x: (value: number) => number, y: (value: number) => number, height: number, margin: { bottom: number; left: number }, product = false): string {
  const ticks = product ? { x: [0, 0.5, 1], y: [0, 4, 8] } : { x: [0, 0.5, 1], y: [0, 0.5, 1] };
  return `${ticks.x.map((tick) => `<text class="tick" x="${x(tick)}" y="${height - margin.bottom + 18}" text-anchor="middle">${tick}</text>`).join("")}${ticks.y.map((tick) => `<text class="tick" x="${margin.left - 8}" y="${y(tick) + 4}" text-anchor="end">${tick}</text>`).join("")}`;
}

function settingTicks(x: (value: number) => number, y: (value: number) => number, scenario: ScenarioV1): string {
  const xCandidates = [0.1, 1, 10, 100, 1000, 2000].filter((value) => value >= scenario.envelope.TMin * 1e6 && value <= scenario.envelope.TMax * 1e6);
  const ySpan = scenario.envelope.NsMax - scenario.envelope.NsMin;
  const yCandidates = [...new Set([scenario.envelope.NsMin, Math.round(scenario.envelope.NsMin + ySpan / 2), scenario.envelope.NsMax])];
  return `${xCandidates.map((tick) => `<text class="tick" x="${x(tick)}" y="371" text-anchor="middle">${tick}</text>`).join("")}${yCandidates.map((tick) => `<text class="tick" x="64" y="${y(tick) + 4}" text-anchor="end">${tick}</text>`).join("")}`;
}

function classificationLegend(x: number, y: number): string {
  return `<g class="chart-legend"><circle class="pass-point" cx="${x}" cy="${y}" r="4"/><text x="${x + 8}" y="${y + 3}">prototype Rloc &lt; 1</text><circle class="fail-point" cx="${x + 112}" cy="${y}" r="4"/><text x="${x + 120}" y="${y + 3}">not below 1</text><rect class="comparator-marker" x="${x + 202}" y="${y - 4}" width="8" height="8"/><text x="${x + 214}" y="${y + 3}">fixed comparator</text></g>`;
}

function surfaceLegend(x: number, y: number): string {
  const values = [-2, -1, 0, 1, 2]; const width = 38;
  return `<g class="surface-legend"><text x="${x}" y="${y + 10}">log10(Rloc)</text>${values.map((value, index) => `<rect x="${x + 76 + index * width}" y="${y}" width="${width}" height="12" fill="${surfaceColor(10 ** value)}"/><text x="${x + 76 + index * width + width / 2}" y="${y + 25}" text-anchor="middle">${value}</text>`).join("")}</g>`;
}

function surfaceColor(rLoc: number): string {
  const z = Math.max(-2, Math.min(2, Math.log10(Math.max(rLoc, 1e-4))));
  const fraction = (z + 2) / 4;
  const red = Math.round(34 + 207 * fraction); const green = Math.round(129 - 37 * fraction); const blue = Math.round(166 - 105 * fraction);
  return `rgb(${red},${green},${blue})`;
}

function settingLabel(id: string): string {
  if (id === "global") return "Envelope maximum";
  return SETTING_ANCHORS.find((anchor) => anchor.id === id)?.label ?? "Custom setting";
}

function anchorShortLabel(id: string): string {
  return ({ low: "Low", houston: "Houston", matlab: "Matlab hybrid", "up-bihar": "UP/Bihar" } as Record<string, string>)[id] ?? id;
}

function isBundledGlobalEnvelope(scenario: ScenarioV1): boolean {
  return canonicalJson(scenario.envelope) === canonicalJson(ENVELOPE);
}

function exportOutput(kind: string, outputs: ModelOutputsV1): void {
  if (kind === "json") download("polio-tpp-prototype-model-outputs.json", canonicalJson({
    exportSchemaVersion: "PrototypeModelExportV1",
    prototypeStatus: PROTOTYPE_STATUS,
    buildIdentity: BUILD_IDENTITY,
    outputs
  }));
  if (kind === "csv") download("polio-tpp-prototype-evaluated-grids.csv", csvOutputs(outputs), "text/csv");
  if (kind === "svg") download("polio-tpp-prototype-figures.svg", combinedSvgExport(), "image/svg+xml");
}

function csvOutputs(outputs: ModelOutputsV1): string {
  const header = "record_type,product_id,take_context,mu0,Tih_g_per_exposure,Ths_g_per_exposure,dIh_exposures_per_person_day,dHs_exposures_per_person_day,Ns,q_acq,q_shed,r_loc_envelope_max,r_loc,prototype_r_loc_below_1,prototype_status";
  const frontier = outputs.frontier.points.map((point) => ["frontier", "hypothetical", point.takeContext, point.mu0, "", "", "", "", "", point.qAcq, point.qShed, point.rLocEnvelopeMax, "", point.passes, csvValue(PROTOTYPE_STATUS)].join(","));
  const comparators = outputs.frontier.comparators.map((point) => ["comparator", point.productId, point.takeContext ?? "", point.mu0 ?? "", "", "", "", "", "", point.qAcq, point.qShed, point.rLocEnvelopeMax, "", point.passes, csvValue(PROTOTYPE_STATUS)].join(","));
  const surface = outputs.settingSurface.map((point) => ["surface", outputs.scenario.vaccine.id, "", "", point.Tih, point.Ths, point.dIh, point.dHs, point.Ns, "", "", "", point.rLoc, passesThreshold(point.rLoc), csvValue(PROTOTYPE_STATUS)].join(","));
  return [header, ...frontier, ...comparators, ...surface].join("\n");
}

function combinedSvgExport(): string {
  const effect = document.querySelector<SVGSVGElement>("#effect-figure")?.innerHTML ?? "";
  const product = document.querySelector<SVGSVGElement>("#product-figure")?.innerHTML ?? "";
  const setting = document.querySelector<SVGSVGElement>("#setting-figure")?.innerHTML ?? "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="830" viewBox="0 0 1120 830" role="img" aria-labelledby="prototype-export-title prototype-export-desc"><title id="prototype-export-title">Scientific prototype figures</title><desc id="prototype-export-desc">${PROTOTYPE_STATUS}. Threshold comparisons are close-contact point-rule results, not complete-population or decision-use classifications.</desc><style>text{font-family:system-ui,sans-serif;fill:#17202a}.plot-bg{fill:#fbfcfd;stroke:#d5dde5}.pass-point{fill:#176b55}.fail-point{fill:#fff;stroke:#9e2a2b}.pass-cell{fill:#61ae8e}.fail-cell{fill:url(#product-fail-hatch)}.pareto-line,.contour-line{fill:none;stroke:#bc4b29;stroke-width:2.5}.selected-ring{fill:none;stroke:#111;stroke-width:2}.comparator-marker{fill:#fff;stroke:#17202a;stroke-width:2}.axis-label{font-size:12px;font-weight:650}.tick,.anchor-label,.chart-legend,.surface-legend{font-size:10px}</style><text x="20" y="20" font-size="13" font-weight="700">SCIENTIFIC PROTOTYPE — POINT RULE ONLY</text><text x="20" y="36" font-size="10">Threshold comparisons are close-contact point-rule results, not complete-population or decision-use classifications.</text><g transform="translate(0 24)">${effect}</g><g transform="translate(560 24)">${product}</g><g transform="translate(80 394)">${setting}</g></svg>`;
}

function download(name: string, content: string, type = "application/json"): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function csvValue(value: string): string { return `"${value.replaceAll('"', '""')}"`; }

function format(value: number): string { return Number.isFinite(value) ? value.toFixed(value < 10 ? 3 : 2) : "—"; }
function percent(value: number): string { return `${(100 * value).toFixed(1)}%`; }
function formatMicrograms(grams: number): string { return (grams * 1e6).toPrecision(3); }
function formatDays(days: number): string { return `${days.toFixed(0)} days`; }

document.querySelector<HTMLElement>("#app") && mountApp(document.querySelector<HTMLElement>("#app")!);
