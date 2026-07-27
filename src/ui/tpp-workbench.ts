import { defaultScenario, scenarioWithProduct } from "../model/model";
import { decodeScenario, encodeScenario } from "../model/serialization";
import type { ScenarioV1 } from "../model/types";
import {
  buildComparatorProfile,
  buildTppProfile,
  decisionRecordMarkdown,
  findMechanismContrastPair,
  type MechanismCandidate,
  type MechanismContrastPair,
  type TppProfile
} from "./tpp-analysis";

const MODE_KEY = "polio-tpp-mode";
const REFERENCE_KEY = "polio-tpp-reference";

type WorkbenchMode = "learn" | "design";
type ReferenceKind = "pinned" | "sabin2" | "ipv";

interface StoredReference {
  kind: ReferenceKind;
  label?: string;
  scenario?: string;
}

interface WorkbenchState {
  current: TppProfile | null;
  reference: TppProfile | null;
  referenceKind: ReferenceKind | null;
  mechanismPair: MechanismContrastPair | null;
  lastIdentity: string | null;
  patchScheduled: boolean;
  patching: boolean;
}

export function installTppWorkbench(doc: Document): void {
  if (doc.getElementById("tpp-workbench")) return;
  const main = doc.querySelector<HTMLElement>("main#top");
  const hero = doc.querySelector<HTMLElement>(".hero");
  const firstChapter = doc.getElementById("within-host");
  if (!main || !hero || !firstChapter) return;

  const storedReference = loadStoredReference();
  const state: WorkbenchState = {
    current: null,
    reference: storedReference?.profile ?? null,
    referenceKind: storedReference?.kind ?? null,
    mechanismPair: null,
    lastIdentity: null,
    patchScheduled: false,
    patching: false
  };

  const modeSwitch = doc.createElement("div");
  modeSwitch.className = "tpp-mode-switch";
  modeSwitch.setAttribute("role", "group");
  modeSwitch.setAttribute("aria-label", "Choose how to use the model");
  modeSwitch.innerHTML = `<span>View</span><button type="button" data-tpp-mode="learn">Learn the causal chain</button><button type="button" data-tpp-mode="design">Compare product scenarios</button>`;
  hero.append(modeSwitch);

  const workbench = doc.createElement("section");
  workbench.id = "tpp-workbench";
  workbench.className = "chapter tpp-workbench";
  workbench.setAttribute("aria-labelledby", "tpp-workbench-heading");
  workbench.innerHTML = workbenchShell();
  main.insertBefore(workbench, firstChapter);

  installCausalChain(doc);
  installTransmissionWaterfall(doc);
  installDesignContext(doc);
  bindModeSwitch(doc, modeSwitch);
  bindWorkbenchActions(doc, workbench, state);
  setMode(doc, storedMode());

  let refreshScheduled = false;
  const refresh = (): void => {
    try {
      const next = buildTppProfile(scenarioFromHash());
      const nextIdentity = next.view.diagnostics.modelIdentity;
      if (state.lastIdentity !== null && state.lastIdentity !== nextIdentity) state.mechanismPair = null;
      state.lastIdentity = nextIdentity;
      state.current = next;
      refreshDynamicReference(state);
      renderWorkbench(doc, state);
      patchExistingNarrative(doc, state);
      if (state.current.transmission.reconciliationError > 1e-9) {
        console.warn("TPP transmission teaching diagnostic did not reconcile with direct R_loc", state.current.transmission);
      }
    } catch (error) {
      const target = doc.getElementById("tpp-profile-content");
      if (target) target.textContent = `The TPP translation layer could not evaluate this scenario: ${errorMessage(error)}`;
    }
  };
  const scheduleRefresh = (): void => {
    if (refreshScheduled) return;
    refreshScheduled = true;
    queueMicrotask(() => {
      refreshScheduled = false;
      refresh();
    });
  };

  installPatchObservers(doc, state, scheduleRefresh);
  window.addEventListener("hashchange", scheduleRefresh);
  scheduleRefresh();
}

function workbenchShell(): string {
  return `<div class="chapter-heading"><p class="chapter-number">TPP translation layer</p><div><h2 id="tpp-workbench-heading">Read the model as a product, schedule, and setting decision.</h2><p>This is the transmission-efficacy module of a target product profile, not a complete vaccine TPP. It keeps product assumptions, program conditions, modeled biological effects, epidemiologic context, and the direct close-contact decision in separate layers.</p></div></div>
    <div class="tpp-workbench-layout wide-breakout">
      <section class="tpp-panel" aria-labelledby="tpp-profile-heading">
        <div id="tpp-profile-content" aria-live="polite"><h3 id="tpp-profile-heading">Current transmission-relevant profile</h3><p>Evaluating the current scenario.</p></div>
        <div class="tpp-actions" aria-label="Profile actions">
          <button type="button" data-action="pin-current">Pin current scenario</button>
          <button type="button" data-action="compare-sabin">Use fixed Sabin 2 as reference</button>
          <button type="button" data-action="compare-ipv">Use fixed IPV as reference</button>
          <button type="button" data-action="export-record">Download decision record</button>
        </div>
      </section>
      <section class="tpp-panel" aria-labelledby="tpp-comparison-heading">
        <div class="tpp-panel-heading"><h3 id="tpp-comparison-heading">Comparison</h3><button type="button" class="text-button" data-action="clear-reference">Clear reference</button></div>
        <div id="tpp-comparison-content" aria-live="polite"><p>Pin the current scenario or choose a fixed comparator. Changes are then shown at each causal stage, not only at the final decision.</p></div>
      </section>
    </div>
    <p id="tpp-workbench-status" class="tpp-workbench-status" role="status" aria-live="polite"></p>
    <details class="tpp-experiments wide-breakout">
      <summary><span>Guided experiments</span><small>Use controlled contrasts to learn which part of the causal chain changed.</small></summary>
      <div class="tpp-experiment-grid">
        <fieldset><legend>Same product, different setting</legend><div class="tpp-button-row"><button type="button" data-action="set-scope" data-value="houston">Houston/Louisiana</button><button type="button" data-action="set-scope" data-value="matlab">Matlab</button><button type="button" data-action="set-scope" data-value="up-bihar">UP/Bihar</button></div><p>Changes only the named exposure and close-contact setting used for the direct decision.</p></fieldset>
        <fieldset><legend>Same product, different time</legend><div class="tpp-button-row"><button type="button" data-action="set-booster" data-value="0">No booster</button><button type="button" data-action="set-booster" data-value="1">Booster at 1 year</button><button type="button" data-action="set-lag" data-value="28">Assess at 28 days</button><button type="button" data-action="set-lag" data-value="90">Assess at 90 days</button></div><p>Separates a product property from schedule and waning effects.</p></fieldset>
        <fieldset class="tpp-mechanism-experiment"><legend>Similar shedding index, different mechanisms</legend><div id="tpp-mechanism-pair"><button type="button" data-action="find-pair">Find a matched pair for the current schedule</button></div><p>The pair is selected for similar q_index but opposing acquisition-versus-conditional-shedding effects. Direct R_loc remains the decision calculation.</p></fieldset>
      </div>
    </details>`;
}

function installCausalChain(doc: Document): void {
  const transmission = doc.getElementById("transmission");
  const motifIntro = transmission?.querySelector(".motif-intro");
  if (!transmission || !motifIntro || doc.getElementById("tpp-causal-chain")) return;
  const causal = doc.createElement("aside");
  causal.id = "tpp-causal-chain";
  causal.className = "tpp-causal-chain wide-breakout";
  causal.setAttribute("aria-labelledby", "tpp-causal-chain-heading");
  causal.innerHTML = `<p class="eyebrow" id="tpp-causal-chain-heading">THE MODEL'S CAUSAL OBJECTS</p>
    <div class="tpp-causal-row"><article><strong>Product + schedule</strong><span>dose response, context multiplier on take, boost, dose timing, waning</span></article><i aria-hidden="true">&#8594;</i><article><strong>Cohort distribution of mucosal immunity</strong><span>the same distribution is used for every child in the motif</span></article></div>
    <div class="tpp-causal-branch"><article><span>Recipient role</span><strong>Probability of productive WPV acquisition at each oral exposure</strong></article><article><span>Source role, if infected</span><strong>Duration and concentration of infectious shedding</strong></article></div>
    <div class="tpp-causal-row"><article><strong>Setting pressure on two links</strong><span>stool-equivalent mass per exposure x repeated exposures per day</span></article><i aria-hidden="true">&#8594;</i><article><strong>Condition on one breakthrough index</strong><span>index child &#8594; household child &#8594; close social contacts</span></article><i aria-hidden="true">&#8594;</i><article class="authoritative"><strong>Direct R<sub>loc</sub></strong><span>N<sub>s</sub> x P(one social contact infected)</span></article></div>
    <p class="tpp-conditioning-note"><strong>Conditioning matters:</strong> direct R<sub>loc</sub> begins with one breakthrough index child. The selected cohort's probability of becoming that index is shown separately; it is not multiplied into R<sub>loc</sub>.</p>`;
  motifIntro.insertAdjacentElement("afterend", causal);
}

function installTransmissionWaterfall(doc: Document): void {
  const readout = doc.querySelector<HTMLElement>("#transmission .motif-readout");
  if (!readout || doc.getElementById("tpp-transmission-waterfall")) return;
  const waterfall = doc.createElement("section");
  waterfall.id = "tpp-transmission-waterfall";
  waterfall.className = "tpp-transmission-waterfall wide-breakout";
  waterfall.setAttribute("aria-labelledby", "tpp-waterfall-heading");
  waterfall.innerHTML = `<p class="eyebrow">DIRECT CALCULATION</p><h3 id="tpp-waterfall-heading">How the selected setting builds R<sub>loc</sub></h3><div id="tpp-waterfall-content" aria-live="polite"><p>Evaluating the two transmission links.</p></div>`;
  readout.insertAdjacentElement("afterend", waterfall);
}

function installDesignContext(doc: Document): void {
  const maps = doc.querySelector<HTMLElement>("#design-space .linked-maps");
  if (!maps || doc.getElementById("tpp-design-context")) return;
  const context = doc.createElement("aside");
  context.id = "tpp-design-context";
  context.className = "tpp-design-context";
  context.setAttribute("aria-live", "polite");
  maps.insertAdjacentElement("beforebegin", context);
}

function bindModeSwitch(doc: Document, switcher: HTMLElement): void {
  switcher.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-tpp-mode]");
    if (!button) return;
    const mode = button.dataset.tppMode === "design" ? "design" : "learn";
    setMode(doc, mode);
  });
}

function bindWorkbenchActions(doc: Document, workbench: HTMLElement, state: WorkbenchState): void {
  workbench.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-action]");
    if (!button || !state.current) return;
    const action = button.dataset.action;
    if (action === "pin-current") setReference(state, buildTppProfile(state.current.scenario, "Pinned scenario"), "pinned");
    if (action === "compare-sabin") setReference(state, buildComparatorProfile(state.current.scenario, "sabin2"), "sabin2");
    if (action === "compare-ipv") setReference(state, buildComparatorProfile(state.current.scenario, "ipv"), "ipv");
    if (action === "clear-reference") clearReference(state);
    if (action === "export-record") downloadDecisionRecord(doc, state.current);
    if (action === "set-scope") {
      setReference(state, buildTppProfile(state.current.scenario, "Before setting change"), "pinned");
      setSelectValue(doc, "scope", button.dataset.value ?? "up-bihar");
    }
    if (action === "set-booster") {
      setReference(state, buildTppProfile(state.current.scenario, "Before schedule change"), "pinned");
      setSelectValue(doc, "booster", button.dataset.value ?? "0");
    }
    if (action === "set-lag") {
      setReference(state, buildTppProfile(state.current.scenario, "Before assessment-time change"), "pinned");
      setSelectValue(doc, "lag", button.dataset.value ?? "28");
    }
    if (action === "find-pair") {
      state.mechanismPair = findMechanismContrastPair(state.current.scenario);
      renderMechanismPair(doc, state);
    }
    if (action === "apply-pair-acquisition" && state.mechanismPair) {
      setReference(state, mechanismProfile(state.current.scenario, state.mechanismPair.sheddingLed, "Conditional-shedding-led matched design"), "pinned");
      applyMechanismCandidate(doc, state.mechanismPair.acquisitionLed);
    }
    if (action === "apply-pair-shedding" && state.mechanismPair) {
      setReference(state, mechanismProfile(state.current.scenario, state.mechanismPair.acquisitionLed, "Acquisition-led matched design"), "pinned");
      applyMechanismCandidate(doc, state.mechanismPair.sheddingLed);
    }
    renderComparison(doc, state);
  });
}

function installPatchObservers(doc: Document, state: WorkbenchState, refresh: () => void): void {
  const settingMap = doc.getElementById("setting-map");
  if (settingMap) {
    new MutationObserver(() => {
      if (state.patchScheduled) return;
      state.patchScheduled = true;
      requestAnimationFrame(() => {
        state.patchScheduled = false;
        patchSurfaceUnits(doc);
      });
    }).observe(settingMap, { childList: true, subtree: true, characterData: true });
  }
  const inspector = doc.getElementById("design-inspector");
  if (inspector) {
    const patchInspector = (): void => patchDesignInspector(doc);
    new MutationObserver(patchInspector).observe(inspector, { childList: true, subtree: true, characterData: true });
    patchInspector();
  }
  const transaction = doc.getElementById("transaction-status");
  if (transaction) {
    const syncTransactionState = (): void => {
      const committed = transaction.classList.contains("committed");
      setWorkbenchAvailability(doc, committed);
      if (committed) refresh();
    };
    new MutationObserver(syncTransactionState).observe(transaction, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
    syncTransactionState();
  }
}

function setWorkbenchAvailability(doc: Document, available: boolean): void {
  const workbench = doc.getElementById("tpp-workbench");
  if (!workbench) return;
  workbench.setAttribute("aria-busy", String(!available));
  workbench.querySelectorAll<HTMLButtonElement>("button[data-action]").forEach((button) => { button.disabled = !available; });
  const status = doc.getElementById("tpp-workbench-status");
  if (status) status.textContent = available
    ? "Profile, comparisons, and decision record reflect the committed model."
    : "Scientific controls changed; the workbench is retaining the last committed profile until the full model commits.";
}

function renderWorkbench(doc: Document, state: WorkbenchState): void {
  if (!state.current) return;
  renderProfile(doc, state.current);
  renderComparison(doc, state);
  renderMechanismPair(doc, state);
  renderWaterfall(doc, state.current);
  renderDesignContext(doc, state.current);
}

function renderProfile(doc: Document, profile: TppProfile): void {
  const target = doc.getElementById("tpp-profile-content");
  if (!target) return;
  const scenario = profile.scenario;
  const metrics = profile.view.metrics;
  const schedule = scenario.schedule;
  const takeRows = profile.doseTakeProbabilities.map((dose) => `<li><span>Dose ${dose.doseNumber}, day ${formatNumber(dose.day)}</span><strong>${dose.probability === null ? "not applicable" : formatPercent(dose.probability)}</strong></li>`).join("");
  const baseline = profile.sabinLikeStartingAssumptions
    ? `<p class="tpp-baseline-note"><strong>Starting design:</strong> Sabin-2-like dose-response, take-context, and mucosal-boost assumptions, evaluated under this selected schedule.</p>`
    : "";
  const comparator = scenario.vaccine.id === "hypothetical"
    ? ""
    : `<p class="tpp-baseline-note"><strong>Comparator convention:</strong> the fixed product is evaluated under the currently selected counterfactual schedule and setting, not asserted to be its licensed or historical regimen.</p>`;
  target.innerHTML = `<div class="tpp-profile-head"><div><p class="eyebrow">CURRENT PRODUCT x SCHEDULE x SETTING</p><h3 id="tpp-profile-heading">${escapeHtml(scenario.vaccine.label)}</h3></div><span class="tpp-threshold" data-state="${profile.decisionPasses ? "below" : "above"}">Direct R<sub>loc</sub> ${formatNumber(metrics.rLocEnvelopeMax)} - ${profile.decisionPasses ? "below threshold" : "at or above threshold"}</span></div>
    <p class="tpp-module-note">This profile is a deterministic transmission-efficacy scenario. It does not cover safety, genetic stability, manufacturability, delivery equity, or other complete-TPP domains.</p>
    ${baseline}${comparator}
    <div class="tpp-profile-groups">
      <article><h4>Product assumptions</h4><dl><div><dt>Context multiplier on take</dt><dd>${scenario.vaccine.live ? formatNumber(scenario.vaccine.takeContext) : "not applicable"}</dd></div><div><dt>Vaccine HID50</dt><dd>${scenario.vaccine.live ? `${formatNumber(profile.hid50CID50)} CID50` : "not applicable"}</dd></div><div><dt>Heterogeneity, 1/alpha</dt><dd>${scenario.vaccine.live ? formatNumber(profile.heterogeneity) : "not applicable"}</dd></div><div><dt>Administered dose</dt><dd>${scenario.vaccine.live ? `${formatNumber(scenario.vaccine.dose)} TCID50` : "not applicable"}</dd></div><div><dt>Mean boost given take</dt><dd>${scenario.vaccine.live ? `${formatNumber(scenario.vaccine.mu0)} log2` : "not applicable"}</dd></div><div><dt>Fixed boost SD</dt><dd>${scenario.vaccine.live ? `${formatNumber(scenario.vaccine.sigma0)} log2` : "not applicable"}</dd></div><div><dt>Fixed immunity sensitivity, gamma</dt><dd>${scenario.vaccine.live ? formatNumber(scenario.vaccine.gamma) : "not applicable"}</dd></div></dl></article>
      <article><h4>Program conditions</h4><dl><div><dt>Routine schedule</dt><dd>6, 10, and 14 weeks</dd></div><div><dt>Booster</dt><dd>${schedule.boosterAgeYears > 0 ? `year ${schedule.boosterAgeYears}` : "none"}</dd></div><div><dt>Assessment</dt><dd>${schedule.assessmentLagDays} days after last dose</dd></div><div><dt>Receipt</dt><dd>100% assumption</dd></div></dl><h4>Modeled take by dose</h4><ul class="tpp-take-list">${takeRows || "<li><span>Live take</span><strong>not applicable</strong></li>"}</ul></article>
      <article><h4>Modeled biological effects</h4><dl><div><dt>Mean mucosal state</dt><dd>${formatNumber(profile.meanMucosalLog2)} log2</dd></div><div><dt>Acquisition reduction</dt><dd>${formatPercent(1 - metrics.qAcq)}</dd></div><div><dt>Conditional shedding reduction</dt><dd>${formatPercent(1 - metrics.qShed)}</dd></div><div><dt>Relative shedding index</dt><dd>${formatNumber(metrics.qIndex)}</dd></div></dl><p>The mean state and q<sub>index</sub> are reading aids. Production retains the full distribution, and direct R<sub>loc</sub> is the pass/fail rule.</p></article>
      <article><h4>Epidemiologic decision context</h4><dl><div><dt>Decision setting</dt><dd>${escapeHtml(profile.scopeLabel)}</dd></div><div><dt>Index condition</dt><dd>one breakthrough index child</dd></div><div><dt>Direct R<sub>loc</sub></dt><dd>${formatNumber(metrics.rLocEnvelopeMax)}</dd></div><div><dt>Margin, 1 - R<sub>loc</sub></dt><dd>${formatSigned(profile.decisionMargin)}</dd></div></dl><p><strong>Evidence status:</strong> one point parameter set. Threshold-crossing uncertainty is not quantified.</p></article>
    </div>`;
}

function renderComparison(doc: Document, state: WorkbenchState): void {
  const target = doc.getElementById("tpp-comparison-content");
  if (!target || !state.current) return;
  if (!state.reference) {
    target.innerHTML = `<p>Pin the current scenario or choose a fixed comparator. Changes will be decomposed into take, mucosal state, acquisition, conditional shedding, and direct R<sub>loc</sub>.</p>`;
    return;
  }
  const reference = state.reference;
  const current = state.current;
  const rows = [
    comparisonRow("Effective first-dose take", reference.view.metrics.effectiveFirstDoseTake, current.view.metrics.effectiveFirstDoseTake, "percent", true),
    comparisonRow("Mean mucosal state", reference.meanMucosalLog2, current.meanMucosalLog2, "number", true),
    comparisonRow("Acquisition reduction", 1 - reference.view.metrics.qAcq, 1 - current.view.metrics.qAcq, "percent", true),
    comparisonRow("Conditional shedding reduction", 1 - reference.view.metrics.qShed, 1 - current.view.metrics.qShed, "percent", true),
    comparisonRow("Direct R_loc", reference.view.metrics.rLocEnvelopeMax, current.view.metrics.rLocEnvelopeMax, "number", false)
  ].join("");
  target.innerHTML = `<p><strong>Reference:</strong> ${escapeHtml(reference.label)} - ${escapeHtml(profileContext(reference))}<br><strong>Current:</strong> ${escapeHtml(current.scenario.vaccine.label)} - ${escapeHtml(profileContext(current))}</p><div class="tpp-comparison-table" role="table" aria-label="Reference and current model outputs"><div class="tpp-comparison-header" role="row"><span role="columnheader">Quantity</span><span role="columnheader">Reference</span><span role="columnheader">Current</span><span role="columnheader">Change</span></div>${rows}</div>`;
}

function renderMechanismPair(doc: Document, state: WorkbenchState): void {
  const target = doc.getElementById("tpp-mechanism-pair");
  if (!target) return;
  const pair = state.mechanismPair;
  if (!pair) {
    target.innerHTML = `<button type="button" data-action="find-pair">Find a matched pair for the current schedule</button>`;
    return;
  }
  target.innerHTML = `<p>Matched q<sub>index</sub> gap: ${formatPercent(pair.relativeQIndexGap)}. Direct R<sub>loc</sub> differs by ${formatPercent(pair.relativeRLocGap)} because the two designs trade acquisition against shedding after breakthrough.</p><div class="tpp-mechanism-cards"><button type="button" data-action="apply-pair-acquisition"><strong>Acquisition-led design</strong><span>take multiplier ${formatNumber(pair.acquisitionLed.takeContext)}; boost ${formatNumber(pair.acquisitionLed.mu0)} log2</span><span>q<sub>acq</sub> ${formatNumber(pair.acquisitionLed.qAcq)}; q<sub>shed</sub> ${formatNumber(pair.acquisitionLed.qShed)}; q<sub>index</sub> ${formatNumber(pair.acquisitionLed.qIndex)}</span><span>direct R<sub>loc</sub> ${formatNumber(pair.acquisitionLed.rLoc)} - ${pair.acquisitionLed.passes ? "below" : "at or above"} threshold</span></button><button type="button" data-action="apply-pair-shedding"><strong>Conditional-shedding-led design</strong><span>take multiplier ${formatNumber(pair.sheddingLed.takeContext)}; boost ${formatNumber(pair.sheddingLed.mu0)} log2</span><span>q<sub>acq</sub> ${formatNumber(pair.sheddingLed.qAcq)}; q<sub>shed</sub> ${formatNumber(pair.sheddingLed.qShed)}; q<sub>index</sub> ${formatNumber(pair.sheddingLed.qIndex)}</span><span>direct R<sub>loc</sub> ${formatNumber(pair.sheddingLed.rLoc)} - ${pair.sheddingLed.passes ? "below" : "at or above"} threshold</span></button></div>`;
}

function renderWaterfall(doc: Document, profile: TppProfile): void {
  const target = doc.getElementById("tpp-waterfall-content");
  if (!target) return;
  const transmission = profile.transmission;
  const setting = transmission.setting;
  target.innerHTML = `<p class="tpp-conditioning-note"><strong>Start condition:</strong> one infected index child drawn from the selected cohort's breakthrough distribution. The ${formatPercent(transmission.indexAcquisitionProbability)} reference-challenge acquisition probability is context, not an outer multiplier on R<sub>loc</sub>.</p>
    <ol class="tpp-waterfall-list">
      <li><span>1. Index &#8594; household</span><strong>${formatPercent(transmission.householdInfectionProbability)}</strong><p>P(household child infected | breakthrough index), using ${formatMicrograms(setting.Tih.value)} micrograms/exposure x ${formatFrequency(setting.dIh.value)}.</p></li>
      <li><span>2. Household &#8594; one social contact</span><strong>${formatPercent(transmission.socialGivenHouseholdProbability)}</strong><p>Conditional on household infection, averaged over its source-immunity state; each new household infection receives the full second-link horizon. ${formatMicrograms(setting.Ths.value)} micrograms/exposure x ${formatFrequency(setting.dHs.value)}.</p></li>
      <li><span>3. One complete two-link path</span><strong>${formatPercent(transmission.singleSocialContactProbability)}</strong><p>P(one close social contact infected | breakthrough index).</p></li>
      <li><span>4. Fan out to N<sub>s</sub> contacts</span><strong>${formatNumber(setting.Ns)} x ${formatPercent(transmission.singleSocialContactProbability)}</strong><p>Expected tertiary infections add across the declared close social contacts.</p></li>
      <li class="authoritative"><span>5. Direct close-contact result</span><strong>R<sub>loc</sub> = ${formatNumber(transmission.directRLoc)}</strong><p>Reconstructed value ${formatNumber(transmission.reconstructedRLoc)}; reconciliation error ${transmission.reconciliationError.toExponential(1)}.</p></li>
    </ol>`;
}

function renderDesignContext(doc: Document, profile: TppProfile): void {
  const target = doc.getElementById("tpp-design-context");
  if (!target) return;
  const scenario = profile.scenario;
  const family = profile.designFamily;
  target.innerHTML = `<strong>Held fixed across both maps:</strong> ${escapeHtml(family.sourceLabel)} with HID50 ${formatNumber(family.hid50CID50)} CID50, heterogeneity 1/alpha ${formatNumber(family.heterogeneity)}, administered dose ${formatNumber(family.administeredDoseTCID50)} TCID50, routine schedule plus ${scenario.schedule.boosterAgeYears > 0 ? `year-${scenario.schedule.boosterAgeYears} booster` : "no booster"}, assessment at ${scenario.schedule.assessmentLagDays} days, and ${escapeHtml(profile.scopeLabel)}. <span>Only the context multiplier on take and maximum mean boost vary. The boundary is a point-model result, not a confidence or uncertainty interval.</span>`;
}

function patchExistingNarrative(doc: Document, state: WorkbenchState): void {
  if (state.patching) return;
  state.patching = true;
  try {
    patchHero(doc);
    patchTakeControl(doc);
    patchMeasurementLanguage(doc);
    patchPrintSummary(doc);
    patchDesignInspector(doc);
    patchSurfaceUnits(doc);
    if (state.current) {
      patchDesignMaps(doc, state.current);
      patchAcquisitionLanguage(doc, state.current);
      patchDecisionLanguage(doc, state.current);
      renderWaterfall(doc, state.current);
      renderDesignContext(doc, state.current);
    }
  } finally {
    state.patching = false;
  }
}

function patchHero(doc: Document): void {
  const paragraphs = doc.querySelectorAll<HTMLElement>(".hero .orienting");
  const first = paragraphs[0];
  const second = paragraphs[1];
  if (first && first.dataset.tppPatched !== "true") {
    first.innerHTML = `<strong>What this is, and what to look for.</strong> This transmission-efficacy module builds on the published polio immunity, shedding, and close-contact model (PLoS Biology, 2018). A product and schedule create a distribution of mucosal immunity; that distribution changes productive WPV acquisition and infectious shedding after breakthrough. The selected setting converts those effects into a direct close-contact result. The pass/fail quantity is direct R<sub>loc</sub> &lt; 1. The shedding index is a reference summary, not the decision rule.`;
    first.dataset.tppPatched = "true";
  }
  if (second && second.dataset.tppPatched !== "true") {
    second.innerHTML = `<strong>How to use it.</strong> Use <em>Learn the causal chain</em> to read the mechanism in order. Use <em>Compare product scenarios</em> to keep the TPP profile, controlled contrasts, setting, decision, and linked requirement maps together. Every view uses the same deterministic model engine.`;
    second.dataset.tppPatched = "true";
  }
}

function patchTakeControl(doc: Document): void {
  const input = doc.getElementById("take");
  const label = input?.closest("label");
  if (!input || !label) return;
  const firstNode = Array.from(label.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim().length > 0);
  const labelText = "Context multiplier on vaccine take ";
  if (firstNode && firstNode.textContent !== labelText) firstNode.textContent = labelText;
  const help = doc.getElementById("take-help");
  const helpText = "Multiplies dose- and immunity-dependent productive take. It is not itself a take probability; modeled take is shown by dose in the TPP profile.";
  if (help && help.textContent !== helpText) help.textContent = helpText;
}

function patchMeasurementLanguage(doc: Document): void {
  const rows = doc.querySelectorAll<HTMLTableRowElement>("#measurement tbody tr");
  const row = Array.from(rows).find((candidate) => candidate.querySelector("th")?.textContent?.includes("Biological take context"));
  if (!row || row.dataset.tppTakeSemantics === "multiplier") return;
  row.dataset.tppTakeSemantics = "multiplier";
  const heading = row.querySelector("th");
  const cells = row.querySelectorAll("td");
  if (heading) heading.textContent = "Context multiplier on vaccine take";
  if (cells[1]) cells[1].textContent = "Multiplicative context factor applied to dose- and immunity-dependent productive live-vaccine take; not receipt, coverage, or a take probability by itself.";
}

function patchPrintSummary(doc: Document): void {
  const summary = doc.getElementById("print-product-summary");
  if (!summary) return;
  summary.querySelectorAll<HTMLElement>("dt").forEach((term) => {
    if (term.textContent?.trim() === "Biological take") term.textContent = "Take-context multiplier";
  });
  const paragraph = summary.querySelector<HTMLElement>("p:last-child");
  if (paragraph?.textContent?.startsWith("Biological take is productive live-vaccine infection")) {
    paragraph.textContent = "Productive live-vaccine infection after a received dose is the biological take event. The take-context value shown here multiplies dose- and immunity-dependent productive take; it is not receipt, coverage, or a take probability by itself. These product parameters determine the take/no-take split and schedule-derived mucosal-immunity distribution; they do not change the fixed WPV challenge equation.";
  }
}

function patchDesignInspector(doc: Document): void {
  doc.querySelectorAll<HTMLElement>("#design-inspector dt").forEach((term) => {
    if (term.textContent?.trim() === "Take context") term.textContent = "Take-context multiplier";
  });
}

function patchAcquisitionLanguage(doc: Document, profile: TppProfile): void {
  const qAcq = profile.view.metrics.qAcq;
  const within = doc.querySelectorAll<HTMLElement>("#within-host-readout article")[1]?.querySelector<HTMLElement>("p");
  const withinHtml = `Naive reference to selected cohort: relative probability of productive WPV acquisition at one HID50 = ${formatNumber(qAcq)}. The source convention observes acquisition through subsequent shedding; this is the acquisition component of the relative risk of shedding, not the amount shed after infection.`;
  if (within && within.innerHTML !== withinHtml) within.innerHTML = withinHtml;
  const mechanism = doc.querySelectorAll<HTMLElement>("#mechanism-values article")[0]?.querySelector<HTMLElement>("p");
  const mechanismHtml = `Residual productive WPV acquisition probability at the reference challenge = ${formatNumber(qAcq)}. This is distinct from conditional shedding after breakthrough.`;
  if (mechanism && mechanism.innerHTML !== mechanismHtml) mechanism.innerHTML = mechanismHtml;
}

function patchDecisionLanguage(doc: Document, profile: TppProfile): void {
  const status = doc.getElementById("result-status");
  const headline = status?.querySelector<HTMLElement>("h2");
  if (!status || !headline) return;
  const scope = (doc.getElementById("scope") as HTMLSelectElement | null)?.value;
  const headlineText = status.classList.contains("pass")
    ? scope === "up-bihar"
      ? "This product-and-schedule scenario clears the hardest known modeled anchor."
      : "This product-and-schedule scenario is below the selected close-contact threshold."
    : status.classList.contains("tie")
      ? "This product-and-schedule scenario is at the threshold and does not satisfy the strict rule."
      : status.classList.contains("fail")
        ? "This product-and-schedule scenario is at or above the selected close-contact threshold."
        : headline.textContent ?? "";
  if (headline.textContent !== headlineText) headline.textContent = headlineText;
  let note = status.querySelector<HTMLElement>(".tpp-point-note");
  if (!note) {
    note = doc.createElement("p");
    note.className = "tpp-point-note";
    status.append(note);
  }
  const noteHtml = `<strong>Evidence status:</strong> deterministic point-parameter result. Threshold-crossing probability and parameter uncertainty are not quantified.`;
  if (note.innerHTML !== noteHtml) note.innerHTML = noteHtml;
  if (status.dataset.tppDecisionObject !== "product-schedule-setting") status.dataset.tppDecisionObject = "product-schedule-setting";
}

function patchSurfaceUnits(doc: Document): void {
  const svg = doc.querySelector<SVGSVGElement>("#setting-figure");
  if (!svg || svg.dataset.tppUnits === "per-exposure") return;
  // Mark first so the MutationObserver triggered by the text edits below is a no-op.
  svg.dataset.tppUnits = "per-exposure";
  const desc = svg.querySelector("#setting-desc");
  if (desc?.textContent) {
    const next = desc.textContent
      .replace("micrograms of stool exposure per day", "micrograms of linked stool-equivalent mass per exposure on both links")
      .replace("micrograms of stool exposure per exposure", "micrograms of linked stool-equivalent mass per exposure on both links");
    if (next !== desc.textContent) desc.textContent = next;
  }
  svg.querySelectorAll("rect.surface-cell > title").forEach((title) => {
    const current = title.textContent ?? "";
    const next = current
      .replaceAll("µg/day", "µg/exposure")
      .replaceAll("micrograms/day", "micrograms/exposure")
      .replaceAll("micrograms per day", "micrograms per exposure");
    if (next !== current) title.textContent = next;
  });
  svg.querySelectorAll<SVGTextElement>("text.axis-label").forEach((text) => {
    if (text.textContent?.includes("Stool exposure per day")) text.textContent = "Linked stool-equivalent mass per exposure (µg; log scale)";
  });
  const readout = svg.querySelector<SVGGElement>(".chart-readout");
  const valueLine = readout?.querySelectorAll("text")[1];
  if (valueLine?.textContent) {
    const next = valueLine.textContent.replaceAll("µg/day", "µg/exposure").replaceAll("micrograms/day", "micrograms/exposure");
    if (next !== valueLine.textContent) valueLine.textContent = next;
  }
}

function patchDesignMaps(doc: Document, profile: TppProfile): void {
  const effect = doc.querySelector<SVGSVGElement>("#effect-figure");
  const product = doc.querySelector<SVGSVGElement>("#product-figure");
  if (effect && effect.dataset.tppSemantics !== "reference-challenge") {
    effect.dataset.tppSemantics = "reference-challenge";
    const title = effect.querySelector("#effect-title");
    if (title) title.textContent = "Reference-challenge effect space";
    const desc = effect.querySelector("#effect-desc");
    if (desc) desc.textContent = "The evaluated hypothetical product family shown by reduction in productive WPV acquisition at one reference HID50 and reduction in conditional breakthrough shedding burden. Direct R_loc determines status. The minimum-sufficient line is a point-model boundary, not an uncertainty interval.";
  }
  if (product && product.dataset.tppSemantics !== "take-multiplier-boost") {
    product.dataset.tppSemantics = "take-multiplier-boost";
    const title = product.querySelector("#product-title");
    if (title) title.textContent = "Take-multiplier and mean-boost design space";
    const desc = product.querySelector("#product-desc");
    if (desc) desc.textContent = "The same evaluated hypothetical product family shown by context multiplier on productive vaccine take and maximum mean mucosal boost. All other product, schedule, assessment, setting, and point-parameter assumptions are held fixed as stated above.";
    product.querySelectorAll<SVGTextElement>("text.axis-label").forEach((text) => {
      if (text.textContent?.includes("Biological take context")) text.textContent = "Context multiplier on vaccine take";
    });
    product.querySelectorAll("rect.design-cell > title").forEach((title) => {
      if (title.textContent?.startsWith("take ")) title.textContent = title.textContent.replace(/^take /, "take multiplier ");
    });
  }
  for (const chart of [effect, product]) {
    if (!chart || chart.dataset.tppBaseline === String(profile.sabinLikeStartingAssumptions)) continue;
    chart.dataset.tppBaseline = String(profile.sabinLikeStartingAssumptions);
    const selectedLabel = chart.querySelector<SVGTextElement>(".selection-label");
    const sabinLabel = Array.from(chart.querySelectorAll<SVGTextElement>(".comparator-label")).find((label) => label.textContent?.includes("fixed Sabin 2"));
    const sabinMarker = sabinLabel?.previousElementSibling as SVGElement | null;
    if (profile.sabinLikeStartingAssumptions) {
      if (selectedLabel) selectedLabel.textContent = "selected = Sabin-2-like";
      // The versioned hypothetical starting point is identical to fixed Sabin 2 in
      // both product and reference-effect coordinates. Suppress the duplicate mark and
      // label the single selected point, rather than implying two separable products.
      if (sabinMarker?.classList.contains("comparator-marker")) sabinMarker.setAttribute("display", "none");
      if (sabinLabel) sabinLabel.setAttribute("display", "none");
    } else {
      if (sabinMarker?.classList.contains("comparator-marker")) sabinMarker.removeAttribute("display");
      if (sabinLabel) sabinLabel.removeAttribute("display");
    }
  }
  const figures = doc.querySelectorAll<HTMLElement>("#design-space .linked-maps figure");
  const effectCaption = figures[0]?.querySelector("figcaption");
  const productCaption = figures[1]?.querySelector("figcaption");
  const effectHtml = `<strong>Reference-challenge effect space.</strong> Each mark is one evaluated product under the held-fixed context above. The turquoise line is the minimum-sufficient boundary within this evaluated product family. The axes are modeled outcomes, not independently tunable specifications, and the line is not an uncertainty interval.`;
  const productHtml = `<strong>Two-parameter product-assumption slice.</strong> This map varies only the context multiplier on take and maximum mean mucosal boost. HID50, dose-response heterogeneity, administered dose, schedule, assessment time, setting, and all other assumptions remain fixed at the values stated above.`;
  if (effectCaption && effectCaption.innerHTML !== effectHtml) effectCaption.innerHTML = effectHtml;
  if (productCaption && productCaption.innerHTML !== productHtml) productCaption.innerHTML = productHtml;
}

function comparisonRow(label: string, reference: number, current: number, format: "number" | "percent", higherIsBetter: boolean): string {
  const delta = current - reference;
  const improved = Math.abs(delta) < 1e-12 ? null : higherIsBetter ? delta > 0 : delta < 0;
  const display = format === "percent" ? formatPercent : formatNumber;
  return `<div class="tpp-comparison-row" role="row"><span role="cell">${escapeHtml(label)}</span><span role="cell">${display(reference)}</span><span role="cell">${display(current)}</span><span role="cell" data-direction="${improved === null ? "same" : improved ? "better" : "worse"}">${format === "percent" ? formatSignedPercent(delta) : formatSigned(delta)}</span></div>`;
}

function setReference(state: WorkbenchState, profile: TppProfile, kind: ReferenceKind): void {
  state.reference = profile;
  state.referenceKind = kind;
  try {
    const stored: StoredReference = kind === "pinned"
      ? { kind, label: profile.label, scenario: encodeScenario(profile.scenario) }
      : { kind };
    sessionStorage.setItem(REFERENCE_KEY, JSON.stringify(stored));
  } catch {
    // Session persistence is optional; the in-memory comparison remains available.
  }
}

function clearReference(state: WorkbenchState): void {
  state.reference = null;
  state.referenceKind = null;
  try { sessionStorage.removeItem(REFERENCE_KEY); } catch { /* optional storage */ }
}

function refreshDynamicReference(state: WorkbenchState): void {
  if (!state.current) return;
  if (state.referenceKind === "sabin2") state.reference = buildComparatorProfile(state.current.scenario, "sabin2");
  if (state.referenceKind === "ipv") state.reference = buildComparatorProfile(state.current.scenario, "ipv");
}

function loadStoredReference(): { kind: ReferenceKind; profile: TppProfile | null } | null {
  try {
    const raw = sessionStorage.getItem(REFERENCE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredReference;
    if (stored.kind === "pinned" && stored.scenario) {
      return { kind: "pinned", profile: buildTppProfile(decodeScenario(stored.scenario), stored.label ?? "Pinned scenario") };
    }
    if (stored.kind === "sabin2" || stored.kind === "ipv") return { kind: stored.kind, profile: null };
    return null;
  } catch {
    return null;
  }
}

function mechanismProfile(base: ScenarioV1, candidate: MechanismCandidate, label: string): TppProfile {
  // A mechanism pair belongs to the currently evaluated hypothetical family. Preserve
  // HID50, heterogeneity, administered dose, and fixed response assumptions when the
  // selected product is already hypothetical; fixed comparators use versioned defaults.
  const scenario = base.vaccine.id === "hypothetical"
    ? structuredClone(base)
    : scenarioWithProduct(structuredClone(base), "hypothetical");
  scenario.comparatorId = "hypothetical";
  scenario.schedule = { ...scenario.schedule, productId: "hypothetical" };
  scenario.vaccine = { ...scenario.vaccine, takeContext: candidate.takeContext, mu0: candidate.mu0 };
  return buildTppProfile(scenario, label);
}

function profileContext(profile: TppProfile): string {
  const schedule = profile.scenario.schedule;
  const booster = schedule.boosterAgeYears > 0 ? `booster at year ${schedule.boosterAgeYears}` : "no booster";
  return `${profile.scopeLabel}; ${booster}; assessed ${schedule.assessmentLagDays} days after last dose`;
}

function applyMechanismCandidate(doc: Document, candidate: MechanismCandidate): void {
  const product = doc.getElementById("product") as HTMLSelectElement | null;
  // Dispatching a redundant product change would reload versioned defaults and silently
  // discard the current HID50, heterogeneity, and dose. Change product only when needed.
  if (product?.value !== "hypothetical") setSelectValue(doc, "product", "hypothetical");
  setRangeValue(doc, "take", candidate.takeContext);
  setRangeValue(doc, "mu", candidate.mu0);
}

function setSelectValue(doc: Document, id: string, value: string): void {
  const select = doc.getElementById(id) as HTMLSelectElement | null;
  if (!select) return;
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function setRangeValue(doc: Document, id: string, value: number): void {
  const input = doc.getElementById(id) as HTMLInputElement | null;
  if (!input) return;
  input.value = String(value);
  delete input.dataset.exact;
  delete input.dataset.exactIndex;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function downloadDecisionRecord(doc: Document, profile: TppProfile): void {
  const blob = new Blob([decisionRecordMarkdown(profile)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = doc.createElement("a");
  link.href = url;
  link.download = "polio-tpp-transmission-decision-record.md";
  link.hidden = true;
  doc.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function setMode(doc: Document, mode: WorkbenchMode): void {
  doc.body.dataset.tppMode = mode;
  doc.querySelectorAll<HTMLButtonElement>("button[data-tpp-mode]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.tppMode === mode));
  });
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* optional storage */ }
}

function storedMode(): WorkbenchMode {
  try { return localStorage.getItem(MODE_KEY) === "design" ? "design" : "learn"; }
  catch { return "learn"; }
}

function scenarioFromHash(): ScenarioV1 {
  const prefix = "#scenario=";
  if (!window.location.hash.startsWith(prefix)) return defaultScenario();
  try { return decodeScenario(window.location.hash.slice(prefix.length)); }
  catch { return defaultScenario(); }
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1e4 || abs < 0.01) return value.toExponential(1);
  return abs >= 1 ? String(Number(value.toPrecision(2))) : value.toFixed(2);
}

function formatPercent(value: number): string {
  const percent = 100 * value;
  const displayed = formatNumber(percent);
  if (displayed === "100" && value < 1) return `${(Math.floor(percent * 10) / 10).toFixed(1)}%`;
  return `${displayed}%`;
}

function formatSigned(value: number): string {
  if (Math.abs(value) < 1e-12) return "0";
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

function formatSignedPercent(value: number): string {
  if (Math.abs(value) < 1e-12) return "0%";
  return `${value > 0 ? "+" : ""}${formatPercent(value)}`;
}

function formatMicrograms(grams: number): string { return formatNumber(grams * 1_000_000); }
function formatFrequency(value: number): string { return `${formatNumber(value)} ${value === 1 ? "exposure" : "exposures"}/person/day`; }
function escapeHtml(value: string): string { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
