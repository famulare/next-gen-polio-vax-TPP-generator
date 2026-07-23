import { passesThreshold } from "./model/frontier";
import {
  defaultScenario,
  evaluateScenario,
  evaluateScenarioLight,
  scenarioWithDecisionScope,
  scenarioWithProduct,
  scenarioWithSetting
} from "./model/model";
import {
  FRONTIER_GRID,
  PARAMETERS,
  PRODUCT_LABELS,
  SETTING_ANCHORS,
  SETTING_DISPLAY_DOMAIN,
  SETTING_MANIFEST_VERSION
} from "./model/parameters";
import { buildScheduleState } from "./model/schedule";
import { rLocForSetting } from "./model/transmission";
import { canonicalJson, decodeScenario, encodeScenario } from "./model/serialization";
import { MICROGRAMS_PER_GRAM } from "./model/types";
import type { AnchorSettingId, DesignGridPoint, EnvelopeV1, ModelOutputsV1, ProductId, ScenarioV1, SettingId, TeachingView } from "./model/types";
import { renderEffectMap, renderImmunityDistribution, renderProductMap, renderSettingSurface, renderVaccineDoseResponse, renderWithinHostTeaching } from "./ui/charts";
import type { ChartViewState } from "./ui/charts";
import { BRAND_COLORS, BRAND_FONT_FAMILIES, SCIENTIFIC_SURFACE_COLORS, brandFontFaceCss, installBrandFonts } from "./ui/brand";
import { buildCandidate, buildPresentation, buildResult, describeDecisionScope, designKey } from "./ui/presentation";


declare const __BUILD_IDENTITY__: string;

const APP_VERSION = "0.5.0-prototype";
const LIGHT_UPDATE_DELAY_MS = 45;
const HEAVY_COMMIT_DELAY_MS = 240;
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
  let liveOutputs: TeachingView | null = null;
  let lightTimer: number | undefined;
  let heavyTimer: number | undefined;
  const maxSurfaceColumn = SETTING_DISPLAY_DOMAIN.exposure.count - 1;
  const maxSurfaceRow = SETTING_DISPLAY_DOMAIN.contacts.max - SETTING_DISPLAY_DOMAIN.contacts.min;
  const view: AppViewState = {
    inspectedDesignKey: null,
    persistentDesignKey: null,
    surfaceColumn: Math.round(maxSurfaceColumn * 0.787), // ~UP/Bihar log-position on the exposure axis
    surfaceRow: 9,
    drawerOpen: false
  };

  syncControls(draftScenario);
  bindControls();
  bindChartInteractions();
  bindMotifReadout();
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
      commitNow("Versioned defaults restored.");
    });
    byId<HTMLSelectElement>("product").addEventListener("change", (event) => {
      draftScenario = scenarioWithProduct(draftScenario, (event.target as HTMLSelectElement).value as ProductId);
      syncControls(draftScenario);
      onEdit();
    });
    byId<HTMLSelectElement>("scope").addEventListener("change", (event) => {
      const id = (event.target as HTMLSelectElement).value as AnchorSettingId;
      // One selector decides and inspects the same named setting.
      draftScenario = scenarioWithSetting(scenarioWithDecisionScope(draftScenario, id), id);
      syncControls(draftScenario);
      onEdit();
    });
    document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-model-control]").forEach((input) => {
      const eventName = input instanceof HTMLInputElement && input.type === "range" ? "input" : "change";
      input.addEventListener(eventName, () => {
        updateReadouts();
        onEdit();
      });
    });
    byId<HTMLButtonElement>("use-design").addEventListener("click", () => {
      if (!committedOutputs || !view.persistentDesignKey) return;
      const point = designPointByKey(committedOutputs, view.persistentDesignKey);
      if (!point) return;
      draftScenario = scenarioWithProduct(draftScenario, "hypothetical");
      draftScenario.vaccine = { ...draftScenario.vaccine, takeContext: point.takeContext, mu0: point.mu0 };
      syncControls(draftScenario);
      onEdit();
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
      if (key === "ArrowRight") view.surfaceColumn = Math.min(maxSurfaceColumn, view.surfaceColumn + 1);
      if (key === "ArrowUp") view.surfaceRow = Math.min(maxSurfaceRow, view.surfaceRow + 1);
      if (key === "ArrowDown") view.surfaceRow = Math.max(0, view.surfaceRow - 1);
      if (key === "Home") view.surfaceColumn = 0;
      if (key === "End") view.surfaceColumn = maxSurfaceColumn;
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

  // Light tier: recompute the cheap teaching projection on every control edit and
  // render it live. If the edit changed scientific identity, the committed frontier
  // and verdict are marked stale until an explicit commit; a probe-only edit (which
  // never changes identity) re-commits by reusing the committed frontier.
  // Any control edit updates the cheap teaching figures + verdict instantly (live tier),
  // then auto-commits the full frontier/maps/exports a short debounce after the last edit.
  // No manual "Update the model" step.
  function onEdit(): void {
    if (lightTimer !== undefined) window.clearTimeout(lightTimer);
    lightTimer = window.setTimeout(renderLivePreview, LIGHT_UPDATE_DELAY_MS);
    if (heavyTimer !== undefined) window.clearTimeout(heavyTimer);
    heavyTimer = window.setTimeout(commitDebounced, HEAVY_COMMIT_DELAY_MS);
  }

  // Instant preview: cheap projection (no frontier), rendering figures + the live verdict.
  // Marks the frontier-dependent maps/exports as recomputing until the debounced commit.
  function renderLivePreview(): void {
    lightTimer = undefined;
    let draft: ScenarioV1;
    try { draft = readControls(draftScenario); }
    catch (error) { renderInvalid(error); return; }
    draftScenario = draft;
    let live: TeachingView;
    try { live = evaluateScenarioLight(structuredClone(draft)); }
    catch (error) { renderInvalid(error); return; }
    liveOutputs = live;
    hideWarning();
    renderTeaching(live);
    setExportAvailability(false);
    const transaction = byId<HTMLElement>("transaction-status");
    transaction.className = "transaction-status stale";
    transaction.textContent = "Figures and verdict updated; recomputing the design frontier…";
  }

  function commitDebounced(): void {
    heavyTimer = undefined;
    if (lightTimer !== undefined) { window.clearTimeout(lightTimer); lightTimer = undefined; }
    let draft: ScenarioV1;
    try { draft = readControls(draftScenario); }
    catch (error) { renderInvalid(error); return; }
    draftScenario = draft;
    run(draft);
  }

  // Immediate full commit (reset and initial load).
  function commitNow(message?: string): void {
    if (lightTimer !== undefined) window.clearTimeout(lightTimer);
    if (heavyTimer !== undefined) window.clearTimeout(heavyTimer);
    let draft: ScenarioV1;
    try { draft = readControls(draftScenario); }
    catch (error) { renderInvalid(error); return; }
    draftScenario = draft;
    run(draft, message);
  }

  function run(nextScenario: ScenarioV1, notice?: string): void {
    try {
      const outputs = evaluateScenario(structuredClone(nextScenario));
      draftScenario = structuredClone(outputs.scenario);
      committedOutputs = outputs;
      window.location.hash = `scenario=${encodeScenario(outputs.scenario)}`;
      renderCommitted(outputs);
      hideWarning();
      if (notice) showWarning(notice, "notice");
    } catch (error) {
      renderInvalid(error);
    }
  }

  // Committed tier: the frontier-dependent decision DOM plus exports and URL.
  // Runs only on an explicit commit (compute/reset/initial). It also refreshes the
  // light tier so a commit is a fully consistent frame.
  function renderCommitted(outputs: ModelOutputsV1): void {
    liveOutputs = outputs;
    renderTeaching(outputs);
    renderMotifReadout();
    const presentation = buildPresentation(outputs);
    byId<HTMLElement>("effect-map").innerHTML = renderEffectMap(outputs, view);
    byId<HTMLElement>("product-map").innerHTML = renderProductMap(outputs, view);
    byId<HTMLElement>("frontier-summary").innerHTML = `<strong>${escapeHtml(presentation.frontier.message)}</strong><span>Selected candidate: q<sub>acq</sub> ${formatNumber(outputs.metrics.qAcq)} · q<sub>shed</sub> ${formatNumber(outputs.metrics.qShed)} · q<sub>index</sub> ${formatNumber(outputs.metrics.qIndex)} · direct R<sub>loc,max</sub> ${formatNumber(outputs.metrics.rLocEnvelopeMax)}.</span><span>The two maps are alternate coordinates for the same ${outputs.frontier.points.length.toLocaleString("en-US")} direct evaluations.</span>`;
    renderAssumptions(outputs);
    renderLinkedInspection();
    setExportAvailability(true);
    byId<HTMLElement>("export-status").textContent = `Exports are ready for committed model ${shortIdentity(outputs.modelIdentity)}.`;
    byId<HTMLElement>("transaction-status").className = "transaction-status committed";
    byId<HTMLElement>("transaction-status").innerHTML = `Committed. ${escapeHtml(presentation.result.statusLabel)}: direct R<sub>loc</sub> ${formatNumber(presentation.result.value)}.`;
  }

  // Live tier: the cheap teaching/immunity/surface figures, point readouts, and the
  // verdict + candidate/scope summaries, all derivable from point metrics + scenario.
  function renderTeaching(teaching: TeachingView): void {
    byId<HTMLElement>("setting-map").innerHTML = renderSettingSurface(teaching, view);
    byId<HTMLElement>("within-host-chart").innerHTML = renderWithinHostTeaching(teaching);
    byId<HTMLElement>("dose-response-chart").innerHTML = renderVaccineDoseResponse(teaching);
    byId<HTMLElement>("immunity-distribution").innerHTML = renderImmunityDistribution(teaching);
    renderMechanism(teaching);
    renderOpeningComparison(teaching);
    renderWithinHostReadout(teaching);
    renderPrintProductSummary(teaching);
    renderDecision(teaching);
  }

  // The verdict tracks live: it depends only on rLocEnvelopeMax + the scenario, both in
  // the light projection, so it updates instantly on any edit.
  function renderDecision(teaching: TeachingView): void {
    const result = buildResult(teaching.metrics, teaching.scenario);
    const candidate = buildCandidate(teaching.scenario);
    const status = byId<HTMLElement>("result-status");
    status.className = `result-status ${result.branch}`;
    status.dataset.modelIdentity = teaching.diagnostics.modelIdentity;
    status.innerHTML = `<p class="result-label">${escapeHtml(result.statusLabel)} · ${escapeHtml(result.scopeShortLabel)}</p>
      <h2>${escapeHtml(result.headline)}</h2>
      <p class="result-number"><span>Direct R<sub>loc</sub></span><strong>${formatNumber(result.value)}</strong><span>${subVarsHtml(result.criterion)}</span></p>
      <p class="qualification">${subVarsHtml(result.qualification)}</p>`;
    byId<HTMLElement>("candidate-summary").innerHTML = `<strong>${escapeHtml(candidate.label)}</strong><span>${escapeHtml(candidate.schedule)} · assessed ${escapeHtml(candidate.assessment)}</span>`;
    byId<HTMLElement>("scope-summary").innerHTML = `<span>Decision scope</span><strong>${subVarsHtml(result.scopeLabel)}</strong>`;
    byId<HTMLElement>("story-results").classList.remove("is-stale");
  }

  function renderMechanism(outputs: TeachingView): void {
    const metrics = outputs.metrics;
    byId<HTMLElement>("mechanism-values").innerHTML = `<article><span>1 · acquisition</span><strong>${formatPercent(1 - metrics.qAcq)} reduction</strong><p>Residual acquisition multiplier q<sub>acq</sub> = ${formatNumber(metrics.qAcq)}.</p></article>
      <article><span>2 · breakthrough shedding</span><strong>${formatPercent(1 - metrics.qShed)} reduction</strong><p>Conditional infectious-shedding multiplier q<sub>shed</sub> = ${formatNumber(metrics.qShed)}.</p></article>
      <article class="diagnostic"><span>3 · diagnostic index</span><strong>q<sub>index</sub> = ${formatNumber(metrics.qIndex)}</strong><p>q<sub>acq</sub> × q<sub>shed</sub>; useful for reading, not the decision rule.</p></article>
      <article class="authoritative"><span>4 · direct motif rule</span><strong>R<sub>loc</sub> = N<sub>s</sub> × P(contact infected)</strong><p>The next step evaluates the selected product at the declared setting scope. This formula, not q<sub>index</sub>, is authoritative.</p></article>`;
  }

  function renderWithinHostReadout(outputs: TeachingView): void {
    const diagnostics = outputs.diagnostics;
    const horizonDays = outputs.scenario.horizonDays;
    byId<HTMLElement>("assessment-age").textContent = formatAssessmentAge(diagnostics.assessmentAgeDays);
    byId<HTMLElement>("within-host-readout").innerHTML = `<article><span>Reference challenge <span class="prov-tag" data-kind="assumption">assumption</span></span><strong>${formatNumber(diagnostics.referenceChallengeDoseCID50)} CID50</strong><p>One WPV HID50 under the fixed WPV dose-response convention. It is a WPV challenge reference, not a vaccine dose.</p></article>
      <article><span>Acquisition at reference <span class="prov-tag" data-kind="derived">derived</span></span><strong>${formatPercent(diagnostics.reference.acquisitionAtReference)} → ${formatPercent(diagnostics.vaccinated.acquisitionAtReference)}</strong><p>Naive reference to selected cohort: q<sub>acq</sub> = ${formatNumber(diagnostics.qAcq)}.</p></article>
      <article><span>Total shed given infection, B <span class="prov-tag" data-kind="derived">derived</span></span><strong>${formatScientific(diagnostics.reference.integratedConditionalBurdenTCID50DaysPerGram)} → ${formatScientific(diagnostics.vaccinated.integratedConditionalBurdenTCID50DaysPerGram)}</strong><p>TCID50-days/g, conditional on WPV acquisition and integrated over ${horizonDays} days. q<sub>shed</sub> = ${formatNumber(diagnostics.qShed)}.</p></article>
      <article class="diagnostic"><span>Shedding index <span class="prov-tag" data-kind="derived">derived</span></span><strong>${formatScientific(diagnostics.reference.sheddingIndexAtReferenceTCID50DaysPerGram)} → ${formatScientific(diagnostics.vaccinated.sheddingIndexAtReferenceTCID50DaysPerGram)}</strong><p>P(acquisition | one WPV HID50) × B, in TCID50-days/g. Its relative value is q<sub>index</sub> = ${formatNumber(diagnostics.qIndex)} = q<sub>acq</sub> × q<sub>shed</sub>; neither replaces direct R<sub>loc</sub>.</p></article>`;
    byId<HTMLElement>("product-pathway-summary").innerHTML = `<strong>${escapeHtml(outputs.scenario.vaccine.label)}</strong><span>Routine immunization at ${escapeHtml(outputs.scenario.schedule.routineDays.map((day) => `${day / 7}`).join(", "))} weeks (${escapeHtml(outputs.scenario.schedule.routineDays.map((day) => `day ${day}`).join(", "))})${outputs.scenario.schedule.boosterAgeYears > 0 ? `, with a booster on top at year ${outputs.scenario.schedule.boosterAgeYears}` : "; no booster"} · assessed ${outputs.scenario.schedule.assessmentLagDays} days after the last scheduled dose.</span>`;
  }

  function renderPrintProductSummary(outputs: TeachingView): void {
    const { vaccine, schedule } = outputs.scenario;
    const scheduleText = `Routine immunization at ${schedule.routineDays.map((day) => `${day / 7}`).join(", ")} weeks (${schedule.routineDays.map((day) => `day ${day}`).join(", ")})${schedule.boosterAgeYears > 0 ? `, with a booster on top at year ${schedule.boosterAgeYears}` : "; no booster"} · assessed ${schedule.assessmentLagDays} days after the last scheduled dose`;
    const summary = byId<HTMLElement>("print-product-summary");
    if (vaccine.id !== "hypothetical") {
      const semantics = vaccine.id === "ipv"
        ? "IPV is a fixed non-live comparator. It has no live-vaccine take coordinate; its mucosal effect depends on prior live infection and is not a next-gen gut mucosal design."
        : "Sabin 2 is a fixed catalog comparator. Its take and mucosal-boost semantics are evaluated as committed, not as hypothetical product sliders.";
      summary.innerHTML = `<p class="eyebrow">Selected product mechanism</p><dl><div><dt>Product</dt><dd>${escapeHtml(vaccine.label)}</dd></div><div><dt>Schedule</dt><dd>${escapeHtml(scheduleText)}</dd></div></dl><p>${escapeHtml(semantics)}</p>`;
      return;
    }
    const administeredDose = `${formatNumber(Math.log10(vaccine.dose))} log10 TCID50 (${formatScientific(vaccine.dose)} TCID50)`;
    summary.innerHTML = `<p class="eyebrow">Selected product mechanism</p><dl><div><dt>Product</dt><dd>${escapeHtml(vaccine.label)}</dd></div><div><dt>Schedule</dt><dd>${escapeHtml(scheduleText)}</dd></div><div><dt>Biological take</dt><dd>${formatNumber(vaccine.takeContext)}</dd></div><div><dt>Mean mucosal boost</dt><dd>${formatNumber(vaccine.mu0)} log2</dd></div><div><dt>Vaccine dose response</dt><dd>α ${formatNumber(vaccine.alpha)} · HID50 ${formatNumber(vaccine.beta * (2 ** (1 / vaccine.alpha) - 1))} CID50</dd></div><div><dt>Administered dose</dt><dd>${administeredDose}</dd></div><div><dt>Fixed vaccine parameters</dt><dd>γ ${formatNumber(vaccine.gamma)} · boost SD ${formatNumber(vaccine.sigma0)} log2</dd></div><div><dt>Receipt</dt><dd>100% in v1</dd></div></dl><p>Biological take is productive live-vaccine infection after a received dose, not receipt or coverage. These vaccine parameters determine the take/no-take split and schedule-derived mucosal-immunity distribution; they do not change the fixed WPV challenge equation.</p>`;
  }

  function renderOpeningComparison(outputs: TeachingView): void {
    const schedule = outputs.scenario.schedule.routineDays.map((day) => `day ${day}`).join(", ");
    const booster = outputs.scenario.schedule.boosterAgeYears > 0 ? ` + booster at year ${outputs.scenario.schedule.boosterAgeYears}` : "; no booster";
    byId<HTMLElement>("opening-comparison").innerHTML = `<span class="cohort"><span class="cohort-tag">Reference cohort</span><strong>Naive child · all mass in mucosal-immunity bin 0</strong></span><i aria-hidden="true">→</i><span class="cohort"><span class="cohort-tag">Selected cohort</span><strong>${escapeHtml(outputs.scenario.vaccine.label)} · ${escapeHtml(schedule)}${escapeHtml(booster)} · assessed ${outputs.scenario.schedule.assessmentLagDays} days after last dose</strong></span>`;
  }

  function renderAssumptions(outputs: ModelOutputsV1): void {
    byId<HTMLElement>("assumptions-list").innerHTML = outputs.assumptions.map((item) => `<li>${subVarsHtml(item)}</li>`).join("");
    byId<HTMLElement>("uncertainty-note").innerHTML = `<strong>Evidence gap:</strong> ${subVarsHtml(outputs.uncertainty.reason)}`;
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
      <div><dt>Take context</dt><dd>${formatNumber(point.takeContext)}</dd></div><div><dt>Mean boost</dt><dd>${formatNumber(point.mu0)} log2</dd></div>
      <div><dt>Acquisition reduction</dt><dd>${formatPercent(1 - point.qAcq)}</dd></div><div><dt>Shedding reduction</dt><dd>${formatPercent(1 - point.qShed)}</dd></div>
      <div><dt>q<sub>index</sub></dt><dd>${formatNumber(point.qAcq * point.qShed)}</dd></div>
      <div><dt>Direct R<sub>loc</sub></dt><dd>${formatNumber(point.rLocEnvelopeMax)}</dd></div><div><dt>Criterion</dt><dd>${point.passes ? "meets" : "does not meet"}</dd></div></dl>`;
    button.hidden = view.persistentDesignKey === null;
    const alreadySelected = committedOutputs.scenario.vaccine.id === "hypothetical"
      && committedOutputs.scenario.vaccine.takeContext === point.takeContext
      && committedOutputs.scenario.vaccine.mu0 === point.mu0;
    button.disabled = view.persistentDesignKey === null || alreadySelected;
    button.textContent = alreadySelected ? "Current scientific design" : "Use this design";
  }

  function renderSurfaceOnly(): void {
    const source = liveOutputs ?? committedOutputs;
    if (!source) return;
    byId<HTMLElement>("setting-map").innerHTML = renderSettingSurface(source, view);
  }

  // View-only teaching readout: R_loc at the committed setting for an arbitrary
  // number of close social contacts. It reads committedOutputs and never mutates
  // the scenario, URL hash, committed outputs, or exports (contract §15.3).
  function bindMotifReadout(): void {
    byId<HTMLInputElement>("motif-contacts").addEventListener("input", renderMotifValue);
  }
  function renderMotifReadout(): void {
    if (!committedOutputs) return;
    const seed = Math.max(0, Math.min(20, Math.round(committedOutputs.scenario.setting.Ns)));
    byId<HTMLInputElement>("motif-contacts").value = String(seed);
    renderMotifValue();
  }
  function renderMotifValue(): void {
    if (!committedOutputs) return;
    const scenario = committedOutputs.scenario;
    const contacts = Number(byId<HTMLInputElement>("motif-contacts").value);
    const state = buildScheduleState(scenario.vaccine, scenario.schedule);
    const rLoc = rLocForSetting(state, { ...scenario.setting, Ns: contacts }, scenario.indexReferenceExposure, scenario.horizonDays);
    byId<HTMLOutputElement>("motif-rloc").innerHTML = `R<sub>loc</sub> = ${formatNumber(rLoc)}`;
  }

  function renderInvalid(error: unknown): void {
    setExportAvailability(false);
    const message = errorMessage(error);
    showWarning(message, "error");
    const transaction = byId<HTMLElement>("transaction-status");
    transaction.className = "transaction-status invalid";
    transaction.textContent = committedOutputs
      ? "The edited state is invalid. The last committed result is retained and cannot be exported as the current controls."
      : "The edited state is invalid. No result is committed.";
    if (committedOutputs) byId<HTMLElement>("story-results").classList.add("is-stale");
  }

  function setExportAvailability(available: boolean): void {
    document.querySelectorAll<HTMLButtonElement>("[data-export], #share").forEach((button) => { button.disabled = !available; });
  }
}

function shell(): string {
  const upBihar = SETTING_ANCHORS.find((anchor) => anchor.id === "up-bihar");
  if (!upBihar) throw new Error("UP/Bihar teaching anchor is missing from the setting manifest");
  const assayFloorLog10 = Math.log10(PARAMETERS.shedding.titerFloor).toFixed(1);
  const horizonDays = PARAMETERS.transmission.horizonDays;
  const productOptions = Object.entries(PRODUCT_LABELS).map(([id, label]) => `<option value="${id}">${escapeHtml(label)}</option>`).join("");
  const scopeOptions = SETTING_ANCHORS.map((anchor) => `<option value="${anchor.id}">${escapeHtml(anchor.label)}</option>`).join("");
  return `<a class="skip-link" href="#within-host">Skip to model</a>
  <header class="site-header"><a class="wordmark" href="#top" aria-label="Polio vaccine target product profile explorer home">TPP / WPV1</a><details class="section-nav"><summary aria-label="Sections">Sections</summary><nav aria-label="Narrative chapters"><a href="#within-host">Model</a><a href="#product-pathway">Product</a><a href="#transmission">Transmission</a><a href="#decision">Decision</a><a href="#measurement">Measurement</a></nav></details></header>
  <main id="top" class="app-shell">
    <header class="hero">
      <p class="eyebrow">WPV1 · close-contact sufficiency model · contract ${PARAMETERS.designContractVersion}</p>
      <h1>Under what conditions can a vaccine block close-contact transmission?</h1>
      <p class="lede">Begin with a child exposed to WPV in the UP/Bihar reference setting. Follow the model from schedule-derived immunity, through acquisition and shedding, into a close-contact transmission motif—then ask what product properties clear that stress test.</p>
      <p class="orienting"><strong>What this is, and what to look for.</strong> This tool explores one question: how much shedding reduction must a vaccine produce to interrupt poliovirus transmission anywhere, under a given schedule? It is based on a published polio model (PLoS Biology, 2018): a serology-based mucosal-immunity correlate for OPV recipients sets the probability of infection at a given wild-poliovirus exposure, then the shedding that follows, then transmission through close contacts. Modeling global eradication in one go is hard, so we assume a vaccine that pushes the effective reproduction number among close contacts (R<sub>loc</sub>) below one will likely win anywhere: reduce transmission among the closest contacts and every weaker contact falls further. The number to look for is the 100- to 1,000-fold shedding-index reduction it takes to interrupt transmission everywhere. That is what we study.</p>
      <p class="orienting"><strong>How to use it.</strong> The page is an interactive narrative through the model of a next-gen gut mucosal vaccine. Read it through once as laid out. Then turn the knobs: every figure is wired to the same model engine, so as you change parameters and interact with the graphs, the whole page recomputes—scroll up and down to watch how the story changes with your inputs.</p>
      <p id="opening-comparison" class="opening-comparison" aria-live="off"></p>
      <aside class="prototype-banner" role="note"><strong>Scientific prototype · point rule</strong><span>This is a deterministic close-contact sufficiency screen under the v1 axiom—not a complete-population R<sub>e</sub>, outbreak forecast, or probability of product success.</span></aside>
    </header>

    <section id="within-host" class="chapter teaching-chapter" aria-labelledby="within-host-heading">
      <div class="chapter-heading"><p class="chapter-number">01 / WPV exposure</p><div><h2 id="within-host-heading">First, separate acquisition from what happens after breakthrough.</h2><p>UP/Bihar is the fixed teaching reference for the transmission setting. The curves below compare a naive reference cohort with the selected vaccine schedule at the same assessment age of <span id="assessment-age">about 4 months</span>.</p></div></div>
      <figure class="hero-figure wide-breakout"><div id="within-host-chart" class="chart-slot" aria-live="off"></div><figcaption><strong>Read each conditioning statement literally.</strong> Acquisition depends on WPV challenge dose. The next two panels condition on acquisition — duration of shedding, then concentration among shedders — and the fourth integrates them at the reference challenge into the shedding index. This preserves the joint expectation rather than averaging an "average child."</figcaption></figure>
      <div id="within-host-readout" class="mechanism-values ruled-list teaching-readout"></div>
    </section>

    <section id="product-pathway" class="chapter" aria-labelledby="product-pathway-heading">
      <div class="chapter-heading"><p class="chapter-number">02 / Schedule to cohort</p><div><h2 id="product-pathway-heading">A received live-vaccine dose may take, boost mucosal immunity, and then wane.</h2><p>Every routine dose is received in v1. Biological take is productive live-vaccine infection after receipt; it is not receipt, coverage, or direct protection against a WPV dose. Repeated take/no-take branches produce the cohort distribution shown here.</p></div></div>
      <div class="pathway ruled-list" role="img" aria-label="Received dose, biological take or no take, mucosal boost, waning, and the cohort immunity distribution before WPV exposure"><article><span>Received dose</span><strong>Schedule event</strong><p>Routine doses at 6, 10, and 14 weeks, plus an optional booster.</p></article><i aria-hidden="true">→</i><article><span>Biological split</span><strong>Take / no take</strong><p>Each branch is probability weighted; no dose receipt is missing.</p></article><i aria-hidden="true">→</i><article><span>State transition</span><strong>Boost then wane</strong><p>Take changes mucosal state; time to assessment allows waning.</p></article><i aria-hidden="true">→</i><article><span>WPV challenge</span><strong>Distribution enters model</strong><p>Transmission uses the full state distribution and histories.</p></article></div>
      <p id="product-pathway-summary" class="narrative-summary"></p>
      <aside id="print-product-summary" class="print-product-summary" aria-label="Selected product mechanism for print"></aside>
      <figure class="hero-figure narrow-figure"><div id="dose-response-chart" class="chart-slot" aria-live="off"></div><figcaption><strong>Vaccine take is the front of the chain.</strong> α, β, and administered dose set the take probability, and prior mucosal immunity lowers it. Take seeds the immunity distribution below, which drives the downstream acquisition and shedding reductions; it does not change the fixed WPV challenge equation.</figcaption></figure>
      <figure class="hero-figure narrow-figure"><div id="immunity-distribution" class="chart-slot"></div></figure>
      <form class="narrative-controls" aria-labelledby="product-controls-heading" onsubmit="return false"><div class="controls-title"><div><p class="eyebrow">Product and schedule</p><h3 id="product-controls-heading">Now choose the schedule whose cohort you want to inspect.</h3></div><button id="reset" type="button" class="text-button">Reset defaults</button></div><div class="control-row"><label>Candidate product<select id="product">${productOptions}</select><small>Fixed catalog products remain fixed; next-gen gut mucosal designs expose their assumptions below.</small></label><label>Booster<select id="booster" data-field="booster" data-model-control><option value="0">No booster</option><option value="1">At 1 year</option><option value="2">At 2 years</option><option value="3">At 3 years</option><option value="4">At 4 years</option></select><small>An extra dose on top of the routine 6/10/14-week schedule.</small></label><label>Assessment after last dose<select id="lag" data-field="lag" data-model-control><option value="28">28 days</option><option value="90">90 days</option></select></label></div><fieldset id="hypothetical-controls"><details class="product-disclosure"><summary><span>Next-gen gut mucosal product parameters</span><small>Five product inputs you can tune — not optional scientific assumptions</small></summary><p>These values determine vaccine take after a received dose, the take/no-take split, the mucosal boost, and therefore the schedule-derived distribution above. They do not change the fixed WPV challenge equation. The five controls are <span class="prov-tag" data-kind="scenario-input">scenario inputs</span>; the fixed values below are v1 <span class="prov-tag" data-kind="assumption">assumptions</span>.</p><div class="advanced-grid product-parameter-grid"><label>Biological take <output id="take-output">0.80</output><input id="take" data-field="take" data-model-control type="range" min="0" max="1" step="0.01"><small id="take-help"></small></label><label>Mean mucosal boost <output id="mu-output">4.0 log2</output><input id="mu" data-field="mu" data-model-control type="range" min="0" max="8" step="0.1"><small id="mu-help"></small></label><label>Vaccine α<input id="alpha" data-field="alpha" data-model-control type="number" min="0.001" max="5" step="0.001"><small>Dose-response shape for productive vaccine infection after receipt.</small></label><label>Vaccine HID50 (CID50)<input id="hid50" data-field="hid50" data-model-control type="number" min="0.1" max="1000000" step="0.1"><small>Vaccine dose-response scale</small></label><label>Administered dose (log10 TCID50)<input id="dose-log" data-field="dose-log" data-model-control type="number" min="0" max="9" step="0.01"><small>Amount offered per received live-vaccine dose.</small></label></div><div class="parameter-context"><span>Fixed γ<sub>vax</sub></span><strong id="product-fixed-gamma"></strong><span>Fixed boost SD, σ<sub>0</sub></span><strong id="product-fixed-sigma"></strong><span>Receipt</span><strong>100% in v1</strong></div></details></fieldset><p id="catalog-product-note" class="catalog-note" hidden></p><p id="state-warning" class="warning" hidden></p></form>
    </section>

    <section id="transmission" class="chapter" aria-labelledby="mechanism-heading">
      <div class="chapter-heading"><p class="chapter-number">03 / Close-contact transmission</p><div><h2 id="mechanism-heading">Then put breakthrough shedding into one declared transmission motif.</h2><p>The model propagates a breakthrough index child to a household child, then to close social contacts. Its endpoint is the expected tertiary infections, R<sub>loc</sub>, for that motif—not a calculated complete-population R<sub>e</sub>.</p></div></div>
      <p class="eyebrow">THE CLOSE-CONTACT MOTIF</p>
      <p class="motif-intro">A breakthrough index child exposes a household child, who exposes N<sub>s</sub> close social contacts in other households. R<sub>loc</sub> counts expected infections along this motif only.</p>
      <figure class="motif-figure wide-breakout">
        <svg viewBox="0 0 820 290" class="scientific-chart motif-svg" role="img" aria-label="A breakthrough index child transmits within one household to a household child, who then exposes N_s close social contacts in other households. The motif endpoint is R_loc, the expected infections along this motif, not a complete-population reproduction number.">
          <defs><marker id="motif-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="motif-arrowhead" d="M0 0 L10 5 L0 10 z"/></marker></defs>
          <rect class="motif-frame" x="36" y="40" width="410" height="180" rx="8"/><text class="motif-frame-label" x="50" y="60">ONE HOUSEHOLD</text>
          <rect class="motif-frame" x="516" y="40" width="268" height="180" rx="8"/><text class="motif-frame-label" x="530" y="60">OTHER HOUSEHOLDS</text>
          <g><rect class="motif-node motif-node-index" x="56" y="99" width="150" height="62" rx="8"/><text class="motif-name" x="131" y="135" text-anchor="middle">Index child</text></g>
          <line class="motif-arrow" x1="206" y1="130" x2="278" y2="130" marker-end="url(#motif-arrow)"/><text class="motif-link" x="242" y="120" text-anchor="middle">${svgSub("T", "ih")} · ${svgSub("d", "ih")}</text>
          <g><rect class="motif-node" x="284" y="99" width="156" height="62" rx="8"/><text class="motif-name" x="362" y="135" text-anchor="middle">Household child</text></g>
          <line class="motif-arrow" x1="440" y1="130" x2="530" y2="110" marker-end="url(#motif-arrow)"/><line class="motif-arrow" x1="440" y1="130" x2="530" y2="148" marker-end="url(#motif-arrow)"/><line class="motif-arrow" x1="440" y1="130" x2="530" y2="196" marker-end="url(#motif-arrow)"/><text class="motif-link" x="486" y="116" text-anchor="middle">${svgSub("T", "hs")} · ${svgSub("d", "hs")}</text>
          <g class="motif-fanout"><text class="motif-name" x="524" y="78">Close social contacts</text>
            <g class="motif-house"><path class="motif-house-roof" d="M 534 102 L 548 88 L 562 102 Z"/><rect class="motif-house-body" x="536" y="102" width="24" height="20" rx="2"/></g><text class="motif-house-label" x="576" y="118">house 1</text>
            <g class="motif-house"><path class="motif-house-roof" d="M 534 140 L 548 126 L 562 140 Z"/><rect class="motif-house-body" x="536" y="140" width="24" height="20" rx="2"/></g><text class="motif-house-label" x="576" y="156">house 2</text>
            <text class="motif-name" x="548" y="178" text-anchor="middle">⋮</text>
            <g class="motif-house"><path class="motif-house-roof" d="M 534 186 L 548 172 L 562 186 Z"/><rect class="motif-house-body" x="536" y="186" width="24" height="20" rx="2"/></g><text class="motif-house-label" x="576" y="202">house ${svgSub("N", "s")}</text></g>
          <text class="motif-foot" x="12" y="258">Endpoint: ${svgSub("R", "loc")} = expected infections along this one motif — not a complete-population ${svgSub("R", "e")}.</text>
        </svg>
      </figure>
      <div class="transmission-handshake"><p class="eyebrow">What happens on each link</p><p><strong>Infectious survival and stool concentration</strong> from the index child, multiplied by <strong>grams of stool per exposure</strong>, determine a recipient's daily oral WPV dose. The recipient's full immunity distribution determines acquisition at that dose. Repeated daily exposures compose as cumulative escape, not as one exposure to an average child. Setting exposure is a <span class="prov-tag" data-kind="scenario-input">scenario input</span> and the contact structure is inherited; R<sub>loc</sub> is <span class="prov-tag" data-kind="derived">derived</span>.</p><dl><div><dt>UP/Bihar index → household</dt><dd>${formatMicrograms(upBihar.Tih.value)} µg stool-equivalent/exposure × ${formatExposureFrequency(upBihar.dIh.value)}</dd></div><div><dt>Household → social contact</dt><dd>${formatMicrograms(upBihar.Ths.value)} µg stool-equivalent/exposure × ${formatExposureFrequency(upBihar.dHs.value)}</dd></div><div><dt>Social-contact motif</dt><dd>N<sub>s</sub> = ${upBihar.Ns} family-like child contacts</dd></div><div><dt>Index conditioning</dt><dd>Actual breakthrough after one WPV HID50, not a random vaccinated child</dd></div></dl><p class="transmission-equation">R<sub>loc</sub> = N<sub>s</sub> × P(one close social contact is infected).</p></div>
      <div class="motif-readout"><p class="eyebrow">See R<sub>loc</sub> build from contacts</p><label>Close social contacts, N<sub>s</sub><input id="motif-contacts" type="range" min="0" max="20" step="1"><output id="motif-rloc" aria-live="polite"></output></label><p>At the committed setting, R<sub>loc</sub> grows in proportion to the number of close social contacts. This is a view-only readout. It never changes the committed decision, scenario, or exports.</p></div>
      <div id="mechanism-values" class="mechanism-values ruled-list"></div>
      <aside class="meaning-note"><strong>The decision step</strong><p>If R<sub>loc</sub> stays below one at the chosen setting, the candidate passes a deliberately hard local test: block transmission among the closest contacts and easier settings should follow. The shedding index is a useful summary of the within-host effects, but it can't stand in for the full motif calculation that makes the call.</p></aside>
    </section>

    <section id="decision" class="chapter surface-chapter" aria-labelledby="decision-heading">
      <div class="chapter-heading"><p class="chapter-number">04 / Setting and decision</p><div><h2 id="decision-heading">Only now ask whether the selected product clears the reference stress test.</h2><p>The default point rule is evaluated directly at the UP/Bihar high anchor, the hardest known empirical/model-calibrated setting in the catalog. Clearing it supports likely adequacy under less demanding modeled conditions; it does not prove control everywhere. Parameter uncertainty and a threshold-crossing probability are <span class="prov-tag" data-kind="not-measured">not measured</span> in v1.</p></div></div>
      <form class="narrative-controls setting-controls" aria-labelledby="setting-controls-heading" onsubmit="return false"><div class="controls-title"><div><p class="eyebrow">Setting</p><h3 id="setting-controls-heading">Choose the field setting you are deciding for.</h3></div></div><div class="control-row"><label>Decision scope<select id="scope">${scopeOptions}</select><small>Sets the field exposure and contacts the candidate must clear, and marks that anchor on the surface. UP/Bihar high is the hardest known.</small></label></div></form>
      <figure class="hero-figure wide-breakout"><div id="setting-map" class="chart-slot" aria-live="off"></div><figcaption><strong>Read from blue through white to red.</strong> White is R<sub>loc</sub> = 1. The ringed diamond is the selected decision anchor. The outlined cell is the display cell you are inspecting, and its readout is that raster cell — not the decision calculation. The dashed path marks threshold crossings between directly evaluated display cells. Hover or use arrow keys to move the inspected cell across all 61 × 20 cells.</figcaption></figure>
      <div id="story-results"><div id="result-status" class="result-status pending" aria-live="polite"><p class="result-label">Evaluating</p><h2>Calculating the versioned default…</h2></div><div class="opening-meta"><p id="candidate-summary"></p><p id="scope-summary"></p></div></div>
      <p id="transaction-status" class="transaction-status" role="status" aria-live="polite"></p>
    </section>

    <section id="measurement" class="chapter" aria-labelledby="measurement-heading">
      <div class="chapter-heading"><p class="chapter-number">05 / Measurement handshake</p><div><h2 id="measurement-heading">What the quantities mean—and what they do not measure.</h2><p>Provenance is signposted inline as you scroll, with role tags at each quantity's point of use. This collapsible reference retains the full map: every quantity's scientific role, measurement interpretation, and v1 status.</p></div></div>
      <details class="provenance-reference"><summary><span>Provenance &amp; units</span><small>Full map: every quantity's role, interpretation, and v1 status</small></summary>
      <div class="table-wrap"><table><thead><tr><th>Quantity</th><th>Scientific role</th><th>Measurement interpretation</th><th>Status in v1</th></tr></thead><tbody>
        <tr><th scope="row">Biological take context</th><td>Product property</td><td>Productive live-vaccine infection after a received dose; not receipt or coverage.</td><td>Scenario input</td></tr>
        <tr><th scope="row">Mean mucosal boost, μ<sub>0</sub></th><td>Product property</td><td>Latent OPV-equivalent mucosal immunity shift; not measured serum titer.</td><td>Scenario input</td></tr>
        <tr><th scope="row">Exposure, T<sub>ih</sub> / T<sub>hs</sub></th><td>Setting pressure</td><td>Stool-equivalent mass transferred per exposure, converted at the UI boundary.</td><td>Named anchor or custom input</td></tr>
        <tr><th scope="row">Contact frequency and N<sub>s</sub></th><td>Motif structure</td><td>Exposures per person-day and family-like close social contacts.</td><td>Calibrated, inherited, or declared</td></tr>
        <tr><th scope="row">WPV acquisition, P(acquisition | d)</th><td>Within-host response</td><td>Probability of productive WPV acquisition after oral challenge dose d in CID50.</td><td>Derived model output</td></tr>
        <tr><th scope="row">Shedding duration</th><td>Within-host response</td><td>P(still shedding at day t | WPV acquisition); probability by days after acquisition.</td><td>Derived model output</td></tr>
        <tr><th scope="row">Concentration among shedders</th><td>Within-host response</td><td>Expected TCID50/g | still shedding and WPV acquisition, at the stated assessment age; assay floor 10<sup>${assayFloorLog10}</sup> TCID50/g.</td><td>Derived model output</td></tr>
        <tr><th scope="row">Total shed given infection, B</th><td>Within-host response</td><td>E[TCID50/g | WPV acquisition] = survival × conditional concentration; B is its ${horizonDays}-day integral in TCID50-days/g.</td><td>Derived model output</td></tr>
        <tr><th scope="row">q<sub>acq</sub>, q<sub>shed</sub></th><td>Modeled effects</td><td>Residual acquisition and conditional infectious-shedding multipliers at one WPV HID50. q<sub>shed</sub> is conditional on acquisition.</td><td>Derived from distributions</td></tr>
        <tr><th scope="row">Shedding index and q<sub>index</sub></th><td>Diagnostic reading aid</td><td>P(acquisition | one WPV HID50) × B is in TCID50-days/g; q<sub>index</sub> is its unitless selected/reference ratio.</td><td>Derived; not the decision rule</td></tr>
        <tr><th scope="row">R<sub>loc</sub></th><td>Decision result</td><td>Expected tertiary infections in the v1 close-contact motif.</td><td>Direct derived output</td></tr>
        <tr><th scope="row">Parameter uncertainty</th><td>Decision uncertainty</td><td>Threshold-crossing uncertainty would require a released ensemble.</td><td>Evidence gap in this version</td></tr>
      </tbody></table></div>
      <dl class="fixed-values"><div><dt>Success rule</dt><dd>Direct R<sub>loc</sub> &lt; 1</dd></div><div><dt>Boost σ<sub>0</sub></dt><dd id="fixed-sigma"></dd></div><div><dt>γ<sub>vax</sub></dt><dd id="fixed-gamma"></dd></div><div><dt>Episode horizon</dt><dd id="fixed-horizon"></dd></div><div><dt>Index reference exposure</dt><dd id="fixed-index-reference"></dd></div></dl>
      </details>
    </section>

    <section id="design-space" class="chapter" aria-labelledby="design-heading">
      <div class="chapter-heading"><p class="chapter-number">06 / From requirement to product</p><div><h2 id="design-heading">The same evaluated products can be read in outcome space or product space.</h2><p>Outcome space shows the acquisition-blocking and breakthrough-shedding reductions achieved by each evaluated product. Product space shows the biological take context and latent mucosal response assumptions that generated them. Neither outcome axis is an independently tunable specification.</p></div></div>
      <div id="frontier-summary" class="frontier-summary"></div>
      <div class="linked-maps wide-breakout"><figure><div id="effect-map" class="chart-slot"></div><figcaption><strong>Outcome requirement space.</strong> Each mark is one evaluated product. The turquoise <strong>Pareto boundary</strong> traces the minimum-sufficient frontier — the least acquisition and breakthrough-shedding reduction that still clears R<sub>loc</sub> &lt; 1 at the decision scope. Designs on it (or up and to the right) meet the criterion; designs below and left do not. It summarizes evaluated combinations, not a new biological endpoint.</figcaption></figure><figure><div id="product-map" class="chart-slot"></div><figcaption><strong>Product-assumption space.</strong> The dashed contour is the same sufficiency boundary in design coordinates: designs beyond it (higher take and mean boost) clear the criterion. Take is productive biological infection after a received live dose. Mean boost is latent OPV-equivalent mucosal immunity, not serum titer.</figcaption></figure></div>
      <div class="design-inspection"><div id="design-inspector"><p><strong>Inspect a design.</strong> Hover, tap, or focus either map. Click or press Enter to hold a selection.</p></div><button id="use-design" type="button" class="primary" hidden disabled>Use this design</button></div>
    </section>

    <section id="assumptions" class="chapter closing" aria-labelledby="assumptions-heading">
      <div class="chapter-heading"><p class="chapter-number" id="assumptions-heading">07 / Assumptions and provenance</p></div>
      <ul id="assumptions-list" class="assumptions-list"></ul><p id="uncertainty-note" class="uncertainty-note"></p>
      <div class="exports"><h3>Export the committed result</h3><p>Scientific changes disable export until a new result commits. JSON contains the versioned teaching diagnostics; SVGs carry the selected product, schedule, scope, criterion, qualification, and figure-specific conditioning.</p><div class="export-actions"><button data-export="json" type="button">JSON</button><button data-export="csv" type="button">CSV grids</button><button data-export="within-host-svg" type="button">Within-host SVG</button><button data-export="setting-svg" type="button">Setting SVG</button><button data-export="effect-svg" type="button">Requirement SVG</button><button data-export="product-svg" type="button">Product SVG</button><button id="share" type="button">Share link</button></div><p id="export-status" role="status" aria-live="polite">Exports are unavailable until evaluation completes.</p></div>
    </section>
  </main>
  <footer class="site-footer"><p>Prototype ${APP_VERSION} · contract ${PARAMETERS.designContractVersion} · parameters ${PARAMETERS.manifestVersion} · settings ${SETTING_MANIFEST_VERSION} · build ${BUILD_IDENTITY}</p><p>No runtime network dependency or random sampling. <a href="https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.2002468">Source paper</a> · <a href="https://github.com/famulare/cessationStability">cessationStability</a></p></footer>`;
}

function scenarioFromHash(): { scenario: ScenarioV1; error?: string } {
  const encoded = window.location.hash.startsWith("#scenario=") ? window.location.hash.slice("#scenario=".length) : "";
  if (!encoded) return { scenario: defaultScenario() };
  try { return { scenario: decodeScenario(encoded) }; }
  catch (error) { return { scenario: defaultScenario(), error: errorMessage(error) }; }
}

function syncControls(scenario: ScenarioV1): void {
  setValue("product", scenario.vaccine.id);
  setValue("scope", describeDecisionScope(scenario.envelope).id);
  setValue("booster", scenario.schedule.boosterAgeYears);
  setValue("lag", scenario.schedule.assessmentLagDays);
  setValue("take", scenario.vaccine.takeContext);
  setValue("mu", scenario.vaccine.mu0);
  setRoundedInput("alpha", scenario.vaccine.alpha);
  setRoundedInput("hid50", scenario.vaccine.beta * (2 ** (1 / scenario.vaccine.alpha) - 1));
  setValue("dose-log", Math.log10(Math.max(scenario.vaccine.dose, 1)));
  byId<HTMLElement>("fixed-gamma").textContent = formatNumber(scenario.vaccine.gamma);
  byId<HTMLElement>("fixed-sigma").textContent = `${formatNumber(scenario.vaccine.sigma0)} log2`;
  byId<HTMLElement>("product-fixed-gamma").textContent = formatNumber(scenario.vaccine.gamma);
  byId<HTMLElement>("product-fixed-sigma").textContent = `${formatNumber(scenario.vaccine.sigma0)} log2`;
  byId<HTMLElement>("fixed-horizon").textContent = `${scenario.horizonDays} days`;
  byId<HTMLElement>("fixed-index-reference").textContent = formatNumber(scenario.indexReferenceExposure);
  syncProductEditability(scenario.vaccine.id);
  updateReadouts();
}

function readControls(previous: ScenarioV1): ScenarioV1 {
  const productId = byId<HTMLSelectElement>("product").value as ProductId;
  let scenario = productId === previous.vaccine.id ? structuredClone(previous) : scenarioWithProduct(previous, productId);
  // One decision-scope selector fixes both the reported scope (envelope) and the
  // inspected setting to the same named anchor.
  const scopeId = byId<HTMLSelectElement>("scope").value as AnchorSettingId;
  scenario = scenarioWithSetting(scenarioWithDecisionScope(scenario, scopeId), scopeId);
  scenario.schedule = {
    ...scenario.schedule,
    boosterAgeYears: Number(byId<HTMLSelectElement>("booster").value) as ScenarioV1["schedule"]["boosterAgeYears"],
    assessmentLagDays: Number(byId<HTMLSelectElement>("lag").value) as 28 | 90
  };
  if (scenario.vaccine.id === "hypothetical") {
    const alphaInput = preciseValue("alpha");
    scenario.vaccine = { ...scenario.vaccine, takeContext: numberValue("take"), mu0: numberValue("mu"), alpha: alphaInput, beta: Math.min(1e6, Math.max(0.001, preciseValue("hid50") / (2 ** (1 / alphaInput) - 1))), dose: 10 ** numberValue("dose-log") };
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
  if (productId === "ipv") note.textContent = "IPV is a fixed non-live comparator. It has no live-vaccine take coordinate; its mucosal effect depends on prior live infection and is not a next-gen gut mucosal design.";
  byId<HTMLElement>("take-help").textContent = "Productive live-vaccine infection after receipt; receipt itself is fixed at 100%.";
  byId<HTMLElement>("mu-help").textContent = "Latent OPV-equivalent mucosal immunity; not measured serum titer.";
}
function updateReadouts(): void {
  byId<HTMLOutputElement>("take-output").value = formatNumber(numberValue("take"));
  byId<HTMLOutputElement>("mu-output").value = `${formatNumber(numberValue("mu"))} log2`;
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
  const exactSelection = outputs.frontier.selectedDesign ? `Selected exact candidate: take ${formatNumber(outputs.frontier.selectedDesign.takeContext)}, boost ${formatNumber(outputs.frontier.selectedDesign.mu0)} log2.` : "Selected candidate is a fixed comparator.";
  const heldPoint = designPointByKey(outputs, view.persistentDesignKey);
  const heldSelection = heldPoint ? ` Held inspection design: take ${formatNumber(heldPoint.takeContext)}, boost ${formatNumber(heldPoint.mu0)} log2.` : " No inspection design is held.";
  const selected = `${exactSelection}${heldSelection}`;
  const withinHostDiagnostics = chart === "within-host" ? outputs.diagnostics : null;
  const diagnosticContext = chart === "within-host"
    ? ` Teaching grid: ${outputs.diagnostics.gridVersion}; reference challenge ${formatNumber(outputs.diagnostics.referenceChallengeDoseCID50)} CID50; assessment age ${outputs.diagnostics.assessmentAgeDays} days; shedding curves conditioned on WPV acquisition.`
    : " Direct cell evaluations determine status; Contours are interpolated display context.";
  const metadata = `${PRODUCT_LABELS[outputs.scenario.vaccine.id]}. ${presentation.candidate.schedule}; ${presentation.candidate.assessment}. Decision scope: ${presentation.result.scopeLabel}. Criterion: ${presentation.result.criterion}. ${presentation.result.qualification} ${selected}${diagnosticContext}`;
  const context = [
    `${presentation.candidate.schedule} · ${presentation.candidate.assessment}`,
    `Decision scope: ${presentation.result.scopeLabel} · direct R_loc ${formatNumber(presentation.result.value)}`,
    presentation.result.qualification,
    exactSelection,
    diagnosticContext,
    `${heldSelection.trim()} ${SVG_EXPORT_SCHEMA_VERSION} · ${BUILD_IDENTITY}`
  ];
  const visualMetadata = context.flatMap((line) => wrapSvgText(line, 168)).map((line, index) => `<text class="export-meta" x="24" y="${76 + index * 14}">${escapeXml(line)}</text>`).join("");
  const headerHeight = 76 + context.flatMap((line) => wrapSvgText(line, 168)).length * 14 + 18;
  const serialized = { exportSchemaVersion: SVG_EXPORT_SCHEMA_VERSION, buildIdentity: BUILD_IDENTITY, modelIdentity: outputs.modelIdentity, chart, diagnosticGridVersion: withinHostDiagnostics?.gridVersion ?? null, diagnosticGridSchemaVersion: withinHostDiagnostics?.gridSchemaVersion ?? null, withinHostDiagnostics, persistentDesignKey: view.persistentDesignKey };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + headerHeight}" viewBox="0 0 ${width} ${height + headerHeight}" role="img" aria-labelledby="export-title export-desc" data-export-schema="${SVG_EXPORT_SCHEMA_VERSION}" data-build-identity="${BUILD_IDENTITY}"${withinHostDiagnostics ? ` data-diagnostic-schema="${withinHostDiagnostics.schemaVersion}" data-diagnostic-grid="${withinHostDiagnostics.gridVersion}"` : ""}><title id="export-title">${escapeXml(chart)} figure · scientific prototype</title><desc id="export-desc">${escapeXml(metadata)}</desc><metadata>${escapeXml(JSON.stringify(serialized))}</metadata><style>${svgStyles()}</style><rect width="100%" height="100%" fill="${BRAND_COLORS.parchment}"/><text class="export-kicker" x="24" y="26">SCIENTIFIC PROTOTYPE · POINT RULE · ${escapeXml(chart.toUpperCase())}</text><text class="export-title" x="24" y="52">${escapeXml(PRODUCT_LABELS[outputs.scenario.vaccine.id])}</text>${visualMetadata}<g transform="translate(0 ${headerHeight})">${source.innerHTML}</g></svg>`;
}

function wrapSvgText(value: string, maxCharacters: number): string[] {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line.length === 0 ? word : `${line} ${word}`;
    if (line.length > 0 && next.length > maxCharacters) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines;
}

function svgStyles(): string {
  const colors = BRAND_COLORS;
  return [
    brandFontFaceCss(),
    `text{font-family:${BRAND_FONT_FAMILIES.sans};fill:${colors.weatheredSlate}}`,
    `.plot-bg{fill:${colors.white}}.grid-line{stroke:${colors.weatheredSlate};stroke-width:.7;stroke-opacity:.13}.tick-mark{stroke:${colors.weatheredSlate};stroke-width:1}`,
    `.tick,.anchor-label,.hybrid-label,.surface-legend,.chart-key{fill:${colors.weatheredSlate};fill-opacity:.78;font-size:10px}.axis-label{fill:${colors.weatheredSlate};font-size:12px;font-weight:800}.chart-kicker,.export-kicker{fill:${colors.dvDarkBlue};font-size:10px;font-weight:800;letter-spacing:1.4px}`,
    `.chart-title,.export-title,.teaching-panel-title{font-family:${BRAND_FONT_FAMILIES.serif};fill:${colors.weatheredSlate};font-size:20px;font-weight:600}.teaching-panel-title{font-size:16px}.teaching-panel-note,.teaching-reference-dose-label{fill:${colors.weatheredSlate};fill-opacity:.78;font-size:10px}.teaching-y-label{fill:${colors.weatheredSlate};font-size:10px}.teaching-panel-bg{stroke:${colors.weatheredSlate};stroke-opacity:.28;stroke-width:1}`,
    `.teaching-reference{fill:none;stroke:${colors.dvMediumOrange};stroke-width:3;stroke-dasharray:6 4;vector-effect:non-scaling-stroke}.teaching-candidate{fill:none;stroke:${colors.dvDarkMagenta};stroke-width:3;vector-effect:non-scaling-stroke}.teaching-reference-dose{stroke:${colors.dvDarkBlue};stroke-width:1.6;stroke-dasharray:4 3;vector-effect:non-scaling-stroke}.teaching-legend{fill:${colors.weatheredSlate};fill-opacity:.78;font-size:10px}.immunity-reference{fill:${colors.dvMediumOrange}}.immunity-candidate{fill:${colors.dvDarkMagenta}}`,
    `.surface-cell,.design-cell{stroke:none}.surface-cell.is-inspected{stroke:${colors.dvDarkMagenta};stroke-width:2;vector-effect:non-scaling-stroke}.threshold-line{fill:none;stroke:#000;stroke-width:2.2;stroke-dasharray:7 5;vector-effect:non-scaling-stroke}.pareto-line{fill:none;stroke:${colors.dvDarkTurquoise};stroke-width:3;vector-effect:non-scaling-stroke}.side-label{fill:${colors.weatheredSlate};font-size:10px;font-weight:800;letter-spacing:.7px;paint-order:stroke;stroke:${SCIENTIFIC_SURFACE_COLORS.threshold};stroke-opacity:.85;stroke-width:3px}`,
    `.anchor-point{fill:${colors.parchment};stroke:${colors.weatheredSlate};stroke-width:2;vector-effect:non-scaling-stroke}.decision-anchor{fill:${colors.weatheredSlate}}.hybrid-anchor{stroke:${colors.dvDarkOrange};stroke-dasharray:3 2}.decision-anchor-ring{fill:none;stroke:${colors.dvDarkBlue};stroke-width:2.5;vector-effect:non-scaling-stroke}.decision-scope-boundary{fill:none;stroke:${colors.dvDarkMagenta};stroke-width:3;stroke-dasharray:8 4;vector-effect:non-scaling-stroke}.hybrid-interval{stroke:${colors.dvDarkOrange};stroke-width:4;stroke-linecap:round}`,
    `.chart-readout rect{fill:${colors.white};fill-opacity:.91;stroke:${colors.weatheredSlate};stroke-width:.8}.chart-readout text{fill:${colors.weatheredSlate};font-size:10px}.chart-readout text:first-of-type{fill:${colors.dvDarkBlue};font-weight:800;letter-spacing:1px}.interpolation-note{fill:${colors.weatheredSlate};fill-opacity:.78;font-size:10px;font-style:italic}`,
    `.effect-point{vector-effect:non-scaling-stroke}.effect-point.passes{fill:${colors.weatheredSlate};stroke:none;opacity:.63}.effect-point.fails{fill:${colors.white};stroke:${colors.weatheredSlate};stroke-width:.75;opacity:.48}.comparator-marker{fill:${colors.parchment};stroke:${colors.weatheredSlate};stroke-width:2;vector-effect:non-scaling-stroke}.comparator-label,.selection-label{fill:${colors.weatheredSlate};font-size:10px;paint-order:stroke;stroke:${colors.parchment};stroke-width:3px}.selected-exact{fill:none;stroke:${colors.dvDarkBlue};stroke-width:2.5;vector-effect:non-scaling-stroke}.nearest-grid{fill:none;stroke:${colors.dvDarkOrange};stroke-width:2;vector-effect:non-scaling-stroke}.design-cell.is-inspected,.effect-point.is-inspected{stroke:${colors.dvDarkMagenta};stroke-width:3;opacity:1}.design-cell.is-persistent,.effect-point.is-persistent{stroke:${colors.dvDarkBlue};stroke-width:3;opacity:1}.empty-frontier{fill:${colors.dvDarkRed};font-family:${BRAND_FONT_FAMILIES.serif};font-size:16px;paint-order:stroke;stroke:${colors.parchment};stroke-width:4px}`,
    `.export-meta{fill:${colors.weatheredSlate};fill-opacity:.78;font-size:10px}`
  ].join("");
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
// Show a control at two significant figures while keeping the exact committed value in a data
// attribute, so an untouched field reads back exact (the model is unchanged) but the user sees a
// clean number. A user-typed value (differing from the rounded display) is read verbatim.
function setRoundedInput(id: string, exact: number): void {
  const element = document.getElementById(id) as HTMLInputElement | null;
  if (!element) return;
  element.value = String(Number(exact.toPrecision(2)));
  element.dataset.exact = String(exact);
}
function preciseValue(id: string): number {
  const element = byId<HTMLInputElement>(id);
  const shown = Number(element.value);
  if (element.dataset.exact === undefined) return shown;
  const exact = Number(element.dataset.exact);
  return Number(exact.toPrecision(2)) === shown ? exact : shown;
}
function byId<T extends HTMLElement>(id: string): T { const element = document.getElementById(id); if (!element) throw new Error(`Missing UI element #${id}`); return element as T; }
function unitExposure(value: number) { return { value, unit: "grams/exposure" as const, basis: "per_exposure" as const }; }
function unitFrequency(value: number) { return { value, unit: "exposures/person/day", basis: "per_day" as const }; }
function microgramsFromGrams(value: number): number { return value * MICROGRAMS_PER_GRAM; }
function gramsFromMicrograms(value: number): number { return value / MICROGRAMS_PER_GRAM; }
function formatMicrograms(valueInGrams: number): string {
  return formatNumber(microgramsFromGrams(valueInGrams));
}
function formatExposureFrequency(value: number): string {
  const exposures = value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return `${exposures} ${value === 1 ? "exposure" : "exposures"}/person/day`;
}
function formatAssessmentAge(days: number): string {
  return days < 730 ? `about ${Math.round(days / 30.44)} months` : `about ${(days / 365.25).toFixed(1)} years`;
}
// Two-digit display: >=1 -> 2 significant figures; 0.01<=|v|<1 -> 2 decimals;
// very large/small -> 2-decimal-mantissa scientific.
function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1e4 || abs < 0.01) return value.toExponential(1);
  return abs >= 1 ? String(Number(value.toPrecision(2))) : value.toFixed(2);
}
function formatScientific(value: number): string { return formatNumber(value); }
// Two significant figures, except never round a genuine sub-100% value up to "100%".
function formatPercent(value: number): string {
  const pct = 100 * value;
  const twoSig = formatNumber(pct);
  if (twoSig === "100" && value < 1) return `${(Math.floor(pct * 10) / 10).toFixed(1)}%`;
  return `${twoSig}%`;
}
function shortIdentity(value: string): string { return `${value.slice(0, 14)}…`; }
function csvValue(value: string): string { return `"${value.replaceAll('"', '""')}"`; }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function escapeHtml(value: string): string { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
// Render model variables written with underscores (R_loc, q_acq, N_s, …) as HTML
// subscripts at the view boundary, leaving the underlying strings plain so SVG
// exports and machine outputs stay literal.
function subVarsHtml(value: string): string { return escapeHtml(value).replace(/\b([RqNTd])_(loc|e|acq|shed|index|s|ih|hs)\b/g, (_m, base, sub) => `${base}<sub>${sub}</sub>`); }
// SVG subscript: a baseline-shifted, smaller tspan for in-figure variable subscripts.
function svgSub(base: string, subscript: string): string { return `${base}<tspan baseline-shift="sub" font-size="0.72em">${subscript}</tspan>`; }
function escapeXml(value: string): string { return escapeHtml(value).replaceAll("'", "&apos;"); }

installBrandFonts(document);
document.querySelector<HTMLElement>("#app") && mountApp(document.querySelector<HTMLElement>("#app")!);
