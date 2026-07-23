import { scaleLinear, scaleLog } from "d3-scale";
import { line } from "d3-shape";
import { FRONTIER_GRID, PARAMETERS, SETTING_ANCHORS, SETTING_DISPLAY_DOMAIN } from "../model/parameters";
import { vaccineTakeCurve } from "../model/diagnostics";
import type { DesignGridPoint, ModelOutputsV1, TeachingView } from "../model/types";
import { BRAND_COLORS, SCIENTIFIC_SURFACE_COLORS } from "./brand";
import { designKey, describeDecisionScope } from "./presentation";

export interface ChartViewState {
  inspectedDesignKey: string | null;
  persistentDesignKey: string | null;
  surfaceColumn: number;
  surfaceRow: number;
}

const BLUE = SCIENTIFIC_SURFACE_COLORS.belowThreshold;
const WHITE = SCIENTIFIC_SURFACE_COLORS.threshold;
const RED = SCIENTIFIC_SURFACE_COLORS.aboveThreshold;
const REFERENCE = BRAND_COLORS.dvMediumOrange;
const CANDIDATE = BRAND_COLORS.dvDarkMagenta;

/**
 * Four read-only projections of the exact production kernels. The curves are
 * intentionally separated from the transmission surface: their conditioning
 * is acquisition by the index child, not a population-average shortcut.
 */
export function renderWithinHostTeaching(outputs: TeachingView): string {
  return `${withinHostFigure(outputs, false)}${withinHostFigure(outputs, true)}`;
}

function withinHostFigure(outputs: TeachingView, mobile: boolean): string {
  const diagnostics = outputs.diagnostics;
  const diagnosticHorizonDays = diagnostics.vaccinated.sheddingByDay.at(-1)?.day;
  if (diagnosticHorizonDays === undefined) throw new Error("Within-host diagnostic grid has no shedding time points");
  const timeTicks = [1, 30, 60, 90, diagnosticHorizonDays].filter((day, index, values) => day <= diagnosticHorizonDays && values.indexOf(day) === index);
  const width = mobile ? 360 : 1200;
  const height = mobile ? 1336 : 880;
  const panels = mobile
    ? [
        { x: 12, y: 92, width: 336, height: 258 },
        { x: 12, y: 394, width: 336, height: 258 },
        { x: 12, y: 696, width: 336, height: 258 },
        { x: 12, y: 998, width: 336, height: 258 }
      ]
    : [
        { x: 58, y: 82, width: 490, height: 340 },
        { x: 654, y: 82, width: 490, height: 340 },
        { x: 58, y: 462, width: 490, height: 340 },
        { x: 654, y: 462, width: 490, height: 340 }
      ];
  const acquisition = curvePanel(
    panels[0]!,
    diagnostics.reference.acquisitionByDose.map((point) => ({ x: point.doseCID50, y: point.probability })),
    diagnostics.vaccinated.acquisitionByDose.map((point) => ({ x: point.doseCID50, y: point.probability })),
    "log-dose",
    "WPV acquisition after oral challenge",
    "CID50 challenge dose (log scale)",
    "Acquisition probability",
    [1, 100, 10_000, 1_000_000],
    [0, .25, .5, .75, 1],
    { note: "One WPV HID50 anchors q_acq and conditioning.", referenceX: diagnostics.referenceChallengeDoseCID50, referenceLabel: "1 WPV HID50" }
  );
  const survival = curvePanel(
    panels[1]!,
    diagnostics.reference.sheddingByDay.map((point) => ({ x: point.day, y: point.survivalProbability })),
    diagnostics.vaccinated.sheddingByDay.map((point) => ({ x: point.day, y: point.survivalProbability })),
    "linear",
    "Duration among infections",
    "Days after WPV acquisition",
    "P(still shedding)",
    timeTicks,
    [0, .25, .5, .75, 1],
    { note: "Conditioned on acquisition, not vaccine take." }
  );
  const concentration = curvePanel(
    panels[2]!,
    diagnostics.reference.sheddingByDay.map((point) => ({ x: point.day, y: point.conditionalConcentrationTCID50PerGram })),
    diagnostics.vaccinated.sheddingByDay.map((point) => ({ x: point.day, y: point.conditionalConcentrationTCID50PerGram })),
    "log-y",
    "Concentration among shedders",
    "Days after WPV acquisition",
    "Expected TCID50/g",
    timeTicks,
    [1e2, 1e4, 1e6, 1e8],
    { note: `Age ${diagnostics.assessmentAgeDays} d; assay floor 10^${Math.log10(PARAMETERS.shedding.titerFloor).toFixed(1)} TCID50/g.` }
  );
  const sheddingIndex = indexBarPanel(
    panels[3]!,
    diagnostics.reference.sheddingIndexAtReferenceTCID50DaysPerGram,
    diagnostics.vaccinated.sheddingIndexAtReferenceTCID50DaysPerGram,
    "Shedding index",
    "TCID50-days/g",
    `P(acquisition) × burden B, over take and ${diagnosticHorizonDays} days.`
  );
  const id = mobile ? "within-host-mobile-figure" : "within-host-figure";
  const titleId = mobile ? "within-host-mobile-title" : "within-host-title";
  const descId = mobile ? "within-host-mobile-desc" : "within-host-desc";
  const headline = mobile
    ? `<text class="chart-title" x="12" y="47">How a WPV exposure becomes</text><text class="chart-title" x="12" y="69">infectious shedding—or not</text>`
    : `<text class="chart-title" x="58" y="54">How a WPV exposure becomes—or fails to become—infectious shedding</text>`;
  const legend = mobile
    ? `<g class="teaching-legend" transform="translate(12 ${height - 42})"><line x1="0" x2="28" y1="0" y2="0" class="teaching-reference"/><text x="36" y="4">Naive reference</text><line x1="160" x2="188" y1="0" y2="0" class="teaching-candidate"/><text x="196" y="4">Selected cohort</text><text x="0" y="23">Named conditioning; full distributions stay in the model.</text></g>`
    : `<g class="teaching-legend" transform="translate(58 ${height - 44})"><line x1="0" x2="28" y1="0" y2="0" class="teaching-reference"/><text x="36" y="4">Naive reference</text><line x1="165" x2="193" y1="0" y2="0" class="teaching-candidate"/><text x="201" y="4">Selected vaccinated cohort</text><text x="440" y="4">Curves are conditioned as named; full immunity distributions remain in the calculation.</text></g>`;
  return `<svg id="${id}" class="scientific-chart teaching-chart${mobile ? " teaching-chart-mobile" : ""}" role="img" aria-labelledby="${titleId} ${descId}" viewBox="0 0 ${width} ${height}">
    <title id="${titleId}">Within-host components of the WPV transmission model</title>
    <desc id="${descId}">Four panels compare a naive reference cohort with the selected vaccinated cohort at the same assessment age. They show productive WPV acquisition by challenge dose, including the marked one-WPV-HID50 reference; probability of still shedding conditional on acquisition; expected concentration conditional on still shedding; and the shedding index at the reference challenge — acquisition probability times the burden integral B — as paired log-scale bars for the two cohorts. The calculation preserves the joint expectation rather than using an average-person approximation.</desc>
    <text class="chart-kicker" x="${mobile ? 12 : 58}" y="25">ONE REFERENCE SETTING · TWO COHORTS · NO DECISION RULE YET</text>
    ${headline}
    ${acquisition}${survival}${concentration}${sheddingIndex}
    ${legend}
  </svg>`;
}

export function renderImmunityDistribution(outputs: TeachingView): string {
  return `${immunityDistributionFigure(outputs, false)}${immunityDistributionFigure(outputs, true)}`;
}

function immunityDistributionFigure(outputs: TeachingView, mobile: boolean): string {
  const width = mobile ? 360 : 820;
  const height = mobile ? 410 : 450;
  const margin = mobile ? { top: 92, right: 15, bottom: 62, left: 80 } : { top: 63, right: 30, bottom: 62, left: 76 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const reference = outputs.diagnostics.reference.immunityBins;
  const vaccinated = outputs.diagnostics.vaccinated.immunityBins;
  const maxValue = Math.max(.1, ...reference, ...vaccinated);
  const x = scaleLinear().domain([0, reference.length]).range([margin.left, margin.left + plotWidth]);
  const y = scaleLinear().domain([0, maxValue]).nice().range([margin.top + plotHeight, margin.top]);
  const bars = reference.map((value, bin) => {
    const band = plotWidth / reference.length;
    const left = x(bin) + band * .12;
    const pairWidth = band * .34;
    const selected = vaccinated[bin] ?? 0;
    return `<rect class="immunity-reference" fill="${REFERENCE}" x="${left}" y="${y(value)}" width="${pairWidth}" height="${Math.max(0, y(0) - y(value))}"><title>Naive reference: log2 mucosal-immunity bin ${bin}; probability ${formatPercent(value)}</title></rect><rect class="immunity-candidate" fill="${CANDIDATE}" x="${left + pairWidth + band * .08}" y="${y(selected)}" width="${pairWidth}" height="${Math.max(0, y(0) - y(selected))}"><title>Selected vaccinated cohort: log2 mucosal-immunity bin ${bin}; probability ${formatPercent(selected)}</title></rect>`;
  }).join("");
  const yTicks = y.ticks(4).map((value) => `<g><line class="grid-line" x1="${margin.left}" x2="${margin.left + plotWidth}" y1="${y(value)}" y2="${y(value)}"/><text class="tick" x="${margin.left - 10}" y="${y(value) + 3}" text-anchor="end">${formatPercentTick(value)}</text></g>`).join("");
  const xTicks = reference.map((_, bin) => `<text class="tick" x="${x(bin + .5)}" y="${margin.top + plotHeight + 18}" text-anchor="middle">${bin}</text>`).join("");
  const id = mobile ? "immunity-distribution-mobile-figure" : "immunity-distribution-figure";
  const titleId = mobile ? "immunity-distribution-mobile-title" : "immunity-distribution-title";
  const descId = mobile ? "immunity-distribution-mobile-desc" : "immunity-distribution-desc";
  const title = mobile
    ? `<text class="chart-title" x="${margin.left}" y="48">The selected schedule creates</text><text class="chart-title" x="${margin.left}" y="70">a distribution—not an average child</text>`
    : `<text class="chart-title" x="${margin.left}" y="49">The selected schedule creates a distribution, not one average immune child</text>`;
  const legend = mobile
    ? `<g class="teaching-legend" transform="translate(${margin.left} 83)"><rect class="immunity-reference" x="0" y="-8" width="13" height="13"/><text x="20" y="3">Naive</text><rect class="immunity-candidate" x="85" y="-8" width="13" height="13"/><text x="105" y="3">Selected</text></g>`
    : `<g class="teaching-legend" transform="translate(${margin.left + plotWidth - 150} ${margin.top + 16})"><rect class="immunity-reference" x="0" y="-10" width="14" height="14"/><text x="22" y="1">Naive reference</text><rect class="immunity-candidate" x="0" y="10" width="14" height="14"/><text x="22" y="21">Selected</text></g>`;
  return `<svg id="${id}" class="scientific-chart immunity-chart${mobile ? " immunity-chart-mobile" : ""}" role="img" aria-labelledby="${titleId} ${descId}" viewBox="0 0 ${width} ${height}">
    <title id="${titleId}">Schedule-derived mucosal immunity distribution</title>
    <desc id="${descId}">Paired bars compare the naive reference distribution and the selected vaccinated cohort's marginal mucosal immunity distribution before WPV exposure. The production calculation retains take history and dose conditioning rather than using this marginal display as an average person.</desc>
    <text class="chart-kicker" x="${margin.left}" y="23">SCHEDULE OUTPUT BEFORE WPV EXPOSURE</text>${title}
    <rect class="plot-bg" x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}"/>${yTicks}${bars}${xTicks}
    <text class="axis-label" x="${margin.left + plotWidth / 2}" y="${height - 14}" text-anchor="middle">Mucosal-immunity bin (log2 NAb-equivalent)</text>${rotatedYLabel("axis-label", 16, margin.top + plotHeight / 2, "Cohort probability")}
    ${legend}
  </svg>`;
}

export function renderVaccineDoseResponse(view: TeachingView): string {
  const vaccine = view.scenario.vaccine;
  const width = 820;
  const height = 360;
  const margin = { top: 66, right: 30, bottom: 64, left: 70 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const doseGrid = Array.from({ length: 73 }, (_, index) => 10 ** ((index / 72) * 9));
  const [naive, primed] = vaccineTakeCurve(vaccine, [0, 6], doseGrid);
  const x = scaleLog().domain([1, 1e9]).range([margin.left, margin.left + plotWidth]);
  const y = scaleLinear().domain([0, 1]).range([margin.top + plotHeight, margin.top]);
  const path = (curve: { points: { dose: number; take: number }[] }) => line<{ dose: number; take: number }>().x((point) => x(point.dose)).y((point) => y(point.take))(curve.points) ?? "";
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((value) => `<g><line class="grid-line" x1="${margin.left}" x2="${margin.left + plotWidth}" y1="${y(value)}" y2="${y(value)}"/><text class="tick" x="${margin.left - 10}" y="${y(value) + 3}" text-anchor="end">${formatPercentTick(value)}</text></g>`).join("");
  const xTicks = [1, 1e2, 1e4, 1e6, 1e8].map((dose) => `<g><line class="tick-mark" x1="${x(dose)}" x2="${x(dose)}" y1="${margin.top + plotHeight}" y2="${margin.top + plotHeight + 6}"/><text class="tick" x="${x(dose)}" y="${margin.top + plotHeight + 22}" text-anchor="middle">${powerLabel(dose)}</text></g>`).join("");
  const doseMark = vaccine.dose > 0
    ? `<line class="teaching-reference-dose" x1="${x(vaccine.dose)}" x2="${x(vaccine.dose)}" y1="${margin.top}" y2="${margin.top + plotHeight}"/><text class="teaching-reference-dose-label" x="${x(vaccine.dose) + 5}" y="${margin.top + 12}">selected dose</text>`
    : "";
  return `<svg id="dose-response-figure" class="scientific-chart" role="img" aria-labelledby="dose-response-title dose-response-desc" viewBox="0 0 ${width} ${height}">
    <title id="dose-response-title">Vaccine take by administered dose and prior immunity</title>
    <desc id="dose-response-desc">Productive vaccine take as a function of administered dose for a naive recipient (mucosal-immunity bin 0) and a primed recipient (bin 6), shaped by vaccine alpha, beta, and take context. Take rises with dose and falls with prior immunity. This is the take that seeds the cohort immunity distribution and therefore the downstream acquisition and shedding reductions; it does not change the fixed WPV challenge equation.</desc>
    <text class="chart-kicker" x="${margin.left}" y="24">RECEIVED DOSE → PRODUCTIVE VACCINE TAKE</text>
    <text class="chart-title" x="${margin.left}" y="49">How dose and prior immunity set vaccine take</text>
    <rect class="plot-bg" x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}"/>
    ${yTicks}${xTicks}${doseMark}
    <path class="teaching-reference" fill="none" stroke="${REFERENCE}" stroke-width="2.5" d="${path(naive!)}"/>
    <path class="teaching-candidate" fill="none" stroke="${CANDIDATE}" stroke-width="2.5" d="${path(primed!)}"/>
    <text class="axis-label" x="${margin.left + plotWidth / 2}" y="${height - 16}" text-anchor="middle">Administered dose (TCID50, log scale)</text><text class="axis-label" transform="translate(18 ${margin.top + plotHeight / 2}) rotate(-90)" text-anchor="middle">Productive vaccine take</text>
    <g class="teaching-legend" transform="translate(${margin.left + plotWidth - 210} 32)"><line x1="0" x2="26" y1="0" y2="0" class="teaching-reference"/><text x="34" y="4">Naive recipient (bin 0)</text><line x1="0" x2="26" y1="20" y2="20" class="teaching-candidate"/><text x="34" y="24">Primed recipient (bin 6)</text></g>
  </svg>`;
}

interface TeachingPoint { x: number; y: number; }

function curvePanel(
  panel: { x: number; y: number; width: number; height: number },
  reference: TeachingPoint[],
  candidate: TeachingPoint[],
  scale: "linear" | "log-dose" | "log-y",
  title: string,
  xLabel: string,
  yLabel: string,
  xTicks: number[],
  yTicks: number[],
  annotation: { note: string; referenceX?: number; referenceLabel?: string }
): string {
  const titleY = panel.y;
  const plot = { x: panel.x + 74, y: panel.y + 45, width: panel.width - 86, height: panel.height - 80 };
  const all = [...reference, ...candidate];
  const xDomain: [number, number] = scale === "log-dose"
    ? [Math.min(...all.map((point) => point.x)), Math.max(...all.map((point) => point.x))]
    : [Math.min(...all.map((point) => point.x)), Math.max(...all.map((point) => point.x))];
  const xScale = scale === "log-dose"
    ? scaleLog().domain(xDomain).range([plot.x, plot.x + plot.width])
    : scaleLinear().domain(xDomain).range([plot.x, plot.x + plot.width]);
  const values = all.map((point) => point.y);
  const yScale = scale === "log-y"
    ? scaleLog().domain(logDomain(values)).range([plot.y + plot.height, plot.y])
    : scaleLinear().domain([0, 1]).range([plot.y + plot.height, plot.y]);
  const path = (points: TeachingPoint[]) => line<TeachingPoint>()
    .x((point) => xScale(point.x))
    .y((point) => yScale(Math.max(point.y, Number.MIN_VALUE)))(points) ?? "";
  const displayedYTicks = scale === "log-y"
    ? yTicks.filter((value) => value >= logDomain(values)[0] && value <= logDomain(values)[1])
    : yTicks;
  const horizontal = displayedYTicks.map((value) => `<g><line class="grid-line" x1="${plot.x}" x2="${plot.x + plot.width}" y1="${yScale(value)}" y2="${yScale(value)}"/><text class="tick" x="${plot.x - 9}" y="${yScale(value) + 3}" text-anchor="end">${scale === "log-y" ? powerLabel(value) : formatPercentTick(value)}</text></g>`).join("");
  const vertical = xTicks.map((value) => `<g><line class="grid-line" x1="${xScale(value)}" x2="${xScale(value)}" y1="${plot.y}" y2="${plot.y + plot.height}"/><text class="tick" x="${xScale(value)}" y="${plot.y + plot.height + 18}" text-anchor="middle">${scale === "log-dose" ? powerLabel(value) : value}</text></g>`).join("");
  const referenceMarker = annotation.referenceX === undefined ? "" : `<line class="teaching-reference-dose" x1="${xScale(annotation.referenceX)}" x2="${xScale(annotation.referenceX)}" y1="${plot.y}" y2="${plot.y + plot.height}"/><text class="teaching-reference-dose-label" x="${xScale(annotation.referenceX) + 5}" y="${plot.y + 12}">${escapeXml(annotation.referenceLabel ?? "Reference")}</text>`;
  return `<g class="teaching-panel"><text class="teaching-panel-title" x="${panel.x}" y="${titleY}">${escapeXml(title)}</text><text class="teaching-panel-note" x="${panel.x}" y="${panel.y + 17}">${escapeXml(annotation.note)}</text><rect class="plot-bg teaching-panel-bg" x="${plot.x}" y="${plot.y}" width="${plot.width}" height="${plot.height}"/>${horizontal}${vertical}${referenceMarker}<path class="teaching-reference" fill="none" stroke="${REFERENCE}" stroke-width="2.5" d="${path(reference)}"/><path class="teaching-candidate" fill="none" stroke="${CANDIDATE}" stroke-width="2.5" d="${path(candidate)}"/><text class="axis-label" x="${plot.x + plot.width / 2}" y="${panel.y + panel.height - 1}" text-anchor="middle">${escapeXml(xLabel)}</text>${rotatedYLabel("teaching-y-label", panel.x + 12, plot.y + plot.height / 2, yLabel)}</g>`;
}

function indexBarPanel(
  panel: { x: number; y: number; width: number; height: number },
  referenceValue: number,
  candidateValue: number,
  title: string,
  yLabel: string,
  note: string
): string {
  const titleY = panel.y;
  const plot = { x: panel.x + 74, y: panel.y + 45, width: panel.width - 86, height: panel.height - 80 };
  const positiveMin = Math.max(Math.min(referenceValue, candidateValue), Number.MIN_VALUE);
  const positiveMax = Math.max(referenceValue, candidateValue, Number.MIN_VALUE);
  const floorExp = Math.floor(Math.log10(positiveMin));
  const ceilExp = Math.max(floorExp + 1, Math.ceil(Math.log10(positiveMax)));
  const floorValue = 10 ** floorExp;
  const yScale = scaleLog().domain([floorValue, 10 ** ceilExp]).range([plot.y + plot.height, plot.y]);
  const horizontal = Array.from({ length: ceilExp - floorExp + 1 }, (_, index) => 10 ** (floorExp + index))
    .map((value) => `<g><line class="grid-line" x1="${plot.x}" x2="${plot.x + plot.width}" y1="${yScale(value)}" y2="${yScale(value)}"/><text class="tick" x="${plot.x - 9}" y="${yScale(value) + 3}" text-anchor="end">${powerLabel(value)}</text></g>`).join("");
  const bottom = plot.y + plot.height;
  const barWidth = plot.width * 0.2;
  const bar = (value: number, center: number, fill: string, label: string) => {
    const left = center - barWidth / 2;
    const top = yScale(Math.max(value, floorValue));
    return `<rect class="teaching-index-bar" fill="${fill}" x="${left}" y="${top}" width="${barWidth}" height="${Math.max(0, bottom - top)}"><title>${escapeXml(label)}: ${formatScientific(value)} TCID50-days/g</title></rect><text class="tick teaching-bar-value" x="${center}" y="${top - 7}" text-anchor="middle">${formatScientific(value)}</text><text class="axis-label" x="${center}" y="${bottom + 20}" text-anchor="middle">${escapeXml(label)}</text>`;
  };
  return `<g class="teaching-panel"><text class="teaching-panel-title" x="${panel.x}" y="${titleY}">${escapeXml(title)}</text><text class="teaching-panel-note" x="${panel.x}" y="${panel.y + 17}">${escapeXml(note)}</text><rect class="plot-bg teaching-panel-bg" x="${plot.x}" y="${plot.y}" width="${plot.width}" height="${plot.height}"/>${horizontal}${bar(referenceValue, plot.x + plot.width * 0.32, REFERENCE, "Naive reference")}${bar(candidateValue, plot.x + plot.width * 0.68, CANDIDATE, "Selected")}${rotatedYLabel("teaching-y-label", panel.x + 12, plot.y + plot.height / 2, yLabel)}</g>`;
}

function formatScientific(value: number): string { return formatNumber(value); }

function splitLabel(label: string, maxChars = 40): [string] | [string, string] {
  if (label.length <= maxChars) return [label];
  const mid = label.length / 2;
  let best = -1;
  for (let index = 0; index < label.length; index += 1) {
    if (label[index] === " " && (best === -1 || Math.abs(index - mid) < Math.abs(best - mid))) best = index;
  }
  return best === -1 ? [label] : [label.slice(0, best), label.slice(best + 1)];
}

// Rotated y-axis label that wraps to two lines when long, so the larger floored
// text does not overflow the plot height.
function rotatedYLabel(cls: string, x: number, y: number, label: string): string {
  const lines = splitLabel(label);
  if (lines.length === 1) return `<text class="${cls}" transform="translate(${x} ${y}) rotate(-90)" text-anchor="middle">${escapeXml(label)}</text>`;
  return `<text class="${cls}" transform="translate(${x + 8} ${y}) rotate(-90)" text-anchor="middle"><tspan x="0" dy="-0.4em">${escapeXml(lines[0]!)}</tspan><tspan x="0" dy="1.15em">${escapeXml(lines[1]!)}</tspan></text>`;
}

function logDomain(values: number[]): [number, number] {
  const positive = values.filter((value) => value > 0);
  const min = Math.min(...positive);
  const max = Math.max(...positive);
  return [10 ** Math.floor(Math.log10(min)), 10 ** Math.ceil(Math.log10(max))];
}

function powerLabel(value: number): string {
  const exponent = Math.round(Math.log10(value));
  return exponent === 0 ? "1" : `10^${exponent}`;
}

export function renderSettingSurface(outputs: TeachingView, view: ChartViewState): string {
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
    const offsets: Record<string, [number, number, string]> = {
      low: [8, 21, "start"],
      houston: [8, -13, "start"],
      matlab: [8, 32, "start"],
      "up-bihar": [10, -13, "start"]
    };
    const [dx, dy, anchorText] = offsets[anchor.id] ?? [8, -8, "start"];
    const shape = activeScope
      ? `<g class="anchor-group decision-anchor-group"><circle class="decision-anchor-ring" cx="${x(anchor.Tih.value)}" cy="${y(anchor.Ns)}" r="10"/><path class="anchor-point decision-anchor" d="M ${x(anchor.Tih.value)} ${y(anchor.Ns) - 7} l 7 7 -7 7 -7 -7 z"/></g>`
      : `<circle class="anchor-point${anchor.kind === "hybrid" ? " hybrid-anchor" : ""}" cx="${x(anchor.Tih.value)}" cy="${y(anchor.Ns)}" r="5"/>`;
    return `<g class="anchor-group">${shape}<text class="anchor-label" x="${x(anchor.Tih.value) + dx}" y="${y(anchor.Ns) + dy}" text-anchor="${anchorText}">${escapeXml(anchorShortLabel(anchor.id))}</text></g>`;
  }).join("");
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
    ${anchors}${ticksX}
    <text class="axis-label" x="${margin.left + plotWidth / 2}" y="${height - 17}" text-anchor="middle">Linked stool-equivalent exposure, T (µg/exposure · log scale)</text>
    <text class="axis-label" transform="translate(20 ${margin.top + plotHeight / 2}) rotate(-90)" text-anchor="middle">Close social contacts, N_s</text>
    <g class="surface-legend" transform="translate(${margin.left + plotWidth - 236} 34)"><rect x="0" y="0" width="166" height="11" fill="url(#surface-scale)"/><text x="0" y="25">0.01</text><text x="83" y="25" text-anchor="middle">R_loc = 1</text><text x="166" y="25" text-anchor="end">100</text></g>
    <g class="chart-readout" transform="translate(${margin.left + 6} ${margin.top + 10})"><rect x="0" y="0" width="250" height="43"/><text x="10" y="17">INSPECTED DISPLAY CELL</text><text x="10" y="34">${formatMicrograms(activePoint.Tih)} µg/exposure · N_s ${activePoint.Ns} · R_loc ${formatNumber(activePoint.rLoc)}</text></g>
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
    return `<rect class="design-cell ${point.passes ? "passes" : "fails"}${inspected ? " is-inspected" : ""}${persistent ? " is-persistent" : ""}" data-design-key="${key}" data-take-index="${takeIndex}" data-boost-index="${boostIndex}" x="${x0}" y="${y0}" width="${Math.max(1, x1 - x0 + 0.2)}" height="${Math.max(1, y1 - y0 + 0.2)}" fill="${surfaceColor(point.rLocEnvelopeMax)}"><title>take ${formatNumber(point.takeContext)}; boost ${formatNumber(point.mu0)} log2; direct R_loc ${formatNumber(point.rLocEnvelopeMax)}; ${point.passes ? "meets" : "does not meet"}</title></rect>`;
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
  const exactMark = exact ? selectedExactMark(x(exact.takeContext), y(exact.mu0), margin.left + plotWidth * 0.6, margin.top, margin.top + plotHeight) : "";
  const nearestMark = nearest ? `<path class="nearest-grid" d="M ${x(nearest.takeContext) - 5} ${y(nearest.mu0)} h 10 M ${x(nearest.takeContext)} ${y(nearest.mu0) - 5} v 10"/>` : "";
  const sabin = outputs.frontier.comparators.find((point) => point.productId === "sabin2")!;
  const sabinMark = sabin.takeContext !== null && sabin.mu0 !== null ? `<path class="comparator-marker sabin-marker" d="M ${x(sabin.takeContext)} ${y(sabin.mu0) - 6} l 6 10 h -12 z"/><text class="comparator-label" x="${x(sabin.takeContext) - 9}" y="${y(sabin.mu0) - 9}" text-anchor="end">fixed Sabin 2</text>` : "";
  return `<svg id="product-figure" class="scientific-chart linked-chart" tabindex="0" role="img" aria-labelledby="product-title product-desc" data-chart="product" viewBox="0 0 ${width} ${height}">
    <title id="product-title">Product design space</title><desc id="product-desc">The same 2,601 hypothetical product designs shown by biological take context and latent mean mucosal boost. The black threshold contour separates direct pass and fail evaluations for the declared decision scope. The selected exact design is a ring; the nearest grid point is a cross. Sabin 2 is fixed. IPV is omitted because these live-vaccine coordinates are undefined for it.</desc>
    <text class="chart-kicker" x="${margin.left}" y="24">PRODUCT ASSUMPTIONS</text><text class="chart-title" x="${margin.left}" y="50">Which OPV-like designs produce enough effect?</text>
    <rect class="plot-bg" x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}"/>${gridLines(x, y, margin, plotWidth, plotHeight, "product")}${cells}<path class="threshold-line" d="${contourPath}"/>${nearestMark}${exactMark}${sabinMark}
    ${linearTicks([0, .25, .5, .75, 1], x, margin.top + plotHeight, "x")}${linearTicks([0, 2, 4, 6, 8], y, margin.left, "y")}
    <text class="axis-label" x="${margin.left + plotWidth / 2}" y="${height - 18}" text-anchor="middle">Biological take context after a received dose</text>${rotatedYLabel("axis-label", 13, margin.top + plotHeight / 2, "Latent mean mucosal boost (log2)")}
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
    return `<circle class="effect-point ${point.passes ? "passes" : "fails"}${inspected ? " is-inspected" : ""}${persistent ? " is-persistent" : ""}" data-design-key="${key}" cx="${x(1 - point.qAcq)}" cy="${y(1 - point.qShed)}" r="${point.passes ? 2.5 : 1.3}"><title>acquisition reduction ${formatPercent(1 - point.qAcq)}; breakthrough shedding reduction ${formatPercent(1 - point.qShed)}; take ${formatNumber(point.takeContext)}; boost ${formatNumber(point.mu0)}; direct R_loc ${formatNumber(point.rLocEnvelopeMax)}</title></circle>`;
  }).join("");
  const paretoPoints = outputs.frontier.pareto.map((point) => [x(1 - point.qAcq), y(1 - point.qShed)] as [number, number]);
  const paretoPath = paretoPoints.length > 1 ? line()(paretoPoints) ?? "" : "";
  const paretoMark = paretoPath ? `<path class="pareto-casing" d="${paretoPath}"/><path class="pareto-line" d="${paretoPath}"/>` : "";
  const paretoLabel = paretoPath
    ? `<g class="chart-key" transform="translate(${margin.left + 8} ${margin.top + 33})"><line class="pareto-casing" x1="0" x2="24" y1="0" y2="0"/><line class="pareto-line" x1="0" x2="24" y1="0" y2="0"/><text x="32" y="3">minimum-sufficient Pareto boundary</text></g>`
    : "";
  const exact = outputs.frontier.selectedDesign;
  const exactMark = exact ? selectedExactMark(x(1 - exact.qAcq), y(1 - exact.qShed), margin.left + plotWidth * 0.6, margin.top, margin.top + plotHeight) : "";
  const comparators = outputs.frontier.comparators.map((point) => {
    const cx = x(1 - point.qAcq);
    const cy = y(1 - point.qShed);
    return point.productId === "ipv"
      ? `<rect class="comparator-marker" x="${cx - 5}" y="${cy - 5}" width="10" height="10"/><text class="comparator-label" x="${cx - 8}" y="${cy - 9}" text-anchor="end">fixed IPV</text>`
      : `<path class="comparator-marker" d="M ${cx} ${cy - 6} l 6 10 h -12 z"/><text class="comparator-label" x="${cx - 8}" y="${cy - 9}" text-anchor="end">fixed Sabin 2</text>`;
  }).join("");
  const empty = outputs.frontier.pareto.length === 0 ? `<text class="empty-frontier" x="${margin.left + plotWidth / 2}" y="${margin.top + plotHeight / 2}" text-anchor="middle">No evaluated design passes this scope</text>` : "";
  return `<svg id="effect-figure" class="scientific-chart linked-chart" tabindex="0" role="img" aria-labelledby="effect-title effect-desc" data-chart="effect" viewBox="0 0 ${width} ${height}">
    <title id="effect-title">Outcome requirement space</title><desc id="effect-desc">The same 2,601 directly evaluated designs shown by modeled reduction in WPV acquisition and conditional breakthrough infectious shedding. The solid, labeled turquoise line is the minimum-sufficient Pareto boundary when one exists. These axes are outcomes, not independently tunable product inputs, and blank regions are unattained.</desc>
    <text class="chart-kicker" x="${margin.left}" y="24">MODELED OUTCOMES</text><text class="chart-title" x="${margin.left}" y="50">What combination of effects is sufficient?</text>
    <rect class="plot-bg" x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}"/>${gridLines(x, y, margin, plotWidth, plotHeight, "effect")}${points}${paretoMark}${exactMark}${comparators}${empty}
    ${linearTicks([0, .25, .5, .75, 1], x, margin.top + plotHeight, "x", true)}${linearTicks([0, .25, .5, .75, 1], y, margin.left, "y", true)}
    <text class="axis-label" x="${margin.left + plotWidth / 2}" y="${height - 18}" text-anchor="middle">Reduction in WPV acquisition (1 − q_acq)</text>${rotatedYLabel("axis-label", 13, margin.top + plotHeight / 2, "Reduction in breakthrough shedding")}
    <g class="chart-key" transform="translate(${margin.left + 8} ${margin.top + 15})"><circle class="effect-point passes" cx="0" cy="0" r="2.5"/><text x="8" y="3">meets</text><circle class="effect-point fails" cx="60" cy="0" r="1.3"/><text x="68" y="3">does not meet</text></g>${paretoLabel}
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

function selectedExactMark(cx: number, cy: number, rightBoundary: number, plotTop: number, plotBottom: number): string {
  const nearRight = cx > rightBoundary;
  const lx = nearRight ? cx - 11 : cx + 11;
  const ly = nearRight ? (cy > plotBottom - 26 ? cy - 12 : cy + 20) : Math.max(plotTop + 10, cy - 9);
  const anchor = nearRight ? "end" : "start";
  return `<circle class="selected-exact" cx="${cx}" cy="${cy}" r="8"/><text class="selection-label" x="${lx}" y="${ly}" text-anchor="${anchor}">selected exact</text>`;
}

function anchorShortLabel(id: string): string {
  return id === "low" ? "Low" : id === "houston" ? "Houston / Louisiana" : id === "matlab" ? "Matlab · daily-exposure hybrid" : "UP / Bihar high";
}

function formatMicrograms(grams: number): string {
  return formatNumber(grams * 1_000_000);
}

// Two-digit display: >=1 -> 2 significant figures; 0.01<=|v|<1 -> 2 decimals;
// very large/small -> 2-decimal-mantissa scientific.
function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1e4 || abs < 0.01) return value.toExponential(2);
  return abs >= 1 ? String(Number(value.toPrecision(2))) : value.toFixed(2);
}

// Two significant figures, except never round a genuine sub-100% value up to "100%".
function formatPercent(value: number): string {
  const pct = 100 * value;
  const twoSig = formatNumber(pct);
  if (twoSig === "100" && value < 1) return `${(Math.floor(pct * 10) / 10).toFixed(1)}%`;
  return `${twoSig}%`;
}

function formatPercentTick(value: number): string {
  return `${Math.round(100 * value)}%`;
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
