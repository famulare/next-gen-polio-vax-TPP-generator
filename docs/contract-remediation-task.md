# Contract-grounded task brief: post-review remediation

## Decision purpose

Restore one auditable meaning for each v1 result before anyone uses the tool to
reason about a product target. The tool must report a selected-setting probe
separately from the authoritative maximum over the selected envelope. Neither
quantity is a complete population reproduction number.

## Requested output

Repair the current prototype so that:

- the source-shaped index -> household -> social episode calculation preserves
  conditional shedding, shedding survival, infection day, and bin-specific
  first-infection incidence;
- fixed product and named-setting identities cannot be mutated through URL
  state;
- the selected-setting result and envelope maximum are distinct model outputs;
- the 51 x 51 frontier always describes the hypothetical OPV-like design
  family, with Sabin 2 and IPV retained as fixed comparator points;
- invalid or unsupported envelope state fails before calculation;
- the UI, exports, and release copy expose the same meanings and clearly label
  all numerical output as prototype output pending source parity and
  calibration; and
- focused regression tests and the existing release checks cover the repaired
  behavior.

This task does not claim to complete the remaining Section 15.1 R/Matlab
direct-port grids or the uncertainty ensemble. The Section 15.2
faithful-modernization prevalence calibration report is versioned separately.

## Contract surface

- Relevant `DESIGN_CONTRACT.md` sections: 2; 4; 6.2; 7.4 and 7.7; 8.3;
  9.2-9.5; 10.1-10.3; 11.2-11.5; 12.4; 13; 14.3-14.5; 15; 16; 17; 18.
- Runtime files: `src/model/types.ts`, `src/model/serialization.ts`,
  `src/model/schedule.ts`, `src/model/shedding.ts`,
  `src/model/transmission.ts`, `src/model/metrics.ts`,
  `src/model/frontier.ts`, `src/model/model.ts`, `src/app.ts`, and
  `src/styles.css`.
- Manifests and sources: `src/data/*.json`; the pinned India R kernels at
  `1e3e832742e84a36fbc75d81b3a2d19cde8208e6`; and the pinned cessation
  Matlab motif at `3d779963e9febe8e6262964b185c8277234f41e0`.
- Verification/release files: `tests/model/model.test.ts`,
  `scripts/generate-reference-fixtures.R`, artifact/browser scripts, README,
  implementation log, and the contract-review record.
- Locked meanings: WPV1 parameters, schedules, units, anchors, success
  threshold/tie tolerance, uncertainty absence, and the close-contact
  qualification remain unchanged.
- Out of scope: new biological pathways, population transmission, wet-lab or
  sequence work, unapproved refitting, invented uncertainty, and any
  tolerance/default change. The design-contract 1.4 India joint calibration
  refit is the sole approved exception.

## Scientific/data invariants

- Shedding survival is applied outside the nonlinear dose-response calculation;
  the dose-response receives conditional concentration among shedders.
- First-infection incidence retains infection day and recipient immunity bin;
  the next link cannot silently reset every source cohort to day zero.
- Probability mass is conserved and incidence probabilities remain in `[0,1]`.
- Zero exposure or contacts gives selected-setting `R_loc = 0`.
- Changing a custom selected setting changes only its probe, not the separately
  declared envelope maximum.
- A named setting id resolves to its manifest values or is rejected.
- IPV and Sabin 2 resolve to their catalog definitions; hypothetical `sigma0`,
  `gamma`, formulation multiplier, identity label, and live status are fixed.
- Passing requires `R_loc < 1` outside the locked `1e-9` threshold tie band.
- The frontier mutates only hypothetical take and boost; comparator points do
  not become product families.
- Unsupported unlinked-envelope state and nonpositive log-grid bounds fail
  closed before model evaluation.

## Acceptance criteria and verification

- Add direct regression tests for malformed product and named-setting state,
  custom zero setting, selected-versus-envelope outputs, envelope validation,
  fixed-comparator/frontier separation, tie handling, and source-shaped
  infection-day/survival mechanics.
- Add or retain mass, monotonicity, deterministic-output, grid, URL, invalid
  state, and upper-95 fail-closed checks.
- Run `Rscript scripts/generate-reference-fixtures.R` and
  `npm run check:reference-fixtures` to confirm that the source-derived
  fixture manifest is reproducible, explicitly partial, and cannot be read as
  completed parity or calibration.
- Run `npm run typecheck`, `npm test`, `npm run build`,
  `npm run check:artifact`, `npm run verify`, a clean-rebuild diff, and an Edge
  interaction pass including narrow viewport and invalid URL behavior.
- Rebuild and inspect `dist/index.html`; update export coverage and the app
  version/commit/prototype disclosure.
- Residual limitation: no release eligibility or source-validated numerical
  conclusion until Section 15.1 is satisfied with reviewed direct-port
  coverage and a reviewed uncertainty ensemble is available.

## Boundaries

This is contract-defined deterministic public-health model and interface work.
If the source comparison reveals that the locked contract does not determine a
scientific choice, stop that change for a contract amendment rather than hide
the choice in an implementation fallback.
