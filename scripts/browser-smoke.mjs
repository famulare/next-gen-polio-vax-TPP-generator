import { chromium } from "playwright";
import assert from "node:assert/strict";
import { deterministicBuildIdentity } from "./build-identity.mjs";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname);
const artifact = resolve(new URL("../dist/index.html", import.meta.url).pathname);
const pagesPath = "/next-gen-polio-vax-TPP-generator/";
const artifactHtml = readFileSync(artifact, "utf8");
const parameters = JSON.parse(readFileSync(new URL("../src/data/parameters.json", import.meta.url), "utf8"));
const { designContractVersion } = parameters;
const settingManifest = JSON.parse(readFileSync(new URL("../src/data/setting-anchors.json", import.meta.url), "utf8"));
const upBihar = settingManifest.anchors.find((anchor) => anchor.id === "up-bihar");
if (!upBihar) throw new Error("UP/Bihar teaching anchor is absent from the setting manifest");
const expectedBuildIdentity = deterministicBuildIdentity(root);
const palette = {
  parchment: "#F5F3ED",
  slate: "#313A44",
  saffron: "#EBCB00",
  white: "#FFFFFF",
  orange: "#F85C02",
  magenta: "#6C1446",
  turquoise: "#295958",
  darkBlue: "#12236D",
  darkOrange: "#9B320D",
  surfaceBlue: "#2166AC",
  surfaceWhite: "#F7F7F2",
  surfaceRed: "#B2182B"
};
assert.match(artifactHtml, /font-src data:/, "Artifact CSP must permit only inline data fonts");
const nodeDiagnosticRun = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", "import { defaultScenario, evaluateScenario } from './src/model/model.ts'; process.stdout.write(JSON.stringify(evaluateScenario(defaultScenario()).diagnostics));"], { cwd: root, encoding: "utf8" });
if (nodeDiagnosticRun.status !== 0) throw new Error(`Node diagnostic evaluation failed: ${nodeDiagnosticRun.stderr}`);
const nodeDiagnostics = JSON.parse(nodeDiagnosticRun.stdout);
const server = createServer((request, response) => {
  if (request.url === pagesPath) {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(artifactHtml);
    return;
  }
  response.writeHead(404);
  response.end();
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const address = server.address();
if (!address || typeof address === "string") throw new Error("Path-prefix test server did not expose a TCP port");
const pagesOrigin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
console.log("Browser smoke: launched Chromium");

try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  const externalRequests = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  page.on("request", (request) => { if (!request.url().startsWith("file:") && !request.url().startsWith("data:")) externalRequests.push(request.url()); });
  await page.goto(`file://${artifact}`, { waitUntil: "load" });
  await waitForCommitted(page);
  console.log("Browser smoke: default narrative committed");

  const visualSystem = await page.evaluate(async () => {
    await document.fonts.ready;
    const root = getComputedStyle(document.documentElement);
    const reference = document.querySelector("#within-host-figure .teaching-reference");
    const candidate = document.querySelector("#within-host-figure .teaching-candidate");
    const pareto = document.querySelector("#effect-figure .pareto-line");
    return {
      tokens: {
        paper: root.getPropertyValue("--paper").trim(), ink: root.getPropertyValue("--ink").trim(),
        saffron: root.getPropertyValue("--accent").trim(), white: root.getPropertyValue("--paper-deep").trim(),
        focus: root.getPropertyValue("--focus").trim()
      },
      header: getComputedStyle(document.querySelector(".site-header")).backgroundColor,
      headlineFont: getComputedStyle(document.querySelector("h1")).fontFamily,
      controlFont: getComputedStyle(document.querySelector("label")).fontFamily,
      fonts: {
        style: document.getElementById("brand-font-faces")?.textContent ?? "",
        sans: document.fonts.check('400 16px "Noto Sans"'),
        serif: document.fonts.check('600 16px "Noto Serif"')
      },
      lines: {
        reference: getComputedStyle(reference).stroke,
        referenceDash: getComputedStyle(reference).strokeDasharray,
        candidate: getComputedStyle(candidate).stroke,
        pareto: getComputedStyle(pareto).stroke
      },
      surfaceStops: [...document.querySelectorAll("#setting-figure #surface-scale stop")].map((stop) => stop.getAttribute("stop-color"))
    };
  });
  assert.deepEqual(visualSystem.tokens, { paper: palette.parchment, ink: palette.slate, saffron: palette.saffron, white: palette.white, focus: palette.darkBlue }, "Core visual tokens changed");
  assert.equal(visualSystem.header, "rgb(235, 203, 0)", "Independent header must use Saffron");
  if (!visualSystem.headlineFont.includes("Noto Serif") || !visualSystem.controlFont.includes("Noto Sans")) throw new Error("Narrative and control typography do not use the Noto system");
  if (!visualSystem.fonts.style.includes("data:font/woff2;base64,") || !visualSystem.fonts.sans || !visualSystem.fonts.serif) throw new Error("Noto faces did not load from inline WOFF2 data");
  assert.equal(visualSystem.lines.reference, "rgb(248, 92, 2)", "Reference line color changed");
  if (visualSystem.lines.referenceDash === "none") throw new Error("Reference line lost its dash discriminator");
  assert.equal(visualSystem.lines.candidate, "rgb(108, 20, 70)", "Selected cohort color changed");
  assert.equal(visualSystem.lines.pareto, "rgb(41, 89, 88)", "Pareto boundary color changed");
  assert.deepEqual(visualSystem.surfaceStops, [palette.surfaceBlue, palette.surfaceWhite, palette.surfaceRed], "R_loc scientific surface endpoints changed");
  for (const [foreground, background, threshold, label] of [
    [palette.slate, palette.parchment, 4.5, "Slate narrative text"],
    [palette.darkBlue, palette.parchment, 4.5, "Dark Blue focus text"],
    [palette.orange, palette.white, 3, "Orange reference line"],
    [palette.magenta, palette.white, 3, "Magenta selected line"],
    [palette.turquoise, palette.white, 3, "Turquoise Pareto line"],
    [palette.darkOrange, palette.white, 3, "Dark Orange hybrid interval"]
  ]) {
    if (contrastRatio(foreground, background) < threshold) throw new Error(`${label} does not meet its contrast threshold`);
  }
  const visibleArtifactText = await page.locator("body").innerText();
  if (/gates foundation|gate device|foundation affiliation/i.test(visibleArtifactText)) throw new Error("Artifact introduces a Foundation identity or affiliation claim");

  if (!(await page.locator(".prototype-banner").count())) throw new Error("Prototype release-status note did not render");
  if (!(await page.locator(".hero .eyebrow").textContent())?.includes(`contract ${designContractVersion}`)) throw new Error("Opening does not identify the design-contract version");
  if (!(await page.locator("h1").textContent())?.includes("block close-contact transmission")) throw new Error("Opening question is missing");
  const openingComparison = await page.locator("#opening-comparison").textContent();
  if (!openingComparison?.includes("Naive child") || !openingComparison.includes("Hypothetical OPV-like vaccine") || !openingComparison.includes("assessed 28 days")) throw new Error("First viewport does not identify the current reference-to-vaccinated comparison");
  const defaultResult = await page.locator("#result-status").textContent();
  if (!defaultResult?.includes("clears the hardest known modeled anchor")) throw new Error("Default result does not lead with the hardest-known anchor");
  if (!defaultResult.includes("Direct Rloc0.92") || !defaultResult.includes("does not prove control everywhere")) throw new Error("Default result or adjacent qualification is wrong");
  if (!defaultResult.includes("not a complete-population R_e")) throw new Error("Result blurs R_loc and complete-population R_e");
  if (await page.locator("#scope").inputValue() !== "up-bihar") throw new Error("UP/Bihar is not the default decision scope");
  if (await page.locator("#probe").count()) throw new Error("A separate inspection probe control still exists; it should be merged into decision scope");
  const narrativeOrder = await page.evaluate(() => ["within-host", "product-pathway", "transmission", "decision", "measurement", "design-space"].map((id) => [...document.querySelectorAll("section")].indexOf(document.getElementById(id))));
  if (narrativeOrder.some((index, position) => position > 0 && index <= narrativeOrder[position - 1])) throw new Error("Teaching chapters are not in within-host, product, transmission, decision, measurement, design order");
  const resultAfterTransmission = await page.evaluate(() => {
    const sections = [...document.querySelectorAll("section")];
    return sections.indexOf(document.getElementById("decision")) > sections.indexOf(document.getElementById("transmission"));
  });
  if (!resultAfterTransmission) throw new Error("Direct verdict appears before the transmission lesson");
  const prematureVerdict = await page.evaluate(() => [...document.querySelectorAll("section")]
    .filter((section) => section.id !== "decision" && section.compareDocumentPosition(document.getElementById("decision")) & Node.DOCUMENT_POSITION_FOLLOWING)
    .some((section) => /clears the hardest known|does not meet|meets the direct criterion/i.test(section.textContent ?? "")));
  if (prematureVerdict) throw new Error("A pass/fail verdict appears before the R_loc setting step");
  if (!(await page.locator("#within-host-figure").count()) || await page.locator("#within-host-figure .teaching-panel").count() !== 4) throw new Error("Four within-host teaching panels did not render");
  const withinHostText = await page.locator("#within-host").textContent();
  if (!(await page.locator("#within-host-figure").getAttribute("aria-labelledby")) || !(await page.locator("#within-host-figure .teaching-reference-dose").count()) || !withinHostText?.includes("assay floor") || !withinHostText.includes("P(acquisition | one WPV HID50) × B") || !withinHostText.includes("qindex")) throw new Error("Within-host teaching panels lack the required reference, conditioning, or shedding-index context");
  if (!(await page.locator("#product-pathway #hypothetical-controls").count()) || !(await page.locator("#product-pathway").textContent())?.includes("Fixed γvax")) throw new Error("Product parameters are not disclosed at their point of use");
  if (await page.locator("#print-product-summary").isVisible()) throw new Error("Print-only product summary leaked into the interactive narrative");
  const transmissionText = await page.locator("#transmission").textContent();
  const expectedIndexLink = `${upBihar.T_ih.value} µg stool-equivalent/exposure × ${upBihar.dIh.value} exposure/person/day`;
  const expectedSocialLink = `${upBihar.T_hs.value} µg stool-equivalent/exposure × ${upBihar.dHs.value} exposures/person/day`;
  if (!transmissionText?.includes("cumulative escape") || !transmissionText.includes(expectedIndexLink) || !transmissionText.includes(expectedSocialLink) || !transmissionText.includes(`Ns = ${upBihar.Ns}`) || !transmissionText.includes("one WPV HID50")) throw new Error("Transmission lesson omits manifest-derived dose composition or UP/Bihar link semantics");
  const measurementText = await page.locator("#measurement").textContent();
  for (const phrase of ["P(acquisition | d)", "P(still shedding at day t | WPV acquisition)", "TCID50-days/g", "qindex", `assay floor 10${Math.log10(parameters.shedding.titerFloor).toFixed(1)}`, `${parameters.transmission.horizonDays}-day integral`]) if (!measurementText?.includes(phrase)) throw new Error(`Measurement map omits ${phrase}`);
  if (!(await page.locator("#immunity-distribution-figure").count())) throw new Error("Schedule-derived immunity distribution did not render");
  if (!(await page.locator("#dose-response-figure").count())) throw new Error("Vaccine dose-response teaching figure did not render");
  if (await page.locator("#within-host-figure .teaching-panel").count() !== 4) throw new Error("The dose-response figure must be separate; within-host must stay four panels");
  if (!(await page.locator(".motif-svg").count())) throw new Error("Transmission motif illustration did not render");
  if (!(await page.locator("#effect-figure").count()) || !(await page.locator("#product-figure").count()) || !(await page.locator("#setting-figure").count())) throw new Error("One or more decision or design figures did not render");
  if (await page.locator("#setting-figure [data-surface-column]").count() !== 1620) throw new Error("Setting surface is not 81 × 20");
  if (await page.locator("#setting-figure").getAttribute("data-columns") !== "81" || await page.locator("#setting-figure").getAttribute("data-rows") !== "20") throw new Error("Setting surface dimensions are not declared");
  if (await page.locator("#product-figure [data-design-key]").count() !== 2601 || await page.locator("#effect-figure [data-design-key]").count() !== 2601) throw new Error("Linked maps do not render the same 2,601 designs");
  if (!(await page.locator("#frontier-summary").textContent())?.includes("92 of 2,601") || !(await page.locator("#frontier-summary").textContent())?.includes("8 lie")) throw new Error("Default frontier summary is wrong");
  if (!(await page.locator("#frontier-summary").textContent())?.includes("qindex") || !(await page.locator("#frontier-summary").textContent())?.includes("direct Rloc,max")) throw new Error("Linked-map summary omits the selected diagnostic decomposition or direct result");
  if (await page.locator("[data-export]").first().isDisabled()) throw new Error("Exports were not enabled for the committed default");
  if (await page.locator("#transaction-status").getAttribute("aria-live") !== "polite") throw new Error("Committed results lack a concise live announcement");

  let identity = await page.locator("#result-status").getAttribute("data-model-identity");
  // One decision-scope selector both decides and inspects the same named setting, and
  // auto-commits (no manual step): changing it changes the committed identity and verdict.
  await page.selectOption("#scope", "low");
  await awaitCommit(page, identity);
  if (!(await page.locator("#scope-summary").textContent())?.includes("Low transmission")) throw new Error("Decision-scope change did not update the scope summary");
  if (await page.locator("[data-export]").first().isDisabled()) throw new Error("Committed decision-scope change left export disabled");
  identity = await page.locator("#result-status").getAttribute("data-model-identity");
  await page.selectOption("#scope", "up-bihar");
  await awaitCommit(page, identity);
  console.log("Browser smoke: decision-scope selector checked");

  identity = await page.locator("#result-status").getAttribute("data-model-identity");
  await page.selectOption("#product", "sabin2");
  await awaitCommit(page, identity);
  if (!(await page.locator("#hypothetical-controls").evaluate((element) => element.hidden)) || !(await page.locator("#take").isDisabled())) throw new Error("Fixed Sabin 2 exposed hypothetical product controls");
  if (!(await page.locator("#catalog-product-note").textContent())?.includes("fixed catalog comparator")) throw new Error("Sabin 2 catalog semantics are not visible");
  identity = await page.locator("#result-status").getAttribute("data-model-identity");
  await page.selectOption("#product", "ipv");
  await awaitCommit(page, identity);
  if (!(await page.locator("#catalog-product-note").textContent())?.includes("fixed non-live comparator")) throw new Error("IPV catalog semantics are not visible");
  identity = await page.locator("#result-status").getAttribute("data-model-identity");
  await page.selectOption("#product", "hypothetical");
  await awaitCommit(page, identity);
  if (await page.locator("#take").isDisabled() || await page.locator("#hypothetical-controls").evaluate((element) => element.hidden)) throw new Error("Hypothetical product controls were not restored");
  console.log("Browser smoke: product controls checked");

  const firstDesign = page.locator("#product-figure [data-design-key]").first();
  await firstDesign.hover();
  if (!(await page.locator("#design-inspector").textContent())?.includes("Inspection")) throw new Error("Hover did not update the linked design inspector");
  const hoverKey = await firstDesign.getAttribute("data-design-key");
  if (!(await page.locator(`#effect-figure [data-design-key="${hoverKey}"]`).evaluate((element) => element.classList.contains("is-inspected")))) throw new Error("Hover inspection was not linked across maps");
  await firstDesign.click();
  if (!(await page.locator("#design-inspector").textContent())?.includes("Held design")) throw new Error("Click did not persist linked-map selection");
  if (await page.locator("#use-design").isHidden() || await page.locator("#use-design").isDisabled()) throw new Error("Persistent selection did not expose the sole promotion action");
  const heldKey = await firstDesign.getAttribute("data-design-key");
  if (await page.locator(`#effect-figure [data-design-key="${heldKey}"]`).count() !== 1) throw new Error("Product selection has no linked effect-space mark");
  if (!(await page.locator(`#effect-figure [data-design-key="${heldKey}"]`).evaluate((element) => element.classList.contains("is-persistent")))) throw new Error("Persistent selection was not linked across maps");
  const useIdentity = await page.locator("#result-status").getAttribute("data-model-identity");
  await page.locator("#use-design").click();
  await awaitCommit(page, useIdentity);
  if (await page.locator("#take").inputValue() !== "0" || await page.locator("#mu").inputValue() !== "0") throw new Error("Use this design did not promote the held grid point");

  await page.locator("#product-figure").focus();
  await page.keyboard.press("End");
  if (!(await page.locator("#design-inspector").textContent())?.includes("Take context1") || !(await page.locator("#design-inspector").textContent())?.includes("Mean boost8 log2")) throw new Error("Keyboard traversal did not reach the final grid design");
  await page.keyboard.press("Enter");
  if (!(await page.locator("#design-inspector").textContent())?.includes("Held design")) throw new Error("Enter did not persist keyboard selection");
  await page.keyboard.press("Escape");
  if (!(await page.locator("#design-inspector").textContent())?.includes("Inspect a design")) throw new Error("Escape did not clear view-only selection");
  console.log("Browser smoke: linked selection checked");

  // View-only per-contact R_loc readout must recompute without touching the committed
  // decision, model identity, or exports (contract §15.3 / §18 decision 21).
  const motifIdentityBefore = await page.locator("#result-status").getAttribute("data-model-identity");
  const motifReadoutBefore = await page.locator("#motif-rloc").evaluate((element) => element.value);
  const motifContactsSeed = await page.locator("#motif-contacts").inputValue();
  const motifContactsNext = motifContactsSeed === "12" ? "6" : "12";
  await page.locator("#motif-contacts").evaluate((element, value) => { element.value = value; element.dispatchEvent(new Event("input", { bubbles: true })); }, motifContactsNext);
  if (await page.locator("#motif-rloc").evaluate((element) => element.value) === motifReadoutBefore) throw new Error("Per-contact R_loc readout did not recompute on input");
  if (await page.locator("#result-status").getAttribute("data-model-identity") !== motifIdentityBefore) throw new Error("View-only motif readout changed the committed model identity");
  if (await page.locator("[data-export]").first().isDisabled()) throw new Error("View-only motif readout disabled export");
  if (await page.locator("#result-status").evaluate((element) => element.dataset.stale === "true")) throw new Error("View-only motif readout marked the committed result stale");
  console.log("Browser smoke: view-only motif readout checked");

  const surfaceReadout = await page.locator("#setting-figure .chart-readout").textContent();
  await page.locator("#setting-figure").focus();
  await page.keyboard.press("ArrowRight");
  if (await page.locator("#setting-figure .chart-readout").textContent() === surfaceReadout) throw new Error("Setting-surface keyboard traversal did not update readout");

  await page.locator("#reset").click();
  await waitForCommitted(page);
  const preEditImmunity = await page.locator("#immunity-distribution-figure").innerHTML();
  const preEditRloc = await page.locator("#result-status .result-number strong").textContent();
  const takeIdentity = await page.locator("#result-status").getAttribute("data-model-identity");
  await page.locator("#take").evaluate((element) => {
    element.value = "0.1";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  // The verdict and figures update live on the edit; the frontier maps/exports auto-commit
  // shortly after, with no manual "Update the model" step.
  await page.waitForFunction((prev) => document.querySelector("#result-status .result-number strong")?.textContent !== prev, preEditRloc, { timeout: 30_000 });
  if (await page.locator("#immunity-distribution-figure").innerHTML() === preEditImmunity) throw new Error("Live figure did not update on a scientific edit");
  if (!(await page.locator("#setting-figure").count()) || !(await page.locator("#result-status").textContent())?.includes("Direct Rloc")) throw new Error("Verdict block disappeared during a live edit");
  await awaitCommit(page, takeIdentity);
  if (await page.locator("[data-export]").first().isDisabled()) throw new Error("Exports were not re-enabled after auto-commit");
  console.log("Browser smoke: live verdict and auto-commit checked");

  // An out-of-range scientific edit fails closed: prior verdict retained + dimmed, export
  // disabled; recovering re-commits and clears the dimming (no permanently stale verdict).
  await page.locator("#reset").click();
  await waitForCommitted(page);
  await page.locator("#alpha").evaluate((element) => { element.value = "0"; element.dispatchEvent(new Event("change", { bubbles: true })); });
  await page.locator("#transaction-status.invalid").waitFor({ state: "visible", timeout: 30_000 });
  if (!(await page.locator("[data-export]").first().isDisabled())) throw new Error("Invalid edited state remained exportable");
  if (!(await page.locator("#story-results").evaluate((element) => element.classList.contains("is-stale")))) throw new Error("Invalid edit did not dim the retained verdict");
  await page.locator("#reset").click();
  await waitForCommitted(page);
  if (await page.locator("#story-results").evaluate((element) => element.classList.contains("is-stale"))) throw new Error("Verdict stayed dimmed after recovering from an invalid edit");
  console.log("Browser smoke: invalid edit fails closed and recovers checked");

  // A reachable weak-dose design yields an empty frontier (no passing design).
  const emptyIdentity = await page.locator("#result-status").getAttribute("data-model-identity");
  await page.locator("#dose-log").evaluate((element) => { element.value = "0"; element.dispatchEvent(new Event("change", { bubbles: true })); });
  await awaitCommit(page, emptyIdentity);
  if (!(await page.locator("#frontier-summary").textContent())?.includes("No evaluated hypothetical design")) throw new Error("Weak-dose scenario did not expose the empty-frontier branch");
  if (await page.locator("#effect-figure .pareto-line").count()) throw new Error("Empty frontier retained a Pareto line element");
  if (!(await page.locator("#effect-figure .empty-frontier").count())) throw new Error("Empty frontier lacks direct accessible chart annotation");
  console.log("Browser smoke: empty frontier checked");

  await page.locator("#reset").click();
  await waitForCommitted(page);
  const exportDesign = page.locator("#product-figure [data-design-key]").nth(1);
  await exportDesign.click();
  const exportHeldKey = await exportDesign.getAttribute("data-design-key");
  const committedIdentity = await page.locator("#result-status").getAttribute("data-model-identity");
  const [jsonDownload] = await Promise.all([page.waitForEvent("download"), page.locator('[data-export="json"]').click()]);
  const jsonPath = await jsonDownload.path();
  if (!jsonPath) throw new Error("JSON export did not provide local content");
  const exportedJson = JSON.parse(readFileSync(jsonPath, "utf8"));
  if (exportedJson.exportSchemaVersion !== "PrototypeModelExportV2") throw new Error("JSON export schema is missing or stale");
  if (exportedJson.buildIdentity !== expectedBuildIdentity || exportedJson.exportIdentity !== committedIdentity) throw new Error("JSON export identities do not match visible committed state");
  if (exportedJson.decisionScope?.id !== "up-bihar" || exportedJson.inspectionProbe?.id !== "up-bihar") throw new Error("JSON export blurs decision scope and inspection probe");
  if (exportedJson.viewState?.persistentDesignKey !== exportHeldKey) throw new Error("JSON export omitted the held view selection");
  if (exportedJson.outputs?.diagnostics?.schemaVersion !== "WithinHostDiagnosticsV1" || exportedJson.outputs?.diagnostics?.gridVersion !== "diagnostic-grid-1.0.0") throw new Error("JSON export omitted versioned within-host diagnostics");
  assert.deepEqual(exportedJson.outputs?.diagnostics, nodeDiagnostics, "Browser JSON export diagnostics do not exactly match the Node projection on fixed grids");

  const [csvDownload] = await Promise.all([page.waitForEvent("download"), page.locator('[data-export="csv"]').click()]);
  const csvPath = await csvDownload.path();
  if (!csvPath) throw new Error("CSV export did not provide local content");
  const csv = readFileSync(csvPath, "utf8");
  if (!csv.startsWith("export_schema_version,build_identity,record_type,product_id,take_context,mu0,Tih_g_per_exposure,Ths_g_per_exposure,dIh_exposures_per_person_day,dHs_exposures_per_person_day,Ns,")) throw new Error("CSV export omitted schema, build, or exact setting dimensions");
  if (!csv.includes(`PrototypeGridExportV2,${expectedBuildIdentity},`)) throw new Error("CSV export schema or build identity is stale");
  if (!csv.includes("decision_scope,inspection_probe,model_identity")) throw new Error("CSV export omitted scope, probe, or identity");

  for (const kind of ["within-host", "setting", "effect", "product"]) {
    const [svgDownload] = await Promise.all([page.waitForEvent("download"), page.locator(`[data-export="${kind}-svg"]`).click()]);
    const svgPath = await svgDownload.path();
    if (!svgPath) throw new Error(`${kind} SVG export did not provide local content`);
    const svg = readFileSync(svgPath, "utf8");
    const requiredContext = ["PrototypeFigureExportV2", expectedBuildIdentity, "SCIENTIFIC PROTOTYPE", "UP/Bihar", "does not prove control everywhere", "Held inspection design"];
    if (kind === "within-host") requiredContext.push("Teaching grid: diagnostic-grid-1.0.0", "conditioned on WPV acquisition", "Within-host components", "sheddingIndexAtReferenceTCID50DaysPerGram", "data-diagnostic-schema=\"WithinHostDiagnosticsV1\"");
    else requiredContext.push("Contours are interpolated display context");
    for (const phrase of requiredContext) {
      if (!svg.includes(phrase)) throw new Error(`Standalone ${kind} SVG omitted required context: ${phrase}`);
    }
    if (!svg.includes("Noto Sans") || !svg.includes("Noto Serif") || !svg.includes("data:font/woff2;base64,")) throw new Error(`Standalone ${kind} SVG did not embed the screen typography`);
    if (!svg.includes(palette.orange) || !svg.includes(palette.magenta) || !svg.includes(palette.darkBlue) || !svg.includes(palette.darkOrange) || !svg.includes(palette.turquoise)) throw new Error(`Standalone ${kind} SVG does not share the screen data palette`);
    if (kind === "setting" && !["0.01", "R_loc = 1", "100", palette.surfaceBlue, palette.surfaceWhite, palette.surfaceRed].every((phrase) => svg.includes(phrase))) throw new Error("Standalone setting SVG omitted its fixed scientific scale");
  }
  await page.locator("#share").click();
  await page.waitForFunction(() => document.getElementById("export-status")?.textContent?.includes("Canonical scenario link"));
  if (!(await page.locator("#export-status").textContent())?.includes("Canonical scenario link")) throw new Error("Share action lacks visible success or fallback feedback");
  console.log("Browser smoke: exports checked");

  const footerText = await page.locator(".site-footer").textContent();
  if (!footerText?.includes(`build ${expectedBuildIdentity}`) || !footerText.includes(`contract ${designContractVersion}`)) throw new Error("Footer identities are incomplete");
  const hash = await page.evaluate(() => window.location.hash);
  if (!hash.startsWith("#scenario=")) throw new Error("Scenario was not serialized into the URL hash");

  await page.setViewportSize({ width: 360, height: 900 });
  await assertNoHorizontalOverflow(page, "360 px viewport");
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  if (await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior) !== "auto") throw new Error("Reduced-motion mode did not disable smooth scrolling");
  await page.locator("#product").focus();
  await page.keyboard.press("Tab");
  if (!(await page.evaluate(() => document.activeElement?.id))) throw new Error("Keyboard focus did not advance through controls");
  if (await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle === "none")) throw new Error("Keyboard focus lacks a visible outline");

  await page.setViewportSize({ width: 600, height: 900 });
  await assertNoHorizontalOverflow(page, "200%-equivalent desktop reflow");
  await page.addStyleTag({ content: "html { filter: grayscale(1); }" });
  const settingText = await page.locator("#setting-figure").textContent();
  if (!settingText?.includes("PASSING SIDE") || !settingText.includes("FAILING SIDE") || !settingText.includes("R_loc = 1")) throw new Error("Grayscale setting surface lacks non-color threshold cues");

  await page.emulateMedia({ media: "screen", reducedMotion: "reduce", forcedColors: "active" });
  if (!(await page.evaluate(() => matchMedia("(forced-colors: active)").matches))) throw new Error("Forced-colors mode was not activated");
  if (!(await page.locator("#result-status").isVisible()) || !(await page.locator("#setting-figure").isVisible())) throw new Error("High-contrast mode hid the authoritative result or setting figure");
  await page.emulateMedia({ media: "print", reducedMotion: "reduce", forcedColors: "none" });
  const printProductSummary = page.locator("#print-product-summary");
  if (!(await page.locator("#result-status").isVisible()) || !(await page.locator("#setting-figure").isVisible()) || await page.locator(".narrative-controls").first().isVisible() || !(await printProductSummary.isVisible()) || !(await printProductSummary.textContent())?.includes("productive live-vaccine infection after a received dose")) throw new Error("Print mode omitted results, retained interactive controls, or hid selected product semantics");
  await page.emulateMedia({ media: "screen", reducedMotion: "no-preference", forcedColors: "none" });

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const touchPage = await touchContext.newPage();
  await touchPage.goto(`file://${artifact}`, { waitUntil: "load" });
  await waitForCommitted(touchPage);
  await touchPage.locator("#product-figure [data-design-key]").first().tap();
  if (!(await touchPage.locator("#design-inspector").textContent())?.includes("Held design")) throw new Error("Touch did not provide an equivalent persistent design readout");
  await assertNoHorizontalOverflow(touchPage, "touch viewport");
  await touchContext.close();
  console.log("Browser smoke: responsive, zoom, grayscale, contrast, print, motion, focus, and touch checks passed");

  await page.setViewportSize({ width: 1200, height: 900 });
  await page.evaluate(() => {
    const encoded = location.hash.slice("#scenario=".length).replace(/-/g, "+").replace(/_/g, "/");
    const scenario = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    scenario.setting.id = "global";
    const stale = btoa(unescape(encodeURIComponent(JSON.stringify(scenario)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    location.hash = `scenario=${stale}`;
  });
  await page.reload({ waitUntil: "load" });
  await waitForCommitted(page);
  if (!(await page.locator("#state-warning").textContent())?.includes("Legacy 'global' setting state is no longer supported")) throw new Error("Legacy URL state was not rejected visibly and actionably");
  if (await page.locator("#scope").inputValue() !== "up-bihar") throw new Error("Legacy URL fallback did not restore versioned default scope");
  console.log("Browser smoke: legacy URL rejection checked");

  const pagesPage = await browser.newPage({ viewport: { width: 900, height: 900 } });
  const pagesRequests = [];
  const pagesErrors = [];
  pagesPage.on("request", (request) => { if (!request.url().startsWith(pagesOrigin) && !request.url().startsWith("data:")) pagesRequests.push(request.url()); });
  pagesPage.on("pageerror", (error) => pagesErrors.push(error.message));
  await pagesPage.goto(`${pagesOrigin}${pagesPath}`, { waitUntil: "load" });
  await waitForCommitted(pagesPage);
  if (!pagesPage.url().startsWith(`${pagesOrigin}${pagesPath}`)) throw new Error("Artifact did not load at the GitHub Pages path prefix");
  if (pagesRequests.length) throw new Error(`Path-prefix load requested external resources: ${pagesRequests.join(", ")}`);
  if (pagesErrors.length) throw new Error(`Path-prefix load raised errors: ${pagesErrors.join(", ")}`);
  await pagesPage.close();

  if (errors.length) throw new Error(errors.join("\n"));
  if (externalRequests.length) throw new Error(`Runtime requested external resources: ${externalRequests.join(", ")}`);
  console.log("Chromium narrative artifact smoke OK");
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function waitForCommitted(page) {
  await page.locator("#transaction-status.committed").waitFor({ state: "visible", timeout: 30_000 });
  await page.locator("#result-status[data-model-identity]").waitFor({ state: "visible", timeout: 30_000 });
}

// After an auto-committing edit: wait for the verdict identity to change (the live tier
// updated) then for the debounced full commit. Avoids racing the transient recompute window.
async function awaitCommit(page, previousIdentity) {
  await page.waitForFunction((prev) => {
    const el = document.getElementById("result-status");
    return !!el && !!el.dataset.modelIdentity && el.dataset.modelIdentity !== prev;
  }, previousIdentity, { timeout: 30_000 });
  await waitForCommitted(page);
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const scrollingElement = document.scrollingElement;
    const originalScrollLeft = scrollingElement?.scrollLeft ?? 0;
    if (scrollingElement) scrollingElement.scrollLeft = Number.MAX_SAFE_INTEGER;
    const scrollableOverflowPx = scrollingElement?.scrollLeft ?? 0;
    if (scrollingElement) scrollingElement.scrollLeft = originalScrollLeft;
    const isContained = (element) => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const overflowX = getComputedStyle(parent).overflowX;
        if (["auto", "scroll", "hidden", "clip"].includes(overflowX)) return true;
      }
      return false;
    };
    const offenders = [...document.querySelectorAll("body *")].flatMap((element) => {
      // SVG descendants report coordinates in their viewBox space, not the
      // scaled screen box. The outer SVG is the relevant responsive element.
      if (element instanceof SVGElement && element.ownerSVGElement) return [];
      if (isContained(element)) return [];
      const rect = element.getBoundingClientRect();
      if (rect.right <= viewportWidth + 1 && rect.left >= -1) return [];
      const name = element.id ? `#${element.id}` : element.classList.length ? `.${[...element.classList].join(".")}` : element.tagName.toLowerCase();
      return [{ name, left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) }];
    }).slice(0, 8);
    return {
      viewportWidth,
      scrollWidth: document.documentElement.scrollWidth,
      scrollableOverflowPx,
      offenders
    };
  });
  // Chromium rounds fractional layout edges differently across platforms. A
  // one-CSS-pixel root metric difference without an uncontained element is not
  // user-visible overflow; larger scroll ranges still fail this smoke check.
  const meaningfulOverflow = overflow.scrollWidth - overflow.viewportWidth > 1 || overflow.scrollableOverflowPx > 1;
  if (meaningfulOverflow) throw new Error(`${label} has horizontal overflow: ${JSON.stringify(overflow)}`);
}

function contrastRatio(foreground, background) {
  const luminance = (hex) => {
    const channels = hex.slice(1).match(/../g).map((value) => Number.parseInt(value, 16) / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
  };
  const [first, second] = [luminance(foreground), luminance(background)];
  return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
}
