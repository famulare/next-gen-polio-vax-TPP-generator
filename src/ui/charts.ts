import { scaleLinear, scaleLog } from "d3-scale";
import { line } from "d3-shape";
import { FRONTIER_GRID, SETTING_ANCHORS, SETTING_DISPLAY_DOMAIN } from "../model/parameters";
import type { DesignGridPoint, ModelOutputsV1 } from "../model/types";
import { designKey, describeDecisionScope } from "./presentation";

export interface ChartViewState {
  inspectedDesignKey: string | null;
  persistentDesignKey: string | null;
  surfaceColumn: number;
  surfaceRow: number;
}

const BLUE = "#2166ac";
const WHITE = "#f7f7f2";
const RED = "#b2182b";

export function renderSettingSurface(outputs: ModelOutputsV1, view: ChartViewState): string {
  const width = 900;
  const height = 570;
  const margin = { top: 76, right: 38, bottom: 86, left: 76 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const exposures = [...new Set(outputs.settingSurface.map((point) => point.Tih))].sort((a, b) => a - b);
  const contacts = [...new Set(outputs.settingSurface.map((point) => point.Ns))].sort((a, b) => a - b);
  const x = scaleLog().domain([SETTING_DISPLAY_DOMAIN.exposure.min, SETTING_DISPLAY_DOMAIN.exposure.max]).range([margin.left, margin.left + plotWidth]);
  const y = scaleLinear().domain([SETTING_DISPLAY_DOMAIN.contacts.min - 0.5, SETTING_DISPLAY_DOMAIN.contacts.max + 0.5]).range([margin.top + plotHeight, margin.top]);
  const values = new Map(outputs.settingSurface.map((point) => [`${point.Tih}:${point.Ns}`, point.rLoc]));
  const cells = exposures.flatMap((exposure, column) => contacts.map((contact, row) => {
    const left = column === 0 ? SETTING_DISPLAY_DOMAIN.exposure.min : Math.sqrt(exposures[column - 1]! * exposure);
    const right = column === exposures.length - 1 ? SETTING_DISPLAY_DOMAIN.exposure.max : Math.sqrt(exposure * exposures[column + 1]!);
    const rLoc = values.get(`${exposure}:${contact}`)!;
    const active = column === view.surfaceColumn && row === view.surfaceRow;
    return `<rect class="surface-cell${active ? " is-inspected" : ""}" data-surface-column="${column}" data-surface-row="${row}" x="${x(left)}" y="${y(contact + 0.5)}" width="${Math.max(0.25, x(right) - x(left) + 0.35)}" height="${Math.max(0.25, y(contact - 0.5) - y(contact + 0.5) + 0.35)}" fill="${surfaceColor(rLoc)}"><title>${formatMicrograms(exposure)} µg/exposure; ${contact} contacts; direct cell R_loc ${formatNumber(rLoc)}</title></rect>`;
  })).join("");
  const threshold = thresholdAcrossExposure(exposures, contacts, values, x, y);
  const thresholdPath = threshold.length > 1 ? line()(threshold) ?? "" : "";
  const scope = describeDecisionScope(outputs.scenario.envelope);
  const scopeMark = scope.id === "custom"
    ? `<rect class="decision-scope-boundary" x="${x(outputs.scenario.envelope.TihMin)}" y="${y(outputs.scenario.envelope.NsMax)}" width="${Math.max(2, x(outputs.scenario.envelope.TihMax) - x(outputs.scenario.envelope.TihMin))}" height="${Math.max(2, y(outputs.scenario.envelope.NsMin) - y(outputs.scenario.envelope.NsMax))}"/>`
    : "";
  const anchors = SETTING_ANCHORS.map((anchor) => {
    const activeScope = anchor.id === scope.id;
    const probe = anchor.id === outputs.scenario.setting.id;
    const offsets: Record<string, [number, number, string]> = {
      low: [8, 21, "start"],
      houston: [8, -13, "start"],
      matlab: [8, 32, "start"],
      "up-bihar": [10, -13, "start"]
    };
    const [dx, dy, anchorText] = offsets[anchor.id] ?? [8, -8, "start"];
    const shape = activeScope
      ? `<path class="anchor-point decision-anchor" d="M ${x(anchor.Tih.value)} ${y(anchor.Ns) - 7} l 7 7 -7 7 -7 -7 z"/>`
      : `<circle class="anchor-point${anchor.kind === "hybrid" ? " hybrid-anchor" : ""}" cx="${x(anchor.Tih.value)}" cy="${y(anchor.Ns)}" r="5"/>`;
    return `<g class="anchor-group${probe ? " probe-anchor" : ""}">${shape}${probe ? `<circle class="probe-ring" cx="${x(anchor.Tih.value)}" cy="${y(anchor.Ns)}" r="10"/>` : ""}<text class="anchor-label" x="${x(anchor.Tih.value) + dx}" y="${y(anchor.Ns) + dy}" text-anchor="${anchorText}">${escapeXml(anchorShortLabel(anchor.id))}</text></g>`;
  }).join("");
  const matlabY = y(3);
  const activePoint = outputs.settingSurface.find((point) => exposures.indexOf(point.Tih) === view.surfaceColumn && contacts.indexOf(point.Ns) === view.surfaceRow) ?? outputs.settingSurface[0]!;
  const ticksX = [0.1, 1, 10, 100, 1000, 2000].map((micrograms) => `<g><line class="tick-mark" x1="${x(micrograms / 1_000_000)}" x2="${x(micrograms / 1_000_000)}" y1="${margin.top + plotHeight}" y2="${margin.top + plotHeight + 6}"/><text class="tick" x="${x(micrograms / 1_000_000)}" y="${margin.top + plotHeight + 22}" text-anchor="middle">${micrograms >= 1000 ? `${micrograms / 1000}k` : micrograms}</text></g>`).join("");
  const ticksY = [1, 5, 10, 15, 20].map((contact) => `<g><line class="grid-line" x1="${margin.left}" x2="${margin.left + plotWidth}" y1="${y(contact)}" y2="${y(contact)}"/><text class="tick" x="${margin.left - 12}" y="${y(contact) + 4}" text-anchor="end">${contact}</text></g>`).join("");
  return `<svg id="setting-figure" class="scientific-chart setting-chart" tabindex="0" role="img" aria-labelledby="setting-title setting-desc" data-chart="surface" data-columns="${exposures.length}" data-rows="${contacts.length}" viewBox="0 0 ${width} ${height}">
    <title id="setting-title">Setting surface for ${escapeXml(outputs.scenario.vaccine.label)}</title>
    <desc id="setting-desc">Direct display-grid R_loc values over 0.1 to 2,000 micrograms per exposure and 1 to 20 close social contacts. Blue is below one, near-white is one, and red is above one. The black dashed internal line is the interpolated threshold. Status is evaluated directly over ${escapeXml(scope.label)}, not from the raster or display-domain corner.</desc>
    <defs><linearGradient id="surface-scale" x1="0" x2="1"><stop offset="0" stop-color="${BLUE}"/><stop offset="0.5" stop-color="${WHITE}"/><stop offset="1" stop-color="${RED}"/></linearGradient></defs>
    <text class="chart-kicker" x="${margin.left}" y="24">NONBINDING DISPLAY DOMAIN · PRODUCT-SPECIFIC MARGIN</text>
    <text class="chart-title" x="${margin.left}" y="51">Where does this candidate cross R_loc = 1?</text>
    <rect class="plot-bg" x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}"/>
    ${ticksY}${cells}
    <path class="threshold-line" d="${thresholdPath}"/>
    <text class="side-label pass-side" x="${margin.left + 15}" y="${margin.top + plotHeight - 16}">PASSING SIDE · lower exposure / fewer contacts</text>
    <text class="side-label fail-side" x="${margin.left + plotWidth - 15}" y="${margin.top + 22}" text-anchor="end">FAILING SIDE · greater transmission pressure</text>
    ${scopeMark}
    <line class="hybrid-interval" x1="${x(3.2 / 1_000_000)}" x2="${x(61.7 / 1_000_000)}" y1="${matlabY}" y2="${matlabY}"/>
    <text class="hybrid-label" x="${x(61.7 / 1_000_000) + 7}" y="${matlabY + 13}">Matlab household interval · 3.2–61.7 µg/day (daily basis) · hybrid mapping; social link inherited</text>
    ${anchors}${ticksX}
    <text class="axis-label" x="${margin.left + plotWidth / 2}" y="${height - 17}" text-anchor="middle">Linked stool-equivalent exposure, T (µg/exposure · log scale)</text>
    <text class="axis-label" transform="translate(20 ${margin.top + plotHeight / 2}) rotate(-90)" text-anchor="middle">Close social contacts, N_s</text>
    <g class="surface-legend" transform="translate(${margin.left + plotWidth - 236} 34)"><rect x="0" y="0" width="166" height="11" fill="url(#surface-scale)"/><text x="0" y="25">0.01</text><text x="83" y="25" text-anchor="middle">R_loc = 1</text><text x="166" y="25" text-anchor="end">100</text></g>
    <g class="chart-readout" transform="translate(${margin.left + 6} ${margin.top + 10})"><rect x="0" y="0" width="250" height="43"/><text x="10" y="17">INSPECTION PROBE</text><text x="10" y="34">${formatMicrograms(activePoint.Tih)} µg/exposure · N_s ${activePoint.Ns} · R_loc ${formatNumber(activePoint.rLoc)}</text></g>
    <text class="interpolation-note" x="${margin.left + plotWidth}" y="${height - 2}" text-anchor="end">Status: direct over decision scope. Contour: interpolated display context.</text>
  </svg>`;
}

export function renderProductMap(outputs: ModelOutputsV1, view: ChartViewState): string {
  const width = 560;
  const height = 500;
  const margin = { top: 72, right: 25, bottom: 72, left: 68 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const x = scaleLinear().domain([FRONTIER_GRID.takeContext.min, FRONTIER_GRID.takeContext.max]).range([margin.left, margin.left + plotWidth]);
  const y = scaleLinear().domain([FRONTIER_GRID.mu0New.min, FRONTIER_GRID.mu0New.max]).range([margin.top + plotHeight, margin.top]);
  const takes = outputs.frontier.takeValues;
  const boosts = outputs.frontier.mu0Values;
  const map = new Map(outputs.frontier.points.map((point) => [designKey(point), point]));
  const cells = outputs.frontier.points.map((point) => {
    const takeIndex = takes.indexOf(point.takeContext);
    const boostIndex = boosts.indexOf(point.mu0);
    const x0 = x(Math.max(0, point.takeContext - 0.5 / (takes.length - 1)));
    const x1 = x(Math.min(1, point.takeContext + 0.5 / (takes.length - 1)));
    const y0 = y(Math.min(8, point.mu0 + 4 / (boosts.length - 1)));
    const y1 = y(Math.max(0, point.mu0 - 4 / (boosts.length - 1)));
    const key = designKey(point);
    const inspected = key === view.inspectedDesignKey;
    const persistent = key === view.persistentDesignKey;
    return `<rect class="design-cell ${point.passes ? "passes" : "fails"}${inspected ? " is-inspected" : ""}${persistent ? " is-persistent" : ""}" data-design-key="${key}" data-take-index="${takeIndex}" data-boost-index="${boostIndex}" x="${x0}" y="${y0}" width="${Math.max(1, x1 - x0 + 0.2)}" height="${Math.max(1, y1 - y0 + 0.2)}" fill="${surfaceColor(point.rLocEnvelopeMax)}"><title>take ${point.takeContext.toFixed(2)}; boost ${point.mu0.toFixed(2)} log2; direct R_loc ${formatNumber(point.rLocEnvelopeMax)}; ${point.passes ? "meets" : "does not meet"}</title></rect>`;
  }).join("");
  const contourPoints: [number, number][] = [];
  for (const take of takes) {
    const row = boosts.map((boost) => map.get(designKey({ takeContext: take, mu0: boost }))!);
    const crossing = crossingAlong(row.map((point) => point.mu0), row.map((point) => point.rLocEnvelopeMax));
    if (crossing !== null) contourPoints.push([x(take), y(crossing)]);
  }
  const contourPath = contourPoints.length > 1 ? line()(contourPoints) ?? "" : "";
  const exact = outputs.frontier.selectedDesign;
  const nearest = outputs.frontier.nearestGridPoint;
  const exactMark = exact ? `<circle class="selected-exact" cx="${x(exact.takeContext)}" cy="${y(exact.mu0)}" r="8"/><text class="selection-label" x="${x(exact.takeContext) + 11}" y="${y(exact.mu0) - 9}">selected exact</text>` : "";
  const nearestMark = nearest ? `<path class="nearest-grid" d="M ${x(nearest.takeContext) - 5} ${y(nearest.mu0)} h 10 M ${x(nearest.takeContext)} ${y(nearest.mu0) - 5} v 10"/>` : "";
  const sabin = outputs.frontier.comparators.find((point) => point.productId === "sabin2")!;
  const sabinMark = sabin.takeContext !== null && sabin.mu0 !== null ? `<path class="comparator-marker sabin-marker" d="M ${x(sabin.takeContext)} ${y(sabin.mu0) - 6} l 6 10 h -12 z"/><text class="comparator-label" x="${x(sabin.takeContext) - 9}" y="${y(sabin.mu0) - 9}" text-anchor="end">fixed Sabin 2</text>` : "";
  return `<svg id="product-figure" class="scientific-chart linked-chart" tabindex="0" role="img" aria-labelledby="product-title product-desc" data-chart="product" viewBox="0 0 ${width} ${height}">
    <title id="product-title">Product design space</title><desc id="product-desc">The same 2,601 hypothetical product designs shown by biological take context and latent mean mucosal boost. The black threshold contour separates direct pass and fail evaluations for the declared decision scope. The selected exact design is a ring; the nearest grid point is a cross. Sabin 2 is fixed. IPV is omitted because these live-vaccine coordinates are undefined for it.</desc>
    <text class="chart-kicker" x="${margin.left}" y="24">PRODUCT ASSUMPTIONS</text><text class="chart-title" x="${margin.left}" y="50">Which OPV-like designs produce enough effect?</text>
    <rect class="plot-bg" x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}"/>${gridLines(x, y, margin, plotWidth, plotHeight, "product")}${cells}<path class="threshold-line" d="${contourPath}"/>${nearestMark}${exactMark}${sabinMark}
    ${linearTicks([0, .25, .5, .75, 1], x, margin.top + plotHeight, "x")}${linearTicks([0, 2, 4, 6, 8], y, margin.left, "y")}
    <text class="axis-label" x="${margin.left + plotWidth / 2}" y="${height - 18}" text-anchor="middle">Biological take context after a received dose</text><text class="axis-label" transform="translate(18 ${margin.top + plotHeight / 2}) rotate(-90)" text-anchor="middle">Latent mean mucosal boost (log2)</text>
    <text class="interpolation-note" x="${margin.left + plotWidth}" y="${height - 2}" text-anchor="end">Evaluated cells determine status; contour is display-only interpolation.</text>
  </svg>`;
}

export function renderEffectMap(outputs: ModelOutputsV1, view: ChartViewState): string {
  const width = 560;
  const height = 500;
  const margin = { top: 72, right: 25, bottom: 72, left: 68 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const x = scaleLinear().domain([0, 1]).range([margin.left, margin.left + plotWidth]);
  const y = scaleLinear().domain([0, 1]).range([margin.top + plotHeight, margin.top]);
  const points = outputs.frontier.points.map((point) => {
    const key = designKey(point);
    const inspected = key === view.inspectedDesignKey;
    const persistent = key === view.persistentDesignKey;
    return `<circle class="effect-point ${point.passes ? "passes" : "fails"}${inspected ? " is-inspected" : ""}${persistent ? " is-persistent" : ""}" data-design-key="${key}" cx="${x(1 - point.qAcq)}" cy="${y(1 - point.qShed)}" r="${point.passes ? 2.1 : 1.35}"><title>acquisition reduction ${formatPercent(1 - point.qAcq)}; breakthrough shedding reduction ${formatPercent(1 - point.qShed)}; take ${point.takeContext.toFixed(2)}; boost ${point.mu0.toFixed(2)}; direct R_loc ${formatNumber(point.rLocEnvelopeMax)}</title></circle>`;
  }).join("");
  const paretoPoints = outputs.frontier.pareto.map((point) => [x(1 - point.qAcq), y(1 - point.qShed)] as [number, number]);
  const paretoPath = paretoPoints.length > 1 ? line()(paretoPoints) ?? "" : "";
  const paretoMark = paretoPath ? `<path class="pareto-line" d="${paretoPath}"/>` : "";
  const exact = outputs.frontier.selectedDesign;
  const exactMark = exact ? `<circle class="selected-exact" cx="${x(1 - exact.qAcq)}" cy="${y(1 - exact.qShed)}" r="8"/><text class="selection-label" x="${x(1 - exact.qAcq) + 11}" y="${y(1 - exact.qShed) - 9}">selected exact</text>` : "";
  const comparators = outputs.frontier.comparators.map((point) => {
    const cx = x(1 - point.qAcq);
    const cy = y(1 - point.qShed);
    return point.productId === "ipv"
      ? `<rect class="comparator-marker" x="${cx - 5}" y="${cy - 5}" width="10" height="10"/><text class="comparator-label" x="${cx - 8}" y="${cy - 9}" text-anchor="end">fixed IPV</text>`
      : `<path class="comparator-marker" d="M ${cx} ${cy - 6} l 6 10 h -12 z"/><text class="comparator-label" x="${cx - 8}" y="${cy - 9}" text-anchor="end">fixed Sabin 2</text>`;
  }).join("");
  const empty = outputs.frontier.pareto.length === 0 ? `<text class="empty-frontier" x="${margin.left + plotWidth / 2}" y="${margin.top + plotHeight / 2}" text-anchor="middle">No evaluated design passes this scope</text>` : "";
  return `<svg id="effect-figure" class="scientific-chart linked-chart" tabindex="0" role="img" aria-labelledby="effect-title effect-desc" data-chart="effect" viewBox="0 0 ${width} ${height}">
    <title id="effect-title">Outcome requirement space</title><desc id="effect-desc">The same 2,601 directly evaluated designs shown by modeled reduction in WPV acquisition and conditional breakthrough infectious shedding. The russet line is the minimum-sufficient Pareto boundary when one exists. These axes are outcomes, not independently tunable product inputs, and blank regions are unattained.</desc>
    <text class="chart-kicker" x="${margin.left}" y="24">MODELED OUTCOMES</text><text class="chart-title" x="${margin.left}" y="50">What combination of effects is sufficient?</text>
    <rect class="plot-bg" x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}"/>${gridLines(x, y, margin, plotWidth, plotHeight, "effect")}${points}${paretoMark}${exactMark}${comparators}${empty}
    ${linearTicks([0, .25, .5, .75, 1], x, margin.top + plotHeight, "x", true)}${linearTicks([0, .25, .5, .75, 1], y, margin.left, "y", true)}
    <text class="axis-label" x="${margin.left + plotWidth / 2}" y="${height - 18}" text-anchor="middle">Reduction in WPV acquisition (1 − q_acq)</text><text class="axis-label" transform="translate(18 ${margin.top + plotHeight / 2}) rotate(-90)" text-anchor="middle">Reduction in breakthrough shedding (1 − q_shed)</text>
    <g class="chart-key" transform="translate(${margin.left + 8} ${margin.top + 15})"><circle class="effect-point passes" cx="0" cy="0" r="2.3"/><text x="8" y="3">meets</text><circle class="effect-point fails" cx="60" cy="0" r="1.5"/><text x="68" y="3">does not meet</text></g>
    <text class="interpolation-note" x="${margin.left + plotWidth}" y="${height - 2}" text-anchor="end">Every mark is one direct product-grid evaluation.</text>
  </svg>`;
}

function thresholdAcrossExposure(
  exposures: number[],
  contacts: number[],
  values: ReadonlyMap<string, number>,
  x: (value: number) => number,
  y: (value: number) => number
): [number, number][] {
  const result: [number, number][] = [];
  for (const contact of contacts) {
    const row = exposures.map((exposure) => values.get(`${exposure}:${contact}`)!);
    const crossing = crossingAlong(exposures.map(Math.log10), row);
    if (crossing !== null) result.push([x(10 ** crossing), y(contact)]);
  }
  return result;
}

function crossingAlong(axis: number[], values: number[]): number | null {
  for (let index = 0; index < values.length - 1; index += 1) {
    const left = Math.log10(Math.max(values[index]!, Number.MIN_VALUE));
    const right = Math.log10(Math.max(values[index + 1]!, Number.MIN_VALUE));
    if (left === 0) return axis[index]!;
    if (left * right <= 0 && left !== right) {
      const fraction = -left / (right - left);
      return axis[index]! + fraction * (axis[index + 1]! - axis[index]!);
    }
  }
  return null;
}

function gridLines(
  x: (value: number) => number,
  y: (value: number) => number,
  margin: { top: number; left: number },
  plotWidth: number,
  plotHeight: number,
  kind: "product" | "effect"
): string {
  const ticks = kind === "product" ? [0, .25, .5, .75, 1] : [0, .25, .5, .75, 1];
  const yTicks = kind === "product" ? [0, 2, 4, 6, 8] : ticks;
  return `${ticks.map((value) => `<line class="grid-line" x1="${x(value)}" x2="${x(value)}" y1="${margin.top}" y2="${margin.top + plotHeight}"/>`).join("")}${yTicks.map((value) => `<line class="grid-line" x1="${margin.left}" x2="${margin.left + plotWidth}" y1="${y(value)}" y2="${y(value)}"/>`).join("")}`;
}

function linearTicks(values: number[], scale: (value: number) => number, axis: number, orientation: "x" | "y", percent = false): string {
  return values.map((value) => orientation === "x"
    ? `<text class="tick" x="${scale(value)}" y="${axis + 21}" text-anchor="middle">${percent ? `${Math.round(value * 100)}%` : value}</text>`
    : `<text class="tick" x="${axis - 11}" y="${scale(value) + 4}" text-anchor="end">${percent ? `${Math.round(value * 100)}%` : value}</text>`).join("");
}

function surfaceColor(rLoc: number): string {
  return scaleLinear<string>().domain([-2, 0, 2]).range([BLUE, WHITE, RED]).clamp(true)(Math.log10(Math.max(rLoc, 1e-12)));
}

function anchorShortLabel(id: string): string {
  return id === "low" ? "Low" : id === "houston" ? "Houston / Louisiana" : id === "matlab" ? "Matlab hybrid" : "UP / Bihar · decision anchor";
}

function formatMicrograms(grams: number): string {
  const value = grams * 1_000_000;
  return value >= 100 ? value.toFixed(0) : value >= 1 ? value.toFixed(1) : value.toPrecision(2);
}

function formatNumber(value: number): string {
  if (value === 0) return "0";
  if (Math.abs(value) < 0.001) return value.toExponential(2);
  return value < 10 ? value.toFixed(3) : value.toFixed(2);
}

function formatPercent(value: number): string {
  return `${(100 * value).toFixed(1)}%`;
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
