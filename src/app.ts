import { passesThreshold } from "./model/frontier";
import {
  defaultScenario,
  evaluateScenario,
  scenarioWithDecisionScope,
  scenarioWithProduct,
  scenarioWithSetting
} from "./model/model";
import {
  FRONTIER_GRID,
  PARAMETERS,
  PRODUCT_LABELS,
  SETTING_ANCHORS,
  SETTING_MANIFEST_VERSION
} from "./model/parameters";
import { canonicalJson, decodeScenario, encodeScenario } from "./model/serialization";
import { MICROGRAMS_PER_GRAM } from "./model/types";
import type { AnchorSettingId, DesignGridPoint, EnvelopeV1, ModelOutputsV1, ProductId, ScenarioV1, SettingId } from "./model/types";
import { renderEffectMap, renderImmunityDistribution, renderProductMap, renderSettingSurface, renderWithinHostTeaching } from "./ui/charts";
import type { ChartViewState } from "./ui/charts";
import { buildPresentation, describeDecisionScope, designKey } from "./ui/presentation";


declare const __BUILD_IDENTITY__: string;

const APP_VERSION = "0.4.0-prototype";
const AUTO_UPDATE_DELAY_MS = 180;
const MIN_STALE_DISPLAY_MS = 50;
const BUILD_IDENTITY = __BUILD_IDENTITY__;
const PROTOTYPE_STATUS = "Scientific prototype: direct point-rule close-contact results under the v1 sufficiency axiom";
const JSON_EXPORT_SCHEMA_VERSION = "PrototypeModelExportV2";
const CSV_EXPORT_SCHEMA_VERSION = "PrototypeGridExportV2";
const SVG_EXPORT_SCHEMA_VERSION = "PrototypeFigureExportV2";

interface AppViewState extends ChartViewState {
  drawerOpen: boolean;
}

export function mountApp(root: HTMLElement): void {
  root.innerHTML = shell();
  const initial = scenarioFromHash();
  let draftScenario = initial.scenario;
  let committedOutputs: ModelOutputsV1 | null = null;
  let updateTimer: number | undefined;
  const view: AppViewState = {
    inspectedDesignKey: null,
    persistentDesignKey: null,
    surfaceColumn: 40,
    surfaceRow: 9,
    drawerOpen: false
  };

  syncControls(draftScenario);
  bindControls();
  bindChartInteractions();
  bindExports();
  bindGlobalKeys();
  if (initial.error) showWarning(`The URL state was rejected: ${initial.error} Versioned defaults were loaded instead.`);
  run(draftScenario, initial.error ? `The URL state was rejected: ${initial.error} Versioned defaults were evaluated instead.` : undefined);

  function bindControls(): void {
    byId<HTMLButtonElement>("reset").addEventListener("click", () => {
      draftScenario = defaultScenario();
      view.inspectedDesignKey = null;
      view.persistentDesignKey = null;
      syncControls(draftScenario);
      scheduleUpdate(0, "Versioned defaults restored.");
    });
    byId<HTMLButtonElement>("compute").addEventListener("click", () => scheduleUpdate(0, "Update requested."));
    byId<HTMLSelectElement>("product").addEventListener("change", (event) => {
      draftScenario = scenarioWithProduct(draftScenario, (event.target as HTMLSelectElement).value as ProductId);
      syncControls(draftScenario);
      scheduleUpdate(0, "Candidate changed.");
    });
    byId<HTMLSelectElement>("probe").addEventListener("change", (event) => {
      const id = (event.target as HTMLSelectElement).value as SettingId;
      draftScenario = scenarioWithSetting(draftScenario, id);
      syncControls(draftScenario);
      scheduleUpdate(0, "Inspection probe changed.");
    });
    byId<HTMLSelectElement>("scope").addEventListener("change", (event) => {
      const id = (event.target as HTMLSelectElement).value;
      if (id !== "custom") draftScenario = scenarioWithDecisionScope(draftScenario, id as AnchorSettingId);
      syncScopeVisibility(id);
      if (id !== "custom") syncScopeControls(draftScenario.envelope);
      scheduleUpdate(0, "Decision scope changed.");
    });
    document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-model-control]").forEach((input) => {
      const eventName = input instanceof HTMLInputElement && input.type === "range" ? "input" : "change";
      input.addEventListener(eventName, () => {
        updateReadouts();
        scheduleUpdate(AUTO_UPDATE_DELAY_MS, "Scientific controls changed.");
      });
    });
    byId<HTMLButtonElement>("use-design").addEventListener("click", () => {
      if (!committedOutputs || !view.persistentDesignKey) return;
      const point = designPointByKey(committedOutputs, view.persistentDesignKey);
      if (!point) return;
      draftScenario = scenarioWithProduct(draftScenario, "hypothetical");
      draftScenario.vaccine = { ...draftScenario.vaccine, takeContext: point.takeContext, mu0: point.mu0 };
      syncControls(draftScenario);
      scheduleUpdate(0, "Selected grid design promoted to the scientific scenario.");
    });
  }

  function bindChartInteractions(): void {
    for (const id of ["effect-map", "product-map"]) {
      const container = byId<HTMLElement>(id);
      container.addEventListener("pointerover", (event) => {
        const mark = (event.target as Element).closest<SVGElement>("[data-design-key]");
        if (!mark || !container.contains(mark)) return;
        view.inspectedDesignKey = mark.dataset.designKey ?? null;
        renderLinkedInspection();
      });
      container.addEventListener("pointerleave", () => {
        view.inspectedDesignKey = null;
        renderLinkedInspection();
      });
      container.addEventListener("click", (event) => {
        const mark = (event.target as Element).closest<SVGElement>("[data-design-key]");
        if (!mark || !container.contains(mark)) return;
        view.persistentDesignKey = mark.dataset.designKey ?? null;
        view.inspectedDesignKey = view.persistentDesignKey;
        renderLinkedInspection();
      });
      container.addEventListener("keydown", (event) => handleDesignKeydown(event as KeyboardEvent));
    }
    const surface = byId<HTMLElement>("setting-map");
    surface.addEventListener("pointerover", (event) => {
      const cell = (event.target as Element).closest<SVGElement>("[data-surface-column]");
      if (!cell || !surface.contains(cell)) return;
      view.surfaceColumn = Number(cell.dataset.surfaceColumn ?? view.surfaceColumn);
      view.surfaceRow = Number(cell.dataset.surfaceRow ?? view.surfaceRow);
      renderSurfaceOnly();
    });
    surface.addEventListener("keydown", (event) => {
      if (!committedOutputs) return;
      const key = (event as KeyboardEvent).key;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(key)) return;
      event.preventDefault();
      if (key === "ArrowLeft") view.surfaceColumn = Math.max(0, view.surfaceColumn - 1);
      if (key === "ArrowRight") view.surfaceColumn = Math.min(80, view.surfaceColumn + 1);
      if (key === "ArrowUp") view.surfaceRow = Math.min(19, view.surfaceRow + 1);
      if (key === "ArrowDown") view.surfaceRow = Math.max(0, view.surfaceRow - 1);
      if (key === "Home") view.surfaceColumn = 0;
      if (key === "End") view.surfaceColumn = 80;
      renderSurfaceOnly();
      document.querySelector<SVGSVGElement>("#setting-figure")?.focus();
    });
  }

  function bindExports(): void {
    document.querySelectorAll<HTMLButtonElement>("[data-export]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!committedOutputs || button.disabled) return;
        try {
          exportOutput(button.dataset.export ?? "json", committedOutputs, view);
          byId<HTMLElement>("export-status").textContent = `${button.textContent ?? "Export"} prepared from committed model ${shortIdentity(committedOutputs.modelIdentity)}.`;
        } catch (error) {
          byId<HTMLElement>("export-status").textContent = `Export failed: ${errorMessage(error)}`;
        }
      });
    });
    byId<HTMLButtonElement>("share").addEventListener("click", async () => {
      if (!committedOutputs) return;
      const url = window.location.href;
      try {
        await navigator.clipboard.writeText(url);
        byId<HTMLElement>("export-status").textContent = "Canonical scenario link copied.";
      } catch {
        byId<HTMLElement>("export-status").textContent = `Canonical scenario link is ready in the address bar: ${url}`;
      }
    });
  }

  function bindGlobalKeys(): void {
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      view.inspectedDesignKey = null;
      view.persistentDesignKey = null;
      const advanced = byId<HTMLDetailsElement>("advanced-controls");
      advanced.open = false;
      view.drawerOpen = false;
      renderLinkedInspection();
    });
  }

  function handleDesignKeydown(event: KeyboardEvent): void {
    if (!committedOutputs) return;
    if (event.key === "Enter" || event.key === " ") {
      if (view.inspectedDesignKey) {
        event.preventDefault();
        view.persistentDesignKey = view.inspectedDesignKey;
        renderLinkedInspection();
      }
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const frontier = committedOutputs.frontier;
    const current = designPointByKey(committedOutputs, view.inspectedDesignKey)
      ?? frontier.nearestGridPoint
      ?? frontier.points[0]!;
    let takeIndex = frontier.takeValues.indexOf(current.takeContext);
    let boostIndex = frontier.mu0Values.indexOf(current.mu0);
    if (event.key === "ArrowLeft") takeIndex = Math.max(0, takeIndex - 1);
    if (event.key === "ArrowRight") takeIndex = Math.min(frontier.takeValues.length - 1, takeIndex + 1);
    if (event.key === "ArrowDown") boostIndex = Math.max(0, boostIndex - 1);
    if (event.key === "ArrowUp") boostIndex = Math.min(frontier.mu0Values.length - 1, boostIndex + 1);
    if (event.key === "Home") { takeIndex = 0; boostIndex = 0; }
    if (event.key === "End") { takeIndex = frontier.takeValues.length - 1; boostIndex = frontier.mu0Values.length - 1; }
    const point = frontier.points.find((candidate) => candidate.takeContext === frontier.takeValues[takeIndex] && candidate.mu0 === frontier.mu0Values[boostIndex]);
    view.inspectedDesignKey = point ? designKey(point) : null;
    renderLinkedInspection();
  }

  function scheduleUpdate(delay: number, message: string): void {
    if (updateTimer !== undefined) window.clearTimeout(updateTimer);
    markStale(message);
    updateTimer = window.setTimeout(() => {
      updateTimer = undefined;
      try {
        draftScenario = readControls(draftScenario);
      } catch (error) {
        renderInvalid(error);
        return;
      }
      run(draftScenario);
    }, Math.max(delay, MIN_STALE_DISPLAY_MS));
  }

  function run(nextScenario: ScenarioV1, notice?: string): void {
    const start = performance.now();
    byId<HTMLElement>("compute-status").textContent = "Evaluating deterministic model…";
    try {
      const outputs = evaluateScenario(structuredClone(nextScenario));
      draftScenario = structuredClone(outputs.scenario);
      committedOutputs = outputs;
      window.location.hash = `scenario=${encodeScenario(outputs.scenario)}`;
      renderCommitted(outputs);
      hideWarning();
      if (notice) showWarning(notice, "notice");
      byId<HTMLElement>("compute-status").textContent = `Committed in ${Math.round(performance.now() - start)} ms`;
    } catch (error) {
      renderInvalid(error);
    }
  }

  function renderCommitted(outputs: ModelOutputsV1): void {
    const presentation = buildPresentation(outputs);
    const result = byId<HTMLElement>("result-status");
    result.className = `result-status ${presentation.result.branch}`;
    result.dataset.modelIdentity = outputs.modelIdentity;
    delete result.dataset.stale;
    result.innerHTML = `<p class="result-label">${escapeHtml(presentation.result.statusLabel)} · ${escapeHtml(presentation.result.scopeShortLabel)}</p>
      <h2>${escapeHtml(presentation.result.headline)}</h2>
      <p class="result-number"><span>Direct R<sub>loc</sub></span><strong>${formatNumber(presentation.result.value)}</strong><span>${escapeHtml(presentation.result.criterion)}</span></p>
      <p class="qualification">${escapeHtml(presentation.result.qualification)}</p>`;
    byId<HTMLElement>("candidate-summary").innerHTML = `<strong>${escapeHtml(presentation.candidate.label)}</strong><span>${escapeHtml(presentation.candidate.schedule)} · assessed ${escapeHtml(presentation.candidate.assessment)}</span>`;
    byId<HTMLElement>("scope-summary").innerHTML = `<span>Decision scope</span><strong>${escapeHtml(presentation.result.scopeLabel)}</strong>`;
    byId<HTMLElement>("probe-summary").innerHTML = `<span>Inspection probe</span><strong>${escapeHtml(presentation.probe.label)} · R<sub>loc</sub> ${presentation.probe.value === null ? "—" : formatNumber(presentation.probe.value)}</strong>`;
    byId<HTMLElement>("setting-map").innerHTML = renderSettingSurface(outputs, view);
    byId<HTMLElement>("effect-map").innerHTML = renderEffectMap(outputs, view);
    byId<HTMLElement>("product-map").innerHTML = renderProductMap(outputs, view);
    byId<HTMLElement>("within-host-chart").innerHTML = renderWithinHostTeaching(outputs);
    byId<HTMLElement>("immunity-distribution").innerHTML = renderImmunityDistribution(outputs);
    byId<HTMLElement>("frontier-summary").innerHTML = `<strong>${escapeHtml(presentation.frontier.message)}</strong><span>The two maps are alternate coordinates for the same ${outputs.frontier.points.length.toLocaleString("en-US")} direct evaluations.</span>`;
    renderMechanism(outputs);
    renderWithinHostReadout(outputs);
    renderAssumptions(outputs);
    renderLinkedInspection();
    setExportAvailability(true);
    byId<HTMLElement>("export-status").textContent = `Exports are ready for committed model ${shortIdentity(outputs.modelIdentity)}.`;
    byId<HTMLElement>("transaction-status").className = "transaction-status committed";
    byId<HTMLElement>("transaction-status").textContent = `Current result committed. ${presentation.result.statusLabel}: direct R_loc ${formatNumber(presentation.result.value)}.`;
    byId<HTMLElement>("story-results").classList.remove("is-stale");
  }

  function renderMechanism(outputs: ModelOutputsV1): void {
    const metrics = outputs.metrics;
    byId<HTMLElement>("mechanism-values").innerHTML = `<article><span>1 · acquisition</span><strong>${formatPercent(1 - metrics.qAcq)} reduction</strong><p>Residual acquisition multiplier q<sub>acq</sub> = ${formatNumber(metrics.qAcq)}.</p></article>
      <article><span>2 · breakthrough shedding</span><strong>${formatPercent(1 - metrics.qShed)} reduction</strong><p>Conditional infectious-shedding multiplier q<sub>shed</sub> = ${formatNumber(metrics.qShed)}.</p></article>
      <article class="diagnostic"><span>3 · diagnostic index</span><strong>q<sub>index</sub> = ${formatNumber(metrics.qIndex)}</strong><p>q<sub>acq</sub> × q<sub>shed</sub>; useful for reading, not the decision rule.</p></article>
      <article class="authoritative"><span>4 · direct motif result</span><strong>R<sub>loc</sub> = ${formatNumber(metrics.rLocEnvelopeMax)}</strong><p>Distribution-native propagation over the declared decision scope.</p></article>`;
  }

  function renderWithinHostReadout(outputs: ModelOutputsV1): void {
    const diagnostics = outputs.diagnostics;
    byId<HTMLElement>("within-host-readout").innerHTML = `<article><span>Reference challenge</span><strong>${formatNumber(diagnostics.referenceChallengeDoseCID50)} CID50</strong><p>One WPV HID50 under the fixed WPV dose-response convention; this is the q-index reference, not a vaccine dose.</p></article>
      <article><span>WPV acquisition</span><strong>${formatPercent(diagnostics.vaccinated.acquisitionAtReference)}</strong><p>Selected cohort at the reference challenge, versus ${formatPercent(diagnostics.reference.acquisitionAtReference)} for the naive reference.</p></article>
      <article><span>Integrated burden</span><strong>${formatNumber(diagnostics.vaccinated.integratedConditionalBurdenTCID50DaysPerGram)} TCID50·days/g</strong><p>Conditioned on WPV acquisition and summed over the committed 120-day diagnostic grid.</p></article>
      <article class="diagnostic"><span>Relative shedding index</span><strong>q<sub>index</sub> = ${formatNumber(diagnostics.qIndex)}</strong><p>q<sub>acq</sub> × q<sub>shed</sub> at one WPV HID50. It is a reading aid, not the decision rule.</p></article>`;
    byId<HTMLElement>("product-pathway-summary").innerHTML = `<strong>${escapeHtml(outputs.scenario.vaccine.label)}</strong><span>${escapeHtml(outputs.scenario.schedule.routineDays.map((day) => `day ${day}`).join(", "))}${outputs.scenario.schedule.boosterAgeYears > 0 ? ` + booster at year ${outputs.scenario.schedule.boosterAgeYears}` : "; no booster"} · assessed ${outputs.scenario.schedule.assessmentLagDays} days after the last scheduled dose.</span>`;
  }

  function renderAssumptions(outputs: ModelOutputsV1): void {
    byId<HTMLElement>("assumptions-list").innerHTML = outputs.assumptions.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    byId<HTMLElement>("uncertainty-note").innerHTML = `<strong>Evidence gap:</strong> ${escapeHtml(outputs.uncertainty.reason)}`;
    byId<HTMLElement>("provenance-summary").textContent = `Model ${shortIdentity(outputs.modelIdentity)} · ${outputs.provenance && typeof outputs.provenance === "object" ? "committed source snapshots and deterministic transforms" : "provenance unavailable"}.`;
  }

  function renderLinkedInspection(): void {
    if (!committedOutputs) return;
    document.querySelectorAll<SVGElement>("[data-design-key]").forEach((mark) => {
      mark.classList.toggle("is-inspected", mark.dataset.designKey === view.inspectedDesignKey);
      mark.classList.toggle("is-persistent", mark.dataset.designKey === view.persistentDesignKey);
    });
    const key = view.inspectedDesignKey ?? view.persistentDesignKey;
    const point = designPointByKey(committedOutputs, key);
    const inspector = byId<HTMLElement>("design-inspector");
    const button = byId<HTMLButtonElement>("use-design");
    if (!point) {
      inspector.innerHTML = `<p><strong>Inspect a design.</strong> Hover, tap, or focus either map. Click or press Enter to hold a selection.</p>`;
      button.disabled = true;
      button.hidden = true;
      return;
    }
    inspector.innerHTML = `<p class="inspector-label">${key === view.persistentDesignKey ? "Held design" : "Inspection"}</p><dl>
      <div><dt>Take context</dt><dd>${point.takeContext.toFixed(2)}</dd></div><div><dt>Mean boost</dt><dd>${point.mu0.toFixed(2)} log2</dd></div>
      <div><dt>Acquisition reduction</dt><dd>${formatPercent(1 - point.qAcq)}</dd></div><div><dt>Shedding reduction</dt><dd>${formatPercent(1 - point.qShed)}</dd></div>
      <div><dt>Direct R<sub>loc</sub></dt><dd>${formatNumber(point.rLocEnvelopeMax)}</dd></div><div><dt>Criterion</dt><dd>${point.passes ? "meets" : "does not meet"}</dd></div></dl>`;
    button.hidden = view.persistentDesignKey === null;
    const alreadySelected = committedOutputs.scenario.vaccine.id === "hypothetical"
      && committedOutputs.scenario.vaccine.takeContext === point.takeContext
      && committedOutputs.scenario.vaccine.mu0 === point.mu0;
    button.disabled = view.persistentDesignKey === null || alreadySelected;
    button.textContent = alreadySelected ? "Current scientific design" : "Use this design";
  }

  function renderSurfaceOnly(): void {
    if (!committedOutputs) return;
    byId<HTMLElement>("setting-map").innerHTML = renderSettingSurface(committedOutputs, view);
  }

  function markStale(message: string): void {
    setExportAvailability(false);
    byId<HTMLElement>("export-status").textContent = "Exports are unavailable while controls differ from the committed result.";
    byId<HTMLElement>("compute-status").textContent = "Change pending…";
    const transaction = byId<HTMLElement>("transaction-status");
    transaction.className = "transaction-status stale";
    transaction.textContent = committedOutputs
      ? `${message} The prior committed result remains visible but is stale until evaluation succeeds.`
      : `${message} No result is committed yet.`;
    if (committedOutputs) {
      byId<HTMLElement>("story-results").classList.add("is-stale");
      const result = byId<HTMLElement>("result-status");
      result.dataset.stale = "true";
    }
  }

  function renderInvalid(error: unknown): void {
    setExportAvailability(false);
    const message = errorMessage(error);
    showWarning(message, "error");
    byId<HTMLElement>("compute-status").textContent = "Invalid scientific state; prior commit retained.";
    const transaction = byId<HTMLElement>("transaction-status");
    transaction.className = "transaction-status invalid";
    transaction.textContent = committedOutputs
      ? "The edited state is invalid. The visible result is the prior commit and cannot be exported as the current controls."
      : "The edited state is invalid. No result is committed.";
    if (committedOutputs) byId<HTMLElement>("story-results").classList.add("is-stale");
  }

  function setExportAvailability(available: boolean): void {
    document.querySelectorAll<HTMLButtonElement>("[data-export], #share").forEach((button) => { button.disabled = !available; });
  }
}

function shell(): string {
  const productOptions = Object.entries(PRODUCT_LABELS).map(([id, label]) => `<option value="${id}">${escapeHtml(label)}</option>`).join("");
  const settingOptions = ([...SETTING_ANCHORS.map((anchor) => [anchor.id, anchor.label] as [string, string]), ["custom", "Custom inspection probe"]] as Array<[string, string]>)
    .map(([id, label]) => `<option value="${id}">${escapeHtml(label)}</option>`).join("");
  const scopeOptions = ([...SETTING_ANCHORS.map((anchor) => [anchor.id, `${anchor.label} singleton`] as [string, string]), ["custom", "Custom rectangular scope"]] as Array<[string, string]>)
    .map(([id, label]) => `<option value="${id}">${escapeHtml(label)}</option>`).join("");
  return `<a class="skip-link" href="#within-host">Skip to model</a>
  <header class="site-header"><a class="wordmark" href="#top" aria-label="Polio vaccine target product profile explorer home">TPP / WPV1</a><nav aria-label="Narrative chapters"><a href="#within-host">Model</a><a href="#product-pathway">Product</a><a href="#transmission">Transmission</a><a href="#decision">Decision</a><a href="#measurement">Measurement</a></nav></header>
  <main id="top" class="app-shell">
    <header class="hero">
      <p class="eyebrow">WPV1 · close-contact sufficiency model · contract ${PARAMETERS.designContractVersion}</p>
      <h1>Under what conditions can a vaccine block close-contact transmission?</h1>
      <p class="lede">Begin with a child exposed to WPV in the UP/Bihar reference setting. Follow the model from schedule-derived immunity, through acquisition and shedding, into a close-contact transmission motif—then ask what product properties clear that stress test.</p>
      <aside class="prototype-banner" role="note"><strong>Scientific prototype · point rule</strong><span>This is a deterministic close-contact sufficiency screen under the v1 axiom—not a complete-population R<sub>e</sub>, outbreak forecast, or probability of product success.</span></aside>
    </header>

    <section id="within-host" class="chapter teaching-chapter" aria-labelledby="within-host-heading">
      <div class="chapter-heading"><p class="chapter-number">01 / WPV exposure</p><div><h2 id="within-host-heading">First, separate acquisition from what happens after breakthrough.</h2><p>UP/Bihar is the fixed teaching reference for the transmission setting, not a different WPV biology. The curves below compare a naive reference cohort with the selected vaccine schedule at the same assessment age.</p></div></div>
      <figure class="hero-figure"><div id="within-host-chart" class="chart-slot" aria-live="off"></div><figcaption><strong>Read each conditioning statement literally.</strong> Acquisition depends on WPV challenge dose. The next three panels condition on acquisition; daily burden is survival multiplied by concentration conditional on still shedding. This preserves the joint expectation rather than averaging an "average child."</figcaption></figure>
      <div id="within-host-readout" class="mechanism-values teaching-readout"></div>
    </section>

    <section id="product-pathway" class="chapter" aria-labelledby="product-pathway-heading">
      <div class="chapter-heading"><p class="chapter-number">02 / Schedule to cohort</p><div><h2 id="product-pathway-heading">A received live-vaccine dose may take, boost mucosal immunity, and then wane.</h2><p>Every routine dose is received in v1. Biological take is productive live-vaccine infection after receipt; it is not receipt, coverage, or direct protection against a WPV dose. Repeated take/no-take branches produce the cohort distribution shown here.</p></div></div>
      <div class="pathway" role="img" aria-label="Received dose, biological take or no take, mucosal boost, waning, and the cohort immunity distribution before WPV exposure"><article><span>Received dose</span><strong>Schedule event</strong><p>Routine doses at 6, 10, and 14 weeks, plus an optional booster.</p></article><i aria-hidden="true">→</i><article><span>Biological split</span><strong>Take / no take</strong><p>Each branch is probability weighted; no dose receipt is missing.</p></article><i aria-hidden="true">→</i><article><span>State transition</span><strong>Boost then wane</strong><p>Take changes mucosal state; time to assessment allows waning.</p></article><i aria-hidden="true">→</i><article><span>WPV challenge</span><strong>Distribution enters model</strong><p>Transmission uses the full state distribution and histories.</p></article></div>
      <p id="product-pathway-summary" class="narrative-summary"></p>
      <figure class="hero-figure narrow-figure"><div id="immunity-distribution" class="chart-slot"></div><figcaption><strong>This is a marginal view, not the calculation's state reduction.</strong> The model retains conditioned take/no-take history and uses each group's dose response and shedding kernel directly.</figcaption></figure>
      <form class="narrative-controls" aria-labelledby="product-controls-heading" onsubmit="return false"><div class="controls-title"><div><p class="eyebrow">Product and schedule</p><h3 id="product-controls-heading">Now choose the schedule whose cohort you want to inspect.</h3></div><button id="reset" type="button" class="text-button">Reset defaults</button></div><div class="control-row"><label>Candidate product<select id="product">${productOptions}</select><small>Fixed catalog products remain fixed; hypothetical OPV-like designs expose their assumptions below.</small></label><label>Booster<select id="booster" data-model-control><option value="0">No booster</option><option value="1">At 1 year</option><option value="2">At 2 years</option><option value="3">At 3 years</option><option value="4">At 4 years</option></select></label><label>Assessment after last dose<select id="lag" data-model-control><option value="28">28 days</option><option value="90">90 days</option></select></label></div><p id="state-warning" class="warning" hidden></p><div class="control-actions"><button id="compute" class="primary" type="button">Update the model</button><span id="compute-status" role="status" aria-live="polite"></span></div></form>
    </section>

    <section id="transmission" class="chapter" aria-labelledby="mechanism-heading">
      <div class="chapter-heading"><p class="chapter-number">03 / Close-contact transmission</p><div><h2 id="mechanism-heading">Then put breakthrough shedding into one declared transmission motif.</h2><p>The model propagates a breakthrough index child to a household child, then to close social contacts. Its endpoint is the expected tertiary infections, R<sub>loc</sub>, for that motif—not a calculated complete-population R<sub>e</sub>.</p></div></div>
      <div class="motif" role="img" aria-label="Index child transmits to a household child, who connects to close social contacts">
        <article><span>01</span><strong>Index child</strong><p>Breakthrough infection and infectious shedding after the selected schedule.</p></article><i aria-hidden="true">→</i><article><span>02</span><strong>Household child</strong><p>Acquisition is propagated through the full modeled immunity distribution.</p></article><i aria-hidden="true">→</i><article><span>03</span><strong>Close social contacts</strong><p>N<sub>s</sub> family-like child contacts extend the local motif.</p></article>
      </div>
      <div id="mechanism-values" class="mechanism-values"></div>
      <aside class="meaning-note"><strong>The decision step</strong><p>If the direct motif result is below one at the declared setting scope, the v1 sufficiency axiom treats that as a demanding local stress test. q<sub>index</sub> helps read the within-host effects but cannot replace the distribution-native motif calculation.</p></aside>
    </section>

    <section id="decision" class="chapter surface-chapter" aria-labelledby="decision-heading">
      <div class="chapter-heading"><p class="chapter-number">04 / Setting and decision</p><div><h2 id="decision-heading">Only now ask whether the selected product clears the reference stress test.</h2><p>The default point rule is evaluated directly at the UP/Bihar high anchor, the hardest known empirical/model-calibrated setting in the catalog. Clearing it supports likely adequacy under less demanding modeled conditions; it does not prove control everywhere.</p></div></div>
      <div id="story-results"><div id="result-status" class="result-status pending" aria-live="polite"><p class="result-label">Evaluating</p><h2>Calculating the versioned default…</h2></div><div class="opening-meta"><p id="candidate-summary"></p><p id="scope-summary"></p><p id="probe-summary"></p></div></div>
      <form class="narrative-controls setting-controls" aria-labelledby="setting-controls-heading" onsubmit="return false"><div class="controls-title"><div><p class="eyebrow">Setting semantics</p><h3 id="setting-controls-heading">Keep the decision scope separate from an inspection probe.</h3></div></div><div class="control-row"><label>Inspection probe<select id="probe">${settingOptions}</select><small>Changes the independent readout and its ring on the figure, not the decision result or model identity.</small></label><label>Decision scope<select id="scope">${scopeOptions}</select><small>Directly determines the reported maximum R<sub>loc</sub>.</small></label></div></form>
      <figure class="hero-figure"><div id="setting-map" class="chart-slot" aria-live="off"></div><figcaption><strong>Read from blue through white to red.</strong> White is R<sub>loc</sub> = 1. The diamond is the decision anchor; the ring is the independent inspection probe. The dashed path marks threshold crossings between directly evaluated display cells; it is not the decision calculation. Arrow keys traverse all 81 × 20 display cells.</figcaption></figure>
      <p id="transaction-status" class="transaction-status" role="status" aria-live="polite"></p>
    </section>

    <section id="measurement" class="chapter" aria-labelledby="measurement-heading">
      <div class="chapter-heading"><p class="chapter-number">05 / Measurement handshake</p><div><h2 id="measurement-heading">What the quantities mean—and what they do not measure.</h2><p>The table connects product assumptions, field setting anchors, inherited model structure, and derived results before returning to the design space.</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Quantity</th><th>Scientific role</th><th>Measurement interpretation</th><th>Status in v1</th></tr></thead><tbody>
        <tr><th scope="row">Biological take context</th><td>Product property</td><td>Productive live-vaccine infection after a received dose; not receipt or coverage.</td><td>Scenario input</td></tr>
        <tr><th scope="row">Mean mucosal boost, μ<sub>0</sub></th><td>Product property</td><td>Latent OPV-equivalent mucosal immunity shift; not measured serum titer.</td><td>Scenario input</td></tr>
        <tr><th scope="row">Exposure, T<sub>ih</sub> / T<sub>hs</sub></th><td>Setting pressure</td><td>Stool-equivalent mass transferred per exposure, converted at the UI boundary.</td><td>Named anchor or custom input</td></tr>
        <tr><th scope="row">Contact frequency and N<sub>s</sub></th><td>Motif structure</td><td>Exposures per person-day and family-like close social contacts.</td><td>Calibrated, inherited, or declared</td></tr>
        <tr><th scope="row">q<sub>acq</sub>, q<sub>shed</sub></th><td>Modeled effects</td><td>Residual acquisition and conditional infectious-shedding multipliers.</td><td>Derived from distributions</td></tr>
        <tr><th scope="row">R<sub>loc</sub></th><td>Decision result</td><td>Expected tertiary infections in the v1 close-contact motif.</td><td>Direct derived output</td></tr>
        <tr><th scope="row">Parameter uncertainty</th><td>Decision uncertainty</td><td>Threshold-crossing uncertainty would require a released ensemble.</td><td>Evidence gap in this version</td></tr>
      </tbody></table></div>
    </section>

    <section id="design-space" class="chapter" aria-labelledby="design-heading">
      <div class="chapter-heading"><p class="chapter-number">06 / From requirement to product</p><div><h2 id="design-heading">The same evaluated products can be read in outcome space or product space.</h2><p>Outcome space shows the acquisition-blocking and breakthrough-shedding reductions achieved by each evaluated product. Product space shows the biological take context and latent mucosal boost assumptions that generated them. Neither outcome axis is an independently tunable specification.</p></div></div>
      <div id="frontier-summary" class="frontier-summary"></div>
      <div class="linked-maps"><figure><div id="effect-map" class="chart-slot"></div><figcaption><strong>Outcome requirement space.</strong> The russet path is the minimum-sufficient Pareto boundary when one exists. It summarizes evaluated combinations, not a new biological endpoint.</figcaption></figure><figure><div id="product-map" class="chart-slot"></div><figcaption><strong>Product-assumption space.</strong> Take is productive biological infection after a received live dose. Mean boost is latent OPV-equivalent mucosal immunity, not serum titer.</figcaption></figure></div>
      <div class="design-inspection"><div id="design-inspector"><p><strong>Inspect a design.</strong> Hover, tap, or focus either map. Click or press Enter to hold a selection.</p></div><button id="use-design" type="button" class="primary" hidden disabled>Use this design</button></div>
    </section>

    <section class="chapter controls-and-provenance" aria-labelledby="advanced-heading">
      <details id="advanced-controls"><summary><span>Advanced scientific controls</span><small>Hypothetical product, custom probe, decision-scope bounds, and fixed v1 assumptions</small></summary>
        <div class="advanced-body">
          <fieldset id="hypothetical-controls"><legend>Hypothetical OPV-like product</legend><div class="advanced-grid">
            <label>Biological take <output id="take-output">0.80</output><input id="take" data-model-control type="range" min="0" max="1" step="0.01"><small id="take-help"></small></label>
            <label>Latent mean mucosal boost <output id="mu-output">4.0 log2</output><input id="mu" data-model-control type="range" min="0" max="8" step="0.1"><small id="mu-help"></small></label>
            <label>Vaccine α<input id="alpha" data-model-control type="number" min="0.001" max="5" step="0.001"></label>
            <label>Vaccine β (CID50)<input id="beta" data-model-control type="number" min="0.001" max="1000000" step="0.1"></label>
            <label>Administered dose (log10 TCID50)<input id="dose-log" data-model-control type="number" min="0" max="9" step="0.01"></label>
          </div></fieldset>
          <p id="catalog-product-note" class="catalog-note" hidden></p>
          <fieldset id="custom-probe-controls" hidden><legend>Custom inspection probe</legend><div class="advanced-grid">
            <label>T<sub>ih</sub> (µg/exposure)<input id="custom-tih" data-model-control type="number" min="0" max="1000000" step="0.1"></label><label>T<sub>hs</sub> (µg/exposure)<input id="custom-ths" data-model-control type="number" min="0" max="1000000" step="0.1"></label>
            <label>d<sub>ih</sub> (exposures/person/day)<input id="custom-dih" data-model-control type="number" min="0" max="1000" step="0.01"></label><label>d<sub>hs</sub> (exposures/person/day)<input id="custom-dhs" data-model-control type="number" min="0" max="1000" step="0.01"></label><label>N<sub>s</sub><input id="custom-ns" data-model-control type="number" min="0" max="1000" step="1"></label>
          </div></fieldset>
          <fieldset id="custom-scope-controls" hidden><legend>Custom rectangular decision scope</legend><p>All corners are evaluated directly. The fixed setting surface remains a nonbinding display domain.</p><div class="advanced-grid">
            <label>Linked T minimum (µg/exposure)<input id="scope-t-min" data-model-control type="number" min="0.000001" max="1000000" step="0.1"></label><label>Linked T maximum (µg/exposure)<input id="scope-t-max" data-model-control type="number" min="0.000001" max="1000000" step="1"></label>
            <label>N<sub>s</sub> minimum<input id="scope-ns-min" data-model-control type="number" min="0" max="1000" step="1"></label><label>N<sub>s</sub> maximum<input id="scope-ns-max" data-model-control type="number" min="0" max="1000" step="1"></label>
            <label>d<sub>ih</sub> minimum<input id="scope-dih-min" data-model-control type="number" min="0" max="1000" step="0.01"></label><label>d<sub>ih</sub> maximum<input id="scope-dih-max" data-model-control type="number" min="0" max="1000" step="0.01"></label>
            <label>d<sub>hs</sub> minimum<input id="scope-dhs-min" data-model-control type="number" min="0" max="1000" step="0.01"></label><label>d<sub>hs</sub> maximum<input id="scope-dhs-max" data-model-control type="number" min="0" max="1000" step="0.01"></label>
          </div></fieldset>
          <fieldset><legend>Fixed v1 assumptions</legend><dl class="fixed-values"><div><dt>Success rule</dt><dd>Direct R<sub>loc</sub> &lt; 1</dd></div><div><dt>Boost σ</dt><dd id="fixed-sigma"></dd></div><div><dt>γ</dt><dd id="fixed-gamma"></dd></div><div><dt>Episode horizon</dt><dd id="fixed-horizon"></dd></div><div><dt>Index reference exposure</dt><dd id="fixed-index-reference"></dd></div></dl></fieldset>
        </div>
      </details>
    </section>

    <section id="assumptions" class="chapter closing" aria-labelledby="assumptions-heading">
      <div class="chapter-heading"><p class="chapter-number">07 / Assumptions and provenance</p><div><h2 id="assumptions-heading">The result is only as broad as its declared model.</h2><p id="provenance-summary"></p></div></div>
      <ul id="assumptions-list" class="assumptions-list"></ul><p id="uncertainty-note" class="uncertainty-note"></p>
      <div class="exports"><h3>Export the committed result</h3><p>Scientific changes disable export until a new result commits. JSON contains the versioned teaching diagnostics; SVGs carry the selected product, schedule, scope, criterion, qualification, and figure-specific conditioning.</p><div class="export-actions"><button data-export="json" type="button">JSON</button><button data-export="csv" type="button">CSV grids</button><button data-export="within-host-svg" type="button">Within-host SVG</button><button data-export="setting-svg" type="button">Setting SVG</button><button data-export="effect-svg" type="button">Requirement SVG</button><button data-export="product-svg" type="button">Product SVG</button><button id="share" type="button">Share link</button></div><p id="export-status" role="status" aria-live="polite">Exports are unavailable until evaluation completes.</p></div>
    </section>
  </main>
  <footer class="site-footer"><p>Prototype ${APP_VERSION} · contract ${PARAMETERS.designContractVersion} · parameters ${PARAMETERS.manifestVersion} · settings ${SETTING_MANIFEST_VERSION} · build ${BUILD_IDENTITY}</p><p>No runtime network dependency or random sampling. <a href="https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.2002468">Source paper</a> · <a href="https://github.com/famulare/cessationStability">cessationStability</a> · <a href="https://github.com/famulare/india-polio">india-polio</a></p></footer>`;
}

function scenarioFromHash(): { scenario: ScenarioV1; error?: string } {
  const encoded = window.location.hash.startsWith("#scenario=") ? window.location.hash.slice("#scenario=".length) : "";
  if (!encoded) return { scenario: defaultScenario() };
  try { return { scenario: decodeScenario(encoded) }; }
  catch (error) { return { scenario: defaultScenario(), error: errorMessage(error) }; }
}

function syncControls(scenario: ScenarioV1): void {
  setValue("product", scenario.vaccine.id);
  setValue("probe", scenario.setting.id);
  setValue("scope", describeDecisionScope(scenario.envelope).id);
  setValue("booster", scenario.schedule.boosterAgeYears);
  setValue("lag", scenario.schedule.assessmentLagDays);
  setValue("take", scenario.vaccine.takeContext);
  setValue("mu", scenario.vaccine.mu0);
  setValue("alpha", scenario.vaccine.alpha);
  setValue("beta", scenario.vaccine.beta);
  setValue("dose-log", Math.log10(Math.max(scenario.vaccine.dose, 1)));
  setValue("custom-tih", microgramsFromGrams(scenario.setting.Tih.value));
  setValue("custom-ths", microgramsFromGrams(scenario.setting.Ths.value));
  setValue("custom-dih", scenario.setting.dIh.value);
  setValue("custom-dhs", scenario.setting.dHs.value);
  setValue("custom-ns", scenario.setting.Ns);
  syncScopeControls(scenario.envelope);
  byId<HTMLElement>("fixed-gamma").textContent = scenario.vaccine.gamma.toFixed(4);
  byId<HTMLElement>("fixed-sigma").textContent = `${scenario.vaccine.sigma0.toFixed(1)} log2`;
  byId<HTMLElement>("fixed-horizon").textContent = `${scenario.horizonDays} days`;
  byId<HTMLElement>("fixed-index-reference").textContent = scenario.indexReferenceExposure.toFixed(4);
  syncProductEditability(scenario.vaccine.id);
  syncProbeVisibility(scenario.setting.id);
  syncScopeVisibility(describeDecisionScope(scenario.envelope).id);
  updateReadouts();
}

function syncScopeControls(envelope: EnvelopeV1): void {
  setValue("scope-t-min", microgramsFromGrams(envelope.TihMin));
  setValue("scope-t-max", microgramsFromGrams(envelope.TihMax));
  setValue("scope-ns-min", envelope.NsMin);
  setValue("scope-ns-max", envelope.NsMax);
  setValue("scope-dih-min", envelope.dIhMin);
  setValue("scope-dih-max", envelope.dIhMax);
  setValue("scope-dhs-min", envelope.dHsMin);
  setValue("scope-dhs-max", envelope.dHsMax);
}

function readControls(previous: ScenarioV1): ScenarioV1 {
  const productId = byId<HTMLSelectElement>("product").value as ProductId;
  let scenario = productId === previous.vaccine.id ? structuredClone(previous) : scenarioWithProduct(previous, productId);
  const probeId = byId<HTMLSelectElement>("probe").value as SettingId;
  scenario = probeId === "custom"
    ? { ...scenario, setting: { id: "custom", Tih: unitExposure(gramsFromMicrograms(numberValue("custom-tih"))), Ths: unitExposure(gramsFromMicrograms(numberValue("custom-ths"))), dIh: unitFrequency(numberValue("custom-dih")), dHs: unitFrequency(numberValue("custom-dhs")), Ns: numberValue("custom-ns") } }
    : scenarioWithSetting(scenario, probeId);
  scenario.schedule = {
    ...scenario.schedule,
    boosterAgeYears: Number(byId<HTMLSelectElement>("booster").value) as ScenarioV1["schedule"]["boosterAgeYears"],
    assessmentLagDays: Number(byId<HTMLSelectElement>("lag").value) as 28 | 90
  };
  if (scenario.vaccine.id === "hypothetical") {
    scenario.vaccine = { ...scenario.vaccine, takeContext: numberValue("take"), mu0: numberValue("mu"), alpha: numberValue("alpha"), beta: numberValue("beta"), dose: 10 ** numberValue("dose-log") };
  }
  const scopeId = byId<HTMLSelectElement>("scope").value;
  if (scopeId === "custom") {
    const tMin = gramsFromMicrograms(numberValue("scope-t-min"));
    const tMax = gramsFromMicrograms(numberValue("scope-t-max"));
    scenario.envelope = {
      linkedExposure: true,
      TihMin: tMin,
      TihMax: tMax,
      ThsMin: tMin,
      ThsMax: tMax,
      NsMin: numberValue("scope-ns-min"),
      NsMax: numberValue("scope-ns-max"),
      dIhMin: numberValue("scope-dih-min"),
      dIhMax: numberValue("scope-dih-max"),
      dHsMin: numberValue("scope-dhs-min"),
      dHsMax: numberValue("scope-dhs-max")
    };
  } else {
    scenario = scenarioWithDecisionScope(scenario, scopeId as AnchorSettingId);
  }
  return scenario;
}

function syncProductEditability(productId: ProductId): void {
  const editable = productId === "hypothetical";
  const controls = byId<HTMLFieldSetElement>("hypothetical-controls");
  controls.hidden = !editable;
  controls.disabled = !editable;
  const note = byId<HTMLElement>("catalog-product-note");
  note.hidden = editable;
  if (productId === "sabin2") note.textContent = "Sabin 2 is a fixed catalog comparator. Its take and mucosal-boost semantics are evaluated as committed, not exposed as hypothetical sliders.";
  if (productId === "ipv") note.textContent = "IPV is a fixed non-live comparator. It has no live-vaccine take coordinate; its mucosal effect depends on prior live infection and is not a hypothetical OPV-like design.";
  byId<HTMLElement>("take-help").textContent = "Productive live-vaccine infection after receipt; receipt itself is fixed at 100%.";
  byId<HTMLElement>("mu-help").textContent = "Latent OPV-equivalent mucosal immunity; not measured serum titer.";
}

function syncProbeVisibility(id: SettingId): void { byId<HTMLFieldSetElement>("custom-probe-controls").hidden = id !== "custom"; }
function syncScopeVisibility(id: string): void { byId<HTMLFieldSetElement>("custom-scope-controls").hidden = id !== "custom"; }
function updateReadouts(): void {
  byId<HTMLOutputElement>("take-output").value = numberValue("take").toFixed(2);
  byId<HTMLOutputElement>("mu-output").value = `${numberValue("mu").toFixed(1)} log2`;
}

function exportOutput(kind: string, outputs: ModelOutputsV1, view: AppViewState): void {
  const scope = describeDecisionScope(outputs.scenario.envelope);
  if (kind === "json") {
    download("polio-tpp-prototype-model-outputs.json", canonicalJson({
      exportSchemaVersion: JSON_EXPORT_SCHEMA_VERSION,
      prototypeStatus: PROTOTYPE_STATUS,
      buildIdentity: BUILD_IDENTITY,
      exportIdentity: outputs.modelIdentity,
      decisionScope: scope,
      inspectionProbe: outputs.scenario.setting,
      viewState: { persistentDesignKey: view.persistentDesignKey },
      outputs
    }));
    return;
  }
  if (kind === "csv") {
    download("polio-tpp-prototype-evaluated-grids.csv", csvOutputs(outputs), "text/csv");
    return;
  }
  const chart = kind === "within-host-svg" ? "within-host" : kind === "setting-svg" ? "setting" : kind === "effect-svg" ? "effect" : "product";
  download(`polio-tpp-prototype-${chart}.svg`, standaloneSvgExport(chart, outputs, view), "image/svg+xml");
}

function csvOutputs(outputs: ModelOutputsV1): string {
  const scope = csvValue(describeDecisionScope(outputs.scenario.envelope).label);
  const probe = csvValue(outputs.scenario.setting.id);
  const identity = csvValue(outputs.modelIdentity);
  const prefix = [CSV_EXPORT_SCHEMA_VERSION, BUILD_IDENTITY];
  const header = "export_schema_version,build_identity,record_type,product_id,take_context,mu0,Tih_g_per_exposure,Ths_g_per_exposure,dIh_exposures_per_person_day,dHs_exposures_per_person_day,Ns,q_acq,q_shed,r_loc_decision_scope_max,r_loc,meets_direct_r_loc_lt_1,decision_scope,inspection_probe,model_identity";
  const frontier = outputs.frontier.points.map((point) => [...prefix, "frontier", "hypothetical", point.takeContext, point.mu0, "", "", "", "", "", point.qAcq, point.qShed, point.rLocEnvelopeMax, "", point.passes, scope, probe, identity].join(","));
  const comparators = outputs.frontier.comparators.map((point) => [...prefix, "comparator", point.productId, point.takeContext ?? "", point.mu0 ?? "", "", "", "", "", "", point.qAcq, point.qShed, point.rLocEnvelopeMax, "", point.passes, scope, probe, identity].join(","));
  const surface = outputs.settingSurface.map((point) => [...prefix, "surface", outputs.scenario.vaccine.id, "", "", point.Tih, point.Ths, point.dIh, point.dHs, point.Ns, "", "", "", point.rLoc, passesThreshold(point.rLoc), scope, probe, identity].join(","));
  return [header, ...frontier, ...comparators, ...surface].join("\n");
}

function standaloneSvgExport(chart: "within-host" | "setting" | "effect" | "product", outputs: ModelOutputsV1, view: AppViewState): string {
  const id = chart === "within-host" ? "within-host-figure" : chart === "setting" ? "setting-figure" : chart === "effect" ? "effect-figure" : "product-figure";
  const source = document.querySelector<SVGSVGElement>(`#${id}`);
  if (!source) throw new Error(`${chart} figure is not rendered`);
  const viewBox = source.viewBox.baseVal;
  const width = viewBox.width;
  const height = viewBox.height;
  const presentation = buildPresentation(outputs);
  const exactSelection = outputs.frontier.selectedDesign ? `Selected exact candidate: take ${outputs.frontier.selectedDesign.takeContext.toFixed(2)}, boost ${outputs.frontier.selectedDesign.mu0.toFixed(2)} log2.` : "Selected candidate is a fixed comparator.";
  const heldPoint = designPointByKey(outputs, view.persistentDesignKey);
  const heldSelection = heldPoint ? ` Held inspection design: take ${heldPoint.takeContext.toFixed(2)}, boost ${heldPoint.mu0.toFixed(2)} log2.` : " No inspection design is held.";
  const selected = `${exactSelection}${heldSelection}`;
  const diagnosticContext = chart === "within-host"
    ? ` Teaching grid: ${outputs.diagnostics.gridVersion}; challenge unit CID50; shedding curves conditioned on WPV acquisition.`
    : " Direct cell evaluations determine status; Contours are interpolated display context.";
  const metadata = `${PRODUCT_LABELS[outputs.scenario.vaccine.id]}. ${presentation.candidate.schedule}; ${presentation.candidate.assessment}. Decision scope: ${presentation.result.scopeLabel}. Criterion: ${presentation.result.criterion}. ${presentation.result.qualification} ${selected}${diagnosticContext}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + 166}" viewBox="0 0 ${width} ${height + 166}" role="img" aria-labelledby="export-title export-desc" data-export-schema="${SVG_EXPORT_SCHEMA_VERSION}" data-build-identity="${BUILD_IDENTITY}"><title id="export-title">${escapeXml(chart)} figure · scientific prototype</title><desc id="export-desc">${escapeXml(metadata)}</desc><metadata>${escapeXml(JSON.stringify({ exportSchemaVersion: SVG_EXPORT_SCHEMA_VERSION, buildIdentity: BUILD_IDENTITY, modelIdentity: outputs.modelIdentity, chart, diagnosticGridVersion: chart === "within-host" ? outputs.diagnostics.gridVersion : null, persistentDesignKey: view.persistentDesignKey }))}</metadata><style>${svgStyles()}</style><rect width="100%" height="100%" fill="#f7f7f2"/><text class="export-kicker" x="24" y="26">SCIENTIFIC PROTOTYPE · POINT RULE · ${escapeXml(chart.toUpperCase())}</text><text class="export-title" x="24" y="52">${escapeXml(PRODUCT_LABELS[outputs.scenario.vaccine.id])}</text><text class="export-meta" x="24" y="76">${escapeXml(presentation.candidate.schedule)} · ${escapeXml(presentation.candidate.assessment)}</text><text class="export-meta" x="24" y="96">Decision scope: ${escapeXml(presentation.result.scopeLabel)} · direct R_loc ${formatNumber(presentation.result.value)}</text><text class="export-meta" x="24" y="116">${escapeXml(presentation.result.qualification)}</text><text class="export-meta" x="24" y="136">${escapeXml(exactSelection)}${escapeXml(diagnosticContext)}</text><text class="export-meta" x="24" y="152">${escapeXml(heldSelection.trim())} ${SVG_EXPORT_SCHEMA_VERSION} · ${BUILD_IDENTITY}</text><g transform="translate(0 166)">${source.innerHTML}</g></svg>`;
}

function svgStyles(): string {
  return `text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#1d2528}.plot-bg{fill:#f7f7f2}.grid-line{stroke:#1d2528;stroke-opacity:.13}.chart-kicker,.export-kicker{font-size:10px;font-weight:700;letter-spacing:1.5px}.chart-title,.export-title{font-family:Georgia,serif;font-size:19px;font-weight:700}.export-meta{font-size:10px}.axis-label{font-size:11px;font-weight:650}.tick,.anchor-label,.surface-legend,.chart-key{font-size:9px}.threshold-line{fill:none;stroke:#111;stroke-width:2;stroke-dasharray:6 4}.pareto-line{fill:none;stroke:#9a4f37;stroke-width:3}.surface-cell{stroke:none}.surface-cell.is-inspected{stroke:#111;stroke-width:2}.anchor-point{fill:#f7f7f2;stroke:#1d2528;stroke-width:2}.decision-anchor{fill:#1d2528}.probe-ring,.selected-exact{fill:none;stroke:#111;stroke-width:2.5}.decision-scope-boundary{fill:none;stroke:#9a4f37;stroke-width:3}.hybrid-interval{stroke:#9a4f37;stroke-width:4}.effect-point.passes{fill:#1d2528}.effect-point.fails{fill:#f7f7f2;stroke:#1d2528}.comparator-marker{fill:#f7f7f2;stroke:#1d2528;stroke-width:2}.design-cell{stroke:none}.design-cell.is-inspected,.effect-point.is-inspected{stroke:#9a4f37;stroke-width:3}.design-cell.is-persistent,.effect-point.is-persistent{stroke:#111;stroke-width:3}`;
}

function download(name: string, content: string, type = "application/json"): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function designPointByKey(outputs: ModelOutputsV1, key: string | null): DesignGridPoint | null {
  if (!key) return null;
  return outputs.frontier.points.find((point) => designKey(point) === key) ?? null;
}

function showWarning(message: string, kind: "notice" | "error" = "error"): void {
  const warning = byId<HTMLElement>("state-warning");
  warning.hidden = false;
  warning.className = `warning ${kind}`;
  warning.textContent = message;
}
function hideWarning(): void { const warning = byId<HTMLElement>("state-warning"); warning.hidden = true; warning.textContent = ""; }
function numberValue(id: string): number { return Number(byId<HTMLInputElement>(id).value); }
function setValue(id: string, value: string | number): void { const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null; if (element) element.value = String(value); }
function byId<T extends HTMLElement>(id: string): T { const element = document.getElementById(id); if (!element) throw new Error(`Missing UI element #${id}`); return element as T; }
function unitExposure(value: number) { return { value, unit: "grams/exposure" as const, basis: "per_exposure" as const }; }
function unitFrequency(value: number) { return { value, unit: "exposures/person/day", basis: "per_day" as const }; }
function microgramsFromGrams(value: number): number { return value * MICROGRAMS_PER_GRAM; }
function gramsFromMicrograms(value: number): number { return value / MICROGRAMS_PER_GRAM; }
function formatNumber(value: number): string { return Math.abs(value) < .001 && value !== 0 ? value.toExponential(2) : value < 10 ? value.toFixed(3) : value.toFixed(2); }
function formatPercent(value: number): string { return `${(100 * value).toFixed(1)}%`; }
function shortIdentity(value: string): string { return `${value.slice(0, 14)}…`; }
function csvValue(value: string): string { return `"${value.replaceAll('"', '""')}"`; }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function escapeHtml(value: string): string { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function escapeXml(value: string): string { return escapeHtml(value).replaceAll("'", "&apos;"); }

document.querySelector<HTMLElement>("#app") && mountApp(document.querySelector<HTMLElement>("#app")!);
