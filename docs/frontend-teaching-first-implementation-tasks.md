# Teaching-first frontend implementation tasks

**Status:** complete and release-verified on 2026-07-21 under
`DESIGN_CONTRACT.md` version 1.8.

**Decision purpose:** teach vaccine-development readers how the model connects
pre-exposure immunity, WPV acquisition, shedding, close-contact transmission,
and the direct `R_loc` criterion before presenting the candidate verdict.

**Relevant contract sections:** 1-3, 6-7, 9, 11, 13, 14.3-14.5, 15.3,
15.6, 17, and 18.

**Scientific invariants:** preserve distribution-native conditioning; retain
the one-WPV-HID50 index reference; distinguish vaccine take from WPV
acquisition and dose receipt; derive conditional concentration and burden from
the joint survival-intensity expectation; keep `q_index` diagnostic and direct
`R_loc_max < 1` authoritative; do not change equations, defaults, calibration,
uncertainty semantics, or fixed comparators.

**Boundaries:** no new dependency, runtime request, free-form parameter lab,
biological endpoint, alternate success rule, or population-spread model.

## Task 0 -- lock and checkpoint the amended contract

- [x] Lock contract version 1.8 after Mike's review.
- [x] Mark the prior redesign plan and task list as historical.
- [x] Create this bounded implementation checklist.

**Gate:** documentation has no internal ordering or status contradiction and
`git diff --check` passes.

## Task 1 -- add the diagnostic model contract

- [x] Version the design-contract identity and add a committed diagnostic grid.
- [x] Add strict `DiagnosticGridV1` and `WithinHostDiagnosticsV1` types.
- [x] Compute naive-reference and selected vaccinated-cohort acquisition curves.
- [x] Compute breakthrough-conditioned shedding survival, conditional
  concentration, daily joint burden, integrated burden, and immunity
  distributions through the pure-model boundary.
- [x] Serialize and validate every diagnostic field with explicit units,
  conditioning, grids, and identities.
- [x] Add kernel-agreement, mass, monotonicity, conditioning, and identity tests.

**Gate:** focused typecheck/model/schema tests pass; existing direct `R_loc`,
frontier, anchor, and comparator fixtures are unchanged.

## Task 2 -- build the teaching-first narrative shell

- [x] Replace the opening verdict with the UP/Bihar reference setting and
  reference-to-vaccinated cohort transition.
- [x] Implement the four causal panels: acquisition, duration, concentration,
  and shedding-index synthesis.
- [x] Add the product take/boost/schedule sequence and schedule-derived immunity
  distribution before exposing its controls.
- [x] Build the transmission sequence through index, household, and social
  contacts before defining `R_loc`.
- [x] Move the direct result and setting surface after the transmission lesson.
- [x] Move the measurement/provenance map before the linked Pareto maps.

**Gate:** static DOM order alone teaches the model correctly; no pass/fail
verdict appears before the `R_loc` step; 360 px and print remain coherent.

## Task 3 -- connect controls and transaction state

- [x] Reveal controls only after their semantics are introduced.
- [x] Keep product/schedule, setting probe, and decision scope separate.
- [x] Recompute all diagnostics atomically with the existing scientific state.
- [x] Keep reveal/scroll/focus/hover state out of scientific and export identity.
- [x] Preserve stale/invalid fail-closed behavior and explicit promotion of a
  held product design.

**Gate:** URL/cache invalidation and transaction tests pass for every scientific
control; view-only actions do not change model or export identity.

## Task 4 -- update accessibility and exports

- [x] Give every panel an accessible text alternative, exact readout, units,
  conditioning, and reference/candidate labels.
- [x] Support keyboard, focus, hover, touch, reduced motion, and no-animation
  reading in the same narrative order.
- [x] Include diagnostic schema/grid identities and values in JSON and
  standalone teaching-figure SVG exports.
- [x] Keep CSV scientific grids stable unless a separately labeled diagnostic
  record family is required and reviewed.

**Gate:** browser smoke covers DOM order, labels, interactions, exports,
responsive layout, print, contrast, and the absence of runtime requests.

## Task 5 -- release verification

- [x] Update README and `IMPLEMENTATION_LOG.md` with the new narrative and
  scientific distinctions.
- [x] Run focused checks after each layer and final `npm run verify`.
- [x] Build twice and confirm byte-identical output and a clean generated diff.
- [x] Review the live artifact visually before replacing the deployed version.
- [x] Record final build identity and artifact hash.

**Release gate:** every amended Section 17 item passes; no diagnostic is
misrepresented as a measurement or decision rule; the committed artifact is
self-contained and reproducible.

## Completion record

- `WithinHostDiagnosticsV1` now records diagnostic and source schema versions,
  parameter-manifest version, model identity, units, conditioning, reference
  challenge, age, absolute reference-dose shedding indices, and the committed
  grids. Validation rejects stale grid coordinates and mismatched scientific
  identity or reference metadata.
- The four-panel lesson marks one WPV HID50, states the concentration panel's
  assessment age and assay floor, and presents both conditional burden `B` and
  the absolute `P(acquisition | d) * B` index alongside `q_acq`, `q_shed`, and
  `q_index`.
- Browser smoke compares the exported browser diagnostic grids exactly with a
  Node projection, and checks the first-viewport cohort comparison, panel
  labels/conditioning, point-of-use product controls, UP/Bihar link semantics,
  measurement map, linked-map decomposition, and standalone SVG diagnostic
  payload.
- `npm run verify` passed with 46 model tests. The final deterministic build is
  `source-f7a3509765187ea7`; its committed artifact SHA-256 is
  `c72ebb3f3bfaaf372fbc5722834fb66214e1405b773bb6b8f7004d4de892c7a2`.
