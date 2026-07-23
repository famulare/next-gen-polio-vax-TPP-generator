import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const brand = readFileSync(new URL("../../src/ui/brand.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../src/styles.css", import.meta.url), "utf8");
const charts = readFileSync(new URL("../../src/ui/charts.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../../src/app.ts", import.meta.url), "utf8");
const build = readFileSync(new URL("../../scripts/build.mjs", import.meta.url), "utf8");

test("visual-system tokens retain the independent Gates-aligned palette", () => {
  for (const token of [
    'parchment: "#F5F3ED"', 'weatheredSlate: "#313A44"', 'bloomingSaffron: "#EBCB00"',
    'white: "#FFFFFF"', 'dvMediumOrange: "#F85C02"', 'dvDarkMagenta: "#6C1446"',
    'dvDarkTurquoise: "#295958"', 'dvDarkBlue: "#12236D"', 'dvDarkOrange: "#9B320D"'
  ]) assert.match(brand, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(styles, /--paper: #F5F3ED;/);
  assert.match(styles, /--ink: #313A44;/);
  assert.match(styles, /--accent: #EBCB00;/);
  assert.match(styles, /\.site-header[^}]*background: var\(--accent\)/);
  assert.match(styles, /\.teaching-reference[^}]*stroke: #F85C02[^}]*stroke-dasharray: 6 4/);
  assert.match(styles, /\.teaching-candidate[^}]*stroke: #6C1446/);
  assert.match(styles, /\.pareto-line[^}]*stroke: #295958/);
  assert.match(styles, /\.hybrid-interval[^}]*stroke: #9B320D/);
  assert.match(styles, /\.decision-anchor-ring[^}]*stroke: var\(--focus\)/);
});

test("scientific R_loc scale remains separate from the visual-system palette", () => {
  for (const endpoint of ["#2166AC", "#F7F7F2", "#B2182B"]) {
    assert.match(brand, new RegExp(endpoint));
  }
  assert.match(charts, /const BLUE = SCIENTIFIC_SURFACE_COLORS\.belowThreshold/);
  assert.match(charts, /const WHITE = SCIENTIFIC_SURFACE_COLORS\.threshold/);
  assert.match(charts, /const RED = SCIENTIFIC_SURFACE_COLORS\.aboveThreshold/);
  assert.match(charts, /<stop offset="0" stop-color="\$\{BLUE\}"\/>/);
  assert.match(charts, /<stop offset="0\.606" stop-color="\$\{WHITE\}"\/>/);
  assert.match(charts, /<stop offset="1" stop-color="\$\{RED\}"\/>/);
});

test("fonts remain data-url bundled on screen and in exported SVG", () => {
  assert.match(brand, /import notoSansLatin from "\.\.\/assets\/fonts\/noto-sans-latin\.woff2"/);
  assert.match(brand, /import notoSerifLatin from "\.\.\/assets\/fonts\/noto-serif-latin\.woff2"/);
  assert.match(brand, /font-family:"Noto Sans"/);
  assert.match(brand, /font-family:"Noto Serif"/);
  assert.match(brand, /format\("woff2"\)/);
  assert.match(app, /brandFontFaceCss\(\)/);
  assert.match(app, /installBrandFonts\(document\)/);
  assert.match(build, /loader: \{ "\.woff2": "dataurl" \}/);
  assert.match(build, /font-src data:/);
});
