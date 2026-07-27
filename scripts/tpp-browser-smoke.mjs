import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(new URL("..", import.meta.url).pathname);
const artifact = resolve(root, "dist/index.html");
readFileSync(artifact);

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  await page.goto(`file://${artifact}`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("#transaction-status")?.classList.contains("committed"));

  assert.equal(await page.locator("body").getAttribute("data-tpp-mode"), "learn");
  assert.ok(await page.locator("#tpp-workbench").isHidden(), "Learn mode should retain the teaching-first page");
  assert.ok(await page.locator("#tpp-causal-chain").isVisible(), "The explicit causal chain should be visible in Learn mode");
  assert.ok(await page.locator("#tpp-transmission-waterfall").isVisible(), "The direct transmission waterfall should be visible in Learn mode");

  const surfaceAxes = await page.locator("#setting-figure text.axis-label").allTextContents();
  assert.ok(surfaceAxes.some((text) => text.includes("per exposure")), "The setting surface must name its per-exposure coordinate");
  assert.ok(surfaceAxes.every((text) => !text.includes("per day")), "The setting surface must not label the per-exposure coordinate per day");
  const firstCellTitle = await page.locator("#setting-figure rect.surface-cell title").first().textContent();
  assert.ok(firstCellTitle?.includes("/exposure"), "Setting cells must report exposure mass per exposure");

  await page.locator('button[data-tpp-mode="design"]').click();
  assert.equal(await page.locator("body").getAttribute("data-tpp-mode"), "design");
  assert.ok(await page.locator("#tpp-workbench").isVisible(), "Design mode should expose the TPP workbench");
  const profileText = await page.locator("#tpp-profile-content").textContent();
  for (const phrase of ["Context multiplier on take", "Modeled take by dose", "Direct Rloc", "Evidence status"]) {
    assert.ok(profileText?.includes(phrase), `TPP profile omits ${phrase}`);
  }

  await page.locator('button[data-action="pin-current"]').click();
  const priorIdentity = await page.locator("#result-status").getAttribute("data-model-identity");
  await page.selectOption("#scope", "matlab");
  await page.waitForFunction((prior) => {
    const status = document.querySelector("#transaction-status");
    const identity = document.querySelector("#result-status")?.getAttribute("data-model-identity");
    return status?.classList.contains("committed") && identity !== prior;
  }, priorIdentity);
  await page.waitForFunction(() => document.querySelector("#tpp-comparison-content")?.textContent?.includes("Matlab"));
  const comparison = await page.locator("#tpp-comparison-content").textContent();
  assert.ok(comparison?.includes("Pinned scenario"));
  assert.ok(comparison?.includes("UP/Bihar"));
  assert.ok(comparison?.includes("Matlab"));
  const sliceNote = await page.locator(".tpp-surface-slice-note").textContent();
  assert.ok(sliceNote?.includes("1 exposure/person/day"));
  assert.ok(await page.locator("#setting-figure text.anchor-label", { hasText: "Matlab" }).isVisible());
  assert.ok(await page.locator("#setting-figure text.anchor-label", { hasText: "Houston" }).isHidden());
  assert.ok(comparison?.includes("Direct R_loc"));

  const decision = await page.locator("#result-status").textContent();
  assert.ok(decision?.includes("product-and-schedule scenario"));
  assert.ok(decision?.includes("parameter uncertainty are not quantified"));
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("TPP browser smoke OK: learning, design, units, comparison, and evidence semantics checked");
} finally {
  await browser.close();
}
