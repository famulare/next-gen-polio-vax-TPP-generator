import { defaultScenario } from "../model/model";
import { SETTING_ANCHORS } from "../model/parameters";
import { decodeScenario } from "../model/serialization";
import type { ScenarioV1 } from "../model/types";

/**
 * Keeps the named markers honest when the setting surface adopts the selected
 * decision anchor's link frequencies. A two-dimensional linked-exposure slice
 * cannot simultaneously contain anchors with different d_ih/d_hs values, so
 * incompatible markers are omitted rather than placed over the wrong raster.
 */
export function installSettingSurfaceScope(doc: Document): void {
  const host = doc.getElementById("setting-map");
  if (!host) return;
  let scheduled = false;
  const schedule = (): void => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      patchSurfaceScope(doc);
    });
  };
  new MutationObserver(schedule).observe(host, { childList: true, subtree: true });
  window.addEventListener("hashchange", schedule);
  schedule();
}

function patchSurfaceScope(doc: Document): void {
  const host = doc.getElementById("setting-map");
  if (!host) return;
  const svg = doc.querySelector<SVGSVGElement>("#setting-figure");
  if (!svg) return;
  const scenario = scenarioFromHash();
  const signature = `${scenario.setting.id}:${scenario.setting.dIh.value}:${scenario.setting.dHs.value}`;
  if (svg.dataset.tppFrequencySlice === signature) return;
  // Set the guard before editing descendants; those edits trigger the observer.
  svg.dataset.tppFrequencySlice = signature;

  const compatibleIds = new Set(SETTING_ANCHORS
    .filter((anchor) => sameFrequency(anchor.dIh.value, scenario.setting.dIh.value)
      && sameFrequency(anchor.dHs.value, scenario.setting.dHs.value))
    .map((anchor) => anchor.id));

  const outerAnchorGroups = Array.from(svg.querySelectorAll<SVGGElement>("g.anchor-group"))
    .filter((group) => Array.from(group.children).some((child) => child.matches("text.anchor-label")));
  for (const group of outerAnchorGroups) {
    const label = Array.from(group.children).find((child) => child.matches("text.anchor-label"))?.textContent ?? "";
    const anchorId = label.includes("Houston") ? "houston" : label.includes("Matlab") ? "matlab" : label.includes("UP/Bihar") ? "up-bihar" : null;
    if (!anchorId) continue;
    const compatible = compatibleIds.has(anchorId);
    group.toggleAttribute("hidden", !compatible);
    if (compatible) group.removeAttribute("display"); else group.setAttribute("display", "none");
    group.setAttribute("aria-hidden", String(!compatible));
  }

  const kicker = svg.querySelector<SVGTextElement>("text.chart-kicker");
  if (kicker) kicker.textContent = "R_LOC ACROSS SETTINGS · FREQUENCIES FROM CHOSEN ANCHOR";
  const desc = svg.querySelector("#setting-desc");
  if (desc && !desc.textContent?.includes("exposure frequencies are held")) {
    desc.textContent = `${desc.textContent ?? ""} The two link exposure frequencies are held at the selected decision setting; named markers with different frequencies are omitted from this slice.`;
  }

  const figure = host.closest("figure");
  if (!figure) return;
  let note = figure.querySelector<HTMLElement>(".tpp-surface-slice-note");
  if (!note) {
    note = doc.createElement("p");
    note.className = "tpp-conditioning-note tpp-surface-slice-note";
    figure.append(note);
  }
  const hiddenLabels = SETTING_ANCHORS.filter((anchor) => !compatibleIds.has(anchor.id)).map((anchor) => anchor.label);
  note.innerHTML = `<strong>Frequency slice:</strong> both link exposure frequencies are held at the selected decision setting (${formatFrequency(scenario.setting.dIh.value)} index-to-household; ${formatFrequency(scenario.setting.dHs.value)} household-to-social). ${hiddenLabels.length ? `Anchors with different frequencies are omitted from this surface: ${escapeHtml(hiddenLabels.join(", "))}.` : "All named anchors share this frequency slice."}`;
}

function scenarioFromHash(): ScenarioV1 {
  const prefix = "#scenario=";
  if (!window.location.hash.startsWith(prefix)) return defaultScenario();
  try { return decodeScenario(window.location.hash.slice(prefix.length)); }
  catch { return defaultScenario(); }
}

function sameFrequency(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-12 * Math.max(1, Math.abs(left), Math.abs(right));
}

function formatFrequency(value: number): string {
  return `${Number(value.toPrecision(3))} ${value === 1 ? "exposure" : "exposures"}/person/day`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
