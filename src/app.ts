import { contours } from "d3-contour";
import { scaleLinear, scaleLog } from "d3-scale";
import { line } from "d3-shape";
import { defaultScenario, evaluateScenario, scenarioWithProduct, scenarioWithSetting } from "./model/model";
import { PARAMETERS, PRODUCT_LABELS, SETTING_ANCHORS } from "./model/parameters";
import { canonicalJson, decodeScenario, encodeScenario, validateScenario } from "./model/serialization";
import type { ModelOutputsV1, ScenarioV1, SettingId } from "./model/types";

const APP_VERSION = "0.1.0";

export function mountApp(root: HTMLElement): void {
  root.innerHTML = shell();
  const initial = scenarioFromHash();
  let scenario = initial.scenario;
  let hashWarning = initial.error;
  let outputs: ModelOutputsV1 | null = null;
  const warning = document.querySelector<HTMLElement>("#state-warning")!;
  const status = document.querySelector<HTMLElement>("#compute-status")!;

  if (initial.error) {
    warning.hidden = false;
    warning.textContent = `The URL state was not evaluated: ${initial.error} Defaults were loaded.`;
  }
  syncControls(scenario);
  document.querySelector<HTMLButtonElement>("#reset")!.addEventListener("click", () => {
    scenario = defaultScenario();
    hashWarning = undefined;
    syncControls(scenario);
    run();
  });
  document.querySelector<HTMLButtonElement>("#compute")!.addEventListener("click", () => {
    scenario = readControls(scenario);
    hashWarning = undefined;
    run();
  });
  document.querySelector<HTMLSelectElement>("#product")!.addEventListener("change", (event) => {
    scenario = scenarioWithProduct(scenario, (event.target as HTMLSelectElement).value as ScenarioV1["vaccine"]["id"]);
    syncControls(scenario);
  });
  document.querySelector<HTMLSelectElement>("#setting")!.addEventListener("change", (event) => {
    scenario = scenarioWithSetting(scenario, (event.target as HTMLSelectElement).value as SettingId);
  });
  document.querySelector<HTMLSelectElement>("#success-rule")!.addEventListener("change", (event) => {
    scenario.successRule = (event.target as HTMLSelectElement).value as ScenarioV1["successRule"];
  });
  document.querySelectorAll<HTMLInputElement>("input[type='range']").forEach((input) => input.addEventListener("input", updateReadouts));
  document.querySelectorAll<HTMLButtonElement>("[data-export]").forEach((button) => button.addEventListener("click", () => {
    if (!outputs) return;
    exportOutput(button.dataset.export ?? "json", outputs);
  }));

  run();

  function run(): void {
    status.textContent = "Computing deterministic model...";
    status.className = "compute-status busy";
    try {
      validateScenario(scenario);
      outputs = evaluateScenario(scenario);
      window.location.hash = `scenario=${encodeScenario(scenario)}`;
      warning.hidden = !hashWarning;
      if (hashWarning) warning.textContent = `The URL state was not evaluated: ${hashWarning} Defaults were loaded.`;
      renderOutputs(outputs);
      status.textContent = "Model updated";
      status.className = "compute-status";
    } catch (error) {
      outputs = null;
      status.textContent = "Model state is invalid";
      status.className = "compute-status error";
      warning.hidden = false;
      warning.textContent = error instanceof Error ? error.message : String(error);
    }
  }

  function renderOutputs(result: ModelOutputsV1): void {
    const metrics = result.metrics;
    const selectedRLoc = result.scenario.setting.id === "global" ? metrics.rLocMax : selectedAnchorRLoc(result);
    const pass = metrics.rLocMax < 1;
    document.querySelector<HTMLElement>("#result-status")!.innerHTML = `<strong>${pass ? "MEETS" : "DOES NOT MEET"} the v1 close-contact sufficiency criterion</strong><span>Maximum modeled R<sub>loc</sub> = ${format(metrics.rLocMax)} across the ${formatMicrograms(result.scenario.envelope.TMin)}-${formatMicrograms(result.scenario.envelope.TMax)} microgram/exposure and ${result.scenario.envelope.NsMin}-${result.scenario.envelope.NsMax} contact envelope.</span>`;
    document.querySelector<HTMLElement>("#selected-setting-result")!.textContent = `${settingLabel(result.scenario.setting.id)}: Rloc ${format(selectedRLoc)}`;
    document.querySelector<HTMLElement>("#summary-cards")!.innerHTML = summaryCards(result);
    document.querySelector<HTMLElement>("#assumptions")!.innerHTML = `<h3>Assumptions and uncertainty</h3><ul>${result.assumptions.map((item) => `<li>${item}</li>`).join("")}</ul><p class="uncertainty-note"><strong>Interval status:</strong> ${result.uncertainty.reason}</p>`;
    document.querySelector<HTMLElement>("#effect-map")!.innerHTML = effectMap(result);
    document.querySelector<HTMLElement>("#product-map")!.innerHTML = productMap(result);
    document.querySelector<HTMLElement>("#setting-map")!.innerHTML = settingMap(result);
    document.querySelector<HTMLElement>("#schedule-summary")!.textContent = `RI days 42, 70, 98${result.scenario.schedule.boosterAgeYears ? `; booster at ${result.scenario.schedule.boosterAgeYears} year${result.scenario.schedule.boosterAgeYears === 1 ? "" : "s"}` : "; no booster"}. Assessment: ${result.metrics.assessmentLagDays} days after last dose (age ${formatDays(result.metrics.assessmentAgeDays)}).`;
    const upper = document.querySelector<HTMLOptionElement>("#success-rule option[value='upper95']")!;
    upper.disabled = !result.uncertainty.available;
  }
}

function shell(): string {
  const productOptions = Object.entries(PRODUCT_LABELS).map(([id, label]) => `<option value="${id}">${label}</option>`).join("");
  const settingOptions = [["global", "Any setting: v1 global envelope"], ["low", "Low transmission"], ["houston", "Houston/Louisiana moderate"], ["matlab", "Matlab household exposure (hybrid)"], ["up-bihar", "UP/Bihar high"], ["custom", "Custom setting"]].map(([id, label]) => `<option value="${id}">${label}</option>`).join("");
  return `<main class="app-shell">
    <header class="hero">
      <p class="eyebrow">Next-generation polio vaccine TPP generator · contract 1.2</p>
      <h1>What combination of vaccine performance is enough?</h1>
      <p class="lede">Explore acquisition blocking, breakthrough infectiousness, schedule, and close-contact setting assumptions for WPV1. The primary decision is the directly evaluated R<sub>loc</sub> criterion, not a scalar shedding target.</p>
    </header>
    <section class="control-panel" aria-labelledby="controls-heading">
      <div class="section-heading"><div><p class="eyebrow">Scenario</p><h2 id="controls-heading">Choose a product and setting</h2></div><button id="reset" class="secondary">Reset defaults</button></div>
      <div class="controls-grid">
        <label>Product<select id="product">${productOptions}</select><small>Sabin 2, IPV, or the hypothetical OPV-like pathway.</small></label>
        <label>Setting<select id="setting">${settingOptions}</select><small>The status still uses the declared envelope when “Any setting” is selected.</small></label>
        <label>Booster<select id="booster"><option value="0">None</option><option value="1">At 1 year</option><option value="2">At 2 years</option><option value="3">At 3 years</option><option value="4">At 4 years</option></select></label>
        <label>Assessment lag<select id="lag"><option value="28">28 days</option><option value="90">90 days</option></select><small>Applied identically to index, household, and social roles.</small></label>
        <label>Setting-specific take <output id="take-output">0.80</output><input id="take" type="range" min="0" max="1" step="0.01" value="0.8"><small>Biological productive live-vaccine take multiplier, not dose receipt.</small></label>
        <label>Mean immune boost <output id="mu-output">4.0 log2</output><input id="mu" type="range" min="0" max="8" step="0.1" value="4"><small>Maximum mean boost for the hypothetical live product; sigma is fixed at 2.4.</small></label>
      </div>
      <details><summary>Advanced product and transmission controls</summary><div class="controls-grid advanced">
        <label>Vaccine alpha<input id="alpha" type="number" min="0.2" max="1" step="0.001"></label>
        <label>Vaccine beta (CID50)<input id="beta" type="number" min="1" max="100" step="0.1"></label>
        <label>Administered dose (log10 TCID50)<input id="dose-log" type="number" min="4" max="7" step="0.01"></label>
        <label>Custom Tih (micrograms/exposure)<input id="custom-tih" type="number" min="0.1" max="2000" step="0.1"><small>Used when Custom setting is selected; canonical model unit is grams.</small></label>
        <label>Custom Ths (micrograms/exposure)<input id="custom-ths" type="number" min="0.1" max="2000" step="0.1"></label>
        <label>Custom Dih (exposures/person/day)<input id="custom-dih" type="number" min="0" max="100" step="0.01"></label>
        <label>Custom Dhs (exposures/person/day)<input id="custom-dhs" type="number" min="0" max="100" step="0.01"></label>
        <label>Custom Ns (close social contacts)<input id="custom-ns" type="number" min="0" max="1000" step="1"></label>
        <label>Success rule<select id="success-rule"><option value="point">Point Rloc &lt; 1</option><option value="upper95">Upper central 95% bound &lt; 1</option></select><small>The upper-95 rule is unavailable until a reviewed joint ensemble is bundled.</small></label>
      </div></details>
      <p id="state-warning" class="warning" hidden></p><div class="control-actions"><button id="compute" class="primary">Update model</button><span id="compute-status" class="compute-status" role="status"></span></div>
    </section>
    <p id="schedule-summary" class="schedule-summary"></p>
    <section id="result-status" class="result-status" aria-live="polite"></section>
    <section id="summary-cards" class="summary-cards"></section>
    <section class="primary-views" aria-labelledby="maps-heading"><div class="section-heading"><div><p class="eyebrow">What product is enough?</p><h2 id="maps-heading">Linked TPP maps</h2></div><span id="selected-setting-result" class="pill"></span></div><div class="map-grid"><figure><div id="effect-map"></div><figcaption><strong>Requirement space.</strong> Directly evaluated product designs shown as acquisition reduction versus breakthrough infectious-shedding reduction. The boundary is the minimum-sufficient Pareto set; unattained coordinate pairs remain visible as empty space.</figcaption></figure><figure><div id="product-map"></div><figcaption><strong>Product space.</strong> The same 2,601 evaluations shown as take context versus mean boost. The contour is evaluated at R<sub>loc</sub> = 1; no interpolation determines classification.</figcaption></figure></div></section>
    <section class="surface-section" aria-labelledby="surface-heading"><p class="eyebrow">Where?</p><h2 id="surface-heading">Setting surface</h2><p class="section-copy">Exposure is shown in micrograms of stool-equivalent transfer per exposure. The fill is log<sub>10</sub>(R<sub>loc</sub>); the heavy contour is R<sub>loc</sub> = 1. Named anchors are overlays, not extra model pathways.</p><figure><div id="setting-map"></div></figure></section>
    <section id="assumptions" class="assumptions"></section>
    <section class="exports"><h2>Reproducible exports</h2><p>Exports include the canonical scenario, manifest versions, exact grid ordering, and directly evaluated outputs.</p><button data-export="json" class="secondary">JSON</button><button data-export="csv" class="secondary">CSV grids</button><button data-export="svg" class="secondary">SVG figures</button></section>
    <footer><p>Version ${APP_VERSION} · parameter manifest ${PARAMETERS.manifestVersion} · no runtime network dependency · no runtime random sampling.</p><p><a href="https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.2002468">Source paper</a> · <a href="https://github.com/famulare/cessationStability">cessationStability</a> · <a href="https://github.com/famulare/india-polio">india-polio</a></p></footer>
  </main>`;
}

function scenarioFromHash(): { scenario: ScenarioV1; error?: string } {
  const encoded = window.location.hash.startsWith("#scenario=") ? window.location.hash.slice("#scenario=".length) : "";
  if (!encoded) return { scenario: defaultScenario() };
  try { return { scenario: decodeScenario(encoded) }; } catch (error) { return { scenario: defaultScenario(), error: error instanceof Error ? error.message : String(error) }; }
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
  setValue("success-rule", scenario.successRule);
  setProductEditability(scenario.vaccine.id === "hypothetical");
  updateReadouts();
}

function readControls(previous: ScenarioV1): ScenarioV1 {
  const product = document.querySelector<HTMLSelectElement>("#product")!.value as ScenarioV1["vaccine"]["id"];
  let scenario = product === previous.vaccine.id ? previous : scenarioWithProduct(previous, product);
  const settingId = document.querySelector<HTMLSelectElement>("#setting")!.value as SettingId;
  scenario = settingId === "custom" ? { ...scenario, setting: { id: "custom", Tih: { value: numberValue("custom-tih") / 1e6, unit: "grams/exposure", basis: "per_exposure" }, Ths: { value: numberValue("custom-ths") / 1e6, unit: "grams/exposure", basis: "per_exposure" }, dIh: { value: numberValue("custom-dih"), unit: "exposures/person/day", basis: "per_day" }, dHs: { value: numberValue("custom-dhs"), unit: "exposures/person/day", basis: "per_day" }, Ns: numberValue("custom-ns") } } : scenarioWithSetting(scenario, settingId);
  scenario.schedule = { ...scenario.schedule, boosterAgeYears: Number(document.querySelector<HTMLSelectElement>("#booster")!.value) as ScenarioV1["schedule"]["boosterAgeYears"], assessmentLagDays: Number(document.querySelector<HTMLSelectElement>("#lag")!.value) as 28 | 90 };
  if (scenario.vaccine.id === "hypothetical") scenario.vaccine = { ...scenario.vaccine, takeContext: numberValue("take"), mu0: numberValue("mu"), alpha: numberValue("alpha"), beta: numberValue("beta"), dose: 10 ** numberValue("dose-log") };
  scenario.successRule = document.querySelector<HTMLSelectElement>("#success-rule")!.value as ScenarioV1["successRule"];
  return scenario;
}

function updateReadouts(): void {
  const take = document.querySelector<HTMLInputElement>("#take")!;
  const mu = document.querySelector<HTMLInputElement>("#mu")!;
  document.querySelector<HTMLOutputElement>("#take-output")!.value = Number(take.value).toFixed(2);
  document.querySelector<HTMLOutputElement>("#mu-output")!.value = `${Number(mu.value).toFixed(1)} log2`;
}

function setProductEditability(editable: boolean): void {
  for (const id of ["take", "mu", "alpha", "beta", "dose-log"]) {
    const input = document.querySelector<HTMLInputElement>(`#${id}`);
    if (input) input.disabled = !editable;
  }
}

function numberValue(id: string): number { return Number(document.querySelector<HTMLInputElement>(`#${id}`)!.value); }
function setValue(id: string, value: string | number): void { const element = document.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`); if (element) element.value = String(value); }

function summaryCards(result: ModelOutputsV1): string {
  const m = result.metrics;
  return [
    ["Acquisition reduction", percent(1 - m.qAcq), "1 − q_acq"],
    ["Breakthrough shedding reduction", percent(1 - m.qShed), "1 − q_shed"],
    ["Derived shedding index", format(m.qIndex), "q_acq × q_shed; diagnostic only"],
    ["Maximum Rloc", format(m.rLocMax), "point criterion; interval unavailable"],
    ["Naive maximum Rloc", format(m.naiveRLocMax), "same envelope and reference exposure"],
    ["First-dose effective take", percent(m.effectiveFirstDoseTake), "naive recipient"]
  ].map(([title, value, detail]) => `<article class="summary-card"><span>${title}</span><strong>${value}</strong><small>${detail}</small></article>`).join("");
}

function effectMap(result: ModelOutputsV1): string {
  const width = 560; const height = 330; const margin = { top: 24, right: 18, bottom: 52, left: 62 };
  const x = scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
  const y = scaleLinear().domain([0, 1]).range([height - margin.bottom, margin.top]);
  const points = result.frontier.points.map((point) => `<circle cx="${x(1 - point.qAcq)}" cy="${y(1 - point.qShed)}" r="${point === result.frontier.selected ? 5 : 2.1}" class="${point.passes ? "pass-point" : "fail-point"}"><title>take ${point.takeContext.toFixed(2)}, boost ${point.mu0.toFixed(1)}; Rloc ${format(point.rLocMax)}</title></circle>`).join("");
  const pareto = result.frontier.pareto.map((point) => [1 - point.qAcq, 1 - point.qShed] as [number, number]);
  const paretoPath = line<[number, number]>().x((d) => x(d[0])).y((d) => y(d[1]))(pareto) ?? "";
  return `<svg id="effect-figure" viewBox="0 0 ${width} ${height}" role="img" aria-label="Acquisition and breakthrough shedding reduction map"><rect class="plot-bg" x="${margin.left}" y="${margin.top}" width="${width - margin.left - margin.right}" height="${height - margin.top - margin.bottom}"/><line class="grid-line" x1="${x(0)}" x2="${x(1)}" y1="${y(0)}" y2="${y(0)}"/><line class="grid-line" x1="${x(0)}" x2="${x(0)}" y1="${y(0)}" y2="${y(1)}"/>${points}<path class="pareto-line" d="${paretoPath}"/><text class="axis-label" x="${width / 2}" y="${height - 12}" text-anchor="middle">Acquisition reduction (1 − q_acq)</text><text class="axis-label" transform="translate(15 ${height / 2}) rotate(-90)" text-anchor="middle">Breakthrough shedding reduction (1 − q_shed)</text><text class="plot-note" x="${margin.left + 5}" y="${margin.top + 15}">passing points + evaluated frontier</text>${tickLabels(x, y, width, height, margin)}</svg>`;
}

function productMap(result: ModelOutputsV1): string {
  const width = 560; const height = 330; const margin = { top: 24, right: 18, bottom: 52, left: 62 }; const n = 51;
  const x = scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]); const y = scaleLinear().domain([0, 8]).range([height - margin.bottom, margin.top]);
  const values = Array.from({ length: n * n }, (_, index) => { const takeIndex = index % n; const muIndex = Math.floor(index / n); return result.frontier.points[takeIndex * n + muIndex]?.rLocMax ?? 0; });
  const cellWidth = (width - margin.left - margin.right) / n; const cellHeight = (height - margin.top - margin.bottom) / n;
  const cells = result.frontier.points.map((point) => `<rect x="${x(point.takeContext) - cellWidth / 2}" y="${y(point.mu0) - cellHeight / 2}" width="${cellWidth + 0.4}" height="${cellHeight + 0.4}" class="${point.passes ? "pass-cell" : "fail-cell"}" opacity="0.72"><title>take ${point.takeContext.toFixed(2)}, boost ${point.mu0.toFixed(1)}; Rloc ${format(point.rLocMax)}</title></rect>`).join("");
  const contour = contours().size([n, n]).thresholds([1])(values);
  const contourPaths = contour.map((shape) => contourPath(shape, (index) => margin.left + index * (width - margin.left - margin.right) / (n - 1), (index) => height - margin.bottom - index * (height - margin.top - margin.bottom) / (n - 1))).join("");
  return `<svg id="product-figure" viewBox="0 0 ${width} ${height}" role="img" aria-label="Product design map"><rect class="plot-bg" x="${margin.left}" y="${margin.top}" width="${width - margin.left - margin.right}" height="${height - margin.top - margin.bottom}"/>${cells}${contourPaths}<circle class="selected-ring" cx="${x(result.frontier.selected.takeContext)}" cy="${y(result.frontier.selected.mu0)}" r="6"/><text class="axis-label" x="${width / 2}" y="${height - 12}" text-anchor="middle">Setting-specific take context</text><text class="axis-label" transform="translate(15 ${height / 2}) rotate(-90)" text-anchor="middle">Mean immune boost (log2 units)</text><text class="plot-note" x="${margin.left + 5}" y="${margin.top + 15}">heavy line: Rloc = 1</text>${tickLabels(x, y, width, height, margin, true)}</svg>`;
}

function settingMap(result: ModelOutputsV1): string {
  const width = 960; const height = 390; const margin = { top: 24, right: 24, bottom: 58, left: 70 }; const rows = 40; const columns = 81;
  const x = scaleLog().domain([result.scenario.envelope.TMin * 1e6, result.scenario.envelope.TMax * 1e6]).range([margin.left, width - margin.right]); const y = scaleLinear().domain([1, 40]).range([height - margin.bottom, margin.top]);
  const grid = result.settingSurface; const cellWidth = (width - margin.left - margin.right) / columns; const cellHeight = (height - margin.top - margin.bottom) / rows;
  const values = Array.from({ length: rows * columns }, (_, index) => { const t = index % columns; const ns = Math.floor(index / columns); return grid[t * rows + ns]?.rLoc ?? 0; });
  const cells = grid.map((point) => { const color = surfaceColor(point.rLoc); return `<rect x="${x(point.Tih * 1e6) - cellWidth / 2}" y="${y(point.Ns) - cellHeight / 2}" width="${cellWidth + 0.3}" height="${cellHeight + 0.3}" fill="${color}"><title>${formatMicrograms(point.Tih)} micrograms/exposure, N_s ${point.Ns}; Rloc ${format(point.rLoc)}</title></rect>`; }).join("");
  const contour = contours().size([columns, rows]).thresholds([1])(values);
  const contourPaths = contour.map((shape) => contourPath(shape, (index) => margin.left + index * (width - margin.left - margin.right) / (columns - 1), (index) => height - margin.bottom - index * (height - margin.top - margin.bottom) / (rows - 1))).join("");
  const anchors = SETTING_ANCHORS.map((anchor) => `<circle class="anchor-point ${anchor.kind === "hybrid" ? "hybrid-anchor" : ""}" cx="${x(anchor.Tih.value * 1e6)}" cy="${y(anchor.Ns)}" r="5"><title>${anchor.label}${anchor.tooltip ? `: ${anchor.tooltip}` : ""}</title></circle><text class="anchor-label" x="${x(anchor.Tih.value * 1e6) + 7}" y="${y(anchor.Ns) - 7}">${anchor.label.replace(" transmission", "").replace(" moderate", "")}</text>`).join("");
  return `<svg id="setting-figure" viewBox="0 0 ${width} ${height}" role="img" aria-label="Setting surface"><rect class="plot-bg" x="${margin.left}" y="${margin.top}" width="${width - margin.left - margin.right}" height="${height - margin.top - margin.bottom}"/>${cells}${contourPaths}${anchors}<text class="axis-label" x="${width / 2}" y="${height - 13}" text-anchor="middle">Stool-equivalent exposure (micrograms/exposure, log scale)</text><text class="axis-label" transform="translate(17 ${height / 2}) rotate(-90)" text-anchor="middle">Close social contacts (N_s)</text><text class="plot-note" x="${margin.left + 5}" y="${margin.top + 15}">fill: log10(Rloc); heavy line: Rloc = 1</text></svg>`;
}

function contourPath(shape: { coordinates: number[][][][] }, x: (value: number) => number, y: (value: number) => number): string {
  return shape.coordinates.flatMap((polygon) => polygon.map((ring) => `<path class="contour-line" d="M${ring.map((point) => `${x(point[0] ?? 0)},${y(point[1] ?? 0)}`).join("L")}Z"/>`)).join("");
}

function tickLabels(x: (value: number) => number, y: (value: number) => number, width: number, height: number, margin: { top: number; right: number; bottom: number; left: number }, product = false): string {
  const xTicks = product ? [0, 0.5, 1] : [0, 0.5, 1];
  const yTicks = product ? [0, 4, 8] : [0, 0.5, 1];
  return `${xTicks.map((tick) => `<text class="tick" x="${x(tick)}" y="${height - margin.bottom + 17}" text-anchor="middle">${tick}</text>`).join("")}${yTicks.map((tick) => `<text class="tick" x="${margin.left - 8}" y="${y(tick) + 4}" text-anchor="end">${tick}</text>`).join("")}`;
}

function surfaceColor(rLoc: number): string {
  const z = Math.max(-2, Math.min(2, Math.log10(Math.max(rLoc, 1e-4))));
  const fraction = (z + 2) / 4;
  const red = Math.round(247 * fraction + 38 * (1 - fraction)); const green = Math.round(88 * fraction + 145 * (1 - fraction)); const blue = Math.round(75 * fraction + 190 * (1 - fraction));
  return `rgb(${red},${green},${blue})`;
}

function selectedAnchorRLoc(result: ModelOutputsV1): number {
  if (result.scenario.setting.id === "low") return result.metrics.rLocLow;
  if (result.scenario.setting.id === "houston") return result.metrics.rLocHouston;
  if (result.scenario.setting.id === "matlab") return result.metrics.rLocMatlab;
  if (result.scenario.setting.id === "up-bihar") return result.metrics.rLocHigh;
  return result.metrics.rLocMax;
}

function settingLabel(id: string): string {
  if (id === "global") return "Global envelope";
  return SETTING_ANCHORS.find((anchor) => anchor.id === id)?.label ?? "Custom setting";
}

function exportOutput(kind: string, outputs: ModelOutputsV1): void {
  if (kind === "json") download("polio-tpp-scenario.json", canonicalJson(outputs));
  if (kind === "csv") download("polio-tpp-grids.csv", csvOutputs(outputs), "text/csv");
  if (kind === "svg") download("polio-tpp-figures.svg", `<svg xmlns="http://www.w3.org/2000/svg"><g>${document.querySelector("#effect-map")?.innerHTML ?? ""}</g><g transform="translate(580)">${document.querySelector("#product-map")?.innerHTML ?? ""}</g></svg>`, "image/svg+xml");
}

function csvOutputs(outputs: ModelOutputsV1): string {
  const frontier = outputs.frontier.points.map((point) => `frontier,${point.takeContext},${point.mu0},${point.qAcq},${point.qShed},${point.rLocMax},${point.passes}`);
  const surface = outputs.settingSurface.map((point) => `surface,${point.Tih},${point.Ns},${point.rLoc}`);
  return ["grid_type,take_or_T,mu0_or_Ns,q_acq_or_blank,q_shed_or_blank,r_loc,passes", ...frontier, ...surface].join("\n");
}

function download(name: string, content: string, type = "application/json"): void {
  const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}

function format(value: number): string { return Number.isFinite(value) ? value.toFixed(value < 10 ? 3 : 2) : "—"; }
function percent(value: number): string { return `${(100 * value).toFixed(1)}%`; }
function formatMicrograms(grams: number): string { return (grams * 1e6).toPrecision(3); }
function formatDays(days: number): string { return `${days.toFixed(0)} days`; }

document.querySelector<HTMLElement>("#app") && mountApp(document.querySelector<HTMLElement>("#app")!);
