# Gates-aligned independent visual revision -- 2026-07-21

## Decision purpose

Improve the teaching-first prototype's legibility and visual hierarchy while
keeping its independent identity and every v1 scientific interpretation
unchanged. This is presentation work, not evidence of Gates Foundation
sponsorship, ownership, or endorsement.

## Requested output

Apply the published Gates visual palette and Noto typography to the
self-contained browser artifact. Preserve the existing red--near-white--blue
`R_loc` scientific decision scale exactly; apply the data palette only to
non-surface scientific marks. Screen and standalone SVG export must use the
same font and color roles with no runtime requests.

## Contract surface

- Relevant `DESIGN_CONTRACT.md` surfaces: locked v1 scope, presentation and
  export requirements, release-artifact determinism, and the Section 14.6
  direct-implementation record requirement.
- Files: `src/styles.css`, `src/ui/charts.ts`, `src/ui/brand.ts`,
  `src/app.ts`, `scripts/build.mjs`, `scripts/browser-smoke.mjs`, and focused
  UI tests.
- Unchanged: decision-rule and model versions, URL state, export schemas,
  equations, defaults, named settings, axes, labels, red--near-white--blue
  `R_loc` endpoint colors, and story order.
- Out of scope: Gates logo, monogram, Gate device, photography, affiliation
  language, model recalibration, biological interpretation, and any design
  contract amendment.

## Scientific/data invariants

- The fixed `R_loc` display scale remains `#2166AC -> #F7F7F2 -> #B2182B`,
  with `R_loc = 1` at its midpoint. It is intentionally a scientific-contract
  exception to the interface palette.
- Data lines are distinguishable without color: reference remains dashed and
  directly labeled; candidate remains solid and directly labeled; the Pareto
  boundary is directly labeled; selection marks retain shape, position, and
  text cues.
- This revision cannot change any numerical output, classification, state
  serialization, or exported scientific record.

## Acceptance criteria and verification

- Core colors: Parchment `#F5F3ED`, Weathered Slate `#313A44`, Blooming
  Saffron `#EBCB00`, White `#FFFFFF`, and Dark Blue `#12236D` focus.
- Other scientific marks: Medium Orange `#F85C02` reference, Dark Magenta
  `#6C1446` selected cohort, Dark Turquoise `#295958` Pareto, Dark Blue
  `#12236D` reference/held-selection, and Dark Orange `#9B320D` hybrid.
- Noto Sans and Noto Serif WOFF2 assets plus the SIL Open Font License are
  bundled as data URLs and embedded in standalone SVG exports.
- Focused UI tests and Chromium smoke assert color endpoints, inline fonts,
  contrast, grayscale discriminators, keyboard/touch/print modes, no external
  requests, and no Foundation identity claims.
- Rebuild the single-file artifact twice, record the deterministic hash, and
  run `npm run verify`.

## Boundaries

This repository remains a deterministic v1 computational public-health model.
No wet-lab work, sequence design, pathogen optimization, biological endpoint
change, or new safety claim is requested or implied.
