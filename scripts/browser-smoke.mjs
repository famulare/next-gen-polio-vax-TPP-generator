import { chromium } from "playwright";
import { deterministicBuildIdentity } from "./build-identity.mjs";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const artifact = resolve(new URL("../dist/index.html", import.meta.url).pathname);
const pagesPath = "/next-gen-polio-vax-TPP-generator/";
const artifactHtml = readFileSync(artifact, "utf8");
const { designContractVersion } = JSON.parse(readFileSync(new URL("../src/data/parameters.json", import.meta.url), "utf8"));
const expectedBuildIdentity = deterministicBuildIdentity(root);
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
  page.on("request", (request) => { if (!request.url().startsWith("file:")) externalRequests.push(request.url()); });
  await page.goto(`file://${artifact}`, { waitUntil: "load" });
  await waitForCommitted(page);
  console.log("Browser smoke: default narrative committed");

  if (!(await page.locator(".prototype-banner").count())) throw new Error("Prototype release-status note did not render");
  if (!(await page.locator(".hero .eyebrow").textContent())?.includes(`contract ${designContractVersion}`)) throw new Error("Opening does not identify the design-contract version");
  if (!(await page.locator("h1").textContent())?.includes("block close-contact transmission")) throw new Error("Opening question is missing");
  const defaultResult = await page.locator("#result-status").textContent();
  if (!defaultResult?.includes("clears the hardest known modeled anchor")) throw new Error("Default result does not lead with the hardest-known anchor");
  if (!defaultResult.includes("Direct Rloc0.920") || !defaultResult.includes("does not prove control everywhere")) throw new Error("Default result or adjacent qualification is wrong");
  if (!defaultResult.includes("not a complete-population R_e")) throw new Error("Result blurs R_loc and complete-population R_e");
  if (await page.locator("#scope").inputValue() !== "up-bihar") throw new Error("UP/Bihar is not the default decision scope");
  if (await page.locator("#probe").inputValue() !== "up-bihar") throw new Error("UP/Bihar is not the default inspection probe");
  const narrativeOrder = await page.evaluate(() => ["within-host", "product-pathway", "transmission", "decision", "measurement", "design-space"].map((id) => [...document.querySelectorAll("section")].indexOf(document.getElementById(id))));
  if (narrativeOrder.some((index, position) => position > 0 && index <= narrativeOrder[position - 1])) throw new Error("Teaching chapters are not in within-host, product, transmission, decision, measurement, design order");
  const resultAfterTransmission = await page.evaluate(() => {
    const sections = [...document.querySelectorAll("section")];
    return sections.indexOf(document.getElementById("decision")) > sections.indexOf(document.getElementById("transmission"));
  });
  if (!resultAfterTransmission) throw new Error("Direct verdict appears before the transmission lesson");
  if (!(await page.locator("#within-host-figure").count()) || await page.locator("#within-host-figure .teaching-panel").count() !== 4) throw new Error("Four within-host teaching panels did not render");
  if (!(await page.locator("#within-host-figure").getAttribute("aria-labelledby")) || !(await page.locator("#within-host-readout").textContent())?.includes("qindex")) throw new Error("Within-host teaching panels lack explicit accessible or diagnostic context");
  if (!(await page.locator("#immunity-distribution-figure").count())) throw new Error("Schedule-derived immunity distribution did not render");
  if (!(await page.locator("#effect-figure").count()) || !(await page.locator("#product-figure").count()) || !(await page.locator("#setting-figure").count())) throw new Error("One or more decision or design figures did not render");
  if (await page.locator("#setting-figure [data-surface-column]").count() !== 1620) throw new Error("Setting surface is not 81 × 20");
  if (await page.locator("#setting-figure").getAttribute("data-columns") !== "81" || await page.locator("#setting-figure").getAttribute("data-rows") !== "20") throw new Error("Setting surface dimensions are not declared");
  if (await page.locator("#product-figure [data-design-key]").count() !== 2601 || await page.locator("#effect-figure [data-design-key]").count() !== 2601) throw new Error("Linked maps do not render the same 2,601 designs");
  if (!(await page.locator("#frontier-summary").textContent())?.includes("92 of 2,601") || !(await page.locator("#frontier-summary").textContent())?.includes("8 lie")) throw new Error("Default frontier summary is wrong");
  if (await page.locator("[data-export]").first().isDisabled()) throw new Error("Exports were not enabled for the committed default");
  if (await page.locator("#transaction-status").getAttribute("aria-live") !== "polite") throw new Error("Committed results lack a concise live announcement");

  const defaultIdentity = await page.locator("#result-status").getAttribute("data-model-identity");
  await page.selectOption("#probe", "low");
  await waitForStale(page);
  await waitForCommitted(page);
  if (await page.locator("#result-status").getAttribute("data-model-identity") !== defaultIdentity) throw new Error("Probe-only change altered scientific identity");
  if (!(await page.locator("#probe-summary").textContent())?.includes("Low transmission")) throw new Error("Probe-only change did not update its independent readout");
  if (!(await page.locator("#scope-summary").textContent())?.includes("UP/Bihar")) throw new Error("Probe-only change altered decision scope");
  console.log("Browser smoke: probe/scope identity checked");

  await page.selectOption("#product", "sabin2");
  await waitForStale(page);
  if (!(await page.locator("#hypothetical-controls").evaluate((element) => element.hidden)) || !(await page.locator("#take").isDisabled())) throw new Error("Fixed Sabin 2 exposed hypothetical product controls");
  if (!(await page.locator("#catalog-product-note").textContent())?.includes("fixed catalog comparator")) throw new Error("Sabin 2 catalog semantics are not visible");
  await waitForCommitted(page);
  await page.selectOption("#product", "ipv");
  await waitForStale(page);
  if (!(await page.locator("#catalog-product-note").textContent())?.includes("fixed non-live comparator")) throw new Error("IPV catalog semantics are not visible");
  await waitForCommitted(page);
  await page.selectOption("#product", "hypothetical");
  await waitForStale(page);
  await waitForCommitted(page);
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
  await page.locator("#use-design").click();
  await waitForStale(page);
  await waitForCommitted(page);
  if (await page.locator("#take").inputValue() !== "0" || await page.locator("#mu").inputValue() !== "0") throw new Error("Use this design did not promote the held grid point");

  await page.locator("#product-figure").focus();
  await page.keyboard.press("End");
  if (!(await page.locator("#design-inspector").textContent())?.includes("1.00") || !(await page.locator("#design-inspector").textContent())?.includes("8.00")) throw new Error("Keyboard traversal did not reach the final grid design");
  await page.keyboard.press("Enter");
  if (!(await page.locator("#design-inspector").textContent())?.includes("Held design")) throw new Error("Enter did not persist keyboard selection");
  await page.keyboard.press("Escape");
  if (!(await page.locator("#design-inspector").textContent())?.includes("Inspect a design")) throw new Error("Escape did not clear view-only selection");
  console.log("Browser smoke: linked selection checked");

  const surfaceReadout = await page.locator("#setting-figure .chart-readout").textContent();
  await page.locator("#setting-figure").focus();
  await page.keyboard.press("ArrowRight");
  if (await page.locator("#setting-figure .chart-readout").textContent() === surfaceReadout) throw new Error("Setting-surface keyboard traversal did not update readout");

  await page.locator("#take").evaluate((element) => {
    element.value = "0.01";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await waitForStale(page);
  if (!(await page.locator("#story-results").evaluate((element) => element.classList.contains("is-stale")))) throw new Error("Prior result is not visibly marked stale");
  if (!(await page.locator("#setting-figure").count()) || !(await page.locator("#result-status").textContent())?.includes("Direct Rloc")) throw new Error("Prior committed result disappeared during recomputation");
  if (!(await page.locator("[data-export]").first().isDisabled())) throw new Error("Stale result remained exportable");
  await waitForCommitted(page);

  await page.selectOption("#scope", "custom");
  await waitForStale(page);
  await waitForCommitted(page);
  await page.locator("#scope-t-min").evaluate((element) => {
    element.value = "0";
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await waitForStale(page);
  await page.locator("#transaction-status.invalid").waitFor({ state: "visible", timeout: 30_000 });
  if (!(await page.locator("#setting-figure").count())) throw new Error("Invalid edit removed prior committed figure instead of retaining it stale");
  if (!(await page.locator("[data-export]").first().isDisabled())) throw new Error("Invalid edited state remained exportable");
  if (!(await page.locator("#state-warning").textContent())?.includes("TihMin")) throw new Error("Invalid scientific state did not expose actionable validation");
  console.log("Browser smoke: stale and invalid transactions checked");

  await page.locator("#reset").click();
  await waitForStale(page);
  await waitForCommitted(page);
  await page.selectOption("#scope", "custom");
  await waitForStale(page);
  await page.evaluate(() => {
    const values = {
      "scope-t-min": "2000", "scope-t-max": "2000", "scope-ns-min": "20", "scope-ns-max": "20",
      "scope-dih-min": "1", "scope-dih-max": "1", "scope-dhs-min": "8.9685", "scope-dhs-max": "8.9685"
    };
    for (const [id, value] of Object.entries(values)) document.getElementById(id).value = value;
    document.getElementById("scope-dhs-max").dispatchEvent(new Event("change", { bubbles: true }));
  });
  await waitForStale(page);
  await waitForCommitted(page);
  if (!(await page.locator("#frontier-summary").textContent())?.includes("No evaluated hypothetical design")) throw new Error("Harsh scope did not expose empty-frontier branch");
  if (await page.locator("#effect-figure .pareto-line").count()) throw new Error("Empty frontier retained a Pareto line element");
  if (!(await page.locator("#effect-figure .empty-frontier").count())) throw new Error("Empty frontier lacks direct accessible chart annotation");
  console.log("Browser smoke: empty frontier checked");

  await page.locator("#reset").click();
  await waitForStale(page);
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
    if (kind === "within-host") requiredContext.push("Teaching grid: diagnostic-grid-1.0.0", "conditioned on WPV acquisition", "Within-host components");
    else requiredContext.push("Contours are interpolated display context");
    for (const phrase of requiredContext) {
      if (!svg.includes(phrase)) throw new Error(`Standalone ${kind} SVG omitted required context: ${phrase}`);
    }
    if (kind === "setting" && !["0.01", "R_loc = 1", "100"].every((phrase) => svg.includes(phrase))) throw new Error("Standalone setting SVG omitted its fixed scale");
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
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error("360 px viewport has horizontal overflow");
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  if (await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior) !== "auto") throw new Error("Reduced-motion mode did not disable smooth scrolling");
  await page.locator("#product").focus();
  await page.keyboard.press("Tab");
  if (!(await page.evaluate(() => document.activeElement?.id))) throw new Error("Keyboard focus did not advance through controls");
  if (await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle === "none")) throw new Error("Keyboard focus lacks a visible outline");

  await page.setViewportSize({ width: 600, height: 900 });
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error("200%-equivalent desktop reflow has horizontal overflow");
  await page.addStyleTag({ content: "html { filter: grayscale(1); }" });
  const settingText = await page.locator("#setting-figure").textContent();
  if (!settingText?.includes("PASSING SIDE") || !settingText.includes("FAILING SIDE") || !settingText.includes("R_loc = 1")) throw new Error("Grayscale setting surface lacks non-color threshold cues");

  await page.emulateMedia({ media: "screen", reducedMotion: "reduce", forcedColors: "active" });
  if (!(await page.evaluate(() => matchMedia("(forced-colors: active)").matches))) throw new Error("Forced-colors mode was not activated");
  if (!(await page.locator("#result-status").isVisible()) || !(await page.locator("#setting-figure").isVisible())) throw new Error("High-contrast mode hid the authoritative result or setting figure");
  await page.emulateMedia({ media: "print", reducedMotion: "reduce", forcedColors: "none" });
  if (!(await page.locator("#result-status").isVisible()) || !(await page.locator("#setting-figure").isVisible()) || await page.locator(".narrative-controls").first().isVisible()) throw new Error("Print mode omitted results or retained interactive controls");
  await page.emulateMedia({ media: "screen", reducedMotion: "no-preference", forcedColors: "none" });

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const touchPage = await touchContext.newPage();
  await touchPage.goto(`file://${artifact}`, { waitUntil: "load" });
  await waitForCommitted(touchPage);
  await touchPage.locator("#product-figure [data-design-key]").first().tap();
  if (!(await touchPage.locator("#design-inspector").textContent())?.includes("Held design")) throw new Error("Touch did not provide an equivalent persistent design readout");
  if (await touchPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error("Touch viewport has horizontal overflow");
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
  pagesPage.on("request", (request) => { if (!request.url().startsWith(pagesOrigin)) pagesRequests.push(request.url()); });
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

async function waitForStale(page) {
  await page.locator("#transaction-status.stale").waitFor({ state: "visible", timeout: 30_000 });
}

async function waitForCommitted(page) {
  await page.locator("#transaction-status.committed").waitFor({ state: "visible", timeout: 30_000 });
  await page.locator("#result-status[data-model-identity]").waitFor({ state: "visible", timeout: 30_000 });
}
