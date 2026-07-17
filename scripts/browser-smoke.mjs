import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";

const artifact = resolve(new URL("../dist/index.html", import.meta.url).pathname);
const pagesPath = "/next-gen-polio-vax-TPP-generator/";
const artifactHtml = readFileSync(artifact, "utf8");
const { designContractVersion } = JSON.parse(
  readFileSync(new URL("../src/data/parameters.json", import.meta.url), "utf8")
);
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
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const errors = [];
const externalRequests = [];
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
page.on("request", (request) => { if (!request.url().startsWith("file:")) externalRequests.push(request.url()); });
await page.goto(`file://${artifact}`, { waitUntil: "load" });
await page.locator("#result-status strong").waitFor({ state: "visible", timeout: 30_000 });
if (!(await page.locator(".prototype-banner").count())) throw new Error("Prototype release-status banner did not render");
if (!(await page.locator(".hero .eyebrow").textContent())?.includes(`design contract ${designContractVersion}`)) throw new Error("UI does not identify the current design-contract version");
if (!(await page.locator("#result-status").textContent())?.includes("PROTOTYPE POINT-RULE COMPARISON")) throw new Error("Result is not labeled as a prototype point-rule comparison");
if ((await page.locator("#result-status").textContent())?.includes("MEETS the point")) throw new Error("Prototype result uses a release-style sufficiency classification");
if (!(await page.locator("#effect-figure").count())) throw new Error("Effect-space figure did not render");
if (!(await page.locator("#product-figure").count())) throw new Error("Product-space figure did not render");
if (!(await page.locator("#setting-figure").count())) throw new Error("Setting figure did not render");
if (!(await page.locator("#compute").isVisible())) throw new Error("Compute control is not visible");
if (await page.locator("[data-export]").first().isDisabled()) throw new Error("Exports were not enabled for the evaluated scenario");
if (!(await page.locator("#export-status").textContent())?.includes("Exports are ready")) throw new Error("Export status does not identify the evaluated scenario as exportable");
const expectedBuildIdentity = process.env.GITHUB_SHA ?? "local-working-tree";
const footerText = await page.locator("footer").textContent();
if (!footerText?.includes(`build ${expectedBuildIdentity}`)) throw new Error("Footer does not identify the build");
if (!footerText.includes(`design contract ${designContractVersion}`)) throw new Error("Footer does not identify the design-contract version");
if (!(await page.locator('footer a[href="#assumptions"]').count())) throw new Error("Footer does not link to model assumptions");

await page.selectOption("#product", "sabin2");
await page.locator("#result-status").filter({ hasText: "PROTOTYPE POINT-RULE COMPARISON" }).waitFor({ state: "visible", timeout: 30_000 });
if (!(await page.locator("#take").isDisabled()) || !(await page.locator("#mu").isDisabled())) throw new Error("Fixed Sabin 2 comparator controls remained editable");
if (!(await page.locator("#take-help").textContent())?.includes("Fixed Sabin 2 catalog")) throw new Error("Sabin 2 take help blurs fixed comparator identity");
if (!(await page.locator("#mu-help").textContent())?.includes("Fixed Sabin 2 catalog")) throw new Error("Sabin 2 boost help blurs fixed comparator identity");

await page.selectOption("#product", "ipv");
await page.locator("#result-status").filter({ hasText: "PROTOTYPE POINT-RULE COMPARISON" }).waitFor({ state: "visible", timeout: 30_000 });
if (!(await page.locator("#take").isDisabled()) || !(await page.locator("#mu").isDisabled())) throw new Error("Fixed IPV comparator controls remained editable");
if (!(await page.locator("#take-help").textContent())?.includes("IPV has no live-vaccine take")) throw new Error("IPV take help does not expose its non-live semantics");
if (!(await page.locator("#mu-help").textContent())?.includes("mucosal boost requires prior live infection")) throw new Error("IPV boost help does not expose its history-dependent mucosal semantics");

await page.selectOption("#product", "hypothetical");
await page.locator("#result-status").filter({ hasText: "PROTOTYPE POINT-RULE COMPARISON" }).waitFor({ state: "visible", timeout: 30_000 });
if (await page.locator("#take").isDisabled() || await page.locator("#mu").isDisabled()) throw new Error("Hypothetical-product controls did not become editable");

const [jsonDownload] = await Promise.all([
  page.waitForEvent("download"),
  page.locator('[data-export="json"]').click()
]);
const jsonPath = await jsonDownload.path();
if (!jsonPath) throw new Error("JSON export did not provide local content");
const exportedJson = JSON.parse(readFileSync(jsonPath, "utf8"));
if (exportedJson.exportSchemaVersion !== "PrototypeModelExportV1") throw new Error("JSON export schema is missing");
if (exportedJson.buildIdentity !== expectedBuildIdentity) throw new Error("JSON export build identity is wrong");
if (exportedJson.outputs?.scenario?.vaccine?.id !== "hypothetical") throw new Error("JSON export omitted the evaluated scenario");
if (typeof exportedJson.outputs?.modelIdentity !== "string" || !exportedJson.outputs.modelIdentity) throw new Error("JSON export omitted model identity");

const [csvDownload] = await Promise.all([
  page.waitForEvent("download"),
  page.locator('[data-export="csv"]').click()
]);
const csvPath = await csvDownload.path();
if (!csvPath) throw new Error("CSV export did not provide local content");
const csv = readFileSync(csvPath, "utf8");
if (!csv.startsWith("record_type,product_id,take_context,mu0,Tih_g_per_exposure,Ths_g_per_exposure,dIh_exposures_per_person_day,dHs_exposures_per_person_day,Ns,")) throw new Error("CSV export omitted exact setting dimensions");

const [svgDownload] = await Promise.all([
  page.waitForEvent("download"),
  page.locator('[data-export="svg"]').click()
]);
const svgPath = await svgDownload.path();
if (!svgPath || !readFileSync(svgPath, "utf8").includes("SCIENTIFIC PROTOTYPE")) throw new Error("SVG export omitted prototype disclosure");

await page.locator("#take").evaluate((element) => {
  element.value = "0.79";
  element.dispatchEvent(new Event("input", { bubbles: true }));
});
if (!(await page.locator("#result-status").textContent())?.includes("RESULT WITHHELD")) throw new Error("Prior threshold comparison remained visible after a control changed");
if (await page.locator("#effect-figure").count() || await page.locator("#product-figure").count() || await page.locator("#setting-figure").count()) throw new Error("Prior figures remained visible after a control changed");
if (!(await page.locator("[data-export]").first().isDisabled())) throw new Error("Exports remained enabled after a control changed");
if (!(await page.locator("#export-status").textContent())?.includes("unavailable")) throw new Error("Export status did not withdraw the stale scenario");
await page.locator("#result-status").filter({ hasText: "PROTOTYPE POINT-RULE COMPARISON" }).waitFor({ state: "visible", timeout: 30_000 });
if (await page.locator("[data-export]").first().isDisabled()) throw new Error("Exports were not re-enabled for the newly evaluated scenario");

await page.locator("#envelope-t-min").evaluate((element) => {
  element.value = "0";
  element.dispatchEvent(new Event("change", { bubbles: true }));
});
if (!(await page.locator("#result-status").textContent())?.includes("RESULT WITHHELD")) throw new Error("Prior threshold comparison remained visible for invalid pending input");
await page.locator("#result-status").filter({ hasText: "INVALID SCENARIO" }).waitFor({ state: "visible", timeout: 30_000 });
if (await page.locator("[data-export]").first().isDisabled() === false) throw new Error("Exports were enabled for an invalid scenario");
if (await page.locator("#effect-figure").count() || await page.locator("#product-figure").count() || await page.locator("#setting-figure").count()) throw new Error("A figure remained visible for an invalid scenario");

await page.setViewportSize({ width: 360, height: 900 });
const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
if (horizontalOverflow) throw new Error("Narrow viewport has horizontal overflow");
await page.locator("#take").focus();
await page.keyboard.press("Tab");
if (!(await page.evaluate(() => document.activeElement?.id))) throw new Error("Keyboard focus did not move");
const hash = await page.evaluate(() => window.location.hash);
if (!hash.startsWith("#scenario=")) throw new Error("Scenario was not serialized into the URL hash");
await page.reload({ waitUntil: "load" });
await page.locator("#result-status strong").waitFor({ state: "visible", timeout: 30_000 });

const pagesPage = await browser.newPage({ viewport: { width: 900, height: 900 } });
const pagesRequests = [];
pagesPage.on("request", (request) => {
  if (!request.url().startsWith(pagesOrigin)) pagesRequests.push(request.url());
});
await pagesPage.goto(`${pagesOrigin}${pagesPath}`, { waitUntil: "load" });
await pagesPage.locator("#result-status strong").waitFor({ state: "visible", timeout: 30_000 });
if (!pagesPage.url().startsWith(`${pagesOrigin}${pagesPath}`)) throw new Error("Artifact did not load at the GitHub Pages path prefix");
if (pagesRequests.length) throw new Error(`Path-prefix load requested external resources: ${pagesRequests.join(", ")}`);
await pagesPage.close();

if (errors.length) throw new Error(errors.join("\n"));
if (externalRequests.length) throw new Error(`Runtime requested external resources: ${externalRequests.join(", ")}`);
await browser.close();
await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
console.log("Chromium artifact smoke OK");
